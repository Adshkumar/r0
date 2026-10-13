import { javascript } from '@codemirror/lang-javascript';
import { rust } from '@codemirror/lang-rust';
import { python } from '@codemirror/lang-python';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import { StreamLanguage } from '@codemirror/language';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { sCSS } from '@codemirror/legacy-modes/mode/css';
import { sass } from '@codemirror/legacy-modes/mode/sass';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import type { Extension } from '@codemirror/state';

export type EditorLanguage =
  | 'javascript' | 'typescript' | 'jsx' | 'tsx'
  | 'rust' | 'python' | 'css' | 'scss' | 'sass' | 'html'
  | 'json' | 'jsonc' | 'markdown' | 'yaml' | 'toml'
  | 'sql' | 'shell' | 'powershell' | 'plain';

export function detectEditorLanguage(path: string | null): EditorLanguage {
  if (!path || path.startsWith('__')) return 'plain';
  const ext = path.split(/[\\/]/).pop()?.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'js': case 'mjs': case 'cjs': return 'javascript';
    case 'ts': case 'mts': case 'cts': return 'typescript';
    case 'jsx': return 'jsx';
    case 'tsx': return 'tsx';
    case 'rs': return 'rust';
    case 'py': case 'pyi': return 'python';
    case 'css': return 'css';
    case 'scss': return 'scss';
    case 'sass': return 'sass';
    case 'html': case 'htm': return 'html';
    case 'svg': return 'html';
    case 'json': return 'json';
    case 'jsonc': return 'jsonc';
    case 'md': case 'mdx': case 'markdown': return 'markdown';
    case 'yaml': case 'yml': return 'yaml';
    case 'toml': return 'toml';
    case 'sql': return 'sql';
    case 'sh': case 'bash': case 'zsh': return 'shell';
    case 'ps1': case 'psm1': case 'psd1': return 'powershell';
    default: return 'plain';
  }
}

export function getLanguageExtension(path: string): Extension {
  switch (detectEditorLanguage(path)) {
    case 'typescript': return javascript({ typescript: true });
    case 'tsx': return javascript({ typescript: true, jsx: true });
    case 'javascript': return javascript();
    case 'jsx': return javascript({ jsx: true });
    case 'rust': return rust();
    case 'python': return python();
    case 'css': return css();
    case 'scss': return StreamLanguage.define(sCSS);
    case 'sass': return StreamLanguage.define(sass);
    case 'html': return html();
    case 'json': case 'jsonc': return json();
    case 'markdown': return markdown();
    case 'yaml': return yaml();
    case 'toml': return StreamLanguage.define(toml);
    case 'sql': return sql();
    case 'shell': return StreamLanguage.define(shell);
    case 'powershell': return StreamLanguage.define(powerShell);
    default: return [];
  }
}

export function languageLabel(path: string | null): string {
  switch (detectEditorLanguage(path)) {
    case 'typescript': return 'TypeScript';
    case 'tsx': return 'TypeScript JSX';
    case 'javascript': return 'JavaScript';
    case 'jsx': return 'JavaScript JSX';
    case 'rust': return 'Rust';
    case 'python': return 'Python';
    case 'css': return 'CSS';
    case 'scss': return 'SCSS';
    case 'sass': return 'Sass';
    case 'html': return 'HTML';
    case 'json': return 'JSON';
    case 'jsonc': return 'JSON with Comments';
    case 'markdown': return 'Markdown';
    case 'yaml': return 'YAML';
    case 'toml': return 'TOML';
    case 'sql': return 'SQL';
    case 'shell': return 'Shell Script';
    case 'powershell': return 'PowerShell';
    default: return 'Plain Text';
  }
}
