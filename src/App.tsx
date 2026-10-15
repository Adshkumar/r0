import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import Onboarding from "./components/onboarding/Onboarding";
import EditorEmptyState from "./components/editor/EditorEmptyState";
import ImagePreview from "./components/editor/ImagePreview";
import TabBar from "./components/editor/TabBar";
import Editor, { type EditorHandle, type EditorContext } from "./components/editor/Editor";
import AiDiffPane, { type AiDiffTabData } from "./components/editor/AiDiffPane";
import GitCommitDetailsPane from "./components/editor/GitCommitDetailsPane";
import GitDiffPane from "./components/editor/GitDiffPane";
import WebPreviewPane from "./components/editor/WebPreviewPane";
import HtmlLivePreviewPanel from "./components/editor/HtmlLivePreviewPanel";
import StatusBar from "./components/StatusBar";
import TerminalPanel, { type TerminalPanelHandle } from "./components/terminal/TerminalPanel";
import CommandPalette from "./components/palette/CommandPalette";
import AiPanel from "./components/ai/AiPanel";
import SettingsPanel from "./components/settings/SettingsPanel";
import DebugToolbar from "./components/DebugToolbar";
import { getSetting, setSetting, pushRecentProject } from "./lib/settings";
import { useToast } from "./components/ui/Toast";
import { streamText } from "ai";
import { buildLanguageModel } from "./lib/agent/providers";
import { loadApiKey } from "./lib/secrets";
import type { AiCompletionFn } from "./lib/aiAutocomplete";
import { getBranch, notifyGitFilesystemChanged, onGitRepositoryChanged, type GitChangedFile, type GitCommitDetails, type StatusFile } from "./lib/git";
import { check as checkForUpdate } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { languageLabel } from "./components/editor/languageSupport";
import { useWorkspace } from "./context/WorkspaceContext";
import { useDebugContext } from "./context/DebugContext";
import { CommandContext } from "./context/CommandContext";
import { useTabs } from "./hooks/useTabs";
import { useWorkspacePersistence } from "./hooks/useWorkspacePersistence";
import { useGlobalKeybindings } from "./hooks/useGlobalKeybindings";
import { isImageFile } from "./lib/imagePreview";
import { canFormat, canFormatOffline, formatSource } from "./lib/formatting";
import {
  deleteRecoveredDocument,
  loadPersistedSession,
  loadRecoveredDocuments,
  savePersistedSession,
  saveRecoveredDocument,
  type PersistedEditorState,
  type PersistedSession,
  type RecoveredDocument,
} from "./lib/session";
import { readDir } from "./lib/fs";

function isPathWithinRoot(path: string, root: string): boolean {
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const windowsPath = /^[a-z]:\//i.test(normalizedRoot);
  const candidate = windowsPath ? normalizedPath.toLowerCase() : normalizedPath;
  const base = windowsPath ? normalizedRoot.toLowerCase() : normalizedRoot;
  return candidate === base || candidate.startsWith(`${base}/`);
}

