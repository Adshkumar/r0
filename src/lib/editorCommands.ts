import type { EditorView } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';

const EMPTY_PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
};

export function insertNewlineInEmptyPair(view: EditorView): boolean {
  const { state } = view;
  const selection = state.selection.main;
  if (!selection.empty || selection.head === 0 || selection.head >= state.doc.length) return false;

  const before = state.sliceDoc(selection.head - 1, selection.head);
  const after = state.sliceDoc(selection.head, selection.head + 1);
  if (EMPTY_PAIRS[before] !== after) return false;

  const line = state.doc.lineAt(selection.head);
  if (line.text.slice(selection.head - line.from + 1).trim()) return false;

  const baseIndent = line.text.match(/^\s*/)?.[0] ?? '';
  const innerIndent = baseIndent + state.facet(indentUnit);
  const insert = `\n${innerIndent}\n${baseIndent}`;
  view.dispatch({
    changes: { from: selection.head, insert },
    selection: { anchor: selection.head + 1 + innerIndent.length },
    userEvent: 'input',
  });
  return true;
}
