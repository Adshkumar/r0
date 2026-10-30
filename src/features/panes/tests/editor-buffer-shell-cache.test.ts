import { describe, expect, it } from "vite-plus/test";
import type { EditorContent } from "../types/pane-content.types";
import { EditorBufferShellCache } from "../services/editor-buffer-shell-cache";

const editor = (id: string, overrides: Partial<EditorContent> = {}) =>
  ({
    id,
    type: "editor",
    path: `/${id}.ts`,
    name: `${id}.ts`,
    readOnly: false,
    ...overrides,
  }) as EditorContent;

describe("editor buffer shell cache", () => {
  it("reuses stable pane props and invalidates them when visible metadata changes", () => {
    const cache = new EditorBufferShellCache();
    const initial = editor("a");
    const shell = cache.get(initial);

    expect(cache.get({ ...initial, content: "changed" })).toBe(shell);
    expect(cache.get({ ...initial, name: "renamed.ts" })).not.toBe(shell);
  });

  it("evicts least recently rendered entries after reaching its capacity", () => {
    const cache = new EditorBufferShellCache(2);
    const first = editor("first");
    const second = editor("second");
    const third = editor("third");
    const firstShell = cache.get(first);
    const secondShell = cache.get(second);

    expect(cache.get(first)).toBe(firstShell);
    cache.get(third);
    expect(cache.get(first)).toBe(firstShell);
    expect(cache.get(second)).not.toBe(secondShell);
  });
});
