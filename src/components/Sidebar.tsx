import { useState, useRef, useCallback } from "react";
import ActivityBar from "./ActivityBar";
import FileTree from "./FileTree";
import SearchPanel from "./SearchPanel";
import SourceTreePanel from "./SourceTreePanel";
import DebugPanel from "./DebugPanel";
import ExtensionsPanel from "./extensions/ExtensionsPanel";
import type { StatusFile } from "../lib/git";

const MIN_WIDTH = 180;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 240;

interface Props {
  onFileOpen: (path: string) => void;
  onPreviewOpen: (path: string) => void;
  onPathRenamed: (from: string, to: string) => void;
  selectedFilePath: string | null;
  onFileOpenAtLine: (path: string, line: number, col: number) => void;
  fileTreeKey?: number;
  onOpenCommit: (hash: string) => void;
  onOpenWorkingDiff: (file: StatusFile) => void;
  selectedCommitHash: string | null;
}

function ActivePanel({ id, onFileOpen, onPreviewOpen, onPathRenamed, selectedFilePath, onFileOpenAtLine, fileTreeKey, onOpenCommit, onOpenWorkingDiff, selectedCommitHash }: {
  id: string;
  onFileOpen: (path: string) => void;
  onPreviewOpen: (path: string) => void;
  onPathRenamed: (from: string, to: string) => void;
  selectedFilePath: string | null;
  onFileOpenAtLine: (path: string, line: number, col: number) => void;
  fileTreeKey?: number;
  onOpenCommit: (hash: string) => void;
  onOpenWorkingDiff: (file: StatusFile) => void;
  selectedCommitHash: string | null;
}) {
  switch (id) {
    case "explorer":   return <FileTree onFileOpen={onFileOpen} onPreviewOpen={onPreviewOpen} onPathRenamed={onPathRenamed} selectedFilePath={selectedFilePath} refreshKey={fileTreeKey} />;
    case "search":     return <SearchPanel onFileOpenAtLine={onFileOpenAtLine} />;
    case "sourcetree": return <SourceTreePanel onOpenCommit={onOpenCommit} onOpenWorkingDiff={onOpenWorkingDiff} selectedCommitHash={selectedCommitHash} />;
    case "debug":      return <DebugPanel onFileOpenAtLine={onFileOpenAtLine} />;
    case "extensions": return <ExtensionsPanel />;
    default:           return null;
  }
}

export default function Sidebar({ onFileOpen, onPreviewOpen, onPathRenamed, selectedFilePath, onFileOpenAtLine, fileTreeKey, onOpenCommit, onOpenWorkingDiff, selectedCommitHash }: Props) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [active, setActive] = useState("explorer");
  const isResizing = useRef(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;

    function onMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX)));
    }

    function onMouseUp() {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div
      className="relative flex flex-col shrink-0 border-r"
      style={{
        width,
        backgroundColor: "var(--r0-bg-sidebar)",
        borderColor: "var(--r0-border-default)",
      }}
    >
      <ActivityBar active={active} onSelect={setActive} />
      <ActivePanel
        id={active}
        onFileOpen={onFileOpen}
        onPreviewOpen={onPreviewOpen}
        onPathRenamed={onPathRenamed}
        selectedFilePath={selectedFilePath}
        onFileOpenAtLine={onFileOpenAtLine}
        fileTreeKey={fileTreeKey}
        onOpenCommit={onOpenCommit}
        onOpenWorkingDiff={onOpenWorkingDiff}
        selectedCommitHash={selectedCommitHash}
      />

      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize z-10"
        style={{ backgroundColor: "transparent" }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--r0-border-default)"; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
      />
    </div>
  );
}
