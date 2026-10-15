import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, File, Terminal, FolderOpen, FilePlus, PanelLeft,
  FileInput, GripHorizontal, Sun, Moon, Settings, Loader, AlignLeft, Globe,
  Save, SaveAll, X, RefreshCw,
} from 'lucide-react';
import { readDir, type FsEntry } from '../../lib/fs';
import { fileColor } from '../../lib/fileColors';
import { useFileIconTheme } from '../../lib/fileIconTheme';
import { searchInFiles, type SearchMatch } from '../../lib/search';
import { useTheme } from '../../themes/ThemeContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { canFormat } from '../../lib/formatting';
import type { Tab } from '../editor/TabBar';

// ── workspace walker ─────────────────────────────────────────────────────────

const IGNORE_DIRS = new Set([
  '.git', 'node_modules', 'target', '.next', 'dist', 'build',
  '.cache', '__pycache__', '.venv', 'venv', '.turbo', 'coverage',
  '.nuxt', 'out', '.parcel-cache', '.svelte-kit',
]);

interface WorkspaceFile { name: string; path: string; rel: string; }

async function walkDir(
  dir: string, base: string, depth: number, acc: WorkspaceFile[],
): Promise<void> {
  if (depth > 5) return;
  let entries: FsEntry[];
  try { entries = await readDir(dir); } catch { return; }
  await Promise.all(entries.map(e => {
    if (IGNORE_DIRS.has(e.name)) return;
    if (e.is_dir) return walkDir(e.path, base, depth + 1, acc);
    const rel = e.path.startsWith(base)
      ? e.path.slice(base.length).replace(/^[/\\]/, '').replace(/\\/g, '/')
      : e.path;
    acc.push({ name: e.name, path: e.path, rel });
  }));
}

function relativeToWorkspace(path: string, roots: string[]): string {
  const root = [...roots]
    .sort((a, b) => b.length - a.length)
    .find(candidate => path.toLowerCase().startsWith(candidate.toLowerCase().replace(/[/\\]+$/, '') + '\\')
      || path.toLowerCase().startsWith(candidate.toLowerCase().replace(/[/\\]+$/, '') + '/'));
  if (!root) return path;
  const rootName = root.split(/[\\/]/).filter(Boolean).pop() ?? root;
  return `${rootName}/${path.slice(root.length).replace(/^[/\\]/, '').replace(/\\/g, '/')}`;
}

// ── fuzzy ────────────────────────────────────────────────────────────────────

function fuzzyScore(q: string, target: string): number | null {
  if (!q) return 0;
  const ql = q.toLowerCase(), tl = target.toLowerCase();
  const idx = tl.indexOf(ql);
  if (idx !== -1) return idx;
  let qi = 0, score = 0;
  for (let i = 0; i < tl.length && qi < ql.length; i++) {
    if (tl[i] === ql[qi]) { score += i; qi++; }
  }
  return qi === ql.length ? score + 1000 : null;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const ql = query.toLowerCase(), tl = text.toLowerCase();
  const idx = tl.indexOf(ql);
  if (idx !== -1) return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: 'var(--r0-accent-blue)', fontWeight: 600 }}>
        {text.slice(idx, idx + ql.length)}
      </span>
      {text.slice(idx + ql.length)}
    </>
  );
  const nodes: React.ReactNode[] = [];
  let qi = 0;
  for (let i = 0; i < text.length; i++) {
    if (qi < ql.length && tl[i] === ql[qi]) {
      nodes.push(<span key={i} style={{ color: 'var(--r0-accent-blue)', fontWeight: 600 }}>{text[i]}</span>);
      qi++;
    } else { nodes.push(text[i]); }
  }
  return <>{nodes}</>;
}

// ── types ────────────────────────────────────────────────────────────────────

type ItemKind = 'open-file' | 'workspace-file' | 'command' | 'text-match';
interface PaletteItem {
  id: string; kind: ItemKind; label: string; detail?: string;
  icon: React.ReactNode; badge?: React.ReactNode;
  shortcut?: string; score: number; action: () => void;
}

// ── props ────────────────────────────────────────────────────────────────────

