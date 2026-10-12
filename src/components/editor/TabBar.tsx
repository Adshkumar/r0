import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, File, GitCompare, Globe, Plus, FolderOpen } from 'lucide-react';
import { fileColor } from '../../lib/fileColors';

export interface Tab {
  path: string;   // for ai-diff tabs: "__diff__<approvalId>"
  name: string;
  isDirty: boolean;
  isUntitled?: boolean;
  kind?: 'file' | 'ai-diff' | 'preview' | 'git-commit' | 'git-diff';
  // ai-diff only
  filePath?: string;
  originalContent?: string;
  proposedContent?: string;
  approve?: () => void;
  reject?: () => void;
  commitHash?: string;
  gitRootPath?: string;
  gitDiff?: {
    oldRevision: string | null;
    newRevision: string | null;
    oldFilePath: string;
    newFilePath: string;
    oldIsEmpty: boolean;
    newIsEmpty: boolean;
    newIsWorkingTree: boolean;
    oldLabel: string;
    newLabel: string;
  };
}

interface Props {
  tabs: Tab[];
  activeTab: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onOpenPreview?: () => void;
}

function TabItem({ tab, active, onSelect, onClose }: { tab: Tab; active: boolean; onSelect: () => void; onClose: () => void }) {
  const [hovered, setHovered] = useState(false);

  function handleAuxClick(e: React.MouseEvent) {
    if (e.button === 1) { e.preventDefault(); onClose(); }
  }

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    onClose();
  }

  const showClose = active || hovered || tab.isDirty;

  return (
    <div
      onClick={onSelect}
      onAuxClick={handleAuxClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '0 10px 0 12px',
        height: '100%',
        minWidth: '80px', maxWidth: '180px',
        flexShrink: 0,
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
        background: active ? 'var(--r0-bg-editor)' : 'transparent',
        borderRight: '1px solid var(--r0-border-default)',
        borderTop: active ? '2px solid var(--r0-accent-blue)' : '2px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Icon: diff badge, preview globe, dirty dot, or file icon */}
      {tab.kind === 'ai-diff' || tab.kind === 'git-diff'
        ? <GitCompare size={13} style={{ flexShrink: 0, color: 'rgba(46,160,67,0.9)' }} />
        : tab.kind === 'git-commit'
        ? <GitCompare size={13} style={{ flexShrink: 0, color: 'var(--r0-accent-blue)' }} />
        : tab.kind === 'preview'
        ? <Globe size={13} style={{ flexShrink: 0, color: 'var(--r0-accent-blue)' }} />
        : tab.isDirty
          ? <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--r0-fg-muted)', flexShrink: 0 }} />
          : <File size={13} style={{ flexShrink: 0, color: fileColor(tab.name) }} />
      }

      {/* File name */}
      <span style={{
        fontSize: '12px', flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: active ? 'var(--r0-fg-default)' : 'var(--r0-fg-muted)',
        fontWeight: active ? 500 : 400,
        fontStyle: tab.isUntitled ? 'italic' : 'normal',
      }}>
        {tab.name}
      </span>

      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '16px', height: '16px', flexShrink: 0,
          border: 'none', borderRadius: '4px', padding: 0,
          background: 'transparent', cursor: 'pointer',
          color: 'var(--r0-fg-muted)',
          opacity: showClose ? 1 : 0,
          transition: 'opacity 0.1s, background 0.1s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--r0-bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--r0-fg-default)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--r0-fg-muted)'; }}
      >
        <X size={11} />
      </button>
    </div>
  );
}

function PlusDropdown({ anchorRef, onNewFile, onOpenFile, onOpenPreview, onClose }: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onOpenPreview?: () => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      // Keep open if clicking the anchor button or inside the dropdown itself
      if (anchorRef.current?.contains(target) || containerRef.current?.contains(target)) return;
      onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listeners are registered once; anchorRef/onClose are read fresh inside handlers
  }, []);

  // eslint-disable-next-line react-hooks/refs -- anchor rect read for one-shot portal positioning of this menu
  const rect = anchorRef.current?.getBoundingClientRect();
  if (!rect) return null;

  const items = [
    { icon: <File size={13} />,       label: 'New File',     onClick: onNewFile },
    { icon: <FolderOpen size={13} />, label: 'Open File',    onClick: onOpenFile },
    { icon: <Globe size={13} />,      label: 'Live Preview', onClick: onOpenPreview },
  ];

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: rect.bottom + 2,
        right: window.innerWidth - rect.right,
        width: '164px',
        backgroundColor: 'var(--r0-bg-panel)',
        border: '1px solid var(--r0-border-default)',
        borderRadius: '6px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)',
        overflow: 'hidden',
        zIndex: 9999,
      }}
    >
      {items.map(item => (
        <button
          key={item.label}
          onClick={() => { onClose(); item.onClick?.(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            width: '100%', padding: '7px 12px',
            background: 'transparent', border: 'none',
            cursor: 'pointer', fontSize: '12px',
            color: 'var(--r0-fg-default)',
            textAlign: 'left',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--r0-bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ color: 'var(--r0-fg-muted)', display: 'flex' }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

export default function TabBar({ tabs, activeTab, onSelect, onClose, onNewFile, onOpenFile, onOpenPreview }: Props) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const plusBtnRef = useRef<HTMLButtonElement>(null);
  const [plusOpen, setPlusOpen] = useState(false);

  function handleWheel(e: React.WheelEvent) {
    if (scrollRef.current) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }

  return (
    <div
      style={{
        height: '36px', flexShrink: 0,
        display: 'flex', alignItems: 'stretch',
        backgroundColor: 'var(--r0-bg-base)',
        borderBottom: '1px solid var(--r0-border-default)',
      }}
    >
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        style={{
          display: 'flex', alignItems: 'stretch',
          overflowX: 'auto', overflowY: 'hidden',
          flex: 1,
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map(tab => (
          <TabItem
            key={tab.path}
            tab={tab}
            active={tab.path === activeTab}
            onSelect={() => onSelect(tab.path)}
            onClose={() => onClose(tab.path)}
          />
        ))}
      </div>

      {/* + button */}
      <button
        ref={plusBtnRef}
        onClick={() => setPlusOpen(v => !v)}
        title="New tab"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '36px', height: '36px', flexShrink: 0,
          border: 'none', borderLeft: '1px solid var(--r0-border-default)',
          background: plusOpen ? 'var(--r0-bg-hover)' : 'transparent',
          cursor: 'pointer',
          color: plusOpen ? 'var(--r0-fg-default)' : 'var(--r0-fg-muted)',
          transition: 'background 0.1s, color 0.1s',
        }}
        onMouseEnter={e => {
          if (!plusOpen) {
            e.currentTarget.style.background = 'var(--r0-bg-hover)';
            e.currentTarget.style.color = 'var(--r0-fg-default)';
          }
        }}
        onMouseLeave={e => {
          if (!plusOpen) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--r0-fg-muted)';
          }
        }}
      >
        <Plus size={14} />
      </button>

      {plusOpen && (
        <PlusDropdown
          anchorRef={plusBtnRef}
          onNewFile={onNewFile}
          onOpenFile={onOpenFile}
          onOpenPreview={onOpenPreview}
          onClose={() => setPlusOpen(false)}
        />
      )}
    </div>
  );
}
