import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  agentId: "custom",
  selectedAgentId: "custom",
  lastSelectedAgentId: "custom",
  stream: vi.fn(),
  inlineEdit: vi.fn(),
  denyAcpPermission: vi.fn(() => Promise.resolve()),
  deleteAcpSession: vi.fn(() => Promise.resolve()),
  cancelAcpPrompt: vi.fn(() => Promise.resolve()),
  denyCodexPermission: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/features/ai/stores/ai-chat.store", () => ({
  useAIChatStore: {
    getState: () => ({
      selectedAgentId: mocks.selectedAgentId,
      lastSelectedAgentId: mocks.lastSelectedAgentId,
      actions: { getCurrentAgentId: () => mocks.agentId },
    }),
  },
}));
vi.mock("@/features/ai/services/ai-chat-service", () => ({
  isAcpAgent: (agentId: string) => agentId !== "custom" && agentId !== "codex",
  getChatCompletionStream: mocks.stream,
}));
vi.mock("@/features/ai/services/acp-stream-handler", () => ({
  AcpStreamHandler: {
    respondToPermission: mocks.denyAcpPermission,
    deleteSession: mocks.deleteAcpSession,
    cancelPrompt: mocks.cancelAcpPrompt,
  },
}));
vi.mock("@/features/ai/integrations/codex/codex-integration-service", () => ({
  CodexIntegrationService: {
    respond: mocks.denyCodexPermission,
    cancel: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock("@/features/ai/integrations/integration-registry", () => ({
  CODEX_INTEGRATION_ID: "codex",
}));
vi.mock("@/features/workspace/stores/project.store", () => ({
  useProjectStore: { getState: () => ({ rootFolderPath: "C:\\workspace" }) },
}));
vi.mock("@/features/settings/stores/settings.store", () => ({
  useSettingsStore: {
    getState: () => ({ settings: { aiProviderId: "openai", aiModelId: "gpt-test" } }),
  },
}));
vi.mock("@/features/ai/intelligence/services/intelligence-text-service", () => ({
  requestInlineEdit: mocks.inlineEdit,
}));

import { requestMermaidEdit } from "../services/diagram-ai-edit";

const prompt = {
  filePath: "diagram.mmd",
  source: "flowchart TD\n  A --> B",
  instruction: "Add a decision node",
  signal: new AbortController().signal,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.agentId = "custom";
  mocks.selectedAgentId = "custom";
  mocks.lastSelectedAgentId = "custom";
  mocks.inlineEdit.mockResolvedValue({ editedText: "flowchart TD\n  A --> B" });
  mocks.stream.mockImplementation(async (...args: unknown[]) => {
    const onChunk = args[5] as (chunk: string) => void;
    const onComplete = args[6] as (result: { outcome: string }) => void;
    const onPermissionRequest = args[13] as (event: { requestId: string }) => void;
    const onSessionOpened = args[23] as (sessionId: string) => void;
    onChunk("flowchart TD\n  A --> B");
    onSessionOpened("session-1");
    onPermissionRequest({ requestId: "permission-1" });
    onComplete({ outcome: "completed" });
  });
});

describe("Mermaid AI routing", () => {
  it("uses the configured inline-edit model for API-provider chat", async () => {
    await expect(requestMermaidEdit(prompt)).resolves.toBe("flowchart TD\n  A --> B");
    expect(mocks.inlineEdit).toHaveBeenCalledWith(
      expect.objectContaining({ selectedText: prompt.source, languageId: "mermaid" }),
      { signal: prompt.signal },
    );
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("uses the selected ACP chat agent and closes its temporary session", async () => {
    mocks.agentId = "github-copilot-cli";
    mocks.lastSelectedAgentId = "github-copilot-cli";

    await expect(requestMermaidEdit(prompt)).resolves.toBe("flowchart TD\n  A --> B");

    expect(mocks.stream).toHaveBeenCalledWith(
      "github-copilot-cli",
      "openai",
      "gpt-test",
      expect.stringContaining(prompt.source),
      expect.objectContaining({ projectRoot: "C:\\workspace" }),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      expect.any(Function),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      expect.stringMatching(/^mermaid-/),
      undefined,
      undefined,
      undefined,
      expect.any(Function),
    );
    expect(mocks.denyAcpPermission).toHaveBeenCalledWith("permission-1", false);
    expect(mocks.deleteAcpSession).toHaveBeenCalledWith("github-copilot-cli", "session-1");
    expect(mocks.inlineEdit).not.toHaveBeenCalled();
  });

  it("uses the last selected agent when the global chat still reports the default", async () => {
    mocks.lastSelectedAgentId = "github-copilot-cli";

    await expect(requestMermaidEdit(prompt)).resolves.toBe("flowchart TD\n  A --> B");

    expect(mocks.stream.mock.calls[0]?.[0]).toBe("github-copilot-cli");
    expect(mocks.inlineEdit).not.toHaveBeenCalled();
  });

  it("uses a read-only ephemeral Codex turn and denies its permission requests", async () => {
    mocks.agentId = "codex";
    mocks.lastSelectedAgentId = "codex";

    await requestMermaidEdit(prompt);

    expect(mocks.stream.mock.calls[0]?.[22]).toEqual({
      ephemeral: true,
      readOnly: true,
    });
    await vi.waitFor(() =>
      expect(mocks.denyCodexPermission).toHaveBeenCalledWith("permission-1", false),
    );
  });
});
