import { describe, expect, it } from "vitest";
import { builtinThemes, normalizeTheme } from "../ThemeContext";

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)?.map((channel) => parseInt(channel, 16) / 255) ?? [];
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrastRatio(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
}

describe("built-in themes", () => {
  it("registers built-in themes in selector order", () => {
    expect(builtinThemes.map(theme => theme.name)).toEqual([
      "Dark Modern",
      "Dark+",
      "Dracula",
      "One Dark Pro",
      "GitHub Dark",
      "High Contrast Dark",
      "Light Modern",
      "Light+",
      "High Contrast Light",
    ]);
  });

  it("provides the same semantic tokens for each theme", () => {
    const tokens = Object.keys(builtinThemes[0].colors).sort();

    for (const theme of builtinThemes) {
      expect(Object.keys(theme.colors).sort()).toEqual(tokens);
    }
  });

  it("defines editor token colors and brackets for every theme", () => {
    for (const theme of builtinThemes) {
      for (const token of [
        "syntax.parameter",
        "syntax.property",
        "syntax.module",
        "syntax.tag",
        "syntax.punctuation",
        "syntax.bracket",
      ]) {
        expect(theme.colors[token], `${theme.name} is missing ${token}`).toBeTruthy();
      }
    }
    expect(new Set(builtinThemes.map(theme => theme.colors["syntax.bracket"])).size).toBe(9);
  });

  it("keeps code comments readable against every theme's editor background", () => {
    for (const theme of builtinThemes) {
      expect(
        contrastRatio(theme.colors["syntax.comment"], theme.colors["bg.editor"]),
        `${theme.name} comment contrast`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps syntax token colors distinct from the editor background", () => {
    const syntaxTokens = [
      "syntax.keyword",
      "syntax.string",
      "syntax.function",
      "syntax.variable",
      "syntax.constant",
      "syntax.type",
      "syntax.parameter",
      "syntax.property",
      "syntax.module",
      "syntax.tag",
      "syntax.operator",
      "syntax.punctuation",
      "syntax.bracket",
    ];

    for (const theme of builtinThemes) {
      for (const token of syntaxTokens) {
        expect(
          contrastRatio(theme.colors[token] ?? "", theme.colors["bg.editor"]),
          `${theme.name} ${token} contrast`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("defines readable, restrained diff and terminal colors for every theme", () => {
    const tokens = [
      "diff.added.background",
      "diff.added.foreground",
      "diff.added.border",
      "diff.added.inline",
      "diff.removed.background",
      "diff.removed.foreground",
      "diff.removed.border",
      "diff.removed.inline",
      "diff.modified.background",
      "diff.modified.foreground",
      "diff.modified.border",
      "diff.modified.inline",
      "terminal.background",
      "terminal.cursor",
      "scrollbar.thumb",
      "scrollbar.thumb-hover",
      "semantic.error-foreground",
      "semantic.success-foreground",
      "diff.modified.foreground",
    ];

    for (const theme of builtinThemes) {
      for (const token of tokens) {
        expect(theme.colors[token], `${theme.name} is missing ${token}`).toMatch(/^#[\da-f]{6}$/i);
      }

      for (const action of ["added", "removed", "modified"]) {
        expect(
          contrastRatio(
            theme.colors[`diff.${action}.foreground`] ?? "",
            theme.colors[`diff.${action}.background`] ?? "",
          ),
          `${theme.name} ${action} diff text contrast`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(
            theme.colors[`diff.${action}.background`] ?? "",
            theme.colors["bg.editor"],
          ),
          `${theme.name} ${action} diff background should remain subtle`,
        ).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it("provides distinct high-contrast dark and light variants", () => {
    const highContrastDark = builtinThemes.find(theme => theme.name === "High Contrast Dark");
    const highContrastLight = builtinThemes.find(theme => theme.name === "High Contrast Light");

    expect(highContrastDark?.contrast).toBe("high");
    expect(highContrastLight?.contrast).toBe("high");
    expect(highContrastDark?.type).toBe("dark");
    expect(highContrastLight?.type).toBe("light");
    expect(highContrastDark?.colors["border.default"]).not.toBe(
      builtinThemes.find(theme => theme.name === "Dark Modern")?.colors["border.default"],
    );
    expect(highContrastLight?.colors["border.default"]).not.toBe(
      builtinThemes.find(theme => theme.name === "Light Modern")?.colors["border.default"],
    );
  });

  it("registers coordinated Dark+ and Light+ variants without removing existing themes", () => {
    const darkPlus = builtinThemes.find(theme => theme.name === "Dark+");
    const lightPlus = builtinThemes.find(theme => theme.name === "Light+");

    expect(darkPlus?.type).toBe("dark");
    expect(lightPlus?.type).toBe("light");
    expect(darkPlus?.colors["bg.editor"]).not.toBe(
      builtinThemes.find(theme => theme.name === "One Dark Pro")?.colors["bg.editor"],
    );
    expect(lightPlus?.colors["syntax.keyword"]).toBe("#8a2857");
  });

  it("fills missing custom-theme tokens from the matching light or dark base", () => {
    const partial = normalizeTheme({
      name: "Open VSX: test.partial / Partial",
      type: "light",
      colors: { "bg.editor": "#ffffff" },
    });

    expect(partial.colors["bg.editor"]).toBe("#ffffff");
    expect(partial.colors["diff.added.background"]).toBe(
      builtinThemes.find((theme) => theme.name === "Light Modern")?.colors["diff.added.background"],
    );
    expect(partial.colors["terminal.background"]).toBe("#fafafa");
  });

  it("uses the Dracula palette while retaining dark-theme behavior", () => {
    const dracula = builtinThemes.find(theme => theme.name === "Dracula");

    expect(dracula).toBeDefined();
    expect(dracula?.type).toBe("dark");
    expect(dracula?.colors["bg.editor"]).toBe("#282A36");
    expect(dracula?.colors["bg.sidebar"]).toBe("#21222C");
    expect(dracula?.colors["accent.purple"]).toBe("#BD93F9");
    expect(dracula?.colors["syntax.keyword"]).toBe("#FF79C6");
    expect(dracula?.colors["terminal.green"]).toBe("#50FA7B");
  });

  it("uses the One Dark Pro palette while retaining dark-theme behavior", () => {
    const oneDark = builtinThemes.find(theme => theme.name === "One Dark Pro");

    expect(oneDark).toBeDefined();
    expect(oneDark?.type).toBe("dark");
    expect(oneDark?.colors["bg.editor"]).toBe("#282c34");
    expect(oneDark?.colors["bg.sidebar"]).toBe("#21252b");
    expect(oneDark?.colors["bg.selection"]).toBe("#3e4451");
    expect(oneDark?.colors["editor.cursor"]).toBe("#528bff");
    expect(oneDark?.colors["syntax.keyword"]).toBe("#c678dd");
    expect(oneDark?.colors["terminal.green"]).toBe("#98c379");
  });

  it("uses a dark GitHub-inspired palette", () => {
    const githubDark = builtinThemes.find(theme => theme.name === "GitHub Dark");

    expect(githubDark?.type).toBe("dark");
    expect(githubDark?.colors["bg.editor"]).toBe("#0d1117");
    expect(githubDark?.colors["bg.selection"]).toBe("#264f78");
    expect(githubDark?.colors["syntax.keyword"]).toBe("#ff7b72");
  });
});
