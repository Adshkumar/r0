import AIChat from "./ai-chat";
import { useOpenBuffersIgnoringText } from "@/features/editor/hooks/use-buffer-text";
import { useActiveBufferId } from "@/features/panes/hooks/use-pane-buffer-state";
import { useAIChatStore } from "@/features/ai/stores/ai-chat.store";
import { isMermaidDiagramPath } from "@/features/diagrams/services/diagram-document";

export function AIChatSidebar() {
  const buffers = useOpenBuffersIgnoringText();
  const activeBufferId = useActiveBufferId();
  const activeBuffer = buffers.find((buffer) => buffer.id === activeBufferId) ?? null;
  const chatId = useAIChatStore((state) => state.currentChatId);
  const initialContextBufferIds =
    activeBuffer?.type === "editor" && activeBuffer.path && isMermaidDiagramPath(activeBuffer.path)
      ? [activeBuffer.id]
      : undefined;

  return (
    <AIChat
      mode="chat"
      surfaceId="workbench-ai-chat"
      chatId={chatId}
      activeBuffer={activeBuffer}
      buffers={buffers}
      initialContextBufferIds={initialContextBufferIds}
      className="min-h-0 flex-1"
    />
  );
}
