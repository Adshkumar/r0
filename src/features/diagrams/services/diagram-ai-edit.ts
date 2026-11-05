import { useAIChatStore } from "@/features/ai/stores/ai-chat.store";
import { CODEX_INTEGRATION_ID } from "@/features/ai/integrations/integration-registry";
import { AcpStreamHandler } from "@/features/ai/services/acp-stream-handler";
import { getChatCompletionStream, isAcpAgent } from "@/features/ai/services/ai-chat-service";
import type { ContextInfo } from "@/features/ai/types/ai-context.types";
import { useProjectStore } from "@/features/workspace/stores/project.store";
import { useSettingsStore } from "@/features/settings/stores/settings.store";

interface MermaidEditRequest {
  filePath: string;
  source: string;
  instruction: string;
  signal: AbortSignal;
}

export async function requestMermaidEdit({
  filePath,
  source,
  instruction,
  signal,
}: MermaidEditRequest): Promise<string> {
  const chatStore = useAIChatStore.getState();
  const currentAgentId = chatStore.actions.getCurrentAgentId();
  const agentId =
    chatStore.lastSelectedAgentId ??
    (currentAgentId === "custom" ? chatStore.selectedAgentId : currentAgentId);
  if (agentId !== "custom" && (isAcpAgent(agentId) || agentId === CODEX_INTEGRATION_ID)) {
    return requestWithAgent({ agentId, source, instruction, signal });
  }

  const { requestInlineEdit } =
    await import("@/features/ai/intelligence/services/intelligence-text-service");
  const { editedText } = await requestInlineEdit(
    {
      model: "",
      beforeSelection: "",
      selectedText: source,
      afterSelection: "",
      instruction,
      filePath,
      languageId: "mermaid",
    },
    { signal },
  );
  return editedText;
}

async function requestWithAgent({
  agentId,
  source,
  instruction,
  signal,
}: {
  agentId: string;
  source: string;
  instruction: string;
  signal: AbortSignal;
}): Promise<string> {
  signal.throwIfAborted();
  const chatId = `mermaid-${globalThis.crypto.randomUUID()}`;
  const projectRoot = useProjectStore.getState().rootFolderPath ?? undefined;
  const settings = useSettingsStore.getState().settings;
  const context: ContextInfo = {
    projectRoot,
    agentId,
    providerId: settings.aiProviderId,
  };
  let sessionId: string | null = null;
  let cancelling = false;
  let started = false;
  let settled = false;
  let output = "";

  const result = new Promise<string>((resolve, reject) => {
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", cancel);
      if (error) reject(error);
      else resolve(output);
    };
    const cancel = () => {
      cancelling = true;
      if (!started) return;
      if (agentId === CODEX_INTEGRATION_ID) {
        void import("@/features/ai/integrations/codex/codex-integration-service").then(
          ({ CodexIntegrationService }) =>
            CodexIntegrationService.cancel().catch((error: unknown) =>
              console.error("Failed to stop Codex diagram generation:", error),
            ),
        );
      } else {
        void AcpStreamHandler.cancelPrompt(chatId).catch((error: unknown) =>
          console.error("Failed to stop ACP diagram generation:", error),
        );
      }
      if (agentId === CODEX_INTEGRATION_ID) {
        finish(new DOMException("Diagram generation was cancelled.", "AbortError"));
      }
    };
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();

    void getChatCompletionStream(
      agentId,
      settings.aiProviderId,
      settings.aiModelId,
      [
        "Generate or edit a Mermaid diagram.",
        "Return only valid Mermaid source, without Markdown fences or explanation.",
        "Do not modify, create, or delete workspace files. Do not run commands or use tools.",
        `Current Mermaid source:\n${source || "(empty; create a new diagram)"}`,
        `User request:\n${instruction}`,
      ].join("\n\n"),
      context,
      (chunk) => {
        output += chunk;
      },
      (completion) => {
        if (cancelling || completion?.outcome === "cancelled") {
          finish(new DOMException("Diagram generation was cancelled.", "AbortError"));
        } else {
          finish();
        }
      },
      (message) => finish(new Error(message)),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      (event) => {
        const respond =
          agentId === CODEX_INTEGRATION_ID
            ? import("@/features/ai/integrations/codex/codex-integration-service").then(
                ({ CodexIntegrationService }) =>
                  CodexIntegrationService.respond(event.requestId, false),
              )
            : AcpStreamHandler.respondToPermission(event.requestId, false);
        void respond.catch((error) =>
          console.error("Failed to deny a diagram-agent permission request:", error),
        );
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      chatId,
      undefined,
      undefined,
      agentId === CODEX_INTEGRATION_ID ? { ephemeral: true, readOnly: true } : undefined,
      (openedSessionId) => {
        sessionId = openedSessionId;
      },
    )
      .then(() => {
        started = true;
        if (cancelling) cancel();
      })
      .catch((error: unknown) => {
        finish(error instanceof Error ? error : new Error(String(error)));
      });
  });

  try {
    return await result;
  } finally {
    if (sessionId && agentId !== CODEX_INTEGRATION_ID) {
      try {
        await AcpStreamHandler.deleteSession(agentId, sessionId);
      } catch (error) {
        console.error("Failed to remove the temporary ACP diagram session:", error);
      }
    }
  }
}
