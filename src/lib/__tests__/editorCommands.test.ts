import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';
import type { EditorView } from '@codemirror/view';
import { insertNewlineInEmptyPair } from '../editorCommands';

function editorView(doc: string, cursor: number, unit?: string) {
  let state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: unit ? indentUnit.of(unit) : [],
  });
  const view = {
    get state() { return state; },
    dispatch(transaction: Parameters<EditorView['dispatch']>[0]) {
      state = state.update(transaction).state;
    },
  } as unknown as EditorView;
  return { view, get state() { return state; } };
}

describe('insertNewlineInEmptyPair', () => {
  it.each(['()', '[]', '{}'])('expands an empty %s pair with an indented cursor line', (pair) => {
    const fixture = editorView(pair, 1);

    expect(insertNewlineInEmptyPair(fixture.view)).toBe(true);
    expect(fixture.state.doc.toString()).toBe(`${pair[0]}\n  \n${pair[1]}`);
    expect(fixture.state.selection.main.head).toBe(4);
  });

  it('uses the configured indentation unit and retains current indentation', () => {
    const fixture = editorView('    {}', 5, '\t');

    expect(insertNewlineInEmptyPair(fixture.view)).toBe(true);
    expect(fixture.state.doc.toString()).toBe('    {\n    \t\n    }');
    expect(fixture.state.selection.main.head).toBe(11);
  });

  it('does not expand non-empty pairs or non-bracket pairs', () => {
    const nonEmpty = editorView('(value)', 1);
    const quotePair = editorView("''", 1);

    expect(insertNewlineInEmptyPair(nonEmpty.view)).toBe(false);
    expect(insertNewlineInEmptyPair(quotePair.view)).toBe(false);
    expect(nonEmpty.state.doc.toString()).toBe('(value)');
    expect(quotePair.state.doc.toString()).toBe("''");
  });
});
