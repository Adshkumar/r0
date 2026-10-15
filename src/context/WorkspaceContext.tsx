/* eslint-disable react-refresh/only-export-components -- exports the useWorkspace hook alongside the provider component */
import { createContext, useCallback, useContext, useState } from "react";

interface WorkspaceContextType {
  folderPath: string | null;
  setFolderPath: (path: string | null) => void;
  workspaceRoots: string[];
  setWorkspaceRoots: (paths: string[]) => void;
  addWorkspaceRoot: (path: string) => boolean;
  removeWorkspaceRoot: (path: string) => void;
}

const ROOTS_KEY = "r0-workspace-roots";

function normalizePath(path: string): string {
  const normalized = path.replace(/\//g, "\\");
  const trimmed = normalized.replace(/\\+$/, "") || (normalized.startsWith("\\") ? "\\" : "");
  return /^[a-z]:/i.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}

function uniqueRoots(paths: string[]): string[] {
  const seen = new Set<string>();
  return paths.filter(path => {
    const normalized = normalizePath(path);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function loadRoots(): string[] {
  try {
    const saved = localStorage.getItem(ROOTS_KEY);
    if (saved) {
      const roots: unknown = JSON.parse(saved);
      if (Array.isArray(roots) && roots.every(path => typeof path === "string")) {
        return uniqueRoots(roots);
      }
    }
  } catch {
    localStorage.removeItem(ROOTS_KEY);
  }
  const legacyRoot = localStorage.getItem("r0-workspace-folder");
  return legacyRoot ? [legacyRoot] : [];
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  folderPath: null,
  setFolderPath: () => {},
  workspaceRoots: [],
  setWorkspaceRoots: () => {},
  addWorkspaceRoot: () => false,
  removeWorkspaceRoot: () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaceRoots, setWorkspaceRootsState] = useState<string[]>(loadRoots);

  const updateRoots = useCallback((paths: string[]) => {
    const roots = uniqueRoots(paths);
    setWorkspaceRootsState(roots);
    if (roots.length > 0) {
      localStorage.setItem(ROOTS_KEY, JSON.stringify(roots));
      localStorage.setItem("r0-workspace-folder", roots[0]);
    } else {
      localStorage.removeItem(ROOTS_KEY);
      localStorage.removeItem("r0-workspace-folder");
    }
  }, []);
  const setFolderPath = useCallback((path: string | null) => updateRoots(path ? [path] : []), [updateRoots]);
  const addWorkspaceRoot = useCallback((path: string) => {
    if (workspaceRoots.some(root => normalizePath(root) === normalizePath(path))) return false;
    updateRoots([...workspaceRoots, path]);
    return true;
  }, [workspaceRoots, updateRoots]);
  const removeWorkspaceRoot = useCallback((path: string) => {
    updateRoots(workspaceRoots.filter(root => normalizePath(root) !== normalizePath(path)));
  }, [workspaceRoots, updateRoots]);

  return (
    <WorkspaceContext.Provider value={{
      folderPath: workspaceRoots[0] ?? null,
      setFolderPath,
      workspaceRoots,
      setWorkspaceRoots: updateRoots,
      addWorkspaceRoot,
      removeWorkspaceRoot,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
