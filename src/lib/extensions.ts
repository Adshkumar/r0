import { invoke } from '@tauri-apps/api/core';

export interface ExtensionThemeContribution {
  id: string;
  label: string;
  uiTheme: string;
  path: string;
}

export interface InstalledExtension {
  namespace: string;
  name: string;
  version: string;
  displayName: string;
  description: string;
  publisher: string;
  sha256: string;
  packageFile: string;
  enabled: boolean;
  installedAt: number;
  contributions: string[];
  themes: ExtensionThemeContribution[];
  dependencies: string[];
}

export interface OpenVsxExtension {
  namespace: string;
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  downloadCount?: number;
  averageRating?: number;
  reviewCount?: number;
  files: { download: string; sha256?: string; icon?: string };
}

export interface OpenVsxSearch {
  extensions: OpenVsxExtension[];
}

export function listExtensions(): Promise<InstalledExtension[]> {
  return invoke<InstalledExtension[]>('extension_list');
}

export function installExtension(extension: OpenVsxExtension): Promise<InstalledExtension> {
  return invoke<InstalledExtension>('extension_install', {
    namespace: extension.namespace,
    name: extension.name,
    version: extension.version,
    displayName: extension.displayName ?? extension.name,
    description: extension.description ?? '',
    downloadUrl: extension.files.download,
    checksumUrl: extension.files.sha256 ?? '',
  });
}

export function setExtensionEnabled(
  namespace: string,
  name: string,
  enabled: boolean,
): Promise<InstalledExtension[]> {
  return invoke<InstalledExtension[]>('extension_set_enabled', { namespace, name, enabled });
}

export function uninstallExtension(
  namespace: string,
  name: string,
): Promise<InstalledExtension[]> {
  return invoke<InstalledExtension[]>('extension_uninstall', { namespace, name });
}

export function readExtensionTheme(
  namespace: string,
  name: string,
  themePath: string,
): Promise<string> {
  return invoke<string>('extension_read_theme', { namespace, name, themePath });
}

const COLOR_MAP: Record<string, string> = {
  'editor.background': 'bg.editor',
  'editor.foreground': 'fg.default',
  'editor.selectionBackground': 'bg.selection',
  'editorLineNumber.foreground': 'fg.subtle',
  'editorLineNumber.activeForeground': 'fg.muted',
  'sideBar.background': 'bg.sidebar',
  'sideBar.foreground': 'fg.default',
  'panel.background': 'bg.panel',
  'input.background': 'bg.input',
  'button.background': 'accent.blue',
  'focusBorder': 'accent.blue',
  'terminal.foreground': 'terminal.fg',
};

function validColor(value: unknown): value is string {
  return typeof value === 'string'
    && (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value) || /^rgba?\([\d.,%\s]+\)$/i.test(value));
}

function tokenColor(scopes: unknown, token: string): boolean {
  const list = Array.isArray(scopes) ? scopes : [scopes];
  return list.some(scope => typeof scope === 'string' && scope.split(/[ ,]+/).some(part => part.startsWith(token)));
}

export function convertVsCodeTheme(
  label: string,
  uiTheme: string,
  source: string,
  baseColors: Record<string, string> = {},
): { name: string; type: 'dark' | 'light'; colors: Record<string, string> } {
  const parsed = JSON.parse(source) as {
    colors?: Record<string, unknown>;
    tokenColors?: Array<{ scope?: string | string[]; settings?: { foreground?: unknown } }>;
  };
  const normalizedUiTheme = uiTheme.toLowerCase();
  const type = normalizedUiTheme === 'vs' || normalizedUiTheme.includes('light') ? 'light' : 'dark';
  const colors: Record<string, string> = { ...baseColors };

  for (const [key, value] of Object.entries(parsed.colors ?? {})) {
    const token = COLOR_MAP[key];
    if (token && validColor(value)) colors[token] = value;
  }

  const syntaxKeys: Array<[string, string[]]> = [
    ['syntax.comment', ['comment']],
    ['syntax.keyword', ['keyword', 'storage']],
    ['syntax.string', ['string']],
    ['syntax.function', ['entity.name.function', 'support.function']],
    ['syntax.variable', ['variable']],
    ['syntax.constant', ['constant']],
    ['syntax.type', ['entity.name.type', 'support.type', 'storage.type']],
    ['syntax.attribute', ['entity.other.attribute-name']],
  ];
  const assignedSyntaxColors = new Set<string>();
  for (const entry of parsed.tokenColors ?? []) {
    const foreground = entry.settings?.foreground;
    if (!validColor(foreground)) continue;
    for (const [token, scopes] of syntaxKeys) {
      if (!assignedSyntaxColors.has(token) && scopes.some(scope => tokenColor(entry.scope, scope))) {
        colors[token] = foreground;
        assignedSyntaxColors.add(token);
      }
    }
  }
  return { name: label, type, colors };
}
