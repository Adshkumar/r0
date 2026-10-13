import { describe, expect, it } from "vitest";
import { builtinThemes } from "../ThemeContext";

describe("built-in themes", () => {
  it("registers the five built-in themes in selector order", () => {
    expect(builtinThemes.map(theme => theme.name)).toEqual([
      "Dark Modern",
      "Dracula",
      "One Dark Pro",
      "GitHub Dark",
      "Light Modern",
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
    expect(new Set(builtinThemes.map(theme => theme.colors["syntax.bracket"])).size).toBe(5);
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
