import { describe, expect, it } from 'vitest';
import { detectEditorLanguage, getLanguageExtension, languageLabel } from '../languageSupport';

describe('editor language detection and support', () => {
  it.each([
    ['C:\\work space\\src\\main.mjs', 'javascript'],
    ['C:\\work\\types.d.ts', 'typescript'],
    ['src\\component.tsx', 'tsx'],
    ['src\\view.jsx', 'jsx'],
    ['src\\main.py', 'python'],
    ['src\\main.rs', 'rust'],
    ['public\\index.html', 'html'],
    ['styles\\site.scss', 'scss'],
    ['styles\\site.sass', 'sass'],
    ['config\\app.jsonc', 'jsonc'],
    ['config\\app.yaml', 'yaml'],
    ['Cargo.toml', 'toml'],
    ['queries\\schema.sql', 'sql'],
    ['scripts\\setup.ps1', 'powershell'],
    ['scripts\\start.sh', 'shell'],
  ] as const)('detects %s as %s', (path, expected) => {
    expect(detectEditorLanguage(path)).toBe(expected);
    expect(getLanguageExtension(path)).not.toEqual([]);
  });

  it('keeps unknown file types as plain text', () => {
    expect(detectEditorLanguage('README.custom')).toBe('plain');
    expect(getLanguageExtension('README.custom')).toEqual([]);
    expect(languageLabel('README.custom')).toBe('Plain Text');
  });

  it('reports labels consistently with detected language', () => {
    expect(languageLabel('src/App.tsx')).toBe('TypeScript JSX');
    expect(languageLabel('config/settings.jsonc')).toBe('JSON with Comments');
    expect(languageLabel('scripts/build.ps1')).toBe('PowerShell');
  });
});