function App() {
  const { folderPath, setFolderPath, workspaceRoots, setWorkspaceRoots, addWorkspaceRoot } = useWorkspace();
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem('r0-onboarding') === 'true'
  );

  const {
    tabs, setTabs: _setTabs,
    activeTab, setActiveTab,
    fileContents,
    fileErrors,
    jumpRequest,
    fileTreeVersion,
    refreshFileTree,
    refreshExternalFile,
    activeTabRef,
    fileContentsRef,
    openTab, openTabAtLine, closeTab, handlePathRenamed,
    restoreSessionTabs,
    handleNewFile, handleEditorChange, openAiDiffTab, openPreviewTab,
    openGitCommitTab, openGitDiffTab,
    handleSave, handleSaveAs, handleSaveAll,
  } = useTabs();

  const {
    sidebarOpen, setSidebarOpen,
    aiPanelOpen, setAiPanelOpen,
    terminalOpen, setTerminalOpen,
    terminalHeight, setTerminalHeight,
    settingsLoaded,
  } = useWorkspacePersistence();

  // Once the terminal has been opened, keep it mounted so PTY sessions survive toggle.
  const [terminalMounted, setTerminalMounted] = useState(false);

  // Auto-hide sidebars when entering live preview; restore on exit.
  // Auto-hide all panels when entering live preview; restore on exit.
  const prePreviewPanels = useRef<{ sidebarOpen: boolean; aiPanelOpen: boolean; terminalOpen: boolean } | null>(null);
  useEffect(() => {
    if (activeTab === '__preview__') {
      prePreviewPanels.current = { sidebarOpen, aiPanelOpen, terminalOpen };
      setSidebarOpen(false);
      setAiPanelOpen(false);
      setTerminalOpen(false);
    } else if (prePreviewPanels.current !== null) {
      setSidebarOpen(prePreviewPanels.current.sidebarOpen);
      setAiPanelOpen(prePreviewPanels.current.aiPanelOpen);
      setTerminalOpen(prePreviewPanels.current.terminalOpen);
      prePreviewPanels.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to activeTab transitions; panel state is read intentionally fresh
  }, [activeTab]);

  const debugCtx = useDebugContext();

  const { showToast } = useToast();
  const editorRef      = useRef<EditorHandle>(null);
  const terminalRef    = useRef<TerminalPanelHandle>(null);
  const pendingDiffRef = useRef<{ code: string; targetPath: string } | null>(null);
  const [pendingDiffTick, setPendingDiffTick] = useState(0);
  const [_zoom,          setZoom]          = useState(1.0);
  const [pinnedContext,  setPinnedContext]  = useState<EditorContext | null>(null);
  const [cursorPositions, setCursorPositions] = useState<Record<string, { line: number; col: number }>>({});
  const [editorStates, setEditorStates] = useState<Record<string, PersistedEditorState>>({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
  const [activeSidebarPanel, setActiveSidebarPanel] = useState("explorer");
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [restoreReady, setRestoreReady] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-way latch: mount terminal once opened
  useEffect(() => { if (restoreReady && terminalOpen) setTerminalMounted(true); }, [restoreReady, terminalOpen]);
  const [sessionOptions, setSessionOptions] = useState({
    restore: true,
    restoreTabs: true,
    restoreEditorState: true,
    recoverUnsaved: true,
  });
  const restoredSessionRef = useRef<PersistedSession | null>(null);
  const sessionRevisionRef = useRef(0);
  const sessionTimerRef = useRef<number | null>(null);
  const sessionSnapshotRef = useRef<Omit<PersistedSession, "revision"> | null>(null);
  const tabsRef = useRef(tabs);
  const contentsRef = useRef(fileContents);
  const recoveryTimersRef = useRef(new Map<string, number>());
  const recoveryRevisionRef = useRef(new Map<string, number>());
  const knownRecoveriesRef = useRef(new Set<string>());
  const recoveryErrorRef = useRef(new Set<string>());
  const allowCloseRef = useRef(false);
  const closeInProgressRef = useRef(false);
  const sessionOptionsRef = useRef(sessionOptions);
  const workspacePathRef = useRef(folderPath);

  tabsRef.current = tabs;
  contentsRef.current = fileContents;
  sessionOptionsRef.current = sessionOptions;
  workspacePathRef.current = folderPath;

  useEffect(() => {
    if (!settingsLoaded || restoreStartedRef.current) return;
    restoreStartedRef.current = true;
    let current = true;
    void (async () => {
      try {
        const [restore, restoreTabs, restoreEditorState, recoverUnsaved, savedSession, configuredWorkspace] =
          await Promise.all([
            getSetting('session.restore'),
            getSetting('session.restoreTabs'),
            getSetting('session.restoreEditorState'),
            getSetting('session.recoverUnsaved'),
            loadPersistedSession().catch(error => {
              showToast(`Could not read the saved session: ${String(error)}`, 'error');
              return null;
            }),
            getSetting('workspace.folder'),
          ]);
        if (!current) return;
        setSessionOptions({ restore, restoreTabs, restoreEditorState, recoverUnsaved });
        restoredSessionRef.current = savedSession;
        sessionRevisionRef.current = savedSession?.revision ?? 0;

        const requestedWorkspaces = restore
          ? savedSession?.workspacePaths?.length
            ? savedSession.workspacePaths
            : [savedSession?.workspacePath || configuredWorkspace || folderPath].filter((path): path is string => Boolean(path))
          : [];
        const usableWorkspaces: string[] = [];
        for (const requestedWorkspace of requestedWorkspaces) {
          try {
            await readDir(requestedWorkspace);
            usableWorkspaces.push(requestedWorkspace);
          } catch {
            showToast(`The previous workspace is unavailable: ${requestedWorkspace}`, 'error', {
              label: 'Choose Folder',
              onClick: () => { void handleOpenFolder(); },
            });
          }
        }
        setWorkspaceRoots(usableWorkspaces);
        const usableWorkspace = usableWorkspaces[0] ?? null;

        if (restore && savedSession) {
          setSidebarOpen(savedSession.layout.sidebarOpen);
          setAiPanelOpen(savedSession.layout.aiPanelOpen);
          setTerminalOpen(savedSession.layout.terminalOpen);
          setTerminalHeight(savedSession.layout.terminalHeight);
          setActiveSidebarPanel(savedSession.layout.activeSidebarPanel || 'explorer');
          setSidebarWidth(savedSession.layout.sidebarWidth || 240);
          setExpandedFolders(new Set(savedSession.expandedFolders ?? []));
          if (restoreEditorState) {
            setEditorStates(savedSession.editorStates);
            setCursorPositions(Object.fromEntries(
              Object.entries(savedSession.editorStates).map(([path, state]) => [path, { line: state.line, col: state.col }]),
            ));
          }
        }

        let recoveries: RecoveredDocument[] = [];
        if (recoverUnsaved) {
          try {
            recoveries = await loadRecoveredDocuments();
          } catch (error) {
            showToast(`Could not load unsaved recovery data; recovery files were kept: ${String(error)}`, 'error');
          }
        }
        const recoveryWorkspaces = savedSession?.workspacePaths?.length
          ? savedSession.workspacePaths
          : [savedSession?.workspacePath ?? usableWorkspace].filter((path): path is string => Boolean(path));
        const relevantRecoveries = recoveries.filter(record =>
          recoveryWorkspaces.includes(record.workspacePath ?? '')
          || (!record.workspacePath && recoveryWorkspaces.length === 0),
        );
        if (restore) {
          const paths = restoreTabs ? [...(savedSession?.tabs ?? [])] : [];
          for (const recovery of relevantRecoveries) {
            if (!paths.includes(recovery.filePath)) paths.push(recovery.filePath);
            knownRecoveriesRef.current.add(recovery.filePath);
            recoveryRevisionRef.current.set(recovery.filePath, recovery.revision);
          }
          const recoveryMap = new Map(relevantRecoveries.map(record => [record.filePath, record]));
          await restoreSessionTabs(
            paths,
            restoreTabs ? savedSession?.activeTab ?? null : null,
            recoveryMap,
          );
        }
      } catch (error) {
        showToast(`Could not restore the previous session: ${String(error)}`, 'error');
      } finally {
        if (current) setRestoreReady(true);
      }
    })();
    return () => {
      current = false;
      restoreStartedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- startup restoration runs once after settings hydration.
  }, [settingsLoaded]);

  const tabOrderKey = tabs.map(tab => tab.path).join('\u0000');
  const sessionWorkspacePath = folderPath ?? restoredSessionRef.current?.workspacePath ?? null;
  sessionSnapshotRef.current = {
    version: 1,
    workspacePath: sessionWorkspacePath,
    workspacePaths: workspaceRoots,
    tabs: tabs.filter(tab => !tab.path.startsWith('__')).map(tab => tab.path),
    activeTab: activeTab && !activeTab.startsWith('__') ? activeTab : null,
    editorStates,
    expandedFolders: [...expandedFolders],
    selectedExplorerPath: activeTab && !activeTab.startsWith('__') ? activeTab : null,
    layout: {
      sidebarOpen,
      aiPanelOpen,
      terminalOpen,
      terminalHeight,
      activeSidebarPanel,
      sidebarWidth,
    },
  };

  async function persistCurrentSession(): Promise<boolean> {
    if (!sessionOptionsRef.current.restore || !sessionSnapshotRef.current) return true;
    const next = {
      ...sessionSnapshotRef.current,
      revision: ++sessionRevisionRef.current,
    };
    try {
      await savePersistedSession(next);
      restoredSessionRef.current = next;
      return true;
    } catch (error) {
      showToast(`Could not save the current session: ${String(error)}`, 'error');
      return false;
    }
  }

  async function persistDirtyDocuments() {
    if (!sessionOptionsRef.current.recoverUnsaved) return;
    const workspace = workspacePathRef.current ?? restoredSessionRef.current?.workspacePath ?? null;
    const writes: Promise<void>[] = [];
    for (const tab of tabsRef.current) {
      if (!tab.isDirty || tab.path.startsWith('__')) continue;
      const content = contentsRef.current[tab.path];
      if (content === undefined) continue;
      const timer = recoveryTimersRef.current.get(tab.path);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        recoveryTimersRef.current.delete(tab.path);
      }
      const revision = (recoveryRevisionRef.current.get(tab.path) ?? 0) + 1;
      recoveryRevisionRef.current.set(tab.path, revision);
      const record: RecoveredDocument = {
        version: 1,
        revision,
        workspacePath: workspace,
        filePath: tab.path,
        content,
        updatedAt: Date.now(),
      };
      const write = saveRecoveredDocument(record).then(() => {
        knownRecoveriesRef.current.add(tab.path);
        recoveryErrorRef.current.delete(tab.path);
      }).catch(error => {
        if (!recoveryErrorRef.current.has(tab.path)) {
          recoveryErrorRef.current.add(tab.path);
          showToast(`Could not preserve unsaved changes for ${tab.path}: ${String(error)}`, 'error');
        }
        throw error;
      });
      writes.push(write);
    }
    await Promise.all(writes);
  }

  async function handleSafeReload() {
    const hasDirtyDocuments = tabsRef.current.some(tab => tab.isDirty && !tab.path.startsWith('__'));
    if (hasDirtyDocuments && (!sessionOptionsRef.current.restore || !sessionOptionsRef.current.recoverUnsaved)) {
      showToast('Save your changes or enable session recovery before reloading', 'error');
      return;
    }
    try {
      await persistDirtyDocuments();
      if (!(await persistCurrentSession())) return;
      window.location.reload();
    } catch (error) {
      showToast(`Could not safely reload the window: ${String(error)}`, 'error');
    }
  }

  useEffect(() => {
    if (!restoreReady) return;
    if (sessionTimerRef.current !== null) window.clearTimeout(sessionTimerRef.current);
    if (!sessionOptions.restore) return;
    sessionTimerRef.current = window.setTimeout(() => {
      sessionTimerRef.current = null;
      void persistCurrentSession();
    }, 450);
    return () => {
      if (sessionTimerRef.current !== null) {
        window.clearTimeout(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshots use current refs and state dependencies listed here.
  }, [
    restoreReady, sessionOptions.restore, folderPath, workspaceRoots, tabOrderKey, activeTab,
    editorStates, expandedFolders, sidebarOpen, aiPanelOpen, terminalOpen,
    terminalHeight, activeSidebarPanel, sidebarWidth,
  ]);

  useEffect(() => {
    if (!restoreReady || !sessionOptions.recoverUnsaved) return;
    const dirtyPaths = new Set(tabs.filter(tab => tab.isDirty && !tab.path.startsWith('__')).map(tab => tab.path));
    for (const path of dirtyPaths) {
      const existing = recoveryTimersRef.current.get(path);
      if (existing !== undefined) window.clearTimeout(existing);
      const content = fileContents[path];
      if (content === undefined) continue;
      recoveryTimersRef.current.set(path, window.setTimeout(() => {
        recoveryTimersRef.current.delete(path);
        const tab = tabsRef.current.find(current => current.path === path && current.isDirty);
        const latestContent = contentsRef.current[path];
        if (!tab || latestContent === undefined) return;
        const revision = (recoveryRevisionRef.current.get(path) ?? 0) + 1;
        recoveryRevisionRef.current.set(path, revision);
        void saveRecoveredDocument({
          version: 1,
          revision,
          workspacePath: folderPath ?? restoredSessionRef.current?.workspacePath ?? null,
          filePath: path,
          content: latestContent,
          updatedAt: Date.now(),
        }).then(() => {
          knownRecoveriesRef.current.add(path);
          recoveryErrorRef.current.delete(path);
        }).catch(error => {
          if (!recoveryErrorRef.current.has(path)) {
            recoveryErrorRef.current.add(path);
            showToast(`Could not preserve unsaved changes for ${path}: ${String(error)}`, 'error');
          }
        });
      }, 700));
    }
    for (const path of [...knownRecoveriesRef.current]) {
      if (dirtyPaths.has(path)) continue;
      const timer = recoveryTimersRef.current.get(path);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        recoveryTimersRef.current.delete(path);
      }
      void deleteRecoveredDocument(path).then(() => {
        knownRecoveriesRef.current.delete(path);
        recoveryRevisionRef.current.delete(path);
      }).catch(error => showToast(`Could not clear saved recovery for ${path}: ${String(error)}`, 'error'));
    }
    const timers = recoveryTimersRef.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer callbacks always read latest document snapshots through refs.
  }, [restoreReady, sessionOptions.recoverUnsaved, tabs, fileContents, folderPath]);

  useEffect(() => {
    if (!restoreReady) return;
    const onSessionCleared = () => {
      if (sessionTimerRef.current !== null) {
        window.clearTimeout(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      setWorkspaceRoots([]);
    };
    const onOptionChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; value: boolean }>).detail;
      const keyMap: Record<string, keyof typeof sessionOptions> = {
        'session.restore': 'restore',
        'session.restoreTabs': 'restoreTabs',
        'session.restoreEditorState': 'restoreEditorState',
        'session.recoverUnsaved': 'recoverUnsaved',
      };
      const key = keyMap[detail?.key];
      if (key) setSessionOptions(current => ({ ...current, [key]: detail.value }));
    };
    window.addEventListener('r0-session-cleared', onSessionCleared);
    window.addEventListener('r0-session-option-changed', onOptionChanged);
    return () => {
      window.removeEventListener('r0-session-cleared', onSessionCleared);
      window.removeEventListener('r0-session-option-changed', onOptionChanged);
    };
  }, [restoreReady, setWorkspaceRoots]);

  useEffect(() => {
    if (!restoreReady) return;
    let active = true;
    const recoveryTimers = recoveryTimersRef.current;
    const win = getCurrentWindow();
    let unlisten: (() => void) | null = null;
    win.onCloseRequested(async event => {
      if (allowCloseRef.current) return;
      event.preventDefault();
      if (closeInProgressRef.current) return;
      closeInProgressRef.current = true;
      if (sessionTimerRef.current !== null) {
        window.clearTimeout(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      for (const timer of recoveryTimers.values()) window.clearTimeout(timer);
      recoveryTimers.clear();
      let timeoutId = 0;
      const timeout = new Promise<void>(resolve => {
        timeoutId = window.setTimeout(resolve, 5_000);
      });
      try {
        await Promise.race([Promise.all([persistCurrentSession(), persistDirtyDocuments()]).then(() => {}), timeout]);
      } catch {
        // Persistence errors have already been reported; keep shutdown responsive.
      } finally {
        window.clearTimeout(timeoutId);
      }
      allowCloseRef.current = true;
      try {
        await win.destroy();
      } catch (error) {
        allowCloseRef.current = false;
        closeInProgressRef.current = false;
        showToast(`Could not close the application: ${String(error)}`, 'error');
      }
    }).then(stop => {
      if (active) unlisten = stop;
      else stop();
    }).catch(error => showToast(`Could not register session shutdown handling: ${String(error)}`, 'error'));
    return () => {
      active = false;
      unlisten?.();
      if (sessionTimerRef.current !== null) window.clearTimeout(sessionTimerRef.current);
      for (const timer of recoveryTimers.values()) window.clearTimeout(timer);
      recoveryTimers.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- close handler reads latest session snapshot and uses bounded flush.
  }, [restoreReady, sessionOptions.restore, sessionOptions.recoverUnsaved, setWorkspaceRoots, showToast]);

  useEffect(() => {
    if (!restoreReady) return;
    void setSetting('workspace.folder', folderPath ?? '').catch(error => {
      showToast(`Could not save the workspace path: ${String(error)}`, 'error');
    });
  }, [restoreReady, folderPath, showToast]);

  useEffect(() => {
    if (!restoreReady) return;
    void invoke('watch_workspace_roots', { roots: workspaceRoots }).catch(error => {
      showToast(`Could not watch workspace folders: ${String(error)}`, 'error');
    });
  }, [restoreReady, workspaceRoots, showToast]);

  useEffect(() => {
    if (!restoreReady) return;
    let active = true;
    let timer: number | null = null;
    let pendingPaths = new Set<string>();
    let unlisten: (() => void) | undefined;
    listen<string[]>('workspace-fs-changed', event => {
      for (const path of event.payload) pendingPaths.add(path);
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        const changedPaths = [...pendingPaths];
        pendingPaths = new Set<string>();
        refreshFileTree();
        for (const path of changedPaths) void refreshExternalFile(path);
        for (const root of workspaceRoots) {
          if (changedPaths.some(path => isPathWithinRoot(path, root))) notifyGitFilesystemChanged(root);
        }
      }, 120);
    }).then(stop => {
      if (active) unlisten = stop;
      else stop();
    }).catch(error => showToast(`Could not subscribe to workspace changes: ${String(error)}`, 'error'));
    return () => {
      active = false;
      unlisten?.();
      if (timer !== null) window.clearTimeout(timer);
      pendingPaths.clear();
    };
  }, [restoreReady, refreshFileTree, refreshExternalFile, showToast, workspaceRoots]);

  const handleFolderExpansionChange = useCallback((path: string, expanded: boolean) => {
    setExpandedFolders(current => {
      const next = new Set(current);
      if (expanded) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);
  const [gitBranch,      setGitBranch]     = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<{ rootPath: string; hash: string } | null>(null);
  const [paletteOpen,    setPaletteOpen]   = useState(false);
  const [paletteInitialQuery, setPaletteInitialQuery] = useState('>');
  const [settingsOpen,   setSettingsOpen]  = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<'general' | 'keybindings'>('general');
  const [aboutOpen,      setAboutOpen]     = useState(false);
  const [htmlPreviewTarget, setHtmlPreviewTarget] = useState<{ path: string; rootPath: string | null } | null>(null);
  const [htmlPreviewRefresh, setHtmlPreviewRefresh] = useState(0);
  const restoreStartedRef = useRef(false);

  function handleOpenHtmlPreview(path: string) {
    openTab(path);
    setHtmlPreviewTarget({ path, rootPath: folderPath });
  }

  function handleGoLive() {
    if (!activeTab || !folderPath) return;
    if (htmlPreviewTarget?.path === activeTab && htmlPreviewTarget.rootPath === folderPath) {
      setHtmlPreviewTarget(null);
      return;
    }
    setHtmlPreviewTarget({ path: activeTab, rootPath: folderPath });
  }

  async function isFormatOnSaveEnabled(): Promise<boolean> {
    try {
      return await getSetting('editor.formatOnSave');
    } catch (error) {
      showToast(`Could not load format-on-save setting: ${String(error)}`, 'error');
      return false;
    }
  }

  async function getFormattedContent(path: string, enabled: boolean): Promise<string | undefined> {
    if (!enabled || !canFormat(path)) return undefined;
    if (activeTab === path && editorRef.current) {
      return (await editorRef.current.formatDocument()) ?? undefined;
    }
    if (!canFormatOffline(path)) return undefined;
    const content = fileContentsRef.current[path];
    if (content === undefined) return undefined;
    try {
      return (await formatSource(content, path, undefined, content.length, folderPath)).text;
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), 'error');
      return undefined;
    }
  }

  async function saveAndRefreshPreview(path: string) {
    const enabled = await isFormatOnSaveEnabled();
    await handleSave(path, await getFormattedContent(path, enabled));
    if (htmlPreviewTarget?.rootPath === folderPath) setHtmlPreviewRefresh(value => value + 1);
  }

  async function saveAsAndRefreshPreview() {
    const path = activeTabRef.current;
    if (!path) return;
    const enabled = await isFormatOnSaveEnabled();
    await handleSaveAs(await getFormattedContent(path, enabled));
    if (htmlPreviewTarget?.rootPath === folderPath) setHtmlPreviewRefresh(value => value + 1);
  }

  async function saveAllAndRefreshPreview() {
    const formatted: Record<string, string> = {};
    if (await isFormatOnSaveEnabled()) {
      for (const tab of tabs) {
        if (!tab.isDirty || tab.isUntitled || !canFormatOffline(tab.path)) continue;
        const content = await getFormattedContent(tab.path, true);
        if (content !== undefined) formatted[tab.path] = content;
      }
    }
    await handleSaveAll(formatted);
    if (htmlPreviewTarget?.rootPath === folderPath) setHtmlPreviewRefresh(value => value + 1);
  }

  // Stable async-generator callback for AI inline autocomplete.
  // Reads localStorage at call time so model/provider/enabled changes take effect immediately.
  const getAiCompletion = useMemo<AiCompletionFn>(() => {
    return async function* (prefix, suffix, signal) {
      if (localStorage.getItem('r0-editor-ai-autocomplete') === 'false') return;
      const providerId = localStorage.getItem('r0-ai-provider') ?? 'anthropic';
      const modelId    = localStorage.getItem('r0-ai-model')    ?? 'claude-haiku-4-5-20251001';
      const apiKey = await loadApiKey(providerId);
      const LOCAL_IDS = ['ollama', 'lmstudio', 'vllm'];
      if (!apiKey && !LOCAL_IDS.includes(providerId)) return;
      const model = buildLanguageModel(providerId, modelId, apiKey ?? '');
      const result = streamText({
        model,
        system: [
          'You perform fill-in-the-middle code completion.',
          'You receive PREFIX (code before cursor) and SUFFIX (code after cursor).',
          'Your output is inserted EXACTLY at the cursor. PREFIX + your_output + SUFFIX must form valid, syntactically-correct code.',
          'Output the next chunk you can predict with high confidence. Stop when the next decision becomes genuinely ambiguous.',
          'Hard rules:',
          '1. NEVER repeat any text already in PREFIX or SUFFIX.',
          '2. NEVER write code that belongs after SUFFIX.',
          '3. Match surrounding indentation, quoting, and naming conventions exactly.',
          '4. Output empty string when no confident completion exists — never guess.',
          '5. Output format: raw insertion text only. No markdown fences. No commentary.',
        ].join('\n'),
        prompt: `PREFIX:\n<<<\n${prefix}\n>>>\n\nSUFFIX:\n<<<\n${suffix}\n>>>\n\nOutput the text to insert at the cursor.`,
        abortSignal: signal,
      });
      for await (const chunk of result.textStream) yield chunk;
    };
  }, []); // Empty deps — reads localStorage lazily at call time

  // Refresh git branch on folder change
  useEffect(() => {
    if (!restoreReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guard reset when no folder is open
    if (!folderPath) { setGitBranch(null); return; }
    getBranch(folderPath).then(setGitBranch).catch(() => setGitBranch(null));
  }, [folderPath, restoreReady]);

  useEffect(() => onGitRepositoryChanged(({ path }) => {
    if (!folderPath || path.toLowerCase() !== folderPath.toLowerCase()) return;
    refreshFileTree();
    void getBranch(folderPath)
      .then(setGitBranch)
      .catch(error => showToast(`Could not refresh Git branch: ${String(error)}`, 'error'));
  }), [folderPath, refreshFileTree, showToast]);

  // Poke CodeMirror + xterm to re-measure after window geometry changes
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let raf = 0;
    const notify = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      });
    };
    const win = getCurrentWindow();
    win.onResized(notify).then(fn => unlisteners.push(fn));
    win.listen('tauri://resize', notify).then(fn => unlisteners.push(fn));
    window.visualViewport?.addEventListener('resize', notify);
    return () => {
      cancelAnimationFrame(raf);
      window.visualViewport?.removeEventListener('resize', notify);
      unlisteners.forEach(fn => fn());
    };
  }, []);

  // Check for updates once on startup; show a persistent toast if one is available.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount
  useEffect(() => {
    checkForUpdate().then(async (update) => {
      if (!update) return;
      showToast(`Update available — v${update.version}`, 'info', {
        label: 'Install & Restart',
        onClick: async () => {
          try {
            showToast('Downloading update...', 'info');
            await update.downloadAndInstall();
            await relaunch();
          } catch {
            showToast('Update failed. Try again later.', 'error');
          }
        },
      });
    }).catch(() => { /* offline or no update endpoint configured */ });
  }, []);

  // Apply a queued diff once the target tab is active and its content is loaded.
  // pendingDiffTick is incremented whenever a new pending diff is enqueued so the
  // effect fires even when activeTab and fileContents haven't changed (already-active
  // tab edge case where editorRef.current was transiently null at enqueue time).
  useEffect(() => {
    const pending = pendingDiffRef.current;
    if (!pending) return;
    if (activeTab !== pending.targetPath) return;
    if (fileContents[pending.targetPath] === undefined) return;
    if (!editorRef.current) return;
    pendingDiffRef.current = null;
    editorRef.current.showDiff(pending.code, fileContents[pending.targetPath]);
  }, [activeTab, fileContents, pendingDiffTick]);

  // Wire the debug navigation callback so DebugContext can open/jump to a paused file.
  useEffect(() => {
    debugCtx.setNavigationCallback(openTabAtLine);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debugCtx is stable; only re-wire when the callback changes
  }, [openTabAtLine]);

  // Push breakpoint + paused-line state into the editor whenever debug session changes.
  useEffect(() => {
    if (!activeTab || activeTab.startsWith('__')) return;
    const lines = (debugCtx.session.breakpoints.get(activeTab) ?? []).map(e => e.line);
    const topFrame = debugCtx.session.stackFrames[0];
    const pausedLine =
      topFrame?.source?.path === activeTab ? topFrame.line : null;
    editorRef.current?.syncBreakpoints(lines, pausedLine);
  }, [activeTab, debugCtx.session.breakpoints, debugCtx.session.stackFrames]);

  const { isFullscreen, toggleFullscreen } = useGlobalKeybindings({
    saveActive:        () => { if (activeTab) void saveAndRefreshPreview(activeTab); },
    toggleTerminal:    () => setTerminalOpen(v => !v),
    togglePalette:     () => setPaletteOpen(v => !v),
    openCommandPalette: () => { setPaletteInitialQuery('>'); setPaletteOpen(true); },
    quickOpen:         () => { setPaletteInitialQuery('@'); setPaletteOpen(true); },
    selectSidebarPanel: panel => { setSidebarOpen(true); setActiveSidebarPanel(panel); },
    toggleSettings:    () => setSettingsOpen(v => !v),
    newFile:           () => handleNewFile(),
    openFile:          () => handleOpenFile(),
    closeTab:          () => { if (activeTab) closeTab(activeTab); },
    toggleSidebar:     () => setSidebarOpen(v => !v),
    zoomIn:            () => handleZoomIn(),
    zoomOut:           () => handleZoomOut(),
    zoomReset:         () => handleZoomReset(),
    startDebug:        () => setSidebarOpen(true),
    stopDebug:         () => debugCtx.stopSession(),
    stepOver:          () => debugCtx.stepOver?.(),
    stepInto:          () => debugCtx.stepIn?.(),
    stepOut:           () => debugCtx.stepOut?.(),
    formatDocument:    () => { void editorRef.current?.formatDocument(); },
    reloadWindow:      () => { void handleSafeReload(); },
  });

  async function completeOnboarding() {
    localStorage.setItem('r0-onboarding', 'true');
    setOnboardingDone(true);
    await setSetting('onboarding.done', true);
  }

  async function handleOpenFolder() {
    try {
      const result = await open({ directory: true, multiple: false });
      if (!result) return;
      const path = result as string;
      const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
      try {
        await pushRecentProject({ path, name });
      } catch (error) {
        showToast(`Could not save recent project: ${String(error)}`, 'error');
      }
      setFolderPath(path);
    } catch (error) {
      showToast(`Could not open folder: ${String(error)}`, 'error');
    }
  }

  async function handleAddFolderToWorkspace() {
    try {
      const result = await open({ directory: true, multiple: false });
      if (!result) return;
      const path = result as string;
      await readDir(path);
      if (!addWorkspaceRoot(path)) {
        showToast('That folder is already in this workspace', 'info');
        return;
      }
      const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
      try {
        await pushRecentProject({ path, name });
      } catch (error) {
        showToast(`Could not save recent project: ${String(error)}`, 'error');
      }
    } catch (error) {
      showToast(`Could not add folder to workspace: ${String(error)}`, 'error');
    }
  }

  async function handleRecentProjectOpen(path: string) {
    try {
      await readDir(path);
      setFolderPath(path);
      const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
      await pushRecentProject({ path, name });
    } catch (error) {
      showToast(`Could not reopen project ${path}: ${String(error)}`, 'error', {
        label: 'Choose Folder',
        onClick: () => { void handleOpenFolder(); },
      });
    }
  }

  async function handleOpenFile() {
    try {
      const result = await open({ multiple: false });
      if (!result) return;
      openTab(result as string);
    } catch (error) {
      showToast(`Could not open file: ${String(error)}`, 'error');
    }
  }

  function handleApplyCode(code: string, filePath?: string, _ctx?: EditorContext) {
    const currentActiveTab    = activeTabRef.current;
    const currentFileContents = fileContentsRef.current;
    const targetPath = filePath ?? currentActiveTab;
    if (!targetPath) return;

    if (
      targetPath === currentActiveTab &&
      editorRef.current &&
      currentFileContents[targetPath] !== undefined
    ) {
      editorRef.current.showDiff(code, currentFileContents[targetPath]);
    } else {
      pendingDiffRef.current = { code, targetPath };
      openTab(targetPath);
      setPendingDiffTick(v => v + 1);
    }
  }

  function handleNewWindow() {
    new WebviewWindow(`origin-${Date.now()}`, {
      url: '/',
      title: 'r0 IDE',
      width: 1280,
      height: 800,
      decorations: false,
      backgroundColor: '#0a0a0a',
    });
  }

  function handleZoomIn() {
    setZoom(prev => {
      const next = Math.min(+(prev + 0.1).toFixed(1), 2.0);
      document.documentElement.style.zoom = String(next);
      return next;
    });
  }

  function handleZoomOut() {
    setZoom(prev => {
      const next = Math.max(+(prev - 0.1).toFixed(1), 0.5);
      document.documentElement.style.zoom = String(next);
      return next;
    });
  }

  function handleZoomReset() {
    setZoom(1.0);
    document.documentElement.style.zoom = '1';
  }

  function handleNewTerminalTab() {
    if (!terminalOpen) setTerminalOpen(true);
    else terminalRef.current?.addTab();
  }

  function handleMissingServer(language: string, installCmd: string) {
    const names: Record<string, string> = { typescript: 'TypeScript', rust: 'Rust', python: 'Python' };
    const langName = names[language] ?? language;
    // Open terminal now so TerminalPanel is mounted by the time the user clicks Install
    setTerminalOpen(true);
    showToast(
      `${langName} language server not found`,
      'info',
      {
        label: 'Install',
        onClick: () => { terminalRef.current?.runInNewTab(installCmd); },
      },
    );
  }

  function handleAbout() { setAboutOpen(true); }

  const handleOpenCommit = useCallback((hash: string, rootPath: string) => {
    setSelectedCommit({ rootPath, hash });
    openGitCommitTab(rootPath, hash);
  }, [openGitCommitTab]);

  const handleOpenCommitFile = useCallback((rootPath: string, file: GitChangedFile, details: GitCommitDetails) => {
    const oldFilePath = file.old_path ?? file.path;
    openGitDiffTab({
      rootPath,
      key: `${details.hash}_${details.comparison_parent ?? 'root'}_${encodeURIComponent(oldFilePath)}_${encodeURIComponent(file.path)}`,
      oldRevision: details.comparison_parent,
      newRevision: details.hash,
      oldFilePath,
      newFilePath: file.path,
      oldIsEmpty: file.status === 'added' || details.comparison_parent === null,
      newIsEmpty: file.status === 'deleted',
      newIsWorkingTree: false,
      oldLabel: details.comparison_parent?.slice(0, 7) ?? 'empty',
      newLabel: details.hash.slice(0, 7),
    });
  }, [openGitDiffTab]);

  const handleOpenWorkingDiff = useCallback((file: StatusFile, rootPath: string) => {
    const status = file.status.replace(/\s/g, '');
    const oldIsEmpty = status === '??' || status.includes('A');
    const newIsEmpty = status.includes('D');
    openGitDiffTab({
      rootPath,
      key: `working_${encodeURIComponent(file.path)}`,
      oldRevision: oldIsEmpty ? null : 'HEAD',
      newRevision: null,
      oldFilePath: file.old_path ?? file.path,
      newFilePath: file.path,
      oldIsEmpty,
      newIsEmpty,
      newIsWorkingTree: !newIsEmpty,
      oldLabel: oldIsEmpty ? 'empty' : 'HEAD',
      newLabel: newIsEmpty ? 'deleted' : 'Working Tree',
    });
  }, [openGitDiffTab]);

  const commands = {
    sidebarOpen, onToggleSidebar: () => setSidebarOpen(v => !v),
    terminalOpen, onToggleTerminal: () => setTerminalOpen(v => !v),
    aiPanelOpen, onToggleAiPanel: () => setAiPanelOpen(v => !v),
    isFullscreen, onToggleFullscreen: toggleFullscreen,
    onOpenFolder: handleOpenFolder,
    onAddFolderToWorkspace: handleAddFolderToWorkspace,
    onOpenFile: handleOpenFile,
    onNewFile: handleNewFile,
    onNewWindow: handleNewWindow,
    onOpenPalette: () => { setPaletteInitialQuery('>'); setPaletteOpen(true); },
    onOpenKeyboardShortcuts: () => { setSettingsInitialSection('keybindings'); setSettingsOpen(true); },
    gitBranch,
    dirtyCount: tabs.filter(t => t.isDirty).length,
    hasActiveTab: !!activeTab && !activeTab.startsWith('__diff__'),
    hasFolderOpen: !!folderPath,
    onSave: () => { if (activeTab) void saveAndRefreshPreview(activeTab); },
    onSaveAs: saveAsAndRefreshPreview,
    onSaveAll: saveAllAndRefreshPreview,
    onCloseEditor: () => { if (activeTab) closeTab(activeTab); },
    onCloseFolder: () => setFolderPath(null),
    onEditorUndo: () => editorRef.current?.undo(),
    onEditorRedo: () => editorRef.current?.redo(),
    onEditorCut: () => editorRef.current?.cut(),
    onEditorCopy: () => editorRef.current?.copy(),
    onEditorPaste: () => editorRef.current?.paste(),
    onEditorSelectAll: () => editorRef.current?.selectAll(),
    onEditorFind: () => editorRef.current?.openFind(),
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onZoomReset: handleZoomReset,
    onNewTerminalTab: handleNewTerminalTab,
    onClearTerminal: () => terminalRef.current?.clearActive(),
    onKillTerminal: () => terminalRef.current?.killActive(),
    onAbout: handleAbout,
    onStartDebugging: () => {
      setSidebarOpen(true);
    },
    onStopDebugging: () => debugCtx.stopSession(),
    isDebugActive: debugCtx.session.status !== 'idle' && debugCtx.session.status !== 'terminated',
  };

  if (!restoreReady) {
    return (
      <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: "var(--r0-bg-base)", color: "var(--r0-fg-muted)" }}>
        Restoring session…
      </div>
    );
  }

  return (
    <CommandContext.Provider value={commands}>
    <div
      className="h-full w-full flex flex-col"
      style={{ backgroundColor: "var(--r0-bg-base)", color: "var(--r0-fg-default)" }}
    >
      {onboardingDone && <TitleBar />}
      {!onboardingDone ? (
        <Onboarding onComplete={completeOnboarding} />
      ) : (
        <>
          <div className="flex flex-1 overflow-hidden">
            {sidebarOpen && (
              <Sidebar
                onFileOpen={openTab}
                onPreviewOpen={handleOpenHtmlPreview}
                onPathRenamed={handlePathRenamed}
                selectedFilePath={activeTab && !activeTab.startsWith('__') ? activeTab : null}
                onFileOpenAtLine={openTabAtLine}
                fileTreeKey={fileTreeVersion}
                onOpenCommit={handleOpenCommit}
                onOpenWorkingDiff={handleOpenWorkingDiff}
                selectedCommitHash={selectedCommit?.hash ?? null}
                expandedFolders={expandedFolders}
                onFolderExpansionChange={handleFolderExpansionChange}
                activePanel={activeSidebarPanel}
                onActivePanelChange={setActiveSidebarPanel}
                width={sidebarWidth}
                onWidthChange={setSidebarWidth}
              />
            )}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden">
                <TabBar
                  tabs={tabs}
                  activeTab={activeTab}
                  onSelect={setActiveTab}
                  onClose={(path) => {
                    if (path === '__preview__') localStorage.removeItem('r0-preview-url');
                    closeTab(path);
                  }}
                  onNewFile={handleNewFile}
                  onOpenFile={handleOpenFile}
                  onOpenPreview={openPreviewTab}
                />
                <main className="flex-1 flex overflow-hidden" style={{ backgroundColor: "var(--r0-bg-editor)", position: "relative" }}>
                  {debugCtx.session.status !== 'idle' && debugCtx.session.status !== 'terminated' && (
                    <DebugToolbar
                      status={debugCtx.session.status}
                      onContinue={debugCtx.continueExec}
                      onStepOver={debugCtx.stepOver}
                      onStepIn={debugCtx.stepIn}
                      onStepOut={debugCtx.stepOut}
                      onPause={debugCtx.pause}
                      onStop={debugCtx.stopSession}
                    />
                  )}
                  {!activeTab || !tabs.some(tab => tab.path === activeTab) ? (
                    <EditorEmptyState
                      folderPath={folderPath}
                      onFolderOpen={handleOpenFolder}
                      onRecentProjectOpen={handleRecentProjectOpen}
                      onFileOpen={handleOpenFile}
                      onNewFile={handleNewFile}
                    />
                  ) : activeTab?.startsWith('__diff__') ? (
                    (() => {
                      const diffTab = tabs.find(t => t.path === activeTab) as AiDiffTabData | undefined;
                      if (!diffTab) return null;
                      return <AiDiffPane tab={diffTab} onClose={() => closeTab(activeTab)} />;
                    })()
                  ) : activeTab?.startsWith('__git_commit__') ? (
                    (() => {
                      const commitTab = tabs.find(t => t.path === activeTab);
                      const rootPath = commitTab?.gitRootPath;
                      if (!commitTab?.commitHash || !rootPath) return null;
                      return (
                        <GitCommitDetailsPane
                          key={`${rootPath}:${commitTab.commitHash}`}
                          rootPath={rootPath}
                          hash={commitTab.commitHash}
                          onOpenDiff={handleOpenCommitFile}
                        />
                      );
                    })()
                  ) : activeTab?.startsWith('__git_diff__') ? (
                    (() => {
                      const gitDiffTab = tabs.find(t => t.path === activeTab);
                      const rootPath = gitDiffTab?.gitRootPath;
                      if (!gitDiffTab || !rootPath) return null;
                      return (
                        <GitDiffPane
                          rootPath={rootPath}
                          tab={gitDiffTab}
                          onOpenCommit={hash => openGitCommitTab(rootPath, hash)}
                        />
                      );
                    })()
                  ) : activeTab === '__preview__' ? (
                    <WebPreviewPane />
                  ) : activeTab && isImageFile(activeTab) ? (
                    <ImagePreview key={activeTab} path={activeTab} />
                  ) : activeTab && fileContents[activeTab] !== undefined ? (
                    <Editor
                      ref={editorRef}
                      path={activeTab}
                      content={fileContents[activeTab]}
                      onChange={v => handleEditorChange(activeTab, v)}
                      onCursorChange={(line, col) =>
                        setCursorPositions(prev => ({ ...prev, [activeTab]: { line, col } }))
                      }
                      initialCursor={cursorPositions[activeTab]}
                      initialEditorState={sessionOptions.restoreEditorState ? editorStates[activeTab] : undefined}
                      onEditorStateChange={state => {
                        setEditorStates(previous => previous[activeTab] === state
                          ? previous
                          : { ...previous, [activeTab]: state });
                      }}
                      jumpTo={jumpRequest?.path === activeTab ? jumpRequest : undefined}
                      onAddToAiContext={ctx => { setPinnedContext(ctx); setAiPanelOpen(true); }}
                      onAcceptDiff={() => saveAndRefreshPreview(activeTab)}
                      rootPath={folderPath}
                      onDefinitionJump={(fp, line, col) => openTabAtLine(fp, line, col)}
                      onMissingServer={handleMissingServer}
                      getAiCompletion={getAiCompletion}
                      onToggleBreakpoint={(fp, line) => debugCtx.toggleBreakpoint(fp, line)}
                    />
                  ) : activeTab && fileErrors[activeTab] ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2">
                      <p className="text-xs" style={{ color: "var(--r0-semantic-error)" }}>
                        Failed to read {activeTab.split(/[\\/]/).pop()}
                      </p>
                      <p className="text-xs" style={{ color: "var(--r0-fg-subtle)" }}>
                        {fileErrors[activeTab]}
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-xs" style={{ color: "var(--r0-fg-subtle)", opacity: 0.6, letterSpacing: "0.12em" }}>
                        Loading
                        <span style={{ animation: "r0-ellipsis 1.2s steps(4, end) infinite" }}>…</span>
                      </span>
                    </div>
                  )}
                  {terminalOpen && (
                    <div
                      style={{
                        position: "absolute", bottom: 0, left: 0, right: 0, height: 20,
                        background: "linear-gradient(to bottom, transparent, var(--r0-bg-panel))",
                        pointerEvents: "none", zIndex: 10,
                      }}
                    />
                  )}
                </main>
                {htmlPreviewTarget && htmlPreviewTarget.rootPath === folderPath && (
                  <div style={{ height: 280, flexShrink: 0 }}>
                    <HtmlLivePreviewPanel
                      rootPath={folderPath}
                      htmlPath={htmlPreviewTarget.path}
                      htmlContent={fileContents[htmlPreviewTarget.path] ?? ''}
                      refreshToken={htmlPreviewRefresh}
                      onClose={() => setHtmlPreviewTarget(null)}
                    />
                  </div>
                )}
                {terminalMounted && (
                  <TerminalPanel
                    ref={terminalRef}
                    cwd={folderPath ?? "."}
                    height={terminalHeight}
                    onResize={setTerminalHeight}
                    onClose={() => setTerminalOpen(false)}
                    hidden={!terminalOpen}
                  />
                )}
              </div>
              {aiPanelOpen && (
                <AiPanel
                  getEditorContext={() => editorRef.current?.getEditorContext() ?? null}
                  getActiveFilePath={() => activeTab}
                  forcedContext={pinnedContext}
                  onForcedContextConsumed={() => setPinnedContext(null)}
                  onApplyCode={handleApplyCode}
                  getOpenTabPaths={() => tabs.map(t => t.path)}
                  getFileContents={() => fileContentsRef.current}
                  onOpenDiffTab={openAiDiffTab}
                />
              )}
            </div>
          </div>
          <StatusBar
            language={languageLabel(activeTab)}
            line={cursorPositions[activeTab ?? '']?.line ?? 1}
            col={cursorPositions[activeTab ?? '']?.col ?? 1}
            branch={gitBranch}
            onOpenSettings={() => setSettingsOpen(true)}
            activeFilePath={folderPath ? activeTab : null}
            livePreviewActive={
              !!htmlPreviewTarget &&
              htmlPreviewTarget.path === activeTab &&
              htmlPreviewTarget.rootPath === folderPath
            }
            onGoLive={handleGoLive}
            debugStatus={
              debugCtx.session.status === 'paused' ? 'paused' :
              debugCtx.session.status === 'running' ? 'running' : null
            }
          />
        </>
      )}
      {paletteOpen && (
        <CommandPalette
          initialQuery={paletteInitialQuery}
          tabs={tabs}
          onFileOpen={openTab}
          onFileOpenAtLine={(path, line) => { setPaletteOpen(false); openTabAtLine(path, line, 0); }}
          onClose={() => setPaletteOpen(false)}
          onNewFile={() => { setPaletteOpen(false); handleNewFile(); }}
          onOpenFolder={() => { setPaletteOpen(false); handleOpenFolder(); }}
          onAddFolderToWorkspace={() => { setPaletteOpen(false); handleAddFolderToWorkspace(); }}
          onReloadWindow={() => { void handleSafeReload(); }}
          onOpenFile={() => { setPaletteOpen(false); handleOpenFile(); }}
          onToggleSidebar={() => { setPaletteOpen(false); setSidebarOpen(v => !v); }}
          onToggleTerminal={() => { setPaletteOpen(false); setTerminalOpen(v => !v); }}
          onOpenSettings={() => { setPaletteOpen(false); setSettingsInitialSection('general'); setSettingsOpen(true); }}
          onOpenKeyboardShortcuts={() => { setPaletteOpen(false); setSettingsInitialSection('keybindings'); setSettingsOpen(true); }}
          onSave={() => { if (activeTab) void saveAndRefreshPreview(activeTab); }}
          onSaveAll={() => { void saveAllAndRefreshPreview(); }}
          onCloseEditor={() => { if (activeTab) closeTab(activeTab); }}
          onSelectSidebarPanel={panel => { setSidebarOpen(true); setActiveSidebarPanel(panel); }}
          activeFilePath={activeTab}
          onOpenHtmlPreview={handleOpenHtmlPreview}
          onFormatDocument={() => { void editorRef.current?.formatDocument(); }}
          terminalOpen={terminalOpen}
          sidebarOpen={sidebarOpen}
        />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} initialSection={settingsInitialSection} />}
      {aboutOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setAboutOpen(false)}
        >
          <div
            style={{
              background: 'var(--r0-bg-surface)',
              border: '1px solid var(--r0-border-default)',
              borderRadius: '10px',
              padding: '28px 32px',
              minWidth: '280px',
              display: 'flex', flexDirection: 'column', gap: '8px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--r0-fg-default)', margin: 0 }}>r0 IDE</p>
            <p style={{ fontSize: '12px', color: 'var(--r0-fg-muted)', margin: 0 }}>Version 0.1.0</p>
            <p style={{ fontSize: '12px', color: 'var(--r0-fg-subtle)', margin: '8px 0 0', lineHeight: 1.6 }}>
              Built with Tauri 2.x + React + CodeMirror 6.
            </p>
            <button
              onClick={() => setAboutOpen(false)}
              style={{
                marginTop: '16px', padding: '6px 16px', alignSelf: 'flex-end',
                background: 'var(--r0-bg-hover)', color: 'var(--r0-fg-default)',
                border: '1px solid var(--r0-border-default)', borderRadius: '6px',
                cursor: 'pointer', fontSize: '12px',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
    </CommandContext.Provider>
  );
}

export default App;
