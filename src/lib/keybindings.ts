import { invoke } from "@tauri-apps/api/core";

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserKeybinding {
  key: string;
  command: string;
  when?: string;
}

export interface CommandDef {
  id: string;
  label: string;
  category: string;
  defaultKey: string;
  defaultKeyMac?: string;
}

// ── Default command registry ─────────────────────────────────────────────────

export const COMMANDS: CommandDef[] = [
  // File
  { id: "r0.newFile",        label: "New File",             category: "File",    defaultKey: "ctrl+n" },
  { id: "r0.openFile",       label: "Open File",            category: "File",    defaultKey: "ctrl+o" },
  { id: "r0.save",           label: "Save",                 category: "File",    defaultKey: "ctrl+s" },
  { id: "r0.saveAs",         label: "Save As",              category: "File",    defaultKey: "ctrl+shift+s" },
  { id: "r0.closeTab",       label: "Close Editor",         category: "File",    defaultKey: "ctrl+w" },
  // Edit
  { id: "r0.editorUndo",     label: "Undo",                 category: "Edit",    defaultKey: "ctrl+z" },
  { id: "r0.editorRedo",     label: "Redo",                 category: "Edit",    defaultKey: "ctrl+y" },
  { id: "r0.editorFind",     label: "Find",                 category: "Edit",    defaultKey: "ctrl+f" },
  { id: "r0.editorReplace",  label: "Replace",              category: "Edit",    defaultKey: "ctrl+h" },
  { id: "r0.editorCut",      label: "Cut",                  category: "Edit",    defaultKey: "ctrl+x" },
  { id: "r0.editorCopy",     label: "Copy",                 category: "Edit",    defaultKey: "ctrl+c" },
  { id: "r0.editorPaste",    label: "Paste",                category: "Edit",    defaultKey: "ctrl+v" },
  { id: "r0.editorSelectAll",label: "Select All",           category: "Edit",    defaultKey: "ctrl+a" },
  { id: "r0.formatDocument", label: "Format Document",      category: "Edit",    defaultKey: "shift+alt+f" },
  // View
  { id: "r0.togglePalette",  label: "Command Palette",      category: "View",    defaultKey: "ctrl+shift+p" },
  { id: "r0.quickOpen",      label: "Quick Open",           category: "View",    defaultKey: "ctrl+p" },
  { id: "r0.toggleSidebar",  label: "Toggle Sidebar",       category: "View",    defaultKey: "ctrl+b" },
  { id: "r0.toggleTerminal", label: "Toggle Panel",          category: "View",    defaultKey: "ctrl+j" },
  { id: "r0.showExplorer",   label: "Show Explorer",        category: "View",    defaultKey: "ctrl+shift+e" },
  { id: "r0.showSearch",     label: "Show Search",          category: "View",    defaultKey: "ctrl+shift+f" },
  { id: "r0.showSourceControl", label: "Show Source Control", category: "View", defaultKey: "ctrl+shift+g" },
  { id: "r0.showExtensions", label: "Show Extensions",      category: "View",    defaultKey: "ctrl+shift+x" },
  { id: "r0.toggleSettings", label: "Open Settings",        category: "View",    defaultKey: "ctrl+," },
  { id: "r0.toggleFullscreen",label: "Toggle Full Screen",  category: "View",    defaultKey: "f11" },
  { id: "r0.reloadWindow",   label: "Reload Window",        category: "View",    defaultKey: "ctrl+r" },
  { id: "r0.zoomIn",         label: "Zoom In",              category: "View",    defaultKey: "ctrl+=" },
  { id: "r0.zoomOut",        label: "Zoom Out",             category: "View",    defaultKey: "ctrl+-" },
  { id: "r0.zoomReset",      label: "Reset Zoom",           category: "View",    defaultKey: "ctrl+0" },
  // Debug
  { id: "r0.startDebug",     label: "Start Debugging",      category: "Debug",   defaultKey: "f5" },
  { id: "r0.stopDebug",      label: "Stop Debugging",       category: "Debug",   defaultKey: "shift+f5" },
  { id: "r0.stepOver",       label: "Step Over",            category: "Debug",   defaultKey: "f10" },
  { id: "r0.stepInto",       label: "Step Into",            category: "Debug",   defaultKey: "f11" },
  { id: "r0.stepOut",        label: "Step Out",             category: "Debug",   defaultKey: "shift+f11" },
  { id: "r0.toggleBreakpoint",label: "Toggle Breakpoint",  category: "Debug",   defaultKey: "f9" },
];

// ── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "r0-keybindings";

export function loadKeybindings(): UserKeybinding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserKeybinding[]) : [];
  } catch {
    return [];
  }
}

