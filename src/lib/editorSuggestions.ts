import { useEffect, useSyncExternalStore } from 'react';
import {
  DEFAULT_EDITOR_SUGGESTION_SETTINGS,
  getSetting,
  hasSetting,
  setSetting,
  type EditorSuggestionSettings,
} from './settings';

let current = DEFAULT_EDITOR_SUGGESTION_SETTINGS;
let initialized = false;
let initialization: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(listener => listener());
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value)))
    : fallback;
}

export function validateEditorSuggestionSettings(value: unknown): EditorSuggestionSettings {
  const candidate = value && typeof value === 'object'
    ? value as Partial<EditorSuggestionSettings>
    : {};
  const defaults = DEFAULT_EDITOR_SUGGESTION_SETTINGS;
  const languageEnabled = candidate.languageEnabled && typeof candidate.languageEnabled === 'object'
    ? candidate.languageEnabled
    : {};

  return {
    enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : defaults.enabled,
    showWhileTyping: typeof candidate.showWhileTyping === 'boolean' ? candidate.showWhileTyping : defaults.showWhileTyping,
    manualSuggestions: typeof candidate.manualSuggestions === 'boolean' ? candidate.manualSuggestions : defaults.manualSuggestions,
    showDocumentation: typeof candidate.showDocumentation === 'boolean' ? candidate.showDocumentation : defaults.showDocumentation,
    showDetails: typeof candidate.showDetails === 'boolean' ? candidate.showDetails : defaults.showDetails,
    semanticIntelliSense: typeof candidate.semanticIntelliSense === 'boolean' ? candidate.semanticIntelliSense : defaults.semanticIntelliSense,
    inlineSuggestions: typeof candidate.inlineSuggestions === 'boolean' ? candidate.inlineSuggestions : defaults.inlineSuggestions,
    aiInlineCompletions: typeof candidate.aiInlineCompletions === 'boolean' ? candidate.aiInlineCompletions : defaults.aiInlineCompletions,
    showGhostText: typeof candidate.showGhostText === 'boolean' ? candidate.showGhostText : defaults.showGhostText,
    acceptWithTab: typeof candidate.acceptWithTab === 'boolean' ? candidate.acceptWithTab : defaults.acceptWithTab,
    languageEnabled: Object.fromEntries(
      Object.entries(defaults.languageEnabled).map(([language, enabled]) => [
        language,
        typeof languageEnabled[language] === 'boolean' ? languageEnabled[language] : enabled,
      ]),
    ),
    debounceMs: boundedNumber(candidate.debounceMs, defaults.debounceMs, 100, 2000),
    maxItems: boundedNumber(candidate.maxItems, defaults.maxItems, 5, 100),
  };
}

async function initialize(): Promise<void> {
  if (initialized) return;
  if (!initialization) {
    initialization = getSetting('editor.suggestions')
      .then(async value => {
        current = validateEditorSuggestionSettings(value);
        if (!await hasSetting('editor.suggestions')) {
          const legacyDelay = Number(localStorage.getItem('r0-editor-autocomplete-delay'));
          current = validateEditorSuggestionSettings({
            ...current,
            debounceMs: Number.isFinite(legacyDelay) && legacyDelay > 0 ? legacyDelay : current.debounceMs,
            aiInlineCompletions: localStorage.getItem('r0-editor-ai-autocomplete') !== 'false',
          });
        }
        initialized = true;
        notify();
      })
      .finally(() => {
        initialization = null;
      });
  }
  await initialization;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useEditorSuggestionSettings(): EditorSuggestionSettings {
  const settings = useSyncExternalStore(subscribe, () => current, () => DEFAULT_EDITOR_SUGGESTION_SETTINGS);
  useEffect(() => {
    void initialize().catch(error => {
      console.error('Could not load editor suggestion settings:', error);
    });
  }, []);
  return settings;
}

export function useEditorSuggestionSettingsLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => initialized, () => false);
}

export async function updateEditorSuggestionSettings(
  patch: Partial<EditorSuggestionSettings> & { language?: string; languageEnabledValue?: boolean },
): Promise<void> {
  await initialize();
  const { language, languageEnabledValue, ...settingsPatch } = patch;
  const next = validateEditorSuggestionSettings({
    ...current,
    ...settingsPatch,
    languageEnabled: language
      ? { ...current.languageEnabled, [language]: languageEnabledValue }
      : settingsPatch.languageEnabled ?? current.languageEnabled,
  });
  current = next;
  initialized = true;
  localStorage.setItem('r0-editor-ai-autocomplete', next.aiInlineCompletions ? 'true' : 'false');
  localStorage.setItem('r0-editor-autocomplete-delay', String(next.debounceMs));
  notify();
  await setSetting('editor.suggestions', next);
}

export async function restoreEditorSuggestionDefaults(): Promise<void> {
  await updateEditorSuggestionSettings(DEFAULT_EDITOR_SUGGESTION_SETTINGS);
}
