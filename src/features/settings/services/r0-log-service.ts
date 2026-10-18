import { commands, type R0LogFile as R0LogFileResponse } from "@/bindings/commands";
import { EDITOR_CONSTANTS } from "@/features/editor/config/constants";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { useEditorStateStore } from "@/features/editor/stores/state.store";
import { usePaneStore } from "@/features/panes/stores/pane.store";

interface R0LogFile {
  path: string;
  content: string;
  targetLine: number;
  truncated: boolean;
}

function toR0LogFile(response: R0LogFileResponse): R0LogFile {
  return {
    path: response.path,
    content: response.content,
    targetLine: response.target_line,
    truncated: response.truncated,
  };
}

function getFileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? "R0.log";
}

function getLineStartOffset(content: string, targetLine: number): number {
  if (targetLine <= 0) return 0;

  let line = 0;
  let offset = 0;
  while (line < targetLine) {
    const nextNewline = content.indexOf("\n", offset);
    if (nextNewline === -1) return content.length;
    offset = nextNewline + 1;
    line++;
  }

  return offset;
}

function cacheLogViewState(bufferId: string, content: string, targetLine: number) {
  const line = Math.max(0, targetLine);
  const offset = getLineStartOffset(content, line);
  const cursor = { line, column: 0, offset };
  const scrollTop = Math.max(0, (line - 8) * EDITOR_CONSTANTS.DEFAULT_LINE_HEIGHT);

  const viewState = {
    cursor,
    selection: undefined,
    scrollTop,
    scrollLeft: 0,
  };
  const editorActions = useEditorStateStore.getState().actions;
  editorActions.cacheViewStateForBuffer(bufferId, viewState);

  const activePane = usePaneStore.getState().actions.getActivePane();
  if (activePane) {
    editorActions.cacheViewStateForBuffer(`${activePane.id}:${bufferId}`, viewState);
  }
}

export async function openR0LogBuffer() {
  const logFile = toR0LogFile(await commands.readR0Log());
  const bufferId = useBufferStore.getState().actions.openContent({
    type: "editor",
    path: logFile.path,
    name: getFileName(logFile.path),
    content: logFile.content,
    isVirtual: true,
    readOnly: true,
    language: "log",
  });

  const nextBufferStore = useBufferStore.getState();
  const openedBuffer = nextBufferStore.buffers.find((buffer) => buffer.id === bufferId);
  if (openedBuffer?.type === "editor") {
    nextBufferStore.actions.updateBuffer({
      ...openedBuffer,
      content: logFile.content,
      savedContent: logFile.content,
      isDirty: false,
      isVirtual: true,
      readOnly: true,
      language: "log",
    });
  }

  cacheLogViewState(bufferId, logFile.content, logFile.targetLine);
  return logFile;
}
