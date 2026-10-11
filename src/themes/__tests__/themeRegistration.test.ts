import { describe, expect, it } from "vitest";
import { builtinThemes } from "../ThemeContext";

describe("built-in themes", () => {
  it("registers Light, Dark, Dracula, and Cobalt2 in selector order", () => {
    expect(builtinThemes.map(theme => theme.name)).toEqual([
      "r0 Light",
      "r0 Dark",
      "r0 Dracula",
      "Cobalt2",
    ]);
  });

  it("provides the same semantic tokens for each theme", () => {
    const tokens = Object.keys(builtinThemes[0].colors).sort();

    for (const theme of builtinThemes) {
      expect(Object.keys(theme.colors).sort()).toEqual(tokens);
    }
  });

  it("uses the Dracula palette while retaining dark-theme behavior", () => {
    const dracula = builtinThemes.find(theme => theme.name === "r0 Dracula");

    expect(dracula).toBeDefined();
    expect(dracula?.type).toBe("dark");
    expect(dracula?.colors["bg.editor"]).toBe("#282A36");
    expect(dracula?.colors["bg.sidebar"]).toBe("#21222C");
    expect(dracula?.colors["accent.purple"]).toBe("#BD93F9");
    expect(dracula?.colors["syntax.keyword"]).toBe("#FF79C6");
    expect(dracula?.colors["terminal.green"]).toBe("#50FA7B");
  });

  it("uses the Cobalt2 palette while retaining dark-theme behavior", () => {
    const cobalt2 = builtinThemes.find(theme => theme.name === "Cobalt2");

    expect(cobalt2).toBeDefined();
    expect(cobalt2?.type).toBe("dark");
    expect(cobalt2?.colors["bg.editor"]).toBe("#193549");
    expect(cobalt2?.colors["bg.sidebar"]).toBe("#15232D");
    expect(cobalt2?.colors["bg.selection"]).toBe("#0050A4");
    expect(cobalt2?.colors["editor.cursor"]).toBe("#FFC600");
    expect(cobalt2?.colors["syntax.keyword"]).toBe("#FF628C");
    expect(cobalt2?.colors["terminal.green"]).toBe("#3AD900");
  });
});
