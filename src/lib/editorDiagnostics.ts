import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { Diagnostic } from '@codemirror/lint';
import * as ts from 'typescript';

function looksLikeJavaScriptOrTypeScript(source: string): boolean {
  return /\b(?:const|let|var|function|class|import|export|return|if|for|while|switch|try|catch|async|await|interface|type|enum|implements|extends|new)\b|=>|\b[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*/.test(source);
}

export function getParserDiagnostics(state: EditorState): Diagnostic[] {
  const source = state.doc.toString();
  if (looksLikeJavaScriptOrTypeScript(source)) {
    try {
      const result = ts.transpileModule(source, {
        compilerOptions: {
          allowJs: true,
          checkJs: true,
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        reportDiagnostics: true,
      });
      const hasSyntaxErrors = result.diagnostics?.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
      if (!hasSyntaxErrors) return [];
    } catch {
      // Fall through to the CodeMirror parse tree for languages that cannot be
      // validated by TypeScript’s parser.
    }
  }

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
