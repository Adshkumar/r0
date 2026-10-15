import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";
import {
  ChevronRight, ChevronDown, File,
  FilePlus, FolderPlus, Pencil, Trash2, Copy, ExternalLink, X,
} from "lucide-react";
import { readDir, writeFile, renamePath, deletePath, createDirCmd, revealInExplorer, type FsEntry } from "../lib/fs";
import { resolveFileIcon } from "../lib/fileIcons";
import { useFileIconTheme } from "../lib/fileIconTheme";
import { useWorkspace } from "../context/WorkspaceContext";
import ContextMenu, { type MenuEntry } from "./ContextMenu";

function isHtmlFile(path: string) {
  return /\.html?$/i.test(path);
}

// ── Shared context ─────────────────────────────────────────────────────────────

interface TreeCtx {
  onFileOpen: (path: string) => void;
  onPreviewOpen: (path: string) => void;
  renamingPath: string | null;
  setRenamingPath: (p: string | null) => void;
  pendingCreate: { parentPath: string; kind: 'file' | 'folder' } | null;
  setPendingCreate: (v: { parentPath: string; kind: 'file' | 'folder' } | null) => void;
  openContextMenu: (x: number, y: number, entry: FsEntry | null) => void;
  nodeRefreshKey: Record<string, number>;
  refreshAt: (parentPath: string) => void;
  fileIconTheme: ReturnType<typeof useFileIconTheme>;
  onPathRenamed: (from: string, to: string) => void;
  selectedFilePath: string | null;
  expandedFolders: Set<string>;
  onFolderExpansionChange: (path: string, expanded: boolean) => void;
}

const TreeCtx = createContext<TreeCtx>({
  onFileOpen: () => {},
  onPreviewOpen: () => {},
  renamingPath: null, setRenamingPath: () => {},
  pendingCreate: null, setPendingCreate: () => {},
  openContextMenu: () => {},
  nodeRefreshKey: {},
  refreshAt: () => {},
  fileIconTheme: 'r0',
  onPathRenamed: () => {},
  selectedFilePath: null,
  expandedFolders: new Set(),
  onFolderExpansionChange: () => {},
});

// ── Path utils ────────────────────────────────────────────────────────────────

function parentOf(p: string) { return p.replace(/[/\\][^/\\]+$/, ''); }
function sep(p: string) { return p.includes('\\') ? '\\' : '/'; }
function join(dir: string, name: string) { return `${dir.replace(/[/\\]+$/, '')}${sep(dir)}${name}`; }

// ── Inline rename input ───────────────────────────────────────────────────────

function RenameInput({ entry, onDone }: { entry: FsEntry; onDone: () => void }) {
  const [name, setName] = useState(entry.name);
  const { refreshAt, onPathRenamed } = useContext(TreeCtx);
  const inputRef = useRef<HTMLInputElement>(null);
  const committed = useRef(false);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  async function commit() {
    if (committed.current) return;
    committed.current = true;
    const trimmed = name.trim();
    if (trimmed && trimmed !== entry.name) {
      try {
        const newPath = join(parentOf(entry.path), trimmed);
        await renamePath(entry.path, newPath);
        onPathRenamed(entry.path, newPath);
        refreshAt(parentOf(entry.path));
      } catch (e) { alert(String(e)); }
    }
    onDone();
  }

  return (
    <input
      ref={inputRef}
      value={name}
      onChange={e => setName(e.target.value)}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') commit(); else if (e.key === 'Escape') onDone(); }}
      onBlur={commit}
      style={{
        flex: 1, fontSize: '12px', padding: '1px 4px', minWidth: 0,
        backgroundColor: 'var(--r0-bg-active)', color: 'var(--r0-fg-default)',
        border: '1px solid var(--r0-accent-blue)', borderRadius: 3,
        outline: 'none', fontFamily: 'var(--font-sans)',
      }}
    />
  );
}

// ── Inline create input ───────────────────────────────────────────────────────

