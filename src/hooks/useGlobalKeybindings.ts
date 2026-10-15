import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCommandKeyMap, matchesEvent } from "../lib/keybindings";

export interface GlobalHandlers {
  // Always provided
  saveActive:     () => void;
  toggleTerminal: () => void;
  togglePalette:  () => void;
  openCommandPalette?: () => void;
  quickOpen?: () => void;
  selectSidebarPanel?: (panel: "explorer" | "search" | "sourcetree" | "extensions") => void;
  toggleSettings: () => void;
  // Optional — wired when available in App.tsx
  newFile?:          () => void;
  openFile?:         () => void;
  closeTab?:         () => void;
  toggleSidebar?:    () => void;
  zoomIn?:           () => void;
  zoomOut?:          () => void;
  zoomReset?:        () => void;
  startDebug?:       () => void;
  stopDebug?:        () => void;
  stepOver?:         () => void;
  stepInto?:         () => void;
  stepOut?:          () => void;
  toggleBreakpoint?: () => void;
  formatDocument?:   () => void;
  reloadWindow?:     () => void;
}

export function useGlobalKeybindings(handlers: GlobalHandlers) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const h = useRef(handlers);
  h.current = handlers;

  const isFullscreenRef = useRef(false);
  const wasMaximizedRef = useRef(false);

  async function toggleFullscreen() {
    const win = getCurrentWindow();
    if (!isFullscreenRef.current) {
      const maximized = await win.isMaximized();
      wasMaximizedRef.current = maximized;
      if (maximized) {
        await win.unmaximize();
        // Win32 processes window state via the message queue — the promise resolves
        // before the OS has finished the restore, so setFullscreen fires into a
        // mid-transition window and silently fails without this delay.
        await new Promise(r => setTimeout(r, 150));
      }
      await win.setFullscreen(true);
      isFullscreenRef.current = true;
      setIsFullscreen(true);
    } else {
      await win.setFullscreen(false);
      if (wasMaximizedRef.current) await win.maximize();
      isFullscreenRef.current = false;
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (
        e.key === "F1" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        (h.current.openCommandPalette ?? h.current.togglePalette)();
        return;
      }
      const target = e.target;
      const isTextEntry = target instanceof HTMLElement && (
        target.isContentEditable ||
        target.matches("input, textarea, select") ||
        !!target.closest(".xterm")
      );
      // Read the live keymap on every event so custom bindings apply immediately
      // without a page reload (localStorage is synchronous).
      const km = getCommandKeyMap();

      // Build the handler dispatch table — maps command ID → action fn
      const dispatch: Record<string, (() => void) | undefined> = {
        "r0.save":             () => h.current.saveActive(),
        "r0.toggleTerminal":   () => h.current.toggleTerminal(),
        "r0.togglePalette":    () => (h.current.openCommandPalette ?? h.current.togglePalette)(),
        "r0.quickOpen":        () => h.current.quickOpen?.(),
        "r0.toggleSettings":   () => h.current.toggleSettings(),
        "r0.showExplorer":     () => h.current.selectSidebarPanel?.("explorer"),
        "r0.showSearch":       () => h.current.selectSidebarPanel?.("search"),
        "r0.showSourceControl":() => h.current.selectSidebarPanel?.("sourcetree"),
        "r0.showExtensions":   () => h.current.selectSidebarPanel?.("extensions"),
        "r0.toggleFullscreen": () => toggleFullscreen(),
        "r0.reloadWindow":    () => h.current.reloadWindow?.(),
        "r0.newFile":          () => h.current.newFile?.(),
        "r0.openFile":         () => h.current.openFile?.(),
        "r0.closeTab":         () => h.current.closeTab?.(),
        "r0.toggleSidebar":    () => h.current.toggleSidebar?.(),
        "r0.zoomIn":           () => h.current.zoomIn?.(),
        "r0.zoomOut":          () => h.current.zoomOut?.(),
        "r0.zoomReset":        () => h.current.zoomReset?.(),
        "r0.startDebug":       () => h.current.startDebug?.(),
        "r0.stopDebug":        () => h.current.stopDebug?.(),
        "r0.stepOver":         () => h.current.stepOver?.(),
        "r0.stepInto":         () => h.current.stepInto?.(),
        "r0.stepOut":          () => h.current.stepOut?.(),
        "r0.toggleBreakpoint": () => h.current.toggleBreakpoint?.(),
        "r0.formatDocument":   () => h.current.formatDocument?.(),
      };

      for (const [cmdId, keyStr] of Object.entries(km)) {
        if (!keyStr) continue;
        const handler = dispatch[cmdId];
        if (!handler) continue;
        if (matchesEvent(e, keyStr)) {
          if (isTextEntry && cmdId !== "r0.togglePalette") continue;
          if (
            cmdId === "r0.formatDocument" &&
            !(e.target instanceof HTMLElement && e.target.closest(".cm-editor"))
          ) continue;
          e.preventDefault();
          handler();
          return;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);

    let unlistenResized: (() => void) | undefined;
    let unlistenScale:   (() => void) | undefined;

    getCurrentWindow().onResized(() => {
      window.dispatchEvent(new Event("resize"));
    }).then(fn => { unlistenResized = fn; });

    getCurrentWindow().onScaleChanged(({ payload: scaleFactor }) => {
      document.documentElement.style.setProperty("--scale-factor", String(scaleFactor));
      window.dispatchEvent(new Event("resize"));
    }).then(fn => { unlistenScale = fn; });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      unlistenResized?.();
      unlistenScale?.();
    };
  }, []);

  return { isFullscreen, toggleFullscreen };
}
