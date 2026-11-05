import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  buffer: {
    id: "diagram",
    type: "editor",
    content: "flowchart TD\n  A --> B",
    isVirtual: true,
  } as {
    id: string;
    type: string;
    content: string;
    isVirtual: boolean;
    readOnly?: boolean;
  },
  updateBufferContent: vi.fn(),
  trackHistory: vi.fn(),
}));

vi.mock("@/features/editor/services/buffer-history-tracking", () => ({
  trackImmediateBufferHistoryChange: mocks.trackHistory,
}));
vi.mock("@/features/editor/services/buffer-text", () => ({
  readBufferText: (buffer: typeof mocks.buffer) => buffer.content,
}));
vi.mock("@/features/editor/stores/buffer.store", () => ({
  useBufferStore: {
    getState: () => ({
      buffers: [mocks.buffer],
      actions: { updateBufferContent: mocks.updateBufferContent },
    }),
  },
}));
vi.mock("@/features/editor/stores/state.store", () => ({
  useEditorStateStore: {
    getState: () => ({ cursorPosition: undefined, selection: undefined }),
  },
}));

import { applyDiagramSourceEdit } from "../services/apply-diagram-source-edit";

describe("apply diagram source edits", () => {
  beforeEach(() => {
    mocks.buffer.content = "flowchart TD\n  A --> B";
    mocks.buffer.isVirtual = true;
    mocks.buffer.readOnly = false;
    vi.clearAllMocks();
  });

  it("applies edits to an editable virtual diagram buffer", () => {
    expect(applyDiagramSourceEdit("diagram", "flowchart TD\n  A --> C")).toBe(true);

    expect(mocks.trackHistory).toHaveBeenCalledWith(
      expect.objectContaining({ bufferId: "diagram" }),
    );
    expect(mocks.updateBufferContent).toHaveBeenCalledWith(
      "diagram",
      "flowchart TD\n  A --> C",
      true,
    );
  });

  it("does not apply edits to a read-only buffer", () => {
    mocks.buffer.readOnly = true;

    expect(applyDiagramSourceEdit("diagram", "flowchart TD\n  A --> C")).toBe(false);
    expect(mocks.trackHistory).not.toHaveBeenCalled();
    expect(mocks.updateBufferContent).not.toHaveBeenCalled();
  });
});