function CreateInput({ parentPath, kind, depth, onDone }: {
  parentPath: string; kind: 'file' | 'folder'; depth: number; onDone: () => void;
}) {
  const [name, setName] = useState('');
  const { refreshAt } = useContext(TreeCtx);
  const inputRef = useRef<HTMLInputElement>(null);
  const committed = useRef(false);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function commit() {
    if (committed.current) return;
    committed.current = true;
    const trimmed = name.trim();
    if (trimmed) {
      try {
        const newPath = join(parentPath, trimmed);
        if (kind === 'folder') await createDirCmd(newPath);
        else await writeFile(newPath, '');
        refreshAt(parentPath);
      } catch (e) { alert(String(e)); }
    }
    onDone();
  }

  const indent = depth * 12 + 6;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: `3px 8px 3px ${indent}px` }}>
      {kind === 'folder'
        ? <FolderPlus size={14} style={{ flexShrink: 0, color: '#eab308' }} />
        : <FilePlus  size={14} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)' }} />}
      <input
        ref={inputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={kind === 'folder' ? 'folder name' : 'file name'}
        onKeyDown={e => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') onDone(); }}
        onBlur={commit}
        style={{
          flex: 1, fontSize: '12px', padding: '1px 4px', minWidth: 0,
          backgroundColor: 'var(--r0-bg-active)', color: 'var(--r0-fg-default)',
          border: '1px solid var(--r0-accent-blue)', borderRadius: 3,
          outline: 'none', fontFamily: 'var(--font-sans)',
        }}
      />
    </div>
  );
}

// ── Tree node ─────────────────────────────────────────────────────────────────

