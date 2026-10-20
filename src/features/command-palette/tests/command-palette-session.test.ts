// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useUIState } from "@/features/layout/stores/ui-state.store";
import {
  attachCommandPaletteSession,
  pushCommandPaletteView,
} from "../services/command-palette-session";

describe("command palette session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIState.setState({
      isCommandPaletteVisible: false,
      commandPaletteInitialView: "root",
    });
  });

  it("opens the palette directly when it is closed even if a session is attached", () => {
    const pushView = vi.fn();
    const detach = attachCommandPaletteSession({ pushView });
    const openCommandPaletteView = vi.spyOn(useUIState.getState(), "openCommandPaletteView");

    pushCommandPaletteView("color-theme");

    expect(pushView).not.toHaveBeenCalled();
    expect(openCommandPaletteView).toHaveBeenCalledWith("color-theme");
    expect(useUIState.getState().commandPaletteInitialView).toBe("color-theme");

    detach();
  });

  it("pushes a nested view when the palette is already open", () => {
    const pushView = vi.fn();
    const detach = attachCommandPaletteSession({ pushView });
    useUIState.setState({ isCommandPaletteVisible: true });
    const openCommandPaletteView = vi.spyOn(useUIState.getState(), "openCommandPaletteView");

    pushCommandPaletteView("icon-theme");

    expect(pushView).toHaveBeenCalledWith("icon-theme");
    expect(openCommandPaletteView).not.toHaveBeenCalled();

    detach();
  });
});
