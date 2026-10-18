import { useEffect, useMemo, useRef } from "react";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { useVimStore } from "@/features/vim/stores/vim.store";
import { type CodeMirrorHost, useCodeMirrorExtension } from "../host";
import { r0Vim, getVimMode, registerR0VimCommands, setVimHistoryHandler } from "../vim";
import "./codemirror-vim.css";

/** Vim keybindings for editable editors while the vim mode setting is on. */
export function CodeMirrorVim({ host }: { host: CodeMirrorHost }) {
  const vimModeSetting = useSettingsStore((state) => state.settings.vimMode);
  const enabled = vimModeSetting && !host.isReadOnly;
  const { view, isActiveSurface, applyHistory } = host;
  const isActiveSurfaceRef = useRef(isActiveSurface);
  isActiveSurfaceRef.current = isActiveSurface;

  const extension = useMemo(
    () =>
      enabled
        ? r0Vim((mode) => {
            if (isActiveSurfaceRef.current) useVimStore.getState().actions.setMode(mode);
          })
        : null,
    [enabled],
  );

  useEffect(() => {
    if (enabled) void registerR0VimCommands();
  }, [enabled]);

  useCodeMirrorExtension(view, extension);

  useEffect(() => {
    if (!enabled) return;
    setVimHistoryHandler(view, applyHistory);
    return () => setVimHistoryHandler(view, null);
  }, [applyHistory, enabled, view]);

  useEffect(() => {
    if (!enabled || !isActiveSurface) return;
    useVimStore.getState().actions.setMode(getVimMode(view) ?? "normal");
    return () => useVimStore.getState().actions.setMode("normal");
  }, [enabled, isActiveSurface, view]);

  return null;
}
