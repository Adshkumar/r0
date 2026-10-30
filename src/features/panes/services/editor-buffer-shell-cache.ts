import type { EditorContent } from "../types/pane-content.types";

export type EditorBufferShell = Pick<EditorContent, "id" | "path" | "name" | "type" | "readOnly">;

/**
 * Keeps memoized pane props for recently rendered editor buffers without retaining every file
 * opened during a long-running session. The normal open-tab limit is 100; the extra headroom
 * allows multiple panes and recent tab switches to keep stable references.
 */
export class EditorBufferShellCache {
  private readonly shells = new Map<string, EditorBufferShell>();

  constructor(private readonly capacity = 128) {}

  get(buffer: EditorContent): EditorBufferShell {
    const cached = this.shells.get(buffer.id);
    if (
      cached &&
      cached.path === buffer.path &&
      cached.name === buffer.name &&
      cached.readOnly === buffer.readOnly
    ) {
      this.shells.delete(buffer.id);
      this.shells.set(buffer.id, cached);
      return cached;
    }

    const shell = {
      id: buffer.id,
      path: buffer.path,
      name: buffer.name,
      type: buffer.type,
      readOnly: buffer.readOnly,
    } satisfies EditorBufferShell;
    this.shells.delete(buffer.id);
    this.shells.set(buffer.id, shell);

    while (this.shells.size > Math.max(1, this.capacity)) {
      const oldestId = this.shells.keys().next().value;
      if (oldestId === undefined) break;
      this.shells.delete(oldestId);
    }

    return shell;
  }
}
