import { describe, expect, it } from 'vitest';
import { convertVsCodeTheme } from '../extensions';

describe('convertVsCodeTheme', () => {
  it('maps VS Code theme colors and token scopes to r0 theme tokens', () => {
    const converted = convertVsCodeTheme(
      'Open VSX: test.theme / Test',
      'vs-dark',
      JSON.stringify({
        colors: {
          'editor.background': '#101820',
          'editor.foreground': '#f0f0f0',
          'focusBorder': 'url(https://invalid.test)',
        },
        tokenColors: [
          { scope: ['keyword.control', 'storage.type'], settings: { foreground: '#ff00aa' } },
          { scope: 'comment.line', settings: { foreground: '#789' } },
        ],
      }),
      { 'syntax.string': '#00ff00' },
    );

    expect(converted.type).toBe('dark');
    expect(converted.colors['bg.editor']).toBe('#101820');
    expect(converted.colors['fg.default']).toBe('#f0f0f0');
    expect(converted.colors['syntax.keyword']).toBe('#ff00aa');
    expect(converted.colors['syntax.comment']).toBe('#789');
    expect(converted.colors['syntax.string']).toBe('#00ff00');
    expect(converted.colors['accent.blue']).toBeUndefined();
  });

  it('recognizes light color themes', () => {
    expect(convertVsCodeTheme('Light', 'vs', '{"colors":{}}').type).toBe('light');
  });
});
