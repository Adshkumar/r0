import { useSyncExternalStore } from 'react';
import { getSetting, setSetting } from './settings';

export const FILE_ICON_THEMES = [
  { id: 'r0', label: 'r0 File Icons', description: 'Colorful language and framework icons with context-aware folders.' },
  { id: 'vscode', label: 'VS Code-style File Icons', description: 'Familiar editor-inspired colors and file associations; not affiliated with Microsoft.' },
  { id: 'minimal', label: 'Minimal Icons', description: 'Subtle monochrome file and folder symbols.' },
] as const;

export type FileIconTheme = typeof FILE_ICON_THEMES[number]['id'];
const DEFAULT_FILE_ICON_THEME: FileIconTheme = 'r0';
const listeners = new Set<() => void>();
let currentTheme: FileIconTheme = DEFAULT_FILE_ICON_THEME;
let loadPromise: Promise<void> | null = null;
let revision = 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loadPromise) {
    const loadingRevision = revision;
    loadPromise = getSetting('explorer.fileIconTheme')
      .then(value => {
        if (loadingRevision === revision && FILE_ICON_THEMES.some(theme => theme.id === value)) {
          currentTheme = value;
        }
      })
      .catch(error => {
        console.error('Could not load the file icon theme setting:', error);
      })
      .finally(() => {
        for (const notify of listeners) notify();
      });
  }
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentTheme;
}

export function useFileIconTheme(): FileIconTheme {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export async function setFileIconTheme(theme: FileIconTheme): Promise<void> {
  revision += 1;
  await setSetting('explorer.fileIconTheme', theme);
  currentTheme = theme;
  for (const notify of listeners) notify();
}
