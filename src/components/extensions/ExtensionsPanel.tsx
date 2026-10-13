import { useCallback, useEffect, useMemo, useState } from 'react';
import { Blocks, Check, Download, ExternalLink, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useTheme } from '../../themes/ThemeContext';
import {
  convertVsCodeTheme,
  installExtension,
  listExtensions,
  readExtensionTheme,
  setExtensionEnabled,
  uninstallExtension,
  type InstalledExtension,
  type OpenVsxExtension,
} from '../../lib/extensions';

type View = 'marketplace' | 'installed' | 'updates';
type InstalledFilter = 'all' | 'enabled' | 'disabled';

const OPEN_VSX = 'https://open-vsx.org';

function keyOf(extension: Pick<InstalledExtension, 'namespace' | 'name'> | Pick<OpenVsxExtension, 'namespace' | 'name'>) {
  return `${extension.namespace}.${extension.name}`.toLowerCase();
}

function formatDownloads(count?: number) {
  if (count === undefined) return '';
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(count);
}

export default function ExtensionsPanel() {
  const { theme, themes, setTheme } = useTheme();
  const [view, setView] = useState<View>('marketplace');
  const [installedFilter, setInstalledFilter] = useState<InstalledFilter>('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpenVsxExtension[]>([]);
  const [updates, setUpdates] = useState<OpenVsxExtension[]>([]);
  const [installed, setInstalled] = useState<InstalledExtension[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [installedLoading, setInstalledLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [applyingTheme, setApplyingTheme] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refreshInstalled = useCallback(async () => {
    setInstalledLoading(true);
    try {
      setInstalled(await listExtensions());
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setInstalledLoading(false);
    }
  }, []);

  useEffect(() => {
    listExtensions()
      .then(setInstalled)
      .catch(cause => setActionError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setInstalledLoading(false));
  }, []);

  useEffect(() => {
    if (view !== 'marketplace') return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          size: '30',
          sortBy: query.trim() ? 'relevance' : 'downloadCount',
          sortOrder: 'desc',
        });
        if (query.trim()) params.set('query', query.trim());
        const response = await fetch(`${OPEN_VSX}/api/-/search?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Open VSX search failed (${response.status})`);
        const data = await response.json() as { extensions?: OpenVsxExtension[] };
        setResults(Array.isArray(data.extensions) ? data.extensions : []);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, view, refreshToken]);

  useEffect(() => {
    if (view !== 'updates' || !installed.length) return;
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setUpdatesLoading(true);
      setError(null);
      try {
        const items = await Promise.all(installed.slice(0, 30).map(async extension => {
          const response = await fetch(
            `${OPEN_VSX}/api/${encodeURIComponent(extension.namespace)}/${encodeURIComponent(extension.name)}`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error(`Could not check updates for ${keyOf(extension)} (${response.status})`);
          const latest = await response.json() as OpenVsxExtension;
          return latest.version !== extension.version ? latest : null;
        }));
        if (!controller.signal.aborted) {
          setUpdates(items.filter((item): item is OpenVsxExtension => item !== null));
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setUpdates([]);
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      } finally {
        if (!controller.signal.aborted) setUpdatesLoading(false);
      }
    });
    return () => controller.abort();
  }, [view, installed, refreshToken]);

  const installedByKey = useMemo(
    () => new Map(installed.map(extension => [keyOf(extension), extension])),
    [installed],
  );

  const shownExtensions = view === 'updates'
    ? installed.length ? updates : []
    : results;
  const visibleInstalled = installed.filter(extension =>
    installedFilter === 'all'
    || (installedFilter === 'enabled' ? extension.enabled : !extension.enabled)
  );
  const loading = view === 'marketplace'
    ? searchLoading
    : view === 'updates'
      ? installed.length > 0 && updatesLoading
      : installedLoading;

  async function install(extension: OpenVsxExtension) {
    const key = keyOf(extension);
    setBusyKey(key);
    setActionError(null);
    try {
      await installExtension(extension);
      await refreshInstalled();
      setView('installed');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyKey(null);
    }
  }

  async function setEnabled(extension: InstalledExtension, enabled: boolean) {
    const key = keyOf(extension);
    setBusyKey(key);
    setActionError(null);
    try {
      setInstalled(await setExtensionEnabled(extension.namespace, extension.name, enabled));
      if (!enabled && theme.name.startsWith(`Open VSX: ${extension.namespace}.${extension.name} /`)) {
        setTheme(themes.find(item => item.type === theme.type) ?? themes[0]);
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyKey(null);
    }
  }

  async function uninstall(extension: InstalledExtension) {
    if (!window.confirm(`Uninstall ${extension.displayName}? Its downloaded package will be removed.`)) return;
    setBusyKey(keyOf(extension));
    setActionError(null);
    try {
      setInstalled(await uninstallExtension(extension.namespace, extension.name));
      if (theme.name.startsWith(`Open VSX: ${extension.namespace}.${extension.name} /`)) {
        setTheme(themes.find(item => item.type === theme.type) ?? themes[0]);
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyKey(null);
    }
  }

  async function applyTheme(extension: InstalledExtension, themePath: string, label: string, uiTheme: string) {
    const key = `${keyOf(extension)}:${themePath}`;
    setApplyingTheme(key);
    setActionError(null);
    try {
      const source = await readExtensionTheme(extension.namespace, extension.name, themePath);
      const name = `Open VSX: ${extension.namespace}.${extension.name} / ${label}`;
      const baseTheme = themes.find(item => item.type === (uiTheme.toLowerCase().includes('light') ? 'light' : 'dark')) ?? theme;
      setTheme(convertVsCodeTheme(name, uiTheme, source, baseTheme.colors));
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setApplyingTheme(null);
    }
  }

  return (
    <section className="flex-1 min-h-0 flex flex-col overflow-hidden" aria-label="Extensions">
      <div style={{ padding: '12px 12px 8px', color: 'var(--r0-fg-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '.7px', textTransform: 'uppercase' }}>
        Extensions: Open VSX
      </div>
      <label style={{
        margin: '0 10px 10px', height: 30, display: 'flex', alignItems: 'center', gap: 7, padding: '0 8px',
        border: '1px solid var(--r0-border-default)', borderRadius: 4, background: 'var(--r0-bg-input)',
      }}>
        <Search size={13} style={{ color: 'var(--r0-fg-subtle)', flexShrink: 0 }} />
        <input
          aria-label="Search Open VSX extensions"
          placeholder="Search extensions"
          value={query}
          onChange={event => setQuery(event.target.value)}
          style={{ width: '100%', border: 0, outline: 0, background: 'transparent', color: 'var(--r0-fg-default)', fontSize: 11 }}
        />
      </label>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--r0-border-default)', padding: '0 8px' }}>
        {([
          ['marketplace', 'Marketplace'],
          ['installed', `Installed${installed.length ? ` (${installed.length})` : ''}`],
          ['updates', 'Updates'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            style={{
              padding: '7px 5px', margin: '0 3px', border: 0,
              borderBottom: view === id ? '1px solid var(--r0-accent-blue)' : '1px solid transparent',
              background: 'transparent', color: view === id ? 'var(--r0-fg-default)' : 'var(--r0-fg-muted)',
              fontSize: 10, cursor: 'pointer',
            }}
          >{label}</button>
        ))}
      </div>
      <div style={{ margin: '8px 10px', padding: '8px', borderRadius: 4, background: 'var(--r0-bg-hover)', color: 'var(--r0-fg-subtle)', fontSize: 10, lineHeight: 1.45 }}>
        Open VSX packages are SHA-256 and manifest-identity checked, but publisher signatures are not verified. r0 never executes downloaded code: declared color themes can be applied; VS Code APIs and other contributions are unsupported.
      </div>
      {actionError && (
        <div role="alert" style={{ margin: '0 10px 8px', color: 'var(--r0-semantic-error)', fontSize: 10, lineHeight: 1.45 }}>
          {actionError}
          <button onClick={() => { setActionError(null); void refreshInstalled(); }} style={{ display: 'block', marginTop: 4, color: 'var(--r0-accent-blue)', border: 0, padding: 0, background: 'none', cursor: 'pointer', fontSize: 10 }}>
            Retry
          </button>
        </div>
      )}
      {view === 'installed' && (
        <div style={{ display: 'flex', gap: 5, padding: '0 10px 8px' }}>
          {([
            ['all', 'All'],
            ['enabled', 'Enabled'],
            ['disabled', 'Disabled'],
          ] as const).map(([filter, label]) => (
            <button key={filter} onClick={() => setInstalledFilter(filter)} style={{
              padding: '3px 7px', border: '1px solid var(--r0-border-default)', borderRadius: 4,
              background: installedFilter === filter ? 'var(--r0-bg-active)' : 'transparent',
              color: installedFilter === filter ? 'var(--r0-fg-default)' : 'var(--r0-fg-muted)',
              fontSize: 9, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {view === 'installed' ? (
          installedLoading ? (
            <Loading />
          ) : visibleInstalled.length ? visibleInstalled.map(extension => (
            <article key={keyOf(extension)} style={{ padding: '10px 12px', borderBottom: '1px solid var(--r0-border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <ExtensionIcon />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--r0-fg-default)' }}>{extension.displayName}</div>
                  <div style={{ marginTop: 2, color: 'var(--r0-fg-subtle)', fontSize: 10 }}>{extension.namespace}.{extension.name} · {extension.version}</div>
                  <p style={{ margin: '6px 0', color: 'var(--r0-fg-muted)', fontSize: 10, lineHeight: 1.45 }}>{extension.description || 'No description provided.'}</p>
                  <div style={{ color: 'var(--r0-fg-subtle)', fontSize: 9, wordBreak: 'break-word' }}>
                    SHA-256 {extension.sha256.slice(0, 16)}… · {extension.contributions.length ? extension.contributions.join(', ') : 'No declared contributions'}
                  </div>
                  {extension.dependencies.length > 0 && (
                    <div style={{ marginTop: 4, color: 'var(--r0-semantic-warning)', fontSize: 9 }}>
                      Dependencies are not installed automatically: {extension.dependencies.join(', ')}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                    {extension.themes.length > 0 ? (
                      <button
                        disabled={busyKey === keyOf(extension)}
                        onClick={() => void setEnabled(extension, !extension.enabled)}
                        style={actionStyle(extension.enabled)}
                      >
                        {busyKey === keyOf(extension) ? <Loader2 size={11} className="animate-spin" /> : extension.enabled ? <Check size={11} /> : null}
                        {extension.enabled ? 'Themes enabled' : 'Enable themes'}
                      </button>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--r0-fg-subtle)', fontSize: 9 }}>
                        Stored only · no r0 activation
                      </span>
                    )}
                    {extension.enabled && extension.themes.map(contribution => {
                      const themeKey = `${keyOf(extension)}:${contribution.path}`;
                      return (
                        <button key={themeKey} disabled={applyingTheme === themeKey} onClick={() => void applyTheme(extension, contribution.path, contribution.label, contribution.uiTheme)} style={actionStyle(false)}>
                          {applyingTheme === themeKey ? <Loader2 size={11} className="animate-spin" /> : null}
                          Apply {contribution.label}
                        </button>
                      );
                    })}
                    <button disabled={busyKey === keyOf(extension)} onClick={() => void uninstall(extension)} style={{ ...actionStyle(false), color: 'var(--r0-semantic-error)' }}>
                      <Trash2 size={11} /> Uninstall
                    </button>
                  </div>
                </div>
              </div>
            </article>
          )) : <Empty label={installed.length ? 'No extensions in this filter.' : 'No extensions installed.'} />
        ) : loading ? (
          <Loading />
        ) : error ? (
          <div style={{ padding: 12, color: 'var(--r0-semantic-error)', fontSize: 11, lineHeight: 1.5 }}>
            {error}
            <button onClick={() => setQuery(value => `${value} `)} style={{ marginTop: 6, display: 'block', color: 'var(--r0-accent-blue)', border: 0, background: 'none', cursor: 'pointer', fontSize: 10 }}>
              Retry search
            </button>
          </div>
        ) : shownExtensions.length ? shownExtensions.map(extension => {
          const installedExtension = installedByKey.get(keyOf(extension));
          const busy = busyKey === keyOf(extension);
          return (
            <article key={keyOf(extension)} style={{ padding: '10px 12px', borderBottom: '1px solid var(--r0-border-subtle)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <ExtensionIcon url={extension.files.icon} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--r0-fg-default)' }}>{extension.displayName || extension.name}</span>
                    <span style={{ fontSize: 9, color: 'var(--r0-fg-subtle)' }}>v{extension.version}</span>
                  </div>
                  <div style={{ marginTop: 2, color: 'var(--r0-fg-subtle)', fontSize: 10 }}>{extension.namespace}.{extension.name}</div>
                  <p style={{ margin: '6px 0', color: 'var(--r0-fg-muted)', fontSize: 10, lineHeight: 1.45 }}>{extension.description || 'No description provided.'}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--r0-fg-subtle)', fontSize: 9 }}>
                      {formatDownloads(extension.downloadCount)} downloads · Open VSX
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => void openUrl(`${OPEN_VSX}/${encodeURIComponent(extension.namespace)}/${encodeURIComponent(extension.name)}`).catch(cause => setActionError(String(cause)))} title="View on Open VSX" style={actionStyle(false)}>
                        <ExternalLink size={11} />
                      </button>
                      {installedExtension?.version === extension.version ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--r0-semantic-success)', fontSize: 9 }}>
                          <Check size={11} /> Installed
                        </span>
                      ) : (
                        <button disabled={busy} onClick={() => void install(extension)} style={actionStyle(true)}>
                          {busy ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                          {installedExtension || view === 'updates' ? 'Update' : 'Install'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        }) : <Empty label={view === 'updates' ? 'All checked extensions are up to date.' : 'No matching extensions found.'} />
        }
      </div>
      {view === 'updates' && installed.length > 30 && (
        <div style={{ padding: 8, color: 'var(--r0-fg-subtle)', fontSize: 9 }}>Update checks are limited to the first 30 installed extensions.</div>
      )}
      <button onClick={() => { setError(null); setRefreshToken(value => value + 1); if (view === 'installed') void refreshInstalled(); }} style={{ border: 0, borderTop: '1px solid var(--r0-border-default)', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, color: 'var(--r0-fg-muted)', background: 'transparent', cursor: 'pointer', fontSize: 10 }}>
        <RefreshCw size={11} /> Refresh
      </button>
    </section>
  );
}

function actionStyle(primary: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    minHeight: 22, padding: '3px 7px', border: '1px solid var(--r0-border-default)',
    borderRadius: 4, background: primary ? 'var(--r0-bg-active)' : 'transparent',
    color: primary ? 'var(--r0-fg-default)' : 'var(--r0-fg-muted)',
    fontSize: 9, cursor: 'pointer',
  };
}

function Loading() {
  return <div style={{ padding: 16, display: 'flex', justifyContent: 'center', color: 'var(--r0-fg-muted)' }}><Loader2 size={15} className="animate-spin" /></div>;
}

function Empty({ label }: { label: string }) {
  return <div style={{ padding: 18, color: 'var(--r0-fg-subtle)', textAlign: 'center', fontSize: 10 }}>{label}</div>;
}

function ExtensionIcon({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <Blocks size={18} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)', marginTop: 1 }} />;
  let trusted = false;
  try { trusted = new URL(url).protocol === 'https:' && new URL(url).hostname === 'open-vsx.org'; } catch { /* show fallback icon */ }
  if (!trusted) return <Blocks size={18} style={{ flexShrink: 0, color: 'var(--r0-fg-muted)', marginTop: 1 }} />;
  return <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} style={{ width: 20, height: 20, flexShrink: 0, objectFit: 'contain', borderRadius: 3 }} />;
}
