import { trackImmediateBufferHistoryChange } from "@/features/editor/services/buffer-history-tracking";
import { readBufferText } from "@/features/editor/services/buffer-text";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { useEditorStateStore } from "@/features/editor/stores/state.store";

export function applyDiagramSourceEdit(bufferId: string, nextContent: string): boolean {
  const buffer = useBufferStore.getState().buffers.find((item) => item.id === bufferId);
  if (!buffer || buffer.type !== "editor" || buffer.readOnly || buffer.isVirtual) return false;

  const currentContent = readBufferText(buffer);
  if (currentContent === nextContent) return true;

  const { cursorPosition, selection } = useEditorStateStore.getState();
  trackImmediateBufferHistoryChange({
    bufferId,
    currentContent,
    nextContent,
    previousCursorPosition: cursorPosition,
    previousSelection: selection,
  });
  useBufferStore.getState().actions.updateBufferContent(bufferId, nextContent, true);
  return true;
}
