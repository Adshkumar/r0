import { useEffect, useState } from 'react';
import { FolderOpen, FileText, FilePlus, ChevronDown } from 'lucide-react';
import { useTheme } from '../../themes/ThemeContext';
import { readDir } from '../../lib/fs';
import { getSetting, pushRecentProject, type RecentProject } from '../../lib/settings';
import { useToast } from '../ui/Toast';
import logo from '../../assets/r0-logo.svg';

interface Props {
  folderPath: string | null;
  onFolderOpen: () => void;
  onRecentProjectOpen: (path: string) => void;
  onFileOpen: () => void;
  onNewFile: () => void;
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '9px 20px', borderRadius: '8px', cursor: 'pointer',
        border: '1px solid var(--r0-border-default)',
        background: hovered ? 'var(--r0-bg-base)' : 'transparent',
        color: hovered ? 'var(--r0-fg-default)' : 'var(--r0-fg-muted)',
        fontSize: '13px', fontWeight: 500, fontFamily: 'inherit',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        borderColor: hovered ? 'var(--r0-border-subtle)' : 'var(--r0-border-default)',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

const INITIAL_LIMIT = 5;
const ITEM_HEIGHT = 34; // px per item including gap

export default function EditorEmptyState({
  folderPath,
  onFolderOpen,
  onRecentProjectOpen,
  onFileOpen,
  onNewFile,
}: Props) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showMoreHovered, setShowMoreHovered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSetting('recent.projects').then(projects => {
      if (cancelled) return;
      setRecents(projects);
      setExpanded(false);
    }).catch(error => {
      if (!cancelled) showToast(`Failed to load recent projects: ${String(error)}`, 'error');
    });
    return () => { cancelled = true; };
  }, [folderPath, showToast]);

  async function handleRecentClick(project: RecentProject) {
    try {
      await readDir(project.path);
      await pushRecentProject(project);
      setRecents(prev => [project, ...prev.filter(p => p.path !== project.path)].slice(0, 10));
      onRecentProjectOpen(project.path);
    } catch (error) {
      showToast(`Could not open ${project.name}: ${String(error)}`, 'error');
    }
  }

  function truncatePath(path: string, max = 42): string {
    if (path.length <= max) return path;
    return '…' + path.slice(-(max - 1));
  }

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', width: '100%', maxWidth: '460px', padding: '12px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <img
            src={logo}
            alt=""
            aria-hidden="true"
            style={{ width: '48px', height: '48px', filter: theme.type === 'dark' ? 'none' : 'invert(1)' }}
          />
          <h1 style={{ margin: 0, fontSize: '22px', lineHeight: 1.2, fontWeight: 600, letterSpacing: '-0.04em', color: 'var(--r0-fg-default)' }}>
            r0
          </h1>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <ActionButton icon={<FolderOpen size={15} />} label="Open Folder" onClick={onFolderOpen} />
          <ActionButton icon={<FileText size={15} />} label="Open File" onClick={onFileOpen} />
          <ActionButton icon={<FilePlus size={15} />} label="New File" onClick={onNewFile} />
        </div>

        {/* Recent projects */}
        <div style={{ width: '100%' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--r0-fg-muted)', marginBottom: '8px' }}>
            RECENT PROJECTS
          </div>
          {recents.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--r0-fg-subtle)', padding: '6px 0' }}>
              No recent projects
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '2px',
                ...(expanded ? {
                  maxHeight: `${INITIAL_LIMIT * ITEM_HEIGHT}px`,
                  overflowY: 'auto',
                } : {}),
              }}>
                {(expanded ? recents : recents.slice(0, INITIAL_LIMIT)).map(p => (
                  <button
                    type="button"
                    key={p.path}
                    onClick={() => handleRecentClick(p)}
                    title={p.path}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: '16px', padding: '6px 8px', borderRadius: '6px', border: 'none',
                      background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                      width: '100%', textAlign: 'left', transition: 'background 0.12s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--r0-bg-base)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--r0-fg-default)', flexShrink: 0 }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--r0-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'right' }}>
                      {truncatePath(p.path)}
                    </span>
                  </button>
                ))}
              </div>

              {!expanded && recents.length > INITIAL_LIMIT && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  onMouseEnter={() => setShowMoreHovered(true)}
                  onMouseLeave={() => setShowMoreHovered(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    width: '100%', marginTop: '6px', padding: '4px 0',
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1, height: '1px', background: 'var(--r0-border-default)' }} />
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${showMoreHovered ? 'var(--r0-fg-muted)' : 'var(--r0-border-default)'}`,
                    color: showMoreHovered ? 'var(--r0-fg-default)' : 'var(--r0-fg-muted)',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}>
                    <ChevronDown size={11} strokeWidth={2.5} />
                  </div>
                  <div style={{ flex: 1, height: '1px', background: 'var(--r0-border-default)' }} />
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
