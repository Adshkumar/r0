import { invoke } from '@tauri-apps/api/core';

export interface PersistedEditorState {
  line: number;
  col: number;
  anchorLine: number;
  anchorCol: number;
  headLine: number;
  headCol: number;
  scrollTop: number;
  scrollLeft: number;
}

export interface PersistedSession {
  version: 1;
  revision: number;
  workspacePath: string | null;
  tabs: string[];
  activeTab: string | null;
  editorStates: Record<string, PersistedEditorState>;
  expandedFolders: string[];
  selectedExplorerPath: string | null;
  layout: {
    sidebarOpen: boolean;
    aiPanelOpen: boolean;
    terminalOpen: boolean;
    terminalHeight: number;
    activeSidebarPanel: string;
    sidebarWidth: number;
  };
}

export interface RecoveredDocument {
  version: 1;
  revision: number;
  workspacePath: string | null;
  filePath: string;
  content: string;
  updatedAt: number;
}

const recoveryOperations = new Map<string, Promise<void>>();
let sessionGeneration = 0;
let sessionOperation = Promise.resolve();
let sessionClearing = false;

export async function loadPersistedSession(): Promise<PersistedSession | null> {
  const raw = await invoke<string | null>('session_load');
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Saved session has an invalid format');
  const session = value as Partial<PersistedSession>;
  if (
    session.version !== 1 ||
    typeof session.revision !== 'number' ||
    !Array.isArray(session.tabs) ||
    !session.editorStates ||
    !session.layout
  ) {
    throw new Error('Saved session uses an unsupported format');
  }
  return session as PersistedSession;
}

export function savePersistedSession(session: PersistedSession): Promise<void> {
  const generation = sessionGeneration;
  const operation = sessionOperation.catch(() => {}).then(async () => {
    if (generation !== sessionGeneration || sessionClearing) return;
    await invoke('session_save', { value: JSON.stringify(session) });
  });
  sessionOperation = operation;
  return operation;
}

export async function loadRecoveredDocuments(): Promise<RecoveredDocument[]> {
  const records = await invoke<string[]>('session_recovery_list');
  const recovered: RecoveredDocument[] = [];
  for (const raw of records) {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') continue;
    const record = value as Partial<RecoveredDocument>;
    if (
      record.version === 1 &&
      typeof record.revision === 'number' &&
      typeof record.filePath === 'string' &&
      typeof record.content === 'string'
    ) {
      recovered.push(record as RecoveredDocument);
    }
  }
  return recovered;
}

export function saveRecoveredDocument(document: RecoveredDocument): Promise<void> {
  return queueRecoveryOperation(document.filePath, () => invoke('session_recovery_save', {
    filePath: document.filePath,
    value: JSON.stringify(document),
  }));
}

export function deleteRecoveredDocument(filePath: string): Promise<void> {
  return queueRecoveryOperation(filePath, () => invoke('session_recovery_delete', { filePath }));
}

function queueRecoveryOperation(filePath: string, operation: () => Promise<void>): Promise<void> {
  const previous = recoveryOperations.get(filePath) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  recoveryOperations.set(filePath, next);
  void next.finally(() => {
    if (recoveryOperations.get(filePath) === next) recoveryOperations.delete(filePath);
  }).catch(() => {});
  return next;
}

export function clearPersistedSession(): Promise<void> {
  sessionGeneration += 1;
  sessionClearing = true;
  const operation = sessionOperation.catch(() => {}).then(() => invoke<void>('session_clear')).then(() => {
    sessionClearing = false;
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('r0-session-cleared'));
  }).catch(error => {
    sessionClearing = false;
    throw error;
  });
  sessionOperation = operation;
  return operation;
}

export function isPathInsideWorkspace(filePath: string, workspacePath: string | null): boolean {
  if (!workspacePath) return true;
  const normalize = (path: string) => path.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
  const root = normalize(workspacePath);
  const path = normalize(filePath);
  return path === root || path.startsWith(`${root}\\`);
}
