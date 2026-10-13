import { describe, expect, it } from 'vitest';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { createLocalCompletionSource } from '../localCompletions';

const defaults = {
  showDocumentation: true,
  showDetails: true,
  maxItems: 100,
};

async function complete(path: string, document: string, explicit = false) {
  const state = EditorState.create({ doc: document });
  const source = createLocalCompletionSource(path, defaults);
  return await source(new CompletionContext(state, document.length, explicit));
}

describe('local language-aware completions', () => {
  it('offers relevant Console members after a JavaScript dot', async () => {
    const result = await complete('app.js', 'console.');

    expect(result?.from).toBe('console.'.length);
    expect(result?.options.map(option => option.label)).toContain('log');
    expect(result?.options.map(option => option.label)).toContain('warn');
    expect(result?.options.map(option => option.label)).not.toContain('sqrt');
  });

  it('offers local JavaScript declarations and language built-ins', async () => {
    const result = await complete('app.ts', 'const calculateTotal = () => 0;\ncalcul');

    expect(result?.options.map(option => option.label)).toContain('calculateTotal');
    expect(result?.options.map(option => option.label)).not.toContain('print');
  });

  it('filters completions by the current language', async () => {
    const python = await complete('app.py', 'pri');
    const rust = await complete('main.rs', 'prin');

    expect(python?.options.map(option => option.label)).toContain('print');
    expect(rust).toBeNull();
  });

  it('does not open an automatic popup for an empty token', async () => {
    expect(await complete('app.js', '')).toBeNull();
    expect((await complete('app.js', '', true))?.options.length).toBeGreaterThan(0);
  });
});
