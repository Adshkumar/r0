import type React from "react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { BOTTOM_PANE_ID } from "@/features/panes/constants/pane";
import { usePaneStore } from "@/features/panes/stores/pane.store";
import { activateBufferInPaneAndSync } from "@/features/panes/services/pane-activation";
import { getAllPaneGroups } from "@/features/panes/services/pane-tree";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import {
  clearInternalTabDragData,
  getInternalTabDragData,
  getInternalTabDragHover,
} from "@/features/tabs/services/internal-tab-drag";
import TerminalContainer from "@/features/terminal/components/terminal-container";
import { cn } from "@/utils/cn";
import { useProjectStore } from "@/features/workspace/stores/project.store";
import { useUIState } from "@/features/layout/stores/ui-state.store";
import { WorkbenchFullscreenSurface } from "@/ui/workbench-fullscreen-surface";
import { emitAppEvent, onAppEvent } from "@/utils/app-events";
import { BottomBufferPane } from "./bottom-buffer-pane";

const DebuggerView = lazy(() => import("@/features/debugger/components/debugger-view"));

const BOTTOM_PANE_HEIGHT_KEY = "r0.bottom-pane-height.v1";
const DEFAULT_BOTTOM_PANE_HEIGHT = 320;
const MIN_BOTTOM_PANE_HEIGHT = 200;

function getInitialBottomPaneHeight(): number {
  try {
    const storedHeight = Number(window.localStorage.getItem(BOTTOM_PANE_HEIGHT_KEY));
    if (!Number.isFinite(storedHeight) || storedHeight <= 0) return DEFAULT_BOTTOM_PANE_HEIGHT;
    return Math.min(Math.max(storedHeight, MIN_BOTTOM_PANE_HEIGHT), window.innerHeight * 0.8);
  } catch (error) {
    console.warn("Unable to read bottom pane height.", error);
    return DEFAULT_BOTTOM_PANE_HEIGHT;
  }
}

