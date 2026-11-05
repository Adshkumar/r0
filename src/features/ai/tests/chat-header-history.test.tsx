// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useAIChatStore } from "../stores/ai-chat.store";
import type { ChatSession } from "../types/ai-chat.types";
import { ChatHeader } from "../components/chat/chat-header";

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({ label: "main" }),
  getAllWebviewWindows: async () => [],
}));

const createChat = (id: string, title: string): ChatSession => ({
  id,
  title,
  createdAt: new Date("2026-10-01T10:00:00Z"),
  lastMessageAt: new Date("2026-10-01T10:01:00Z"),
  agentId: "claude-code",
});

let root: Root;
let container: HTMLDivElement;

const headerProps = {
  chatId: "current",
  conversationHistory: [createChat("previous", "Mermaid: previous diagram")],
  onSelectConversation: vi.fn(),
  onDeleteConversation: vi.fn(),
  isMessageSearchOpen: false,
  messageSearchQuery: "",
  onToggleMessageSearch: vi.fn(),
  onCloseMessageSearch: vi.fn(),
  onMessageSearchQueryChange: vi.fn(),
  messageSearchMatchCount: 0,
  activeMessageSearchIndex: 0,
  onPreviousMessageSearchMatch: vi.fn(),
  onNextMessageSearchMatch: vi.fn(),
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const current = createChat("current", "Mermaid: current diagram");
  useAIChatStore.setState({
    currentChatId: current.id,
    chats: [current, ...headerProps.conversationHistory],
    messagesByChat: {},
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("Mermaid conversation history controls", () => {
  it("opens a previous conversation and offers delete actions in both menus", () => {
    const onSelectConversation = vi.fn((id: string) =>
      useAIChatStore.getState().actions.switchToChat(id),
    );
    act(() =>
      root.render(<ChatHeader {...headerProps} onSelectConversation={onSelectConversation} />),
    );

    act(() => {
      const currentTitle = [...container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Mermaid: current diagram"),
      );
      currentTitle!.click();
    });
    const previousConversation = document.body.querySelector<HTMLElement>('[role="menuitem"]');
    expect(previousConversation?.textContent).toContain("Mermaid: previous diagram");
    act(() => previousConversation?.click());
    expect(onSelectConversation).toHaveBeenCalledWith("previous");
    expect(useAIChatStore.getState().currentChatId).toBe("previous");

    act(() =>
      container.querySelector<HTMLButtonElement>('[aria-label="Conversation history"]')!.click(),
    );
    act(() =>
      document
        .querySelector<HTMLButtonElement>(
          '[aria-label="More actions for Mermaid: previous diagram"]',
        )!
        .click(),
    );
    act(() =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
        .find((item) => item.textContent?.includes("Delete conversation"))!
        .click(),
    );
    expect(headerProps.onDeleteConversation).toHaveBeenCalledWith("previous");

    act(() =>
      container.querySelector<HTMLButtonElement>('[aria-label="Conversation actions"]')!.click(),
    );
    act(() =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
        .find((item) => item.textContent?.includes("Delete conversation"))!
        .click(),
    );
    expect(headerProps.onDeleteConversation).toHaveBeenCalledWith("current");
  });
});
