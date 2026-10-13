import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { getLanguageExtension } from '../../components/editor/languageSupport';
import { getParserDiagnostics } from '../editorDiagnostics';

describe('parser diagnostics', () => {
  it('does not report parser errors for valid JavaScript', () => {
    const state = EditorState.create({
      doc: 'const answer = 42;\nconsole.log(answer);',
      extensions: [getLanguageExtension('example.js')],
    });

    expect(getParserDiagnostics(state)).toEqual([]);
  });

  it('reports only actual parser error nodes', () => {
    const state = EditorState.create({
      doc: 'const answer = ;',
      extensions: [getLanguageExtension('example.js')],
    });

    const diagnostics = getParserDiagnostics(state);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.every(diagnostic => diagnostic.severity === 'error')).toBe(true);
    expect(diagnostics.every(diagnostic => diagnostic.source === 'Parser')).toBe(true);
  });
});