export function saveKeybindings(bindings: UserKeybinding[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}

export function resetKeybindings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Returns effective key for a command: user override → default. */
export function getEffectiveKey(commandId: string): string | null {
  const user = loadKeybindings();
  const override = user.find(b => b.command === commandId);
  if (override) return override.key;
  return COMMANDS.find(c => c.id === commandId)?.defaultKey ?? null;
}

/** Full map of commandId → effective key (used by the global listener). */
export function getCommandKeyMap(): Record<string, string> {
  const user = loadKeybindings();
  const map: Record<string, string> = {};
  for (const cmd of COMMANDS) {
    map[cmd.id] = cmd.defaultKey;
  }
  for (const b of user) {
    if (b.command) map[b.command] = b.key;
  }
  return map;
}

/** Rebind a single command. Pass null key to remove the override. */
export function setKeybinding(commandId: string, key: string | null): void {
  const bindings = loadKeybindings().filter(b => b.command !== commandId);
  if (key !== null) bindings.push({ command: commandId, key });
  saveKeybindings(bindings);
}

// ── Key matching ─────────────────────────────────────────────────────────────

interface ParsedKey {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

function parseKey(keyStr: string): ParsedKey {
  const parts = keyStr.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  return {
    ctrl:  parts.includes("ctrl") || parts.includes("cmd"),
    shift: parts.includes("shift"),
    alt:   parts.includes("alt"),
    key,
  };
}

export function matchesEvent(e: KeyboardEvent, keyStr: string): boolean {
  const { ctrl, shift, alt, key } = parseKey(keyStr);
  // Normalise e.key → lowercase single token
  const eKey = e.key === "`" ? "`"
    : e.key === "=" ? "="
    : e.key === "-" ? "-"
    : e.key === "0" ? "0"
    : e.key === "," ? ","
    : e.key.toLowerCase();

  return (
    (e.ctrlKey || e.metaKey) === ctrl &&
    e.shiftKey === shift &&
    e.altKey === alt &&
    eKey === key
  );
}

export function isAllowedInTextEntry(commandId: string): boolean {
  return commandId === "r0.save" || commandId === "r0.togglePalette";
}

// ── VS Code / Cursor / Windsurf import ───────────────────────────────────────

// Maps VS Code command IDs → r0 command IDs
const VSCODE_CMD_MAP: Record<string, string> = {
  "workbench.action.files.newUntitledFile":    "r0.newFile",
  "workbench.action.files.openFile":           "r0.openFile",
  "workbench.action.files.save":               "r0.save",
  "workbench.action.files.saveAs":             "r0.saveAs",
  "workbench.action.closeActiveEditor":        "r0.closeTab",
  "undo":                                       "r0.editorUndo",
  "redo":                                       "r0.editorRedo",
  "actions.find":                               "r0.editorFind",
  "editor.action.startFindReplaceAction":      "r0.editorReplace",
  "editor.action.clipboardCutAction":          "r0.editorCut",
  "editor.action.clipboardCopyAction":         "r0.editorCopy",
  "editor.action.clipboardPasteAction":        "r0.editorPaste",
  "editor.action.selectAll":                   "r0.editorSelectAll",
  "workbench.action.quickOpen":                "r0.togglePalette",
  "workbench.action.showCommands":             "r0.togglePalette",
  "workbench.action.toggleSidebarVisibility":  "r0.toggleSidebar",
  "workbench.action.terminal.toggleTerminal":  "r0.toggleTerminal",
  "workbench.action.openSettings":             "r0.toggleSettings",
  "workbench.action.toggleFullScreen":         "r0.toggleFullscreen",
  "workbench.action.zoomIn":                   "r0.zoomIn",
  "workbench.action.zoomOut":                  "r0.zoomOut",
  "workbench.action.zoomReset":                "r0.zoomReset",
  "workbench.action.debug.start":              "r0.startDebug",
  "workbench.action.debug.run":                "r0.startDebug",
  "workbench.action.debug.stop":               "r0.stopDebug",
  "workbench.action.debug.stepOver":           "r0.stepOver",
  "workbench.action.debug.stepInto":           "r0.stepInto",
  "workbench.action.debug.stepOut":            "r0.stepOut",
  "editor.debug.action.toggleBreakpoint":      "r0.toggleBreakpoint",
};

interface ImportResult {
  imported: number;
  bindings: UserKeybinding[];
}

function stripJsonComments(raw: string): string {
  // Very simple single-line comment stripper for keybindings.json
  return raw.replace(/\/\/[^\n]*/g, "");
}

export function parseEditorKeybindings(json: string): ImportResult {
  try {
    const items = JSON.parse(stripJsonComments(json));
    if (!Array.isArray(items)) return { imported: 0, bindings: [] };
    const bindings: UserKeybinding[] = [];
    for (const item of items) {
      if (typeof item.key !== "string" || typeof item.command !== "string") continue;
      // Skip negation entries (command starting with -)
      if (item.command.startsWith("-")) continue;
      const r0Cmd = VSCODE_CMD_MAP[item.command];
      if (r0Cmd) {
        bindings.push({
          key: item.key.toLowerCase(),
          command: r0Cmd,
          ...(item.when ? { when: item.when } : {}),
        });
      }
    }
    return { imported: bindings.length, bindings };
  } catch {
    return { imported: 0, bindings: [] };
  }
}

// ── Tauri wrappers ───────────────────────────────────────────────────────────

export async function detectInstalledEditors(): Promise<string[]> {
  return invoke<string[]>("detect_installed_editors");
}

export async function importKeybindingsFromEditor(editorId: string): Promise<ImportResult> {
  const json = await invoke<string>("read_editor_keybindings", { editor: editorId });
  return parseEditorKeybindings(json);
}

/**
 * Import keybindings from an editor, merge with existing user overrides,
 * and persist. Returns the number of commands that were mapped.
 */
export async function applyKeybindingsFromEditor(editorId: string): Promise<number> {
  const { imported, bindings } = await importKeybindingsFromEditor(editorId);
  if (imported === 0) return 0;
  // Merge: editor import wins over current user overrides for matching commands
  const existing = loadKeybindings().filter(
    b => !bindings.some(nb => nb.command === b.command)
  );
  saveKeybindings([...existing, ...bindings]);
  return imported;
}
