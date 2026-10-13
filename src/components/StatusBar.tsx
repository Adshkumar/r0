import { Sun, Moon, GitBranch, Settings, Globe } from 'lucide-react';
import { useTheme } from '../themes/ThemeContext';

interface Props {
  language: string;
  line: number;
  col: number;
  branch: string | null;
  onOpenSettings?: () => void;
  activeFilePath?: string | null;
  livePreviewActive?: boolean;
  onGoLive?: () => void;
  debugStatus?: 'paused' | 'running' | null;
}

function StatusItem({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  return (
    <div
      onClick={onClick}
      title={title}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={event => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '0 8px', height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: '2px',
        transition: 'background 0.1s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (onClick) (e.currentTarget as HTMLElement).style.background = 'var(--r0-bg-hover)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {children}
    </div>
  );
}

export default function StatusBar({
  language,
  line,
  col,
  branch,
  onOpenSettings,
  activeFilePath,
  livePreviewActive = false,
  onGoLive,
  debugStatus,
}: Props) {
  const { theme, themes, setTheme } = useTheme();
  const isDark = theme.type === 'dark';
  const canGoLive = !!activeFilePath && /\.html?$/i.test(activeFilePath);

  function toggleTheme() {
    const currentIndex = themes.findIndex(t => t.name === theme.name);
    const target = themes[(currentIndex + 1) % themes.length];
    if (target) setTheme(target);
  }
  const nextTheme = themes[(themes.findIndex(t => t.name === theme.name) + 1) % themes.length];

  return (
    <div
      style={{
        height: '22px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--r0-bg-base)',
        borderTop: '1px solid var(--r0-border-default)',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: 'var(--r0-fg-subtle)',
        userSelect: 'none',
        paddingLeft: '4px',
        paddingRight: '4px',
      }}
    >
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        {branch && (
          <StatusItem>
            <GitBranch size={11} />
            <span>{branch}</span>
          </StatusItem>
        )}
        {debugStatus && (
          <StatusItem>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              backgroundColor: debugStatus === 'paused'
                ? 'var(--r0-accent-yellow)'
                : 'var(--r0-semantic-success)',
            }} />
            <span>{debugStatus === 'paused' ? 'Paused' : 'Running'}</span>
          </StatusItem>
        )}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        {canGoLive && (
          <StatusItem
            onClick={onGoLive}
            title={livePreviewActive ? 'Stop Live Preview' : 'Open active HTML in Live Preview'}
          >
            <Globe size={12} />
            <span>{livePreviewActive ? 'Stop Live' : 'Go Live'}</span>
          </StatusItem>
        )}
        <StatusItem>
          <span>{language}</span>
        </StatusItem>
        <StatusItem>
          <span>Ln {line}, Col {col}</span>
        </StatusItem>
        <StatusItem>
          <span>UTF-8</span>
        </StatusItem>
        <StatusItem
          onClick={onOpenSettings}
          title="Settings (Ctrl+,)"
        >
          <Settings size={11} />
        </StatusItem>
        <StatusItem
          onClick={toggleTheme}
          title={`Switch to ${nextTheme?.name ?? (isDark ? 'Light' : 'Dark')} Theme`}
        >
          {isDark
            ? <Sun size={11} />
            : <Moon size={11} />
          }
        </StatusItem>
      </div>
    </div>
  );
}
