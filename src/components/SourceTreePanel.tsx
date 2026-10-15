import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GitBranch, GitCommitHorizontal, RefreshCw, ChevronRight } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useToast } from './ui/Toast';
import {
  getGitCommitDetails,
  getGitHubCommitAuthorAvatar,
  getGitRemoteUrl,
  getStatusFiles, getGitHistory, gitCommit, gitCommitPush, invalidateGitCache, onGitRepositoryChanged,
  type GitCommitDetails, type GitHubCommitAuthorAvatar, type StatusFile, type GitHistoryCommit,
} from '../lib/git';
import { calculatePopoverPosition, getGitHubAvatarUrl } from '../lib/githubAvatar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(raw: string): string {
  const s = raw.replace(/\s/g, '');
  if (s === '??' || s === 'U') return 'var(--r0-git-untracked)';
  if (s[0] === 'A') return 'var(--r0-git-added)';
  if (s[0] === 'M' || s[1] === 'M') return 'var(--r0-git-modified)';
  if (s[0] === 'D' || s[1] === 'D') return 'var(--r0-git-deleted)';
  if (s[0] === 'R') return 'var(--r0-accent-blue)';
  return 'var(--r0-fg-muted)';
}

function statusLabel(raw: string): string {
  if (raw === '??') return 'U';
  const s = raw.replace(/\s/g, '');
  return s[0] ?? '?';
}

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts.length > 2 ? parts.slice(-2).join('/') : p;
}

function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map(part => part[0]?.toUpperCase() ?? '').join('').slice(0, 2);
}

