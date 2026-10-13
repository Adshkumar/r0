import { useState, useEffect, useCallback, useMemo } from 'react';
import { GitBranch, GitCommitHorizontal, RefreshCw, ChevronRight } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useToast } from './ui/Toast';
import {
  getStatusFiles, getGitHistory, gitCommit, gitCommitPush, invalidateGitCache,
  type StatusFile, type GitHistoryCommit,
} from '../lib/git';

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
  const lanes: string[] = [];
  const positions = new Map<string, GraphPosition>();
  commits.forEach(commit => {
    let lane = lanes.indexOf(commit.hash);
    if (lane < 0) {
      lane = lanes.indexOf('');
      if (lane < 0) lane = lanes.length;
      lanes[lane] = commit.hash;
    }
    positions.set(commit.hash, { lane });
    if (commit.parents.length) {
      let firstParentLane = lanes.indexOf(commit.parents[0]);
      if (firstParentLane < 0) {
        lanes[lane] = commit.parents[0];
        firstParentLane = lane;
      } else {
        lanes.splice(lane, 1);
        if (firstParentLane > lane) firstParentLane -= 1;
      }
      for (const parent of commit.parents.slice(1)) {
        if (!lanes.includes(parent)) lanes.splice(firstParentLane + 1, 0, parent);
      }
    } else {
      lanes.splice(lane, 1);
    }
  });
  return { positions, laneCount: Math.max(1, ...Array.from(positions.values(), point => point.lane + 1)) };
}

interface Props {
  onOpenCommit: (hash: string) => void;
  onOpenWorkingDiff: (file: StatusFile) => void;
  selectedCommitHash: string | null;
}

export default function SourceTreePanel({ onOpenCommit, onOpenWorkingDiff, selectedCommitHash }: Props) {
  const { folderPath } = useWorkspace();
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
  const currentRepository = repositoryState?.rootPath === folderPath ? repositoryState : null;
  const files = currentRepository?.files ?? [];
  const history = currentRepository?.history ?? EMPTY_HISTORY;
  const historyError = currentRepository?.error ?? null;
  const hasOlderHistory = currentRepository?.hasOlderHistory ?? false;
  const loadingHistory = !!folderPath && currentRepository === null;

  const load = useCallback(async () => {
    if (!folderPath) return { files: [], history: [] as GitHistoryCommit[] };
    const [f, h] = await Promise.all([
      getStatusFiles(folderPath),
      getGitHistory(folderPath, 0, HISTORY_PAGE_SIZE),
    ]);
    setRepositoryState({
      rootPath: folderPath,
      files: f,
      history: h,
      hasOlderHistory: h.length === HISTORY_PAGE_SIZE,
      error: null,
    });
    setSelectedDate(date => date && h.some(commit => localDay(commit.author_time) === date) ? date : null);
    return { files: f, history: h };
  }, [folderPath]);

  useEffect(() => {
    let current = true;
    if (!folderPath) return;
    Promise.all([
      getStatusFiles(folderPath),
      getGitHistory(folderPath, 0, HISTORY_PAGE_SIZE),
    ]).then(([f, h]) => {
      if (!current) return;
      setRepositoryState({
        rootPath: folderPath,
        files: f,
        history: h,
        hasOlderHistory: h.length === HISTORY_PAGE_SIZE,
        error: null,
      });
      setSelectedDate(date => date && h.some(commit => localDay(commit.author_time) === date) ? date : null);
    }).catch(reason => {
      if (current) setRepositoryState({
        rootPath: folderPath,
        files: [],
        history: [],
        hasOlderHistory: false,
        error: String(reason),
      });
    });
    return () => { current = false; };
  }, [folderPath]);

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
              onClick={() => onOpenWorkingDiff(f)}
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
            <div style={{ position: 'relative' }}>
              {graphSvg}
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
                      onClick={() => onOpenCommit(commit.hash)}
                      title={`${commit.subject}\n${commit.hash}\n${commit.parents.length > 1 ? `${commit.parents.length} parents` : ''}`}
                      style={{ height: 48, width: '100%', display: 'flex', alignItems: 'center', padding: `0 7px 0 ${graphWidth + 5}px`, position: 'relative', zIndex: 1, border: 0, borderBottom: '1px solid color-mix(in srgb, var(--r0-border-default) 45%, transparent)', background: selectedCommitHash === commit.hash ? 'var(--r0-bg-active)' : 'transparent', textAlign: 'left', cursor: 'pointer' }}
                      onMouseEnter={e => { if (selectedCommitHash !== commit.hash) e.currentTarget.style.background = 'var(--r0-bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = selectedCommitHash === commit.hash ? 'var(--r0-bg-active)' : 'transparent'; }}
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
