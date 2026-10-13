import * as prettier from 'prettier/standalone';
import type { BuiltInParserName, Options, Plugin } from 'prettier';
import { invoke } from '@tauri-apps/api/core';
import { supportsLspFormatting } from './lspCm6';

type FormatRange = { from: number; to: number };

interface Formatter {
  parser: BuiltInParserName;
  plugins: () => Promise<Plugin[]>;
}

function repairMismatchedHeadingTags(source: string): { text: string; repaired: boolean } {
  let repaired = false;
  const text = source.replace(
    /<(h[1-6])(\s[^>]*)?>([\s\S]*?)<\/(h[1-6])\s*>/gi,
    (match, openingTag: string, attributes: string | undefined, content: string, closingTag: string) => {
      if (openingTag.toLowerCase() === closingTag.toLowerCase()) return match;
      repaired = true;
      return `<${closingTag}${attributes ?? ''}>${content}</${closingTag}>`;
    },
  );
  return { text, repaired };
}

const formatters: Record<string, Formatter> = {
  js: { parser: 'babel', plugins: async () => [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')] },
  jsx: { parser: 'babel', plugins: async () => [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')] },
  mjs: { parser: 'babel', plugins: async () => [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')] },
  mts: { parser: 'typescript', plugins: async () => [await import('prettier/plugins/typescript'), await import('prettier/plugins/estree')] },
  cts: { parser: 'typescript', plugins: async () => [await import('prettier/plugins/typescript'), await import('prettier/plugins/estree')] },
  cjs: { parser: 'babel', plugins: async () => [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')] },
  ts: { parser: 'typescript', plugins: async () => [await import('prettier/plugins/typescript'), await import('prettier/plugins/estree')] },
  tsx: { parser: 'typescript', plugins: async () => [await import('prettier/plugins/typescript'), await import('prettier/plugins/estree')] },
  json: { parser: 'json', plugins: async () => [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')] },
  jsonc: { parser: 'jsonc', plugins: async () => [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')] },
  html: { parser: 'html', plugins: async () => [await import('prettier/plugins/html')] },
  htm: { parser: 'html', plugins: async () => [await import('prettier/plugins/html')] },
  svg: { parser: 'html', plugins: async () => [await import('prettier/plugins/html')] },
  vue: { parser: 'vue', plugins: async () => [await import('prettier/plugins/html')] },
  graphql: { parser: 'graphql', plugins: async () => [await import('prettier/plugins/graphql')] },
  gql: { parser: 'graphql', plugins: async () => [await import('prettier/plugins/graphql')] },
  css: { parser: 'css', plugins: async () => [await import('prettier/plugins/postcss')] },
  scss: { parser: 'scss', plugins: async () => [await import('prettier/plugins/postcss')] },
  less: { parser: 'less', plugins: async () => [await import('prettier/plugins/postcss')] },
  md: { parser: 'markdown', plugins: async () => [await import('prettier/plugins/markdown')] },
  markdown: { parser: 'markdown', plugins: async () => [await import('prettier/plugins/markdown')] },
  mdx: { parser: 'mdx', plugins: async () => [await import('prettier/plugins/markdown')] },
  yaml: { parser: 'yaml', plugins: async () => [await import('prettier/plugins/yaml')] },
  yml: { parser: 'yaml', plugins: async () => [await import('prettier/plugins/yaml')] },
};

export function canFormat(path: string): boolean {
  return canFormatOffline(path) || supportsLspFormatting(path);
}

export function canFormatOffline(path: string): boolean {
  const extension = path.split(/[\\/]/).pop()?.split('.').pop()?.toLowerCase();
  return !!extension && extension in formatters;
}

export async function formatSource(
  source: string,
  path: string,
  range?: FormatRange,
  cursorOffset = source.length,
  workspaceRoot?: string | null,
): Promise<{ text: string; cursorOffset: number; repairedHtmlHeadings: boolean }> {
  const extension = path.split(/[\\/]/).pop()?.split('.').pop()?.toLowerCase();
  const formatter = extension ? formatters[extension] : undefined;
  if (!formatter) {
    const name = extension || 'this file';
    throw new Error(`No bundled formatter is available for ${name}. Install and configure a compatible formatter.`);
  }

  try {
    const headingRepair = extension === 'html' || extension === 'htm'
      ? repairMismatchedHeadingTags(source)
      : { text: source, repaired: false };
    let projectOptions: Options = {};
    if (workspaceRoot) {
      const rawConfig = await invoke<string | null>('read_prettier_config', {
        filePath: path,
        workspaceRoot,
      });
      if (rawConfig) {
        const config: unknown = JSON.parse(rawConfig);
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
          throw new Error('Prettier config must be a JSON object');
        }
        if ('plugins' in config) {
          throw new Error('Prettier config plugins are not loaded by the built-in formatter');
        }
        projectOptions = config as Options;
      }
    }
    const options: Options = {
      endOfLine: 'auto',
      ...projectOptions,
      parser: formatter.parser,
      plugins: await formatter.plugins(),
      filepath: path,
      ...(range ? { rangeStart: range.from, rangeEnd: range.to } : {}),
    };
    const result = await prettier.formatWithCursor(headingRepair.text, { ...options, cursorOffset });
    return {
      text: result.formatted,
      cursorOffset: result.cursorOffset,
      repairedHtmlHeadings: headingRepair.repaired,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const formattingError = new Error(
      `Prettier could not format ${path.split(/[\\/]/).pop() ?? path}: ${message}`,
    ) as Error & { cause: unknown };
    formattingError.cause = error;
    throw formattingError;
  }
}