export interface CommandPaletteProps {
  initialQuery?: string;
  tabs: Tab[];
  onFileOpen: (path: string) => void;
  onFileOpenAtLine: (path: string, line: number) => void;
  onClose: () => void;
  onNewFile: () => void;
  onOpenFolder: () => void;
  onAddFolderToWorkspace: () => void;
  onReloadWindow: () => void;
  onOpenFile: () => void;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
  onOpenSettings: () => void;
  onOpenKeyboardShortcuts: () => void;
  onSave: () => void;
  onSaveAll: () => void;
  onCloseEditor: () => void;
  onSelectSidebarPanel: (panel: 'search' | 'sourcetree' | 'extensions') => void;
  activeFilePath: string | null;
  onOpenHtmlPreview: (path: string) => void;
  onFormatDocument: () => void;
  terminalOpen: boolean;
  sidebarOpen: boolean;
}

// ── component ────────────────────────────────────────────────────────────────

const PALETTE_W = 560;

export default function CommandPalette({
  initialQuery = '',
  tabs, onFileOpen, onFileOpenAtLine, onClose,
  onNewFile, onOpenFolder, onAddFolderToWorkspace, onReloadWindow, onOpenFile,
  onToggleSidebar, onToggleTerminal, onOpenSettings,
  onOpenKeyboardShortcuts, onSave, onSaveAll, onCloseEditor, onSelectSidebarPanel,
  activeFilePath, onOpenHtmlPreview, onFormatDocument,
  terminalOpen, sidebarOpen,
}: CommandPaletteProps) {
  const { workspaceRoots } = useWorkspace();
  const rootKey = workspaceRoots.join('\u0000');
  const roots = useMemo(() => rootKey ? rootKey.split('\u0000') : [], [rootKey]);
  const { theme, themes, setTheme } = useTheme();
  const fileIconTheme = useFileIconTheme();
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState(0);
  const [wsFiles, setWsFiles] = useState<WorkspaceFile[]>([]);
  const [textResults, setTextResults] = useState<SearchMatch[]>([]);
  const [textLoading, setTextLoading] = useState(false);
  const [pos, setPos] = useState(() => ({
    x: Math.round((window.innerWidth - PALETTE_W) / 2),
    y: Math.round(window.innerHeight * 0.22),
  }));

  const inputRef   = useRef<HTMLInputElement>(null);
  const listRef    = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const dragRef    = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Walk all workspace roots once for file search.
  useEffect(() => {
    let current = true;
    Promise.all(roots.map(async root => {
      const files: WorkspaceFile[] = [];
      await walkDir(root, root, 0, files);
      const rootName = root.split(/[\\/]/).filter(Boolean).pop() ?? root;
      return files.map(file => ({ ...file, rel: `${rootName}/${file.rel}` }));
    })).then(groups => { if (current) setWsFiles(groups.flat()); });
    return () => { current = false; };
  }, [roots]);

  // Text search — fires when query starts with '%'
  useEffect(() => {
    const isTextMode = query.startsWith('%');
    if (!isTextMode || roots.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- guard reset when not in text-search mode
      setTextResults([]);
      setTextLoading(false);
      return;
    }
    const textQuery = query.slice(1).trim();
    if (!textQuery) {
      setTextResults([]);
      setTextLoading(false);
      return;
    }
    setTextLoading(true);
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const results = await Promise.allSettled(roots.map(root => searchInFiles(root, textQuery)));
        if (current) {
          for (const failure of results.filter(result => result.status === 'rejected')) {
            console.error('Could not search a workspace root:', failure.reason);
          }
          setTextResults(results.flatMap(result => result.status === 'fulfilled' ? result.value : []));
        }
      } catch (error) {
        console.error('Could not search workspace files:', error);
        if (current) setTextResults([]);
      } finally {
        if (current) setTextLoading(false);
      }
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, roots]);

  // Auto-focus input
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [onClose]);

  // Dragging
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.origX + ev.clientX - dragRef.current.startX,
        y: dragRef.current.origY + ev.clientY - dragRef.current.startY,
      });
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos.x, pos.y]);

  const isTextMode = query.startsWith('%');
  const isFileMode = query.startsWith('@');
  const isCommandMode = query.startsWith('>');
  const q = (isTextMode || isFileMode) ? '' : query.replace(/^>/, '').trim();
  const textQuery = isTextMode ? query.slice(1).trim() : '';
  const fileQuery = isFileMode ? query.slice(1).trim() : '';

  const fileItems = useMemo<PaletteItem[]>(() => {
    if (!isFileMode) return [];
    const result: PaletteItem[] = [];
    const openPaths = new Set(tabs.map(t => t.path));
    for (const tab of tabs) {
      const score = fuzzyScore(fileQuery, tab.name);
      if (score === null) continue;
      const rel = relativeToWorkspace(tab.path, roots);
      result.push({
        id: `open:${tab.path}`, kind: 'open-file', label: tab.name, detail: rel,
        icon: <File size={14} style={{ color: fileColor(tab.name, fileIconTheme), flexShrink: 0 }} />,
        badge: <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--r0-accent-blue)', flexShrink: 0 }} />,
        score: score - 20000,
        action: () => { onFileOpen(tab.path); onClose(); },
      });
    }
    for (const f of wsFiles) {
      if (openPaths.has(f.path)) continue;
      const score = fuzzyScore(fileQuery, f.name);
      if (score === null) continue;
      result.push({
        id: `ws:${f.path}`, kind: 'workspace-file', label: f.name, detail: f.rel,
        icon: <File size={14} style={{ color: fileColor(f.name, fileIconTheme), flexShrink: 0 }} />,
        score,
        action: () => { onFileOpen(f.path); onClose(); },
      });
    }
    result.sort((a, b) => a.score - b.score);
    return result.slice(0, 60);
  }, [isFileMode, fileQuery, tabs, wsFiles, roots, onFileOpen, onClose, fileIconTheme]);

  const items = useMemo<PaletteItem[]>(() => {
    if (isTextMode || isFileMode) return [];
    const result: PaletteItem[] = [];
    const openPaths = new Set(tabs.map(t => t.path));

    // Open tabs
    for (const tab of isCommandMode ? [] : tabs) {
      const score = fuzzyScore(q, tab.name);
      if (score === null) continue;
      const rel = relativeToWorkspace(tab.path, roots);
      result.push({
        id: `open:${tab.path}`, kind: 'open-file', label: tab.name, detail: rel,
        icon: <File size={14} style={{ color: fileColor(tab.name, fileIconTheme), flexShrink: 0 }} />,
        badge: <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--r0-accent-blue)', flexShrink: 0 }} />,
        score: score - 20000,
        action: () => { onFileOpen(tab.path); onClose(); },
      });
    }

    // Workspace files (only when searching)
    if (q && !isCommandMode) {
      for (const f of wsFiles) {
        if (openPaths.has(f.path)) continue;
        const score = fuzzyScore(q, f.name);
        if (score === null) continue;
        result.push({
          id: `ws:${f.path}`, kind: 'workspace-file', label: f.name, detail: f.rel,
          icon: <File size={14} style={{ color: fileColor(f.name, fileIconTheme), flexShrink: 0 }} />,
          score,
          action: () => { onFileOpen(f.path); onClose(); },
        });
      }
    }

    // Commands
    const cmds = [
      { label: 'New File',            tokens: 'new create untitled',        detail: 'Create a new untitled file',          icon: <FilePlus  size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: 'Ctrl+N',   action: () => { onNewFile();       onClose(); } },
      { label: 'Open Folder…',        tokens: 'open folder workspace',       detail: 'Open a project folder',               icon: <FolderOpen size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: 'Ctrl+K O', action: () => { onOpenFolder();    onClose(); } },
      { label: 'Add Folder to Workspace…', tokens: 'add folder workspace multi root', detail: 'Add another project folder to this workspace', icon: <FolderOpen size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: undefined as string | undefined, action: () => { onAddFolderToWorkspace(); onClose(); } },
      { label: 'Open File…',          tokens: 'open file browse disk',       detail: 'Open a file from disk',               icon: <FileInput  size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: 'Ctrl+O',   action: () => { onOpenFile();      onClose(); } },
      { label: 'Save',                tokens: 'write save active document',   detail: 'Save the active document',            icon: <Save size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: 'Ctrl+S', action: () => { onSave(); onClose(); } },
      { label: 'Save All',            tokens: 'write save every document',    detail: 'Save all modified documents',         icon: <SaveAll size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: undefined as string | undefined, action: () => { onSaveAll(); onClose(); } },
      { label: 'Close Editor',        tokens: 'close active file tab',       detail: 'Close the active editor tab',         icon: <X size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: 'Ctrl+W', action: () => { onCloseEditor(); onClose(); } },
      { label: 'Reload Window',       tokens: 'reload restart refresh',       detail: 'Reload the IDE window safely',         icon: <RefreshCw size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: 'Ctrl+R', action: () => { onReloadWindow(); onClose(); } },
      ...(activeFilePath && /\.html?$/i.test(activeFilePath)
        ? [{ label: 'Open Active HTML in Live Preview', tokens: 'html browser preview web', detail: 'Open a local HTML preview at the bottom', icon: <Globe size={14} style={{ flexShrink: 0, color: 'var(--r0-accent-blue)' }} />, shortcut: undefined as string | undefined, action: () => { onOpenHtmlPreview(activeFilePath); onClose(); } }]
        : []),
      ...(activeFilePath && canFormat(activeFilePath)
        ? [{ label: 'Format Document', tokens: 'format prettier code document', detail: 'Format the active document', icon: <AlignLeft size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: 'Shift+Alt+F', action: () => { onFormatDocument(); onClose(); } }]
        : []),
      { label: 'Open Settings',       tokens: 'settings preferences config', detail: 'Manage API keys, themes and more',    icon: <Settings   size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: 'Ctrl+,',   action: () => { onOpenSettings();  onClose(); } },
      { label: 'Keyboard Shortcuts',  tokens: 'keybindings customize keys',   detail: 'View and customize keyboard shortcuts', icon: <Settings size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: undefined as string | undefined, action: () => { onOpenKeyboardShortcuts(); onClose(); } },
      { label: 'Search Files',        tokens: 'search files in workspace',    detail: 'Search file contents',                 icon: <Search size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: 'Ctrl+Shift+F', action: () => { onSelectSidebarPanel('search'); onClose(); } },
      { label: 'Source Control',      tokens: 'git changes source control',   detail: 'Open changes, history, and graph',     icon: <AlignLeft size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: 'Ctrl+Shift+G', action: () => { onSelectSidebarPanel('sourcetree'); onClose(); } },
      { label: 'Extensions',          tokens: 'extensions install manage',    detail: 'Browse installed extensions',          icon: <Globe size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: 'Ctrl+Shift+X', action: () => { onSelectSidebarPanel('extensions'); onClose(); } },
      { label: terminalOpen ? 'Hide Terminal' : 'Show Terminal', tokens: 'terminal toggle panel', detail: terminalOpen ? 'Close the terminal panel' : 'Open the terminal panel', icon: <Terminal size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: 'Ctrl+J', action: () => { onToggleTerminal(); onClose(); } },
      { label: sidebarOpen  ? 'Hide Sidebar'  : 'Show Sidebar',  tokens: 'sidebar toggle explorer', detail: sidebarOpen ? 'Close the file explorer' : 'Open the file explorer', icon: <PanelLeft size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />, shortcut: undefined, action: () => { onToggleSidebar(); onClose(); } },
      ...themes.filter(t => t.name !== theme.name).map(t => ({
        label: `Switch to ${t.name}`,
        tokens: `theme color ${t.type} appearance`,
        detail: `Change the IDE color theme`,
        icon: t.type === 'dark'
          ? <Moon size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />
          : <Sun  size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />,
        shortcut: undefined as string | undefined,
        action: () => { setTheme(t); onClose(); },
      })),
    ];
    for (const cmd of cmds) {
      const score = fuzzyScore(q, cmd.label + ' ' + cmd.tokens);
      if (score === null) continue;
      result.push({ id: `cmd:${cmd.label}`, kind: 'command', label: cmd.label, detail: cmd.detail, icon: cmd.icon, shortcut: cmd.shortcut, score: score + 50000, action: cmd.action });
    }

    result.sort((a, b) => a.score - b.score);
    return result.slice(0, 60);
  }, [isTextMode, isFileMode, isCommandMode, q, tabs, wsFiles, roots, terminalOpen, sidebarOpen, theme, themes, setTheme,
      onFileOpen, onClose, onNewFile, onOpenFolder, onAddFolderToWorkspace, onReloadWindow, onOpenFile, onToggleSidebar, onToggleTerminal, onOpenSettings,
      onOpenKeyboardShortcuts, onSave, onSaveAll, onCloseEditor, onSelectSidebarPanel,
      activeFilePath, onOpenHtmlPreview, onFormatDocument, fileIconTheme]);

  const textItems = useMemo<PaletteItem[]>(() =>
    textResults.map(r => {
      const fileName = r.path.replace(/\\/g, '/').split('/').pop() ?? r.path;
      return {
        id: `text:${r.path}:${r.line}:${r.col}`,
        kind: 'text-match' as ItemKind,
        label: r.text,
        detail: `${fileName} · Line ${r.line}`,
        icon: <AlignLeft size={14} style={{ color: 'var(--r0-fg-muted)', flexShrink: 0 }} />,
        score: 0,
        action: () => { onFileOpenAtLine(r.path, r.line); onClose(); },
      };
    }),
  [textResults, onFileOpenAtLine, onClose]);

  const openGroup = items.filter(i => i.kind === 'open-file');
  const wsGroup   = items.filter(i => i.kind === 'workspace-file');
  const cmdGroup  = items.filter(i => i.kind === 'command');
  const flat      = useMemo<PaletteItem[]>(
    () => isTextMode ? textItems : isFileMode ? fileItems : isCommandMode ? cmdGroup : [...openGroup, ...wsGroup, ...cmdGroup],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openGroup/wsGroup/cmdGroup are derived synchronously from `items`
    [isTextMode, isFileMode, isCommandMode, textItems, fileItems, items],
  );
  const idxOf     = (item: PaletteItem) => flat.findIndex(i => i.id === item.id);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset selection to top whenever the result set changes
  useEffect(() => { setSelected(0); }, [flat.length, q, isTextMode, isFileMode]);

  // Keyboard — capture phase so it beats CM6 and other listeners
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setSelected(s => Math.min(s + 1, flat.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      else if (e.key === 'Enter')   { e.preventDefault(); flat[selected]?.action(); }
      else if (e.key === 'Escape')  { e.preventDefault(); onClose(); }
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [flat, selected, onClose]);

  // Scroll active row into view
  useEffect(() => {
    (listRef.current?.children[selected] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const isLoading = isTextMode && textLoading;
  const activeQuery = isTextMode ? textQuery : isFileMode ? fileQuery : isCommandMode ? (q || '>') : q;

  return createPortal(
    <div
      ref={paletteRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: PALETTE_W,
        zIndex: 10000,
        background: 'var(--r0-bg-base)',
        border: '1px solid var(--r0-border-subtle)',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        // eslint-disable-next-line react-hooks/refs -- transient drag flag read for cursor styling; re-render is driven by drag state elsewhere
        userSelect: dragRef.current ? 'none' : undefined,
      }}
    >
      {/* Drag handle bar */}
      <div
        onMouseDown={onDragStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 22,
          cursor: 'grab',
          background: 'var(--r0-bg-titlebar)',
          borderBottom: '1px solid var(--r0-border-default)',
        }}
      >
        <GripHorizontal size={13} style={{ color: 'var(--r0-fg-subtle)', pointerEvents: 'none' }} />
      </div>

      {/* Search input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '11px 14px',
        borderBottom: flat.length > 0 || isLoading || (isTextMode && query.length > 1) || (isFileMode && query.length > 1) ? '1px solid var(--r0-border-default)' : 'none',
      }}>
        <Search size={14} style={{ color: 'var(--r0-fg-muted)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={isCommandMode ? "Type a command…" : "Go to file or command… (@ files · % text · > commands)"}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: '14px', lineHeight: '1.4',
            color: 'var(--r0-fg-default)', fontFamily: 'var(--font-sans)',
          }}
        />
        <kbd
          onClick={onClose}
          style={{
            background: 'var(--r0-bg-hover)', border: '1px solid var(--r0-border-default)',
            borderRadius: '4px', padding: '1px 6px', fontSize: '10px',
            color: 'var(--r0-fg-subtle)', fontFamily: 'var(--font-mono)',
            flexShrink: 0, cursor: 'pointer',
          }}
        >
          esc
        </kbd>
      </div>

      {/* Mode hints */}
      {isTextMode && query === '%' && (
        <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--r0-fg-subtle)', fontSize: '13px' }}>
          Type to search for text across all files
        </div>
      )}

      {/* Loading spinner */}
      {isLoading && (
        <div style={{ padding: '24px 14px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Loader size={18} style={{ color: 'var(--r0-fg-muted)', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {/* Results */}
      {flat.length > 0 && (
        <div ref={listRef} style={{ maxHeight: 380, overflowY: 'auto', padding: '4px 5px 6px' }}>
          {isTextMode ? <>
            <GroupLabel text={`Text matches — ${flat.length} result${flat.length === 1 ? '' : 's'}${flat.length >= 500 ? ' (capped)' : ''}`} />
            {textItems.map(item => <Row key={item.id} item={item} active={idxOf(item) === selected} query={textQuery} onHover={() => setSelected(idxOf(item))} />)}
          </> : isFileMode ? <>
            <GroupLabel text={`Files — ${flat.length} result${flat.length === 1 ? '' : 's'}`} />
            {fileItems.map(item => <Row key={item.id} item={item} active={idxOf(item) === selected} query={fileQuery} onHover={() => setSelected(idxOf(item))} />)}
          </> : <>
            {openGroup.length > 0 && <>
              <GroupLabel text="Open Files" />
              {openGroup.map(item => <Row key={item.id} item={item} active={idxOf(item) === selected} query={q} onHover={() => setSelected(idxOf(item))} />)}
            </>}
            {wsGroup.length > 0 && <>
              <GroupLabel text="Files" />
              {wsGroup.map(item => <Row key={item.id} item={item} active={idxOf(item) === selected} query={q} onHover={() => setSelected(idxOf(item))} />)}
            </>}
            {cmdGroup.length > 0 && <>
              <GroupLabel text="Commands" />
              {cmdGroup.map(item => <Row key={item.id} item={item} active={idxOf(item) === selected} query={q} onHover={() => setSelected(idxOf(item))} />)}
            </>}
          </>}
        </div>
      )}

      {/* No results */}
      {flat.length === 0 && !isLoading && activeQuery.length > 0 && (
        <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--r0-fg-subtle)', fontSize: '13px' }}>
          No results for "{activeQuery}"
        </div>
      )}
    </div>,
    document.body,
  );
}

// ── sub-components ───────────────────────────────────────────────────────────

function GroupLabel({ text }: { text: string }) {
  return (
    <div style={{
      padding: '7px 9px 2px', fontSize: '10px', fontWeight: 600,
      letterSpacing: '0.7px', textTransform: 'uppercase',
      color: 'var(--r0-fg-subtle)', userSelect: 'none',
    }}>
      {text}
    </div>
  );
}

function Row({ item, active, query, onHover }: {
  item: PaletteItem; active: boolean; query: string; onHover: () => void;
}) {
  return (
    <div
      onMouseEnter={onHover}
      onClick={item.action}
      style={{
        display: 'flex', alignItems: 'center', gap: '9px',
        padding: '6px 9px', borderRadius: '7px', cursor: 'pointer',
        background: active ? 'var(--r0-bg-hover)' : 'transparent',
        transition: 'background 0.07s',
      }}
    >
      {item.icon}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '13px', color: 'var(--r0-fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <HighlightMatch text={item.label} query={query} />
        </span>
        {item.detail && (
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--r0-fg-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
            {item.detail}
          </span>
        )}
      </span>
      {item.shortcut && (
        <kbd style={{ fontSize: '10px', color: 'var(--r0-fg-subtle)', fontFamily: 'var(--font-mono)', flexShrink: 0, background: 'var(--r0-bg-hover)', border: '1px solid var(--r0-border-default)', borderRadius: '4px', padding: '1px 5px' }}>
          {item.shortcut}
        </kbd>
      )}
      {item.badge}
    </div>
  );
}