function TreeNode({ entry, depth }: { entry: FsEntry; depth: number }) {
  const { onFileOpen, renamingPath, setRenamingPath, pendingCreate, setPendingCreate, openContextMenu, nodeRefreshKey, fileIconTheme, selectedFilePath, expandedFolders, onFolderExpansionChange } = useContext(TreeCtx);
  const [expanded, setExpanded] = useState(() => expandedFolders.has(entry.path));
  const [children, setChildren] = useState<FsEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isRenaming = renamingPath === entry.path;
  const isSelected = selectedFilePath === entry.path;
  const createHere = entry.is_dir && pendingCreate?.parentPath === entry.path;

  useEffect(() => {
    if (!entry.is_dir || !expanded || loaded) return;
    let current = true;
    readDir(entry.path)
      .then(entries => {
        if (!current) return;
        setChildren(entries);
        setLoaded(true);
      })
      .catch(error => {
        if (current) console.error(`Could not read folder ${entry.path}:`, error);
      });
    return () => { current = false; };
  }, [entry.is_dir, entry.path, expanded, loaded]);

  // Auto-expand folder when a create is pending inside it
  useEffect(() => {
    if (!createHere) return;
    if (!loaded) {
      readDir(entry.path)
        .then(c => { setChildren(c); setLoaded(true); setExpanded(true); })
        .catch(error => {
          console.error(`Could not read folder ${entry.path}:`, error);
          setExpanded(true);
        });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- expand node when a child-create is requested
      setExpanded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createHere]);

  // Refresh children when parent requests it
  useEffect(() => {
    if (!loaded || !nodeRefreshKey[entry.path]) return;
    readDir(entry.path).then(setChildren).catch(error => {
      console.error(`Could not refresh folder ${entry.path}:`, error);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeRefreshKey[entry.path]]);

  async function handleClick() {
    if (isRenaming) return;
    if (entry.is_dir) {
      if (!loaded) {
        try {
          setChildren(await readDir(entry.path));
        } catch (error) {
          console.error(`Could not read folder ${entry.path}:`, error);
          return;
        }
        setLoaded(true);
      }
      setExpanded(v => {
        onFolderExpansionChange(entry.path, !v);
        return !v;
      });
    } else {
      onFileOpen(entry.path);
    }
  }

  const indent = depth * 12 + 6;
  const resolvedIcon = resolveFileIcon(entry.name, entry.is_dir, expanded, fileIconTheme);
  const EntryIcon = resolvedIcon.icon;

  return (
    <>
      <button
        onClick={handleClick}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); openContextMenu(e.clientX, e.clientY, entry); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-current={isSelected ? 'page' : undefined}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          gap: 4, padding: `3px 8px 3px ${indent}px`,
          border: 'none', background: isSelected ? 'var(--r0-bg-active)' : hovered ? 'var(--r0-bg-hover)' : 'transparent',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.1s',
        }}
      >
        <span style={{ width: 14, flexShrink: 0, color: 'var(--r0-fg-muted)', display: 'flex', alignItems: 'center' }}>
          {entry.is_dir ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
        </span>

        <EntryIcon size={14} aria-hidden="true" style={{ flexShrink: 0, color: resolvedIcon.color }} />

        {isRenaming
          ? <RenameInput entry={entry} onDone={() => setRenamingPath(null)} />
          : (
            <span style={{
              fontSize: 13, color: 'var(--r0-fg-default)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              opacity: entry.name.startsWith('.') ? 0.5 : 1,
            }}>
              <span title={entry.name}>{entry.name}</span>
            </span>
          )
        }
      </button>

      {entry.is_dir && expanded && (
        <>
          {createHere && (
            <CreateInput
              parentPath={entry.path}
              kind={pendingCreate!.kind}
              depth={depth + 1}
              onDone={() => setPendingCreate(null)}
            />
          )}
          {children.map(child => (
            <TreeNode key={child.path} entry={child} depth={depth + 1} />
          ))}
        </>
      )}
    </>
  );
}

// ── File Tree ─────────────────────────────────────────────────────────────────

interface Props {
  onFileOpen: (path: string) => void;
  onPreviewOpen: (path: string) => void;
  onPathRenamed: (from: string, to: string) => void;
  selectedFilePath: string | null;
  refreshKey?: number;
  expandedFolders?: Set<string>;
  onFolderExpansionChange?: (path: string, expanded: boolean) => void;
  rootPath?: string;
  embedded?: boolean;
}

export default function FileTree({ onFileOpen, onPreviewOpen, onPathRenamed, selectedFilePath, refreshKey, expandedFolders = new Set(), onFolderExpansionChange = () => {}, rootPath, embedded = false }: Props) {
  const { folderPath: activeWorkspacePath, workspaceRoots, removeWorkspaceRoot } = useWorkspace();
  const folderPath = rootPath ?? activeWorkspacePath;
  const fileIconTheme = useFileIconTheme();
  const [rootEntries, setRootEntries] = useState<FsEntry[]>([]);
  const rootName = folderPath?.split(/[\\/]/).filter(Boolean).pop() ?? '';

  const [menuState, setMenuState] = useState<{ x: number; y: number; entry: FsEntry | null } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [pendingCreate, setPendingCreate] = useState<{ parentPath: string; kind: 'file' | 'folder' } | null>(null);
  const [nodeRefreshKey, setNodeRefreshKey] = useState<Record<string, number>>({});

  const refreshRoot = useCallback(() => {
    if (!folderPath) return;
    readDir(folderPath).then(setRootEntries).catch(error => {
      console.error(`Could not refresh folder ${folderPath}:`, error);
    });
  }, [folderPath]);

  const refreshAt = useCallback((parentPath: string) => {
    const rootNorm = (folderPath ?? '').replace(/[/\\]+$/, '');
    const pathNorm = parentPath.replace(/[/\\]+$/, '');
    if (pathNorm === rootNorm) {
      refreshRoot();
    } else {
      setNodeRefreshKey(prev => ({ ...prev, [parentPath]: (prev[parentPath] ?? 0) + 1 }));
    }
  }, [folderPath, refreshRoot]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guard reset when no folder is open
    if (!folderPath) { setRootEntries([]); return; }
    let current = true;
    readDir(folderPath)
      .then(entries => { if (current) setRootEntries(entries); })
      .catch(error => {
        if (current) console.error(`Could not read folder ${folderPath}:`, error);
      });
    return () => { current = false; };
  }, [folderPath, refreshKey]);

  function openContextMenu(x: number, y: number, entry: FsEntry | null) {
    setRenamingPath(null);
    setPendingCreate(null);
    setMenuState({ x, y, entry });
  }

  function buildMenuItems(entry: FsEntry | null): MenuEntry[] {
    if (!entry) {
      return [
        { label: 'New File',   icon: <FilePlus   size={13} />, action: () => setPendingCreate({ parentPath: folderPath!, kind: 'file'   }) },
        { label: 'New Folder', icon: <FolderPlus size={13} />, action: () => setPendingCreate({ parentPath: folderPath!, kind: 'folder' }) },
      ];
    }

    if (entry.is_dir) {
      return [
        { label: 'New File Here',   icon: <FilePlus   size={13} />, action: () => setPendingCreate({ parentPath: entry.path, kind: 'file'   }) },
        { label: 'New Folder Here', icon: <FolderPlus size={13} />, action: () => setPendingCreate({ parentPath: entry.path, kind: 'folder' }) },
        { separator: true },
        { label: 'Rename',        icon: <Pencil size={13} />,       action: () => setRenamingPath(entry.path) },
        { label: 'Delete Folder', icon: <Trash2 size={13} />, danger: true,
          action: async () => {
            if (!window.confirm(`Delete folder "${entry.name}" and all its contents?`)) return;
            try { await deletePath(entry.path); refreshAt(parentOf(entry.path)); } catch (e) { alert(String(e)); }
          },
        },
        { separator: true },
        { label: 'Copy Path',          icon: <Copy        size={13} />, action: () => navigator.clipboard.writeText(entry.path) },
        { label: 'Reveal in Explorer', icon: <ExternalLink size={13} />, action: () => revealInExplorer(entry.path) },
      ];
    }

    // File
    const root = (folderPath ?? '').replace(/[/\\]+$/, '');
    const rel = entry.path.startsWith(root) ? entry.path.slice(root.length + 1) : entry.path;

    return [
      { label: 'Open in Editor', icon: <File size={13} />, action: () => onFileOpen(entry.path) },
      ...(isHtmlFile(entry.path)
        ? [{ label: 'Open with Live Preview', icon: <ExternalLink size={13} />, action: () => onPreviewOpen(entry.path) }]
        : []),
      { separator: true },
      { label: 'Rename',      icon: <Pencil size={13} />,       action: () => setRenamingPath(entry.path) },
      { label: 'Delete File', icon: <Trash2 size={13} />, danger: true,
        action: async () => {
          if (!window.confirm(`Delete "${entry.name}"?`)) return;
          try { await deletePath(entry.path); refreshAt(parentOf(entry.path)); } catch (e) { alert(String(e)); }
        },
      },
      { separator: true },
      { label: 'Copy Path',          icon: <Copy        size={13} />, action: () => navigator.clipboard.writeText(entry.path) },
      { label: 'Copy Relative Path', icon: <Copy        size={13} />, action: () => navigator.clipboard.writeText(rel) },
      { label: 'Reveal in Explorer', icon: <ExternalLink size={13} />, action: () => revealInExplorer(entry.path) },
    ];
  }

  if (!folderPath) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--r0-fg-subtle)' }}>No folder open</p>
      </div>
    );
  }

  const createAtRoot = pendingCreate?.parentPath === folderPath || pendingCreate?.parentPath === folderPath?.replace(/[/\\]+$/, '');

  return (
    <TreeCtx.Provider value={{
      onFileOpen,
      onPreviewOpen,
      renamingPath, setRenamingPath,
      pendingCreate, setPendingCreate,
      openContextMenu,
      nodeRefreshKey,
      refreshAt,
      fileIconTheme,
      onPathRenamed,
      selectedFilePath,
      expandedFolders,
      onFolderExpansionChange,
    }}>
      <div
        className={embedded ? "flex flex-col" : "flex-1 flex flex-col overflow-y-auto"}
        style={embedded ? { flex: "0 0 auto" } : undefined}
        onContextMenu={e => { e.preventDefault(); openContextMenu(e.clientX, e.clientY, null); }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px 6px', fontSize: 11, fontWeight: 600,
          letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--r0-fg-muted)',
          userSelect: 'none',
        }}>
          {rootName}
          {embedded && workspaceRoots.length > 1 && (
            <button
              type="button"
              aria-label={`Remove ${rootName} from workspace`}
              title="Remove Folder from Workspace"
              onClick={() => removeWorkspaceRoot(folderPath)}
              style={{ border: 0, background: 'transparent', color: 'var(--r0-fg-subtle)', cursor: 'pointer', display: 'flex', padding: 2 }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div style={{ flex: 1 }}>
          {createAtRoot && (
            <CreateInput
              parentPath={folderPath}
              kind={pendingCreate!.kind}
              depth={0}
              onDone={() => setPendingCreate(null)}
            />
          )}
          {rootEntries.map(entry => (
            <TreeNode key={entry.path} entry={entry} depth={0} />
          ))}
        </div>
      </div>

      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={buildMenuItems(menuState.entry)}
          onClose={() => setMenuState(null)}
        />
      )}
    </TreeCtx.Provider>
  );
}
