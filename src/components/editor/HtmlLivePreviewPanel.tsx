import { useCallback, useEffect, useRef, useState } from 'react';
import { FileCode2, Loader2, RefreshCw, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const PANEL_ID = 'html-preview-isolated';

interface Props {
  rootPath: string | null;
  htmlPath: string;
  htmlContent: string;
  refreshToken: number;
  onClose: () => void;
}

export default function HtmlLivePreviewPanel({ rootPath, htmlPath, htmlContent, refreshToken, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef(htmlContent);
  const serverReadyRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const updateRevisionRef = useRef(0);
  const updateQueueRef = useRef(Promise.resolve());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => { sourceRef.current = htmlContent; }, [htmlContent]);

  const syncBounds = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    void invoke('resize_html_preview_panel', {
      sessionId,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    }).catch(cause => {
      if (sessionIdRef.current === sessionId) setError(cause instanceof Error ? cause.message : String(cause));
    });
  }, []);

  const refreshPreview = useCallback(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      setReloadKey(key => key + 1);
      return;
    }
    void invoke('update_html_preview', { sessionId, htmlContent: sourceRef.current })
      .then(() => invoke('reload_ide_panel', { panelId: PANEL_ID, sessionId }))
      .catch(cause => {
        if (sessionIdRef.current === sessionId) setError(cause instanceof Error ? cause.message : String(cause));
      });
  }, []);

  useEffect(() => {
    if (!rootPath) {
      return;
    }
    let cancelled = false;
    serverReadyRef.current = false;
    sessionIdRef.current = null;

    async function start() {
      setLoading(true);
      setError(null);
      const initialContent = sourceRef.current;
      try {
        const preview = await invoke<{ url: string; sessionId: string }>('start_html_preview', {
          rootPath,
          htmlPath,
          htmlContent: initialContent,
        });
        if (cancelled) {
          await invoke('destroy_html_preview_panel', { sessionId: preview.sessionId });
          return;
        }
        sessionIdRef.current = preview.sessionId;
        if (sourceRef.current !== initialContent) {
          await invoke('update_html_preview', { sessionId: preview.sessionId, htmlContent: sourceRef.current });
        }
        const element = containerRef.current;
        if (!element) throw new Error('Preview panel is not available');
        const rect = element.getBoundingClientRect();
        await invoke('embed_ide_panel', {
          panelId: PANEL_ID,
          url: preview.url,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
        if (cancelled) {
          await invoke('destroy_html_preview_panel', { sessionId: preview.sessionId });
          return;
        }
        serverReadyRef.current = true;
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void start();

    return () => {
      cancelled = true;
      serverReadyRef.current = false;
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sessionId) {
        void invoke('destroy_html_preview_panel', { sessionId }).catch(() => {});
      }
    };
  }, [rootPath, htmlPath, reloadKey]);

  useEffect(() => {
    if (!serverReadyRef.current) return;
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    const revision = ++updateRevisionRef.current;
    const timer = window.setTimeout(() => {
      updateQueueRef.current = updateQueueRef.current
        .then(async () => {
          await invoke('update_html_preview', { sessionId, htmlContent });
          if (revision === updateRevisionRef.current) {
            await invoke('reload_ide_panel', { panelId: PANEL_ID, sessionId });
          }
        })
        .catch(cause => {
          if (revision === updateRevisionRef.current && sessionIdRef.current === sessionId) {
            setError(cause instanceof Error ? cause.message : String(cause));
          }
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [htmlContent]);

  useEffect(() => {
    if (!serverReadyRef.current || refreshToken === 0) return;
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    void invoke('reload_ide_panel', { panelId: PANEL_ID, sessionId })
      .catch(cause => {
        if (sessionIdRef.current === sessionId) setError(cause instanceof Error ? cause.message : String(cause));
      });
  }, [refreshToken]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(syncBounds);
    observer.observe(element);
    window.addEventListener('resize', syncBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncBounds);
    };
  }, [syncBounds]);

  const previewError = error ?? (!rootPath ? 'Open a workspace folder before previewing a local HTML file.' : null);

  return (
    <section style={{ height: '100%', minHeight: 80, display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--r0-border-default)', background: 'var(--r0-bg-panel)' }}>
      <header style={{ height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', borderBottom: '1px solid var(--r0-border-default)' }}>
        <FileCode2 size={13} style={{ color: 'var(--r0-accent-blue)' }} />
        <span title={htmlPath} style={{ minWidth: 0, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: 'var(--r0-fg-muted)', fontSize: 11 }}>
          Live Preview — {htmlPath.split(/[\\/]/).pop()}
        </span>
        <button title="Refresh preview" onClick={refreshPreview} style={toolbarButton}>
          <RefreshCw size={13} />
        </button>
        <button title="Close preview" onClick={onClose} style={toolbarButton}>
          <X size={14} />
        </button>
      </header>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', background: 'var(--r0-bg-editor)' }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: 'transparent' }} />
        {(loading || previewError) && (
          <div role={previewError ? 'alert' : 'status'} style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16, background: 'var(--r0-bg-editor)', color: previewError ? 'var(--r0-semantic-error)' : 'var(--r0-fg-muted)', textAlign: 'center', fontSize: 11 }}>
            {previewError ? <span>{previewError}</span> : <Loader2 size={18} className="animate-spin" />}
            {previewError && rootPath && <button onClick={() => setReloadKey(key => key + 1)} style={{ ...toolbarButton, width: 'auto', padding: '4px 8px', color: 'var(--r0-fg-default)' }}>Retry</button>}
          </div>
        )}
      </div>
    </section>
  );
}

const toolbarButton: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 0,
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--r0-fg-muted)',
  cursor: 'pointer',
};
