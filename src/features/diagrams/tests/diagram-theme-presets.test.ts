// @vitest-environment jsdom

import { describe, expect, it } from "vite-plus/test";
import { createMermaidTheme } from "../services/diagram-theme";
import {
  isMermaidThemePresetId,
  MERMAID_THEME_PRESETS,
  resolveMermaidThemePreset,
} from "../services/diagram-theme-presets";

describe("Mermaid theme presets", () => {
  it("offers Mermaid Chart, named styles, and Mermaid's built-in themes", () => {
    expect(MERMAID_THEME_PRESETS.map(({ label }) => label)).toEqual([
      "Mermaid Chart",
      "Neo",
      "Neo Dark",
      "Default",
      "Forest",
      "Base",
      "Dark",
      "Neutral",
      "Redux Dark",
      "Redux Color",
      "Redux Dark Color",
    ]);
  });

  it("uses active r0 theme tokens for Mermaid Chart and native Mermaid themes for built-ins", () => {
    const activeTheme = createMermaidTheme({
      "--background": "#101216",
      "--foreground": "#f4f6fa",
      "--primary": "#ff7423",
    });

    expect(resolveMermaidThemePreset("mermaid-chart", activeTheme)).toMatchObject({
      mermaidTheme: "base",
      colors: activeTheme,
      backgroundColor: "#101216",
    });
    expect(resolveMermaidThemePreset("forest", activeTheme)).toEqual({
      mermaidTheme: "forest",
      colors: undefined,
      backgroundColor: "#ffffff",
    });
    expect(resolveMermaidThemePreset("dark", activeTheme).backgroundColor).toBe("#333333");
  });

  it("accepts only preset IDs exposed by the selector", () => {
    expect(isMermaidThemePresetId("redux-dark-color")).toBe(true);
    expect(isMermaidThemePresetId("not-a-theme")).toBe(false);
  });
});
