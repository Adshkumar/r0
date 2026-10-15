import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import {
  clearPersistedSession,
  deleteRecoveredDocument,
  isPathInsideWorkspace,
  loadPersistedSession,
  saveRecoveredDocument,
  savePersistedSession,
  type PersistedSession,
  type RecoveredDocument,
} from '../session';

const session: PersistedSession = {
  version: 1,
  revision: 7,
  workspacePath: 'C:\\work\\app',
  workspacePaths: ['C:\\work\\app', 'C:\\work\\shared'],
  tabs: ['C:\\work\\app\\src\\main.ts'],
  activeTab: 'C:\\work\\app\\src\\main.ts',
  editorStates: {},
  expandedFolders: ['C:\\work\\app\\src'],
  selectedExplorerPath: 'C:\\work\\app\\src\\main.ts',
  layout: {
    sidebarOpen: true,
    aiPanelOpen: false,
    terminalOpen: false,
    terminalHeight: 240,
    activeSidebarPanel: 'explorer',
    sidebarWidth: 240,
  },
};

describe('persisted session data', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(null);
  });

  it('loads a supported versioned session and rejects malformed data', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(JSON.stringify(session));
    await expect(loadPersistedSession()).resolves.toEqual(session);

    vi.mocked(invoke).mockResolvedValueOnce('not-json');
    await expect(loadPersistedSession()).rejects.toThrow();

    vi.mocked(invoke).mockResolvedValueOnce(JSON.stringify({ ...session, version: 2 }));
    await expect(loadPersistedSession()).rejects.toThrow(/unsupported format/);
  });

  it('normalizes Windows separators while checking workspace containment', () => {
    expect(isPathInsideWorkspace('c:/WORK/app/src/main.ts', 'C:\\work\\app')).toBe(true);
    expect(isPathInsideWorkspace('C:\\work\\application\\main.ts', 'C:\\work\\app')).toBe(false);
    expect(isPathInsideWorkspace('C:\\other\\main.ts', null)).toBe(true);
  });

  it('serializes recovery writes and deletes per file in request order', async () => {
    const order: string[] = [];
    vi.mocked(invoke).mockImplementation(async (command) => {
      order.push(String(command));
    });
    const recovery: RecoveredDocument = {
      version: 1,
      revision: 1,
      workspacePath: session.workspacePath,
      filePath: session.tabs[0],
      content: 'unsaved',
      updatedAt: 1,
    };

    await Promise.all([
      saveRecoveredDocument(recovery),
      deleteRecoveredDocument(recovery.filePath),
    ]);

    expect(order).toEqual(['session_recovery_save', 'session_recovery_delete']);
  });

  it('allows session saves to resume after clearing persisted state', async () => {
    const order: string[] = [];
    vi.mocked(invoke).mockImplementation(async command => {
      order.push(String(command));
    });

    await clearPersistedSession();
    await savePersistedSession(session);

    expect(order).toEqual(['session_clear', 'session_save']);
  });
});