function githubCommitUrl(remoteUrl: string | null, hash: string): string | null {
  if (!remoteUrl || !hash) return null;
  const normalized = remoteUrl.trim();
  const candidates = [normalized, normalized.replace(/\.git$/, '')];
  const httpMatch = candidates.find(value => /^(https?:\/\/|git@)/.test(value));
  if (!httpMatch) return null;

  const githubMatch = httpMatch.match(/^(?:https?:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!githubMatch) return null;

  const [, owner, repo] = githubMatch;
  return `https://github.com/${owner}/${repo}/commit/${hash}`;
}

function coAuthorsFromMessage(message: string): string[] {
  return message
    .split(/\r?\n/)
    .map(line => line.match(/^Co-authored-by:\s*(.+?)\s*<[^>]+>\s*$/i)?.[1])
    .filter((name): name is string => !!name);
}

function avatarDataUri(name: string): string {
  const label = initialsFromName(name || 'Unknown user');
  const safeName = (name || 'Unknown user').replace(/["'<>]/g, '');
  let hash = 0;
  for (let i = 0; i < safeName.length; i += 1) {
    hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const fill = `hsl(${hue} 62% 55%)`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${fill}" />
          <stop offset="100%" stop-color="hsl(${(hue + 28) % 360} 60% 46%)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="32" fill="url(#g)" />
      <text x="50%" y="54%" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="white">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// ── Panel ─────────────────────────────────────────────────────────────────────

const HISTORY_PAGE_SIZE = 100;
const GRAPH_COLORS = ['#4daafc', '#c586c0', '#89d185', '#e2c08d', '#f48771', '#d7ba7d'];
const EMPTY_HISTORY: GitHistoryCommit[] = [];

function localDay(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function branchLabel(ref: string): string {
  return ref.replace(/^origin\//, '');
}

interface GraphPosition { lane: number; }

function graphPositions(commits: GitHistoryCommit[]): { positions: Map<string, GraphPosition>; laneCount: number } {
  const positions = new Map<string, GraphPosition>();
  const laneLookup = new Map<string, number>();
  const occupiedLanes = new Map<number, string>();
  let laneCount = 1;

  const claimLane = (commitHash: string, preferredLane?: number) => {
    let lane = typeof preferredLane === 'number' ? preferredLane : 0;
    if (typeof preferredLane !== 'number' || occupiedLanes.has(lane)) {
      lane = 0;
      while (occupiedLanes.has(lane)) lane += 1;
    }
    occupiedLanes.set(lane, commitHash);
    laneLookup.set(commitHash, lane);
    laneCount = Math.max(laneCount, lane + 1);
    return lane;
  };

  for (const commit of [...commits].reverse()) {
    const parentLanes = commit.parents
      .map(parent => laneLookup.get(parent))
      .filter((lane): lane is number => lane !== undefined);

    let lane: number | undefined;
    if (parentLanes.length > 0) {
      const primaryParentLane = parentLanes[0];
      const owner = occupiedLanes.get(primaryParentLane);
      if (!owner || owner === commit.parents[0]) {
        lane = primaryParentLane;
      }
    }

    if (lane === undefined) {
      lane = claimLane(commit.hash);
    } else {
      occupiedLanes.set(lane, commit.hash);
      laneLookup.set(commit.hash, lane);
      laneCount = Math.max(laneCount, lane + 1);
    }
    positions.set(commit.hash, { lane });
  }

  for (const commit of commits) {
    const lane = laneLookup.get(commit.hash);
    if (lane !== undefined) positions.set(commit.hash, { lane });
  }

  return { positions, laneCount: Math.max(1, laneCount) };
}

interface Props {
  onOpenCommit: (hash: string, rootPath: string) => void;
  onOpenWorkingDiff: (file: StatusFile, rootPath: string) => void;
  selectedCommitHash: string | null;
}

export default function SourceTreePanel({ onOpenCommit, onOpenWorkingDiff, selectedCommitHash }: Props) {
  const { folderPath: defaultRoot, workspaceRoots } = useWorkspace();
  const [selectedRoot, setSelectedRoot] = useState(defaultRoot);
  const folderPath = selectedRoot && workspaceRoots.includes(selectedRoot) ? selectedRoot : defaultRoot;
  const [repositoryState, setRepositoryState] = useState<{
    rootPath: string;
    files: StatusFile[];
    history: GitHistoryCommit[];
    hasOlderHistory: boolean;
    error: string | null;
  } | null>(null);
  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [busy, setBusy]         = useState(false);
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hoveredCommit, setHoveredCommit] = useState<{ hash: string } | null>(null);
  const [hoverDetails, setHoverDetails] = useState<GitCommitDetails | null>(null);
  const [hoverError, setHoverError] = useState<{ hash: string; message: string } | null>(null);
  const [authorAvatar, setAuthorAvatar] = useState<{
    hash: string;
    value: GitHubCommitAuthorAvatar | null;
  } | null>(null);
  const [authorAvatarError, setAuthorAvatarError] = useState<{ hash: string; message: string } | null>(null);
  const [hoverCardPosition, setHoverCardPosition] = useState<{ left: number; top: number } | null>(null);
  const [remoteState, setRemoteState] = useState<{ path: string; url: string | null } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hoverCardRef = useRef<HTMLDivElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const hoverTargetRef = useRef<HTMLButtonElement | null>(null);
  const hoverRowActiveRef = useRef(false);
  const hoverCardActiveRef = useRef(false);
  const loadRevisionRef = useRef(0);
  const currentRepository = repositoryState?.rootPath === folderPath ? repositoryState : null;
  const files = currentRepository?.files ?? [];
  const history = currentRepository?.history ?? EMPTY_HISTORY;
  const historyError = currentRepository?.error ?? null;
  const hasOlderHistory = currentRepository?.hasOlderHistory ?? false;
  const loadingHistory = !!folderPath && currentRepository === null;
  const remoteUrl = remoteState?.path === folderPath ? remoteState.url : null;
  const hoveredHash = hoveredCommit?.hash;

  const load = useCallback(async () => {
    if (!folderPath) return { files: [], history: [] as GitHistoryCommit[] };
    const revision = ++loadRevisionRef.current;
    const rootPath = folderPath;
    const [f, h] = await Promise.all([
      getStatusFiles(folderPath),
      getGitHistory(folderPath, 0, HISTORY_PAGE_SIZE),
    ]);
    if (revision === loadRevisionRef.current) {
      setRepositoryState({
        rootPath,
        files: f,
        history: h,
        hasOlderHistory: h.length === HISTORY_PAGE_SIZE,
        error: null,
      });
      setSelectedDate(date => date && h.some(commit => localDay(commit.author_time) === date) ? date : null);
    }
    return { files: f, history: h };
  }, [folderPath]);

  useEffect(() => {
    let current = true;
    if (!folderPath) return;
    void load().catch(reason => {
      if (current) setRepositoryState(previous => previous?.rootPath === folderPath
        ? { ...previous, error: String(reason) }
        : { rootPath: folderPath, files: [], history: [], hasOlderHistory: false, error: String(reason) });
    });
    return () => { current = false; };
  }, [folderPath, load]);

  useEffect(() => onGitRepositoryChanged(event => {
    if (event.path.toLowerCase() !== folderPath?.toLowerCase()) return;
    void load().catch(reason => {
      showToast(`Git operation completed, but repository state could not be refreshed: ${String(reason)}`, 'error');
    });
  }), [folderPath, load, showToast]);

  async function refresh() {
    if (!folderPath || refreshing) return;
    setRefreshing(true);
    try {
      invalidateGitCache(folderPath);
      const result = await load();
      const f = result?.files ?? [];
      const h = result?.history ?? [];
      showToast(
        `${f.length} change${f.length !== 1 ? 's' : ''} · ${h.length} commit${h.length !== 1 ? 's' : ''}`,
        'info',
      );
    } catch (error: unknown) {
      showToast(`Failed to refresh Git data: ${String(error)}`, 'error');
    } finally {
      setRefreshing(false);
    }
  }

  async function loadOlder() {
    if (!folderPath || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const older = await getGitHistory(folderPath, history.length, HISTORY_PAGE_SIZE);
      const rootPath = folderPath;
      setRepositoryState(current => {
        if (!current || current.rootPath !== rootPath) return current;
        const known = new Set(current.history.map(commit => commit.hash));
        return {
          ...current,
          history: [...current.history, ...older.filter(commit => !known.has(commit.hash))],
          hasOlderHistory: older.length === HISTORY_PAGE_SIZE,
        };
      });
    } catch (e: unknown) {
      showToast(`Failed to load Git history: ${String(e)}`, 'error');
    } finally {
      setLoadingOlder(false);
    }
  }

  async function commit(andPush: boolean) {
    if (!folderPath || !title.trim() || busy) return;
    setBusy(true);
    try {
      if (andPush) {
        await gitCommitPush(folderPath, title.trim(), desc.trim());
      } else {
        await gitCommit(folderPath, title.trim(), desc.trim());
      }
      setTitle('');
      setDesc('');
      showToast(andPush ? 'Committed and pushed.' : 'Committed successfully.', 'success');
      await load();
    } catch (e: unknown) {
      showToast(String(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const canCommit = title.trim().length > 0 && !busy;
  const filteredHistory = useMemo(
    () => selectedDate
      ? history.filter(commit => localDay(commit.author_time) === selectedDate)
      : history,
    [history, selectedDate],
  );
  const groupedHistory = useMemo(() => Array.from(
    filteredHistory.reduce((groups, commit) => {
      const day = localDay(commit.author_time);
      const group = groups.get(day) ?? [];
      group.push(commit);
      groups.set(day, group);
      return groups;
    }, new Map<string, GitHistoryCommit[]>()),
  ), [filteredHistory]);
  const graph = useMemo(() => graphPositions(history), [history]);
  const { visibleCommitY, graphHeight } = useMemo(() => {
    const visibleCommitY = new Map<string, number>();
    let graphHeight = 0;
    for (const [, commits] of groupedHistory) {
      graphHeight += 24;
      for (const commit of commits) {
        visibleCommitY.set(commit.hash, graphHeight + 24);
        graphHeight += 48;
      }
    }
    return { visibleCommitY, graphHeight };
  }, [groupedHistory]);
  useEffect(() => {
    if (!hoveredCommit || !folderPath) return;
    const hash = hoveredCommit.hash;
    let active = true;
    getGitCommitDetails(folderPath, hash, null)
      .then(details => {
        if (active) {
          setHoverDetails(details);
          setHoverError(current => current?.hash === hash ? null : current);
        }
      })
      .catch(reason => {
        if (active) setHoverError({ hash, message: String(reason) });
      });
    return () => { active = false; };
  }, [folderPath, hoveredCommit]);

  useEffect(() => {
    if (!folderPath) return;
    let active = true;
    getGitRemoteUrl(folderPath)
      .then(url => {
        if (active) setRemoteState({ path: folderPath, url });
      })
      .catch(() => {
        if (active) setRemoteState({ path: folderPath, url: null });
      });
    return () => { active = false; };
  }, [folderPath]);

  useEffect(() => {
    if (!hoveredHash || !remoteUrl || !githubCommitUrl(remoteUrl, hoveredHash)) return;
    const hash = hoveredHash;
    let active = true;
    getGitHubCommitAuthorAvatar(remoteUrl, hash)
      .then(value => {
        if (active) {
          setAuthorAvatar({ hash, value });
          setAuthorAvatarError(current => current?.hash === hash ? null : current);
        }
      })
      .catch(reason => {
        if (active) setAuthorAvatarError({ hash, message: String(reason) });
      });
    return () => { active = false; };
  }, [hoveredHash, remoteUrl]);

  useEffect(() => () => {
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
    if (hoverCloseTimerRef.current !== null) window.clearTimeout(hoverCloseTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!hoveredCommit || !hoverTargetRef.current || !hoverCardRef.current) {
      setHoverCardPosition(null);
      return;
    }

    const updatePosition = () => {
      const target = hoverTargetRef.current;
      const card = hoverCardRef.current;
      if (!target?.isConnected || !card) return;
      const targetRect = target.getBoundingClientRect();
      setHoverCardPosition(calculatePopoverPosition({
        targetRect,
        cardWidth: card.getBoundingClientRect().width,
        cardHeight: card.getBoundingClientRect().height,
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
        gap: 12,
        padding: 8,
      }));
    };

    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(hoverCardRef.current);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [hoveredCommit, hoverDetails, hoverError, remoteUrl]);
  const laneStep = graph.laneCount > 1 ? Math.min(9, 68 / (graph.laneCount - 1)) : 0;
  const graphWidth = 16 + Math.max(0, graph.laneCount - 1) * laneStep;
  const graphSvg = useMemo(() => (
    <svg
      aria-hidden="true"
      width={graphWidth}
      height={graphHeight}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      {filteredHistory.flatMap(commit => {
        const position = graph.positions.get(commit.hash);
        const fromY = visibleCommitY.get(commit.hash);
        if (!position || fromY === undefined) return [];
        const fromX = 8 + position.lane * laneStep;
        return [
          ...commit.parents.flatMap((parent, index) => {
            const parentPosition = graph.positions.get(parent);
            const toY = visibleCommitY.get(parent);
            if (!parentPosition || toY === undefined) return [];
            const toX = 8 + parentPosition.lane * laneStep;
            const midY = (fromY + toY) / 2;
            return [<path key={`${commit.hash}:${parent}`} d={`M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`} fill="none" stroke={GRAPH_COLORS[(position.lane + index) % GRAPH_COLORS.length]} strokeWidth="1.5" />];
          }),
          <circle key={`${commit.hash}:node`} cx={fromX} cy={fromY} r={commit.is_head ? 4 : 3.2} fill={GRAPH_COLORS[position.lane % GRAPH_COLORS.length]} stroke="var(--r0-bg-sidebar)" strokeWidth="1.5" />,
        ];
      })}
    </svg>
  ), [filteredHistory, graph.positions, visibleCommitY, graphWidth, graphHeight, laneStep]);
  const hoveredHistoryCommit = hoveredCommit
    ? history.find(commit => commit.hash === hoveredCommit.hash) ?? null
    : null;
  const currentHoverDetails = hoveredCommit && hoverDetails?.hash === hoveredCommit.hash
    ? hoverDetails
    : null;
  const currentHoverError = hoveredCommit && hoverError?.hash === hoveredCommit.hash
    ? hoverError.message
    : null;
  const currentAuthorAvatar = hoveredCommit && authorAvatar?.hash === hoveredCommit.hash
    ? authorAvatar.value
    : null;
  const currentAuthorAvatarError = hoveredCommit && authorAvatarError?.hash === hoveredCommit.hash
    ? authorAvatarError.message
    : null;
  const hoverCard = hoveredCommit && (currentHoverDetails ?? {
    hash: hoveredCommit.hash,
    parents: hoveredHistoryCommit?.parents ?? [],
    comparison_parent: null,
    message: hoveredHistoryCommit?.subject ?? '',
    author: hoveredHistoryCommit?.author ?? '',
    author_email: hoveredHistoryCommit?.author_email ?? '',
    author_time: hoveredHistoryCommit?.author_time ?? 0,
    committer: '',
    committer_email: '',
    committer_time: 0,
    refs: hoveredHistoryCommit?.refs ?? [],
    files: [],
  });

  if (!folderPath) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <p style={{ fontSize: 12, color: 'var(--r0-fg-subtle)', textAlign: 'center', lineHeight: 1.5 }}>
          Open a folder to use source control
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
      {workspaceRoots.length > 1 && (
        <div style={{ padding: '8px 8px 0' }}>
          <select
            value={folderPath ?? ''}
            onChange={event => setSelectedRoot(event.target.value)}
            aria-label="Git repository"
            style={{ width: '100%', padding: '4px 6px', background: 'var(--r0-bg-base)', color: 'var(--r0-fg-default)', border: '1px solid var(--r0-border-default)', borderRadius: 4, fontSize: 11 }}
          >
            {workspaceRoots.map(root => (
              <option key={root} value={root}>{root.split(/[\\/]/).filter(Boolean).pop() ?? root}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Top half: commit form + changes ─────────────────────────────────── */}
      <div style={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

      {/* ── Commit form ─────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '10px 8px 8px' }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && commit(false)}
          placeholder="Commit message"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--r0-bg-base)',
            border: '1px solid var(--r0-border-default)',
            borderRadius: 5, padding: '5px 8px', marginBottom: 5,
            fontSize: 12, color: 'var(--r0-fg-default)',
            fontFamily: 'var(--font-sans)', outline: 'none',
          }}
        />
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'none',
            background: 'var(--r0-bg-base)',
            border: '1px solid var(--r0-border-default)',
            borderRadius: 5, padding: '5px 8px', marginBottom: 7,
            fontSize: 12, color: 'var(--r0-fg-default)',
            fontFamily: 'var(--font-sans)', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            onClick={() => commit(false)}
            disabled={!canCommit}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 5, border: 'none',
              cursor: canCommit ? 'pointer' : 'not-allowed',
              background: canCommit ? 'var(--r0-bg-active)' : 'var(--r0-bg-hover)',
              color: canCommit ? 'var(--r0-fg-default)' : 'var(--r0-fg-subtle)',
              fontSize: 12, fontFamily: 'var(--font-sans)',
              transition: 'opacity 0.15s',
            }}
          >
            {busy ? '…' : 'Commit'}
          </button>
          <button
            onClick={() => commit(true)}
            disabled={!canCommit}
            style={{
              flex: 1.5, padding: '5px 0', borderRadius: 5, border: 'none',
              cursor: canCommit ? 'pointer' : 'not-allowed',
              background: canCommit ? 'var(--r0-semantic-success)' : 'var(--r0-bg-hover)',
              color: canCommit ? '#ffffff' : 'var(--r0-fg-subtle)',
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)',
              transition: 'opacity 0.15s',
            }}
          >
            {busy ? '…' : 'Commit & Push'}
          </button>
        </div>
      </div>

      {/* ── Changed files ────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid var(--r0-border-default)',
        flex: 1, overflowY: 'auto', minHeight: 0,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 8px 4px', position: 'sticky', top: 0, zIndex: 2,
          background: 'var(--r0-bg-sidebar)',
          borderBottom: '1px solid var(--r0-border-default)',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--r0-fg-subtle)',
          }}>
            Changes{files.length > 0 ? ` (${files.length})` : ''}
          </span>
          <button
            onClick={refresh}
            title="Refresh"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--r0-fg-subtle)', display: 'flex' }}
          >
            <RefreshCw size={10} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
          </button>
        </div>
        {files.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--r0-fg-subtle)' }}>
              No local changes
            </p>
          </div>
        ) : (
          files.map((f, i) => (
            <button
              key={`${f.path}:${i}`}
              onClick={() => onOpenWorkingDiff(f, folderPath)}
              title={`Open working-tree diff for ${f.path}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', width: '100%', border: 0, textAlign: 'left', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--r0-bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                color: statusColor(f.status), flexShrink: 0, width: 12, textAlign: 'center',
              }}>
                {statusLabel(f.status)}
              </span>
              <span style={{
                fontSize: 11, color: 'var(--r0-fg-default)', flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {shortPath(f.path)}
              </span>
              <GitBranch size={11} style={{ color: 'var(--r0-fg-subtle)', flexShrink: 0 }} />
            </button>
          ))
        )}
      </div>
      </div>{/* end top-half */}

      {/* ── Commit graph and date navigation ─────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--r0-border-default)', flex: '0 0 50%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flexShrink: 0, padding: '5px 8px 4px', background: 'var(--r0-bg-sidebar)', borderBottom: '1px solid var(--r0-border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <GitBranch size={11} color="var(--r0-fg-subtle)" />
            <span style={{ flex: 1, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--r0-fg-subtle)' }}>
              History{history.length > 0 ? ` (${history.length})` : ''}
            </span>
            {selectedDate && (
              <button onClick={() => setSelectedDate(null)} title="Clear date filter" style={{ padding: '2px 5px', fontSize: 9, color: 'var(--r0-accent-blue)', background: 'transparent', border: 0, cursor: 'pointer' }}>
                All dates
              </button>
            )}
            <button onClick={refresh} title="Refresh history and changes" disabled={refreshing} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--r0-fg-subtle)', display: 'flex' }}>
              <RefreshCw size={10} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
            </button>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 9, color: 'var(--r0-fg-subtle)' }}>Dates shown in local time</p>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {loadingHistory && history.length === 0 ? (
            <p style={{ padding: '8px 10px', fontSize: 11, color: 'var(--r0-fg-subtle)' }}>Loading Git history…</p>
          ) : historyError && history.length === 0 ? (
            <p style={{ padding: '8px 10px', fontSize: 11, color: 'var(--r0-semantic-error)', overflowWrap: 'anywhere' }}>{historyError}</p>
          ) : history.length === 0 ? (
            <p style={{ padding: '8px 10px', fontSize: 11, color: 'var(--r0-fg-subtle)' }}>No commits yet</p>
          ) : filteredHistory.length === 0 ? (
            <p style={{ padding: '8px 10px', fontSize: 11, color: 'var(--r0-fg-subtle)' }}>No commits on this date.</p>
          ) : (
            <div ref={panelRef} data-source-tree-root="true" style={{ position: 'relative' }}>
              {graphSvg}
              {hoveredCommit && hoverCard && createPortal(
                <div
                  ref={hoverCardRef}
                  style={{
                    position: 'fixed',
                    left: hoverCardPosition?.left ?? 0,
                    top: hoverCardPosition?.top ?? 0,
                    width: 'min(320px, calc(100vw - 24px))',
                    maxHeight: 'min(420px, calc(100vh - 16px))',
                    overflowY: 'auto',
                    zIndex: 1000,
                    borderRadius: 8,
                    background: 'var(--r0-bg-panel)',
                    border: '1px solid var(--r0-border-default)',
                    boxShadow: '0 14px 32px rgba(0,0,0,0.22)',
                    color: 'var(--r0-fg-default)',
                    pointerEvents: 'auto',
                    visibility: hoverCardPosition ? 'visible' : 'hidden',
                  }}
                  onMouseEnter={() => {
                    hoverCardActiveRef.current = true;
                    if (hoverCloseTimerRef.current !== null) {
                      window.clearTimeout(hoverCloseTimerRef.current);
                      hoverCloseTimerRef.current = null;
                    }
                  }}
                  onMouseLeave={() => {
                    hoverCardActiveRef.current = false;
                    if (!hoverRowActiveRef.current) {
                      hoverCloseTimerRef.current = window.setTimeout(() => {
                        if (!hoverRowActiveRef.current && !hoverCardActiveRef.current) {
                          setHoveredCommit(null);
                          hoverTargetRef.current = null;
                        }
                      }, 140);
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 8px' }}>
                    <img
                      src={currentAuthorAvatar?.avatar_url
                        ?? getGitHubAvatarUrl(hoverCard.author_email || '')
                        ?? avatarDataUri(hoverCard.author || hoverCard.author_email || 'Unknown user')}
                      alt={`Avatar of ${hoverCard.author || 'unknown author'}`}
                      onError={e => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.onerror = null;
                        target.src = avatarDataUri(hoverCard.author || hoverCard.author_email || 'Unknown user');
                      }}
                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--r0-border-default)', background: 'var(--r0-bg-hover)' }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hoverCard.author || 'Unknown author'}</div>
                      <div style={{ fontSize: 10, color: 'var(--r0-fg-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hoverCard.author_email || 'unknown@example.invalid'}</div>
                      {currentAuthorAvatar && (
                        <div style={{ fontSize: 9, color: 'var(--r0-fg-subtle)' }}>GitHub @{currentAuthorAvatar.login}</div>
                      )}
                    </div>
                  </div>
                  {currentAuthorAvatarError && (
                    <div style={{ padding: '0 10px 8px', fontSize: 9, color: 'var(--r0-fg-subtle)' }}>
                      Couldn’t verify a GitHub profile image; showing initials instead.
                    </div>
                  )}
                  <div style={{ padding: '0 10px 10px', display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {hoverCard.message?.trim() || (currentHoverError ? '(commit details unavailable)' : 'Loading commit details…')}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {hoverCard.refs.length > 0 ? hoverCard.refs.slice(0, 3).map(ref => (
                        <span key={ref} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 4, padding: '2px 6px', background: 'color-mix(in srgb, var(--r0-accent-blue) 16%, transparent)', color: 'var(--r0-accent-blue)', fontSize: 9 }}>
                          <GitBranch size={9} /> {branchLabel(ref)}
                        </span>
                      )) : <span style={{ fontSize: 9, color: 'var(--r0-fg-subtle)' }}>No refs</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '2px 8px', fontSize: 10, color: 'var(--r0-fg-subtle)' }}>
                      <span>Commit</span><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--r0-fg-default)' }}>{hoverCard.hash.slice(0, 8)}</span>
                      <span>Time</span><span>{new Date(hoverCard.author_time * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>Files</span><span>{currentHoverDetails ? hoverCard.files.length : 'Loading…'}</span>
                      {currentHoverDetails && (
                        <>
                          <span>Changes</span>
                          <span>
                            +{hoverCard.files.reduce((total, file) => total + (file.additions ?? 0), 0)}
                            {' / '}
                            -{hoverCard.files.reduce((total, file) => total + (file.deletions ?? 0), 0)}
                          </span>
                        </>
                      )}
                    </div>
                    {coAuthorsFromMessage(hoverCard.message).length > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--r0-fg-subtle)' }}>
                        Co-authored by {coAuthorsFromMessage(hoverCard.message).join(', ')}
                      </div>
                    )}
                    {remoteUrl && githubCommitUrl(remoteUrl, hoverCard.hash) && (
                      <a
                        href={githubCommitUrl(remoteUrl, hoverCard.hash) ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 10, color: 'var(--r0-accent-blue)', textDecoration: 'none' }}
                      >
                        Open on GitHub
                      </a>
                    )}
                    {currentHoverError && <div style={{ fontSize: 10, color: 'var(--r0-semantic-error)' }}>{currentHoverError}</div>}
                  </div>
                </div>,
                document.body,
              )}
              {groupedHistory.map(([day, commits]) => (
                <div key={day}>
                  <button
                    onClick={() => setSelectedDate(current => current === day ? null : day)}
                    title={`Show all commits from ${day} (local time)`}
                    style={{ height: 24, width: '100%', display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', position: 'relative', zIndex: 1, border: 0, borderBottom: '1px solid var(--r0-border-default)', background: selectedDate === day ? 'var(--r0-bg-active)' : 'var(--r0-bg-sidebar)', color: 'var(--r0-fg-muted)', textAlign: 'left', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <ChevronRight size={11} />
                    {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    <span style={{ marginLeft: 'auto', color: 'var(--r0-fg-subtle)', fontWeight: 400 }}>{commits.length}</span>
                  </button>
                  {commits.map(commit => (
                    <button
                      key={commit.hash}
                      onClick={() => onOpenCommit(commit.hash, folderPath)}
                      aria-label={`${commit.subject || '(no subject)'}, ${commit.hash}`}
                      style={{ height: 48, width: '100%', display: 'flex', alignItems: 'center', padding: `0 7px 0 ${graphWidth + 5}px`, position: 'relative', zIndex: 1, border: 0, borderBottom: '1px solid color-mix(in srgb, var(--r0-border-default) 45%, transparent)', background: selectedCommitHash === commit.hash ? 'var(--r0-bg-active)' : 'transparent', textAlign: 'left', cursor: 'pointer' }}
                      onMouseEnter={e => {
                        if (selectedCommitHash !== commit.hash) e.currentTarget.style.background = 'var(--r0-bg-hover)';
                        hoverRowActiveRef.current = true;
                        if (hoverCloseTimerRef.current !== null) {
                          window.clearTimeout(hoverCloseTimerRef.current);
                          hoverCloseTimerRef.current = null;
                        }
                        if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
                        const target = e.currentTarget;
                        hoverTargetRef.current = target;
                        if (hoveredCommit?.hash !== commit.hash) {
                          setHoveredCommit(null);
                          setHoverCardPosition(null);
                        }
                        hoverTimerRef.current = window.setTimeout(() => {
                          hoverTimerRef.current = null;
                          if (hoverRowActiveRef.current && target.isConnected) {
                            setHoveredCommit({ hash: commit.hash });
                          }
                        }, 120);
                      }}
                      onMouseMove={e => {
                        if (hoveredCommit?.hash === commit.hash) {
                          hoverTargetRef.current = e.currentTarget;
                        }
                      }}
                      onMouseLeave={e => {
                        hoverRowActiveRef.current = false;
                        if (hoverTimerRef.current !== null) {
                          window.clearTimeout(hoverTimerRef.current);
                          hoverTimerRef.current = null;
                        }
                        e.currentTarget.style.background = selectedCommitHash === commit.hash ? 'var(--r0-bg-active)' : 'transparent';
                        if (!hoverCardActiveRef.current) {
                          hoverCloseTimerRef.current = window.setTimeout(() => {
                            if (!hoverRowActiveRef.current && !hoverCardActiveRef.current) {
                              setHoveredCommit(current => current?.hash === commit.hash ? null : current);
                              hoverTargetRef.current = null;
                            }
                          }, 140);
                        }
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: 11, lineHeight: 1.35, color: 'var(--r0-fg-default)' }}>
                          {commit.is_head && <span style={{ color: 'var(--r0-accent-blue)', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>HEAD</span>}
                          <span style={{ flex: '1 1 0%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commit.subject || '(no subject)'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, marginTop: 2, fontSize: 9, color: 'var(--r0-fg-subtle)', whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{commit.hash.slice(0, 8)}</span>
                          <span>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{commit.author}</span>
                          <span>·</span><span>{new Date(commit.author_time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {commit.parents.length > 1 && <span title={`${commit.parents.length} parents`}>· merge</span>}
                        </div>
                        {commit.refs.length > 0 && (
                          <div style={{ display: 'flex', gap: 3, overflow: 'hidden', marginTop: 2 }}>
                            {commit.refs.slice(0, 2).map(ref => (
                              <span key={ref} title={ref} style={{ maxWidth: 82, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 3px', borderRadius: 3, background: 'color-mix(in srgb, var(--r0-accent-blue) 12%, transparent)', color: 'var(--r0-accent-blue)', fontSize: 8 }}>
                                {branchLabel(ref)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {commit.parents.length > 1 && <GitCommitHorizontal size={11} style={{ marginLeft: 4, color: 'var(--r0-fg-subtle)', flexShrink: 0 }} />}
                    </button>
                  ))}
                </div>
              ))}
              {hasOlderHistory && !selectedDate && (
                <button onClick={loadOlder} disabled={loadingOlder} style={{ width: '100%', padding: 8, border: 0, background: 'transparent', color: 'var(--r0-accent-blue)', fontSize: 10, cursor: loadingOlder ? 'wait' : 'pointer' }}>
                  {loadingOlder ? 'Loading older commits…' : 'Load older commits'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