const BottomPane = () => {
  const isBottomPaneVisible = useUIState((state) => state.isBottomPaneVisible);
  const bottomPaneActiveTab = useUIState((state) => state.bottomPaneActiveTab);
  const rootFolderPath = useProjectStore((state) => state.rootFolderPath);
  const terminalEnabled = useSettingsStore((state) => state.settings.coreFeatures.terminal);
  const debuggerEnabled = useSettingsStore((state) => state.settings.coreFeatures.debugger);
  const bottomRoot = usePaneStore.use.bottomRoot();
  const bottomPaneBufferIds = useMemo(() => {
    const bufferIds: string[] = [];
    for (const pane of getAllPaneGroups(bottomRoot)) {
      for (const bufferId of pane.bufferIds) {
        bufferIds.push(bufferId);
      }
    }
    return bufferIds;
  }, [bottomRoot]);
  const { moveBufferToPane } = usePaneStore.use.actions();
  const { openTerminalBuffer } = useBufferStore.use.actions();
  const [height, setHeight] = useState(getInitialBottomPaneHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isInternalHoverTarget, setIsInternalHoverTarget] = useState(false);
  const paneFrameRef = useRef<HTMLDivElement>(null);

  const closeBottomPane = useCallback(() => {
    setIsFullScreen(false);
    useUIState.getState().setIsBottomPaneVisible(false);
  }, []);
  useEffect(() => {
    const syncHover = () => {
      setIsInternalHoverTarget(getInternalTabDragHover().paneId === BOTTOM_PANE_ID);
    };

    return onAppEvent("tabs:internal-drag-hover", syncHover);
  }, []);

  useEffect(() => {
    if (
      isBottomPaneVisible &&
      (bottomPaneActiveTab === "diagnostics" || bottomPaneActiveTab === "references")
    ) {
      useUIState.getState().setIsBottomPaneVisible(false);
    }
  }, [bottomPaneActiveTab, isBottomPaneVisible]);

  useEffect(() => {
    if (isBottomPaneVisible && bottomPaneActiveTab === "debugger" && !debuggerEnabled) {
      useUIState.getState().setIsBottomPaneVisible(false);
    }
  }, [bottomPaneActiveTab, isBottomPaneVisible, debuggerEnabled]);

  useEffect(() => {
    if (
      isBottomPaneVisible &&
      bottomPaneActiveTab === "buffers" &&
      bottomPaneBufferIds.length === 0
    ) {
      useUIState.getState().setIsBottomPaneVisible(false);
    }
  }, [bottomPaneActiveTab, bottomPaneBufferIds.length, isBottomPaneVisible]);

  // Resize logic
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startY = e.clientY;
      const startHeight = height;
      const frameEl = paneFrameRef.current;
      let currentHeight = startHeight;
      let rafId: number | null = null;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaY = startY - e.clientY;
        currentHeight = Math.min(Math.max(startHeight + deltaY, 200), window.innerHeight * 0.8);

        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          if (frameEl) {
            frameEl.style.setProperty(
              "--bottom-pane-height",
              `calc(${currentHeight}px + var(--r0-workbench-gap))`,
            );
          }
        });
      };

      const handleMouseUp = () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (frameEl) {
          frameEl.style.setProperty(
            "--bottom-pane-height",
            `calc(${currentHeight}px + var(--r0-workbench-gap))`,
          );
        }
        setHeight(currentHeight);
        try {
          window.localStorage.setItem(BOTTOM_PANE_HEIGHT_KEY, String(Math.round(currentHeight)));
        } catch (error) {
          console.warn("Unable to save bottom pane height.", error);
        }
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    },
    [height],
  );

  const adjustHeight = useCallback((nextHeight: number) => {
    const clampedHeight = Math.min(
      Math.max(nextHeight, MIN_BOTTOM_PANE_HEIGHT),
      window.innerHeight * 0.8,
    );
    setHeight(clampedHeight);
    paneFrameRef.current?.style.setProperty(
      "--bottom-pane-height",
      `calc(${clampedHeight}px + var(--r0-workbench-gap))`,
    );
    try {
      window.localStorage.setItem(BOTTOM_PANE_HEIGHT_KEY, String(Math.round(clampedHeight)));
    } catch (error) {
      console.warn("Unable to save bottom pane height.", error);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("application/tab-data") && !getInternalTabDragData()) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const tabDataString = e.dataTransfer.getData("application/tab-data");
      const fallbackTabData = getInternalTabDragData();
      if (!tabDataString && !fallbackTabData) return;

      e.preventDefault();

      try {
        const tabData = (tabDataString ? JSON.parse(tabDataString) : fallbackTabData) as
          | {
              bufferId?: string;
              paneId?: string;
              source?: "pane" | "terminal-panel";
              terminalId?: string;
              name?: string;
              shell?: string;
              initialCommand?: string;
              currentDirectory?: string;
              remoteConnectionId?: string;
            }
          | undefined;

        if (!tabData) return;

        if (tabData.source === "terminal-panel" && tabData.terminalId) {
          openTerminalBuffer(
            {
              sessionId: tabData.terminalId,
              name: tabData.name,
              shell: tabData.shell,
              command: tabData.initialCommand,
              workingDirectory: tabData.currentDirectory,
              remoteConnectionId: tabData.remoteConnectionId,
            },
            { paneId: BOTTOM_PANE_ID },
          );
          emitAppEvent("terminal:detach-to-buffer", { terminalId: tabData.terminalId });
        } else if (tabData.bufferId && tabData.paneId && tabData.paneId !== BOTTOM_PANE_ID) {
          moveBufferToPane(tabData.bufferId, tabData.paneId, BOTTOM_PANE_ID);
          activateBufferInPaneAndSync(BOTTOM_PANE_ID, tabData.bufferId);
        } else {
          return;
        }

        useUIState.getState().setBottomPaneActiveTab("buffers");
        useUIState.getState().setIsBottomPaneVisible(true);
      } catch {
        // Ignore malformed drag payloads.
      } finally {
        clearInternalTabDragData();
      }
    },
    [moveBufferToPane, openTerminalBuffer],
  );

  const resizeGutter = !isFullScreen ? (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        "group relative z-20 flex h-workbench w-full shrink-0 cursor-ns-resize",
        "transition-colors duration-fast ease-smooth hover:bg-primary-soft",
        "bg-background",
        isResizing && "bg-primary-soft",
      )}
      role="separator"
      tabIndex={0}
      aria-orientation="horizontal"
      aria-label="Resize bottom pane"
      aria-valuenow={Math.round(height)}
      aria-valuemin={MIN_BOTTOM_PANE_HEIGHT}
      aria-valuemax={Math.round(window.innerHeight * 0.8)}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          const step = event.shiftKey ? 40 : 16;
          adjustHeight(height + (event.key === "ArrowUp" ? step : -step));
        } else if (event.key === "Home") {
          event.preventDefault();
          adjustHeight(MIN_BOTTOM_PANE_HEIGHT);
        } else if (event.key === "End") {
          event.preventDefault();
          adjustHeight(window.innerHeight * 0.8);
        }
      }}
    >
      <div
        className={cn(
          "absolute inset-x-0 -top-px h-px bg-transparent transition-colors duration-fast ease-smooth group-hover:bg-primary",
          isResizing && "bg-primary",
        )}
      />
    </div>
  ) : null;

  const paneContent = (
    <div
      data-bottom-pane-drop-target
      className={cn(
        "r0-glass-island group/chrome-host relative flex min-h-0 flex-col overflow-hidden bg-background",
        isInternalHoverTarget && "ring-2 ring-primary ring-inset",
        isFullScreen && "size-full ring-0",
        !isFullScreen && "flex-1",
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="h-full overflow-hidden">
        {/* Terminal Container - Always mounted to preserve terminal sessions */}
        {terminalEnabled && (
          <TerminalContainer
            currentDirectory={rootFolderPath}
            className={cn("h-full", bottomPaneActiveTab === "terminal" ? "block" : "hidden")}
            onFullScreen={() => setIsFullScreen(!isFullScreen)}
            isFullScreen={isFullScreen}
          />
        )}

        {debuggerEnabled && bottomPaneActiveTab === "debugger" && (
          <div className="h-full">
            <Suspense fallback={null}>
              <DebuggerView
                isFullScreen={isFullScreen}
                onFullScreen={() => setIsFullScreen(!isFullScreen)}
                onClose={closeBottomPane}
              />
            </Suspense>
          </div>
        )}

        {bottomPaneActiveTab === "buffers" && (
          <div className="h-full">
            {bottomPaneBufferIds.length > 0 ? <BottomBufferPane /> : null}
          </div>
        )}
      </div>
    </div>
  );

  const pane = isFullScreen ? (
    <WorkbenchFullscreenSurface>{paneContent}</WorkbenchFullscreenSurface>
  ) : (
    paneContent
  );

  if (isFullScreen) {
    return isBottomPaneVisible ? pane : null;
  }

  return (
    <div
      ref={paneFrameRef}
      className={cn(
        // The height lives in a variable and a class, never an inline style, so the
        // `starting:` (@starting-style) rule can win on the first visible frame and
        // the pane animates open from 0.
        "flex h-(--bottom-pane-height) shrink-0 flex-col",
        !isResizing &&
          "transition-[height] duration-fast ease-smooth starting:h-0 motion-reduce:transition-none",
        !isBottomPaneVisible && "hidden",
      )}
      style={{
        ["--bottom-pane-height" as string]: `calc(${height}px + var(--r0-workbench-gap))`,
      }}
    >
      {resizeGutter}
      {pane}
      {isResizing ? <div className="fixed inset-0 z-40 cursor-ns-resize" /> : null}
    </div>
  );
};

export default BottomPane;
