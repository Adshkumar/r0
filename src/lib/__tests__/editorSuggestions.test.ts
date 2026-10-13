import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITOR_SUGGESTION_SETTINGS } from '../settings';
import { validateEditorSuggestionSettings } from '../editorSuggestions';

describe('editor suggestion settings validation', () => {
  it('fills missing options with defaults', () => {
    expect(validateEditorSuggestionSettings({ enabled: false })).toEqual({
      ...DEFAULT_EDITOR_SUGGESTION_SETTINGS,
      enabled: false,
      languageEnabled: DEFAULT_EDITOR_SUGGESTION_SETTINGS.languageEnabled,
    });
  });

  it('bounds performance settings and ignores invalid values', () => {
    const settings = validateEditorSuggestionSettings({
      debounceMs: 12_000,
      maxItems: 1,
      showWhileTyping: 'yes',
      languageEnabled: { python: false, rust: 'off' },
    });

    expect(settings.debounceMs).toBe(2000);
    expect(settings.maxItems).toBe(5);
    expect(settings.showWhileTyping).toBe(true);
    expect(settings.languageEnabled.python).toBe(false);
    expect(settings.languageEnabled.rust).toBe(true);
  });
});
