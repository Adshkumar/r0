import { useState, useRef, useEffect, useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "../lib/fs";
import { isImageFile } from "../lib/imagePreview";
import type { Tab } from "../components/editor/TabBar";
import { useToast } from "../components/ui/Toast";

export function useTabs() {
  const { showToast } = useToast();

  const [tabs, setTabs]               = useState<Tab[]>([]);
  const [activeTab, setActiveTab]     = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [fileErrors, setFileErrors]   = useState<Record<string, string>>({});
  const [jumpRequest, setJumpRequest] = useState<{ path: string; line: number; col: number; key: number } | null>(null);
  const [fileTreeVersion, setFileTreeVersion] = useState(0);
  const untitledCount = useRef(0);

  // Always-current snapshots used by callbacks that fire before re-render
  const activeTabRef      = useRef<string | null>(activeTab);
  const fileContentsRef   = useRef<Record<string, string>>(fileContents);
  // eslint-disable-next-line react-hooks/refs -- stable ref pattern: keep current values visible to pre-render callbacks
  activeTabRef.current    = activeTab;
  // eslint-disable-next-line react-hooks/refs -- stable ref pattern: keep current values visible to pre-render callbacks
  fileContentsRef.current = fileContents;

  useEffect(() => {
    if (!activeTab || fileContents[activeTab] !== undefined) return;
    if (
      activeTab.startsWith('__untitled__') ||
      activeTab.startsWith('__diff__') ||
      activeTab.startsWith('__git_commit__') ||
      activeTab.startsWith('__git_diff__') ||
      activeTab.startsWith('__preview__') ||
      isImageFile(activeTab)
    ) return;
    readFile(activeTab)
      .then(content => setFileContents(prev => ({ ...prev, [activeTab]: content })))
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        const name = activeTab.split(/[\\/]/).filter(Boolean).pop() ?? activeTab;
        showToast(`Failed to read ${name}: ${msg}`, 'error');
        setFileErrors(prev => ({ ...prev, [activeTab]: msg }));
        setFileContents(prev => ({ ...prev, [activeTab]: '' }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showToast is stable; including it would re-run this file-load effect needlessly
  }, [activeTab, fileContents]);

  function openTab(path: string) {
    const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
    setTabs(prev => prev.find(t => t.path === path) ? prev : [...prev, { path, name, isDirty: false }]);
    setActiveTab(path);
  }

  function openTabAtLine(path: string, line: number, col: number) {
    openTab(path);
    setJumpRequest({ path, line, col, key: Date.now() });
  }

  function closeTab(path: string) {
    setTabs(prev => {
      const idx  = prev.findIndex(t => t.path === path);
      const next = prev.filter(t => t.path !== path);
      if (activeTab === path) {
        setActiveTab((next[idx] ?? next[idx - 1] ?? null)?.path ?? null);
      }
      return next;
    });
  }

  function handlePathRenamed(from: string, to: string) {
    const source = from.replace(/[/\\]+$/, '');
    const normalizedSource = source.replace(/\//g, '\\').toLowerCase();
    const rebase = (path: string) => {
      const normalizedPath = path.replace(/\//g, '\\').toLowerCase();
      if (normalizedPath === normalizedSource) return to;
      if (normalizedPath.startsWith(`${normalizedSource}\\`)) return `${to}${path.slice(source.length)}`;
      return path;
    };
    const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

    setTabs(current => current.map(tab => {
      const path = tab.path.startsWith('__') ? tab.path : rebase(tab.path);
      const filePath = tab.filePath ? rebase(tab.filePath) : undefined;
      const gitDiff = tab.gitDiff
        ? {
            ...tab.gitDiff,
            oldFilePath: rebase(tab.gitDiff.oldFilePath),
            newFilePath: rebase(tab.gitDiff.newFilePath),
          }
        : undefined;
      const name = filePath && filePath !== tab.filePath
        ? `${basename(filePath)} (diff)`
        : path !== tab.path
          ? basename(path)
          : tab.name;
      return {
        ...tab,
        path,
        name,
        ...(filePath !== undefined ? { filePath } : {}),
        ...(gitDiff ? { gitDiff } : {}),
      };
    }));
    setActiveTab(current => current && !current.startsWith('__') ? rebase(current) : current);
    setFileContents(current => {
      const next = { ...current };
      for (const [path, content] of Object.entries(current)) {
        const renamedPath = rebase(path);
        if (renamedPath !== path) {
          delete next[path];
          next[renamedPath] = content;
        }
      }
      return next;
    });
    setFileErrors(current => {
      const next = { ...current };
      for (const [path, error] of Object.entries(current)) {
        const renamedPath = rebase(path);
        if (renamedPath !== path) {
          delete next[path];
          next[renamedPath] = error;
        }
      }
      return next;
    });
    setJumpRequest(current => current ? { ...current, path: rebase(current.path) } : current);
  }

  function handleNewFile() {
    untitledCount.current += 1;
    const id = `__untitled__${untitledCount.current}`;
    setTabs(prev => [...prev, { path: id, name: `Untitled-${untitledCount.current}`, isDirty: true, isUntitled: true }]);
    setFileContents(prev => ({ ...prev, [id]: '' }));
    setActiveTab(id);
  }

  function handleEditorChange(path: string, value: string) {
    setFileContents(prev => ({ ...prev, [path]: value }));
    setTabs(prev => prev.map(t => t.path === path ? { ...t, isDirty: true } : t));
  }

  function openAiDiffTab(data: {
    approvalId: string;
    filePath: string;
    proposedContent: string;
    originalContent: string;
    approve: () => void;
    reject: () => void;
  }) {
    const tabPath  = `__diff__${data.approvalId}`;
    const fileName = data.filePath.split(/[\\/]/).filter(Boolean).pop() ?? data.filePath;
    const approveAndRefresh = () => {
      data.approve();
      setFileContents(prev => ({ ...prev, [data.filePath]: data.proposedContent }));
      setTabs(prev => prev.map(t => t.path === data.filePath ? { ...t, isDirty: false } : t));
      setFileTreeVersion(v => v + 1);
    };
    setTabs(prev => prev.find(t => t.path === tabPath) ? prev : [...prev, {
      path: tabPath,
      name: `${fileName} (diff)`,
      isDirty: false,
      kind: 'ai-diff' as const,
      filePath: data.filePath,
      originalContent: data.originalContent,
      proposedContent: data.proposedContent,
      approve: approveAndRefresh,
      reject: data.reject,
    }]);
    setActiveTab(tabPath);
  }

  function openPreviewTab() {
    const tabPath = '__preview__';
    setTabs(prev => prev.find(t => t.path === tabPath)
      ? prev
      : [...prev, { path: tabPath, name: 'Live Preview', isDirty: false, kind: 'preview' as const }]
    );
    setActiveTab(tabPath);
  }

  const openGitCommitTab = useCallback((rootPath: string, hash: string) => {
    const path = `__git_commit__${encodeURIComponent(rootPath)}__${hash}`;
    setTabs(prev => prev.some(tab => tab.path === path)
      ? prev
      : [...prev, { path, name: `Commit ${hash.slice(0, 7)}`, isDirty: false, kind: 'git-commit', commitHash: hash, gitRootPath: rootPath }]
    );
    setActiveTab(path);
  }, []);

  const openGitDiffTab = useCallback((input: NonNullable<Tab['gitDiff']> & { key: string; rootPath: string }) => {
    const path = `__git_diff__${encodeURIComponent(input.rootPath)}__${input.key}`;
    const oldName = input.oldFilePath.split(/[\\/]/).filter(Boolean).pop() ?? input.oldFilePath;
    const newName = input.newFilePath.split(/[\\/]/).filter(Boolean).pop() ?? input.newFilePath;
    const name = `${oldName} (${input.oldLabel}) ↔ ${newName} (${input.newLabel})`;
    setTabs(prev => prev.some(tab => tab.path === path)
      ? prev
      : [...prev, {
          path,
          name,
          isDirty: false,
          kind: 'git-diff',
          gitRootPath: input.rootPath,
          gitDiff: {
            oldRevision: input.oldRevision,
            newRevision: input.newRevision,
            oldFilePath: input.oldFilePath,
            newFilePath: input.newFilePath,
            oldIsEmpty: input.oldIsEmpty,
            newIsEmpty: input.newIsEmpty,
            newIsWorkingTree: input.newIsWorkingTree,
            oldLabel: input.oldLabel,
            newLabel: input.newLabel,
          },
        }]
    );
    setActiveTab(path);
  }, []);

  async function handleSave(path: string, contentOverride?: string) {
    const content = contentOverride ?? fileContentsRef.current[path];
    if (content === undefined) return;
    const tab = tabs.find(t => t.path === path);
    if (tab?.isUntitled) {
      const dest = await save({ defaultPath: tab.name });
      if (!dest) return;
      await writeFile(dest, content);
      const newName = dest.split(/[\\/]/).filter(Boolean).pop() ?? dest;
      setTabs(prev => prev.map(t => t.path === path ? { ...t, path: dest, name: newName, isDirty: false, isUntitled: false } : t));
      setActiveTab(dest);
      setFileContents(prev => { const next = { ...prev, [dest]: content }; delete next[path]; return next; });
    } else {
      await writeFile(path, content);
      if (contentOverride !== undefined) {
        setFileContents(prev => ({ ...prev, [path]: content }));
      }
      setTabs(prev => prev.map(t => t.path === path ? { ...t, isDirty: false } : t));
    }
  }

  async function handleSaveAs(contentOverride?: string) {
    const path = activeTabRef.current;
    if (!path) return;
    const content = contentOverride ?? fileContentsRef.current[path];
    if (content === undefined) return;
    const tab  = tabs.find(t => t.path === path);
    const dest = await save({ defaultPath: tab?.name });
    if (!dest) return;
    const newName = dest.split(/[\\/]/).filter(Boolean).pop() ?? dest;
    await writeFile(dest, content);
    setTabs(prev => prev.map(t => t.path === path ? { ...t, path: dest, name: newName, isDirty: false, isUntitled: false } : t));
    setActiveTab(dest);
    setFileContents(prev => { const next = { ...prev, [dest]: content }; if (dest !== path) delete next[path]; return next; });
  }

  async function handleSaveAll(formattedContents: Record<string, string> = {}) {
    const dirty = tabs.filter(t => t.isDirty && !t.isUntitled);
    for (const tab of dirty) await handleSave(tab.path, formattedContents[tab.path]);
  }

  return {
    tabs, setTabs,
    activeTab, setActiveTab,
    fileContents, setFileContents,
    fileErrors,
    jumpRequest,
    fileTreeVersion,
    activeTabRef,
    fileContentsRef,
    openTab, openTabAtLine, closeTab,
    handlePathRenamed,
    handleNewFile, handleEditorChange, openAiDiffTab, openPreviewTab,
    openGitCommitTab, openGitDiffTab,
    handleSave, handleSaveAs, handleSaveAll,
  };
}
