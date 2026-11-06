// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { useFileExplorerContextMenu } from "@/features/file-explorer/hooks/use-file-explorer-context-menu";
import { InlineRenameInput } from "@/ui/input";

let root: Root;
let container: HTMLDivElement;
let renamedPath: string | null;
let menuClosedBeforeRename: boolean;

function Harness() {
  const [editingValue, setEditingValue] = useState("notes.txt");
  const [renaming, setRenaming] = useState(false);
  const contextMenu = useFileExplorerContextMenu({
    onFileSelect: () => {},
    onRenamePath: (path) => {
      renamedPath = path;
      menuClosedBeforeRename = document.querySelector('[role="menuitem"]') === null;
      setRenaming(true);
    },
    onDeleteRequested: () => {},
    onStartInlineEditing: () => {},
    onOpenAllFilesInDirectory: async () => {},
  });

  return (
    <>
      <button
        type="button"
        data-testid="editor"
        onContextMenu={(event) =>
          contextMenu.handleContextMenu(event, "/workspace/notes.txt", false)
        }
      >
        editor
      </button>
      {renaming ? (
        <InlineRenameInput
          aria-label="Rename notes.txt"
          value={editingValue}
          onValueChange={setEditingValue}
          onSubmit={() => setRenaming(false)}
          onCancel={() => setRenaming(false)}
        />
      ) : null}
      {contextMenu.contextMenuElement}
    </>
  );
}

const editor = () => document.querySelector<HTMLButtonElement>('[data-testid="editor"]')!;
const menuItem = (label: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (item) => item.textContent?.trim() === label,
  )!;

async function openMenu() {
  await act(async () => {
    editor().focus();
    editor().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
}

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  renamedPath = null;
  menuClosedBeforeRename = false;
  Element.prototype.getAnimations = () => [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

// The file tree's Rename item focuses an inline field; the context menu must not take focus back
// as it closes, or the blur submits the rename before anything is typed.
describe("renaming from a context menu", () => {
  it("keeps the rename field focused after the menu closes", async () => {
    await openMenu();
    await act(async () => menuItem("Rename").click());
    await settle();

    expect(document.activeElement?.getAttribute("aria-label")).toBe("Rename notes.txt");
    expect(renamedPath).toBe("/workspace/notes.txt");
    expect(menuClosedBeforeRename).toBe(true);
  });

  it("still returns focus when the menu is dismissed without a choice", async () => {
    await openMenu();
    expect(menuItem("Rename")).toBeTruthy();
    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    await settle();

    expect(document.querySelector('[role="menuitem"]')).toBeNull();
    expect(document.activeElement).toBe(editor());
  });
});
