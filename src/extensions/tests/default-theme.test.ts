import { describe, expect, it } from "vite-plus/test";
import r0Themes from "@/extensions/themes/builtin/r0.json";
import {
  getR0DefaultColor,
  getR0DefaultCssVariables,
  getR0DefaultSyntaxColor,
  getR0DefaultSyntaxTokens,
  getR0DefaultTheme,
  getRequiredR0DefaultColor,
  getRequiredR0DefaultSyntaxColor,
} from "@/extensions/themes/default-theme";
import type { ThemeFile } from "@/extensions/themes/theme-schema";

const themeFile = r0Themes as ThemeFile;

describe("r0 default themes", () => {
  it("uses bundled r0.json as the canonical default theme source", () => {
    const bundledDark = themeFile.themes.find((theme) => theme.id === "r0-dark");
    const bundledLight = themeFile.themes.find((theme) => theme.id === "r0-light");

    expect(getR0DefaultTheme("dark").colors).toEqual(bundledDark?.colors);
    expect(getR0DefaultTheme("light").syntax).toEqual(bundledLight?.syntax);
  });

  it("builds prefixed CSS and syntax variables from the same defaults", () => {
    expect(getR0DefaultCssVariables("dark")["--background"]).toBe(
      getR0DefaultColor("dark", "background"),
    );
    expect(getR0DefaultSyntaxTokens("dark")["--syntax-keyword"]).toBe(
      getR0DefaultSyntaxColor("dark", "keyword"),
    );
  });

  it("requires bundled default color names to exist", () => {
    expect(getRequiredR0DefaultColor("dark", "terminal-bright-blue")).toBe(
      getR0DefaultColor("dark", "terminal-bright-blue"),
    );
    expect(getRequiredR0DefaultSyntaxColor("light", "keyword")).toBe(
      getR0DefaultSyntaxColor("light", "keyword"),
    );
    expect(() => getRequiredR0DefaultColor("dark", "missing-color")).toThrow(
      "Missing r0 dark default color: missing-color",
    );
  });

  it("exposes canonical raw theme variables without runtime aliases", () => {
    const definition = getR0DefaultTheme("light").definition;

    expect(definition.cssVariables["--background"]).toBe(getR0DefaultColor("light", "background"));
    expect(definition.cssVariables["--color-background"]).toBeUndefined();
    expect(definition.syntaxTokens?.["--syntax-keyword"]).toBe(
      getR0DefaultSyntaxColor("light", "keyword"),
    );
    expect(definition.syntaxTokens?.["--color-syntax-keyword"]).toBeUndefined();
  });
});
