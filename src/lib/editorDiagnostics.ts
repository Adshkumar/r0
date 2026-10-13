import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { Diagnostic } from '@codemirror/lint';

export function getParserDiagnostics(state: EditorState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (!node.type.isError) return;
      diagnostics.push({
        from: node.from,
        to: node.to,
        severity: 'error',
        message: 'Parser reported unexpected or incomplete syntax.',
        source: 'Parser',
      });
    },
  });
  return diagnostics;
}
