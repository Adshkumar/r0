import { load, type Store } from '@tauri-apps/plugin-store';

export interface RecentProject {
  path: string;
  name: string;
}

export interface SavedTermTab {
  name: string;
  cwd: string;
}

export interface DebugLastConfig {
  adapter: string;
  adapterPath: string;
  program: string;
  args: string;
  cwd: string;
  stopOnEntry: boolean;
}

export interface EditorSuggestionSettings {
  enabled: boolean;
  showWhileTyping: boolean;
  manualSuggestions: boolean;
  showDocumentation: boolean;
  showDetails: boolean;
  semanticIntelliSense: boolean;
  inlineSuggestions: boolean;
  aiInlineCompletions: boolean;
  showGhostText: boolean;
  acceptWithTab: boolean;
  languageEnabled: Record<string, boolean>;
  debounceMs: number;
  maxItems: number;
}

export interface IDESettings {
  'sidebar.open': boolean;
  'sidebar.width': number;
  'panel.bottom.open': boolean;
  'panel.right.open': boolean;
  'theme': string;
  'onboarding.done': boolean;
  'recent.projects': RecentProject[];
  'workspace.folder': string;
  'terminal.open': boolean;
  'terminal.height': number;
  'terminal.tabs': SavedTermTab[];
  'terminal.activeIndex': number;
  'debug.lastLaunchConfig': DebugLastConfig | null;
  'editor.suggestions': EditorSuggestionSettings;
  'editor.formatOnSave': boolean;
}

export const DEFAULT_EDITOR_SUGGESTION_SETTINGS: EditorSuggestionSettings = {
  enabled: true,
  showWhileTyping: true,
  manualSuggestions: true,
  showDocumentation: true,
  showDetails: true,
  semanticIntelliSense: true,
  inlineSuggestions: true,
  aiInlineCompletions: true,
  showGhostText: true,
  acceptWithTab: true,
  languageEnabled: {
    javascript: true,
    typescript: true,
    python: true,
    rust: true,
    html: true,
    css: true,
    json: true,
    other: true,
  },
  debounceMs: 350,
  maxItems: 30,
};

const DEFAULTS: IDESettings = {
  'sidebar.open': true,
  'sidebar.width': 240,
  'panel.bottom.open': false,
  'panel.right.open': false,
  'theme': '',
  'onboarding.done': false,
  'recent.projects': [],
  'workspace.folder': '',
  'terminal.open': false,
  'terminal.height': 240,
  'terminal.tabs': [],
  'terminal.activeIndex': 0,
  'debug.lastLaunchConfig': null,
  'editor.suggestions': DEFAULT_EDITOR_SUGGESTION_SETTINGS,
  'editor.formatOnSave': false,
};

let _store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!_store) _store = await load('settings.json', { autoSave: true, defaults: {} });
  return _store;
}

export async function getSetting<K extends keyof IDESettings>(key: K): Promise<IDESettings[K]> {
  const store = await getStore();
  const value = await store.get<IDESettings[K]>(key);
  return value ?? DEFAULTS[key];
}

export async function setSetting<K extends keyof IDESettings>(key: K, value: IDESettings[K]): Promise<void> {
  const store = await getStore();
  await store.set(key, value);
}

export async function hasSetting<K extends keyof IDESettings>(key: K): Promise<boolean> {
  const store = await getStore();
  return store.has(key);
}

export async function pushRecentProject(project: RecentProject): Promise<void> {
  const current = await getSetting('recent.projects');
  const filtered = current.filter(p => p.path !== project.path);
  await setSetting('recent.projects', [project, ...filtered].slice(0, 10));
}

export async function loadAllSettings(): Promise<IDESettings> {
  const keys = Object.keys(DEFAULTS) as (keyof IDESettings)[];
  const entries = await Promise.all(keys.map(async k => [k, await getSetting(k)]));
  return Object.fromEntries(entries) as IDESettings;
}
