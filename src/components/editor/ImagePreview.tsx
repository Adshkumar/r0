import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Image as ImageIcon, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { readFileBytes } from '../../lib/fs';
import { getImageMimeType } from '../../lib/imagePreview';

interface Props {
  path: string;
}

export default function ImagePreview({ path }: Props) {
  const mimeType = getImageMimeType(path);
  const [image, setImage] = useState<{ path: string; src: string } | null>(null);
  const [loadError, setLoadError] = useState<{ path: string; message: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dimensions, setDimensions] = useState<{ path: string; width: number; height: number } | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    if (!mimeType) return;

    readFileBytes(path).then(bytes => {
      if (cancelled) return;
      const blob = new Blob([Uint8Array.from(bytes)], { type: mimeType });
      objectUrl = URL.createObjectURL(blob);
      setImage({ path, src: objectUrl });
    }).catch(cause => {
      if (!cancelled) setLoadError({ path, message: cause instanceof Error ? cause.message : String(cause) });
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, mimeType]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const filename = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  const src = image?.path === path ? image.src : null;
  const error = mimeType
    ? loadError?.path === path ? loadError.message : null
    : 'This image format is not supported.';
  const imageDimensions = dimensions?.path === path ? dimensions : null;
  const fitScale = imageDimensions && viewportSize.width > 0 && viewportSize.height > 0
    ? Math.min(1, (viewportSize.width - 48) / imageDimensions.width, (viewportSize.height - 48) / imageDimensions.height)
    : 1;
  const renderedWidth = imageDimensions ? imageDimensions.width * fitScale * zoom : 0;
  const renderedHeight = imageDimensions ? imageDimensions.height * fitScale * zoom : 0;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const stage = stageRef.current;
    if (!viewport || !stage) return;
    if (zoom <= 1) {
      viewport.scrollTo({ left: 0, top: 0 });
      return;
    }
    viewport.scrollTo({
      left: Math.max(0, (stage.scrollWidth - viewport.clientWidth) / 2),
      top: Math.max(0, (stage.scrollHeight - viewport.clientHeight) / 2),
    });
  }, [fitScale, renderedHeight, renderedWidth, viewportSize, zoom]);

  return (
    <section
      aria-label={`Image preview: ${filename}`}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--r0-bg-editor)',
      }}
    >
      <header
        style={{
          flexShrink: 0,
          minHeight: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0 14px',
          borderBottom: '1px solid var(--r0-border-default)',
          color: 'var(--r0-fg-muted)',
          fontSize: 11,
        }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={path}>
          {filename}
          {imageDimensions && <span style={{ marginLeft: 10, color: 'var(--r0-fg-subtle)' }}>{imageDimensions.width} × {imageDimensions.height}</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span aria-live="polite" style={{ minWidth: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <ToolbarButton label="Zoom out" onClick={() => setZoom(value => Math.max(0.1, +(value - 0.1).toFixed(1)))} disabled={zoom <= 0.1}>
            <ZoomOut size={14} />
          </ToolbarButton>
          <ToolbarButton label="Reset zoom" onClick={() => setZoom(1)}>
            <RotateCcw size={13} />
          </ToolbarButton>
          <ToolbarButton label="Zoom in" onClick={() => setZoom(value => Math.min(5, +(value + 0.1).toFixed(1)))} disabled={zoom >= 5}>
            <ZoomIn size={14} />
          </ToolbarButton>
        </div>
      </header>

      <div
        ref={viewportRef}
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: 'auto',
        }}
      >
        {error ? (
          <div style={{ alignSelf: 'center', margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--r0-fg-muted)', fontSize: 12 }}>
            <ImageIcon size={28} strokeWidth={1.4} />
            <span>Could not preview image</span>
            <span style={{ maxWidth: 420, color: 'var(--r0-semantic-error)', textAlign: 'center', overflowWrap: 'anywhere' }}>{error}</span>
          </div>
        ) : src ? (
          <div
            ref={stageRef}
            style={{
              width: Math.max(viewportSize.width, renderedWidth + 48),
              height: Math.max(viewportSize.height, renderedHeight + 48),
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <img
              src={src}
              alt={filename}
              onLoad={event => setDimensions({
                path,
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })}
              onError={() => setLoadError({ path, message: 'The image could not be decoded.' })}
              style={{
                display: 'block',
                width: renderedWidth || undefined,
                height: renderedHeight || undefined,
                flexShrink: 0,
                objectFit: 'contain',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.22)',
              }}
            />
          </div>
        ) : (
          <div role="status" style={{ minHeight: '100%', display: 'grid', placeItems: 'center', color: 'var(--r0-fg-subtle)', fontSize: 12 }}>
            Loading image…
          </div>
        )}
      </div>
    </section>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        border: '1px solid transparent',
        borderRadius: 5,
        color: disabled ? 'var(--r0-fg-subtle)' : 'var(--r0-fg-muted)',
        background: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={event => {
        if (!disabled) event.currentTarget.style.background = 'var(--r0-bg-hover)';
      }}
      onMouseLeave={event => { event.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}
