import r0Themes from "./builtin/r0.json";
import { toThemeDefinition } from "./theme-file";
import type { ThemeFile } from "./theme-schema";
import type { ThemeDefinition } from "./theme.types";

export type R0DefaultThemeType = "dark" | "light";

interface R0DefaultTheme {
  id: string;
  type: R0DefaultThemeType;
  colors: Record<string, string>;
  syntax: Record<string, string>;
  definition: ThemeDefinition;
}

const r0ThemeFile = r0Themes as ThemeFile;

function prefixRecord(prefix: string, value: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[`${prefix}${key}`] = entry;
  }
  return result;
}

function toStringRecord(value: object): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      result[key] = entry;
    }
  }
  return result;
}

function buildDefaultTheme(type: R0DefaultThemeType): R0DefaultTheme {
  const theme = r0ThemeFile.themes.find((entry) => entry.appearance === type);
  if (!theme) {
    throw new Error(`Missing R0 ${type} default theme`);
  }

  return {
    id: theme.id,
    type,
    colors: toStringRecord(theme.colors),
    syntax: toStringRecord(theme.syntax ?? {}),
    definition: toThemeDefinition(theme),
  };
}

const R0_DEFAULT_THEMES: Record<R0DefaultThemeType, R0DefaultTheme> = {
  dark: buildDefaultTheme("dark"),
  light: buildDefaultTheme("light"),
};

export function getR0DefaultTheme(type: R0DefaultThemeType): R0DefaultTheme {
  return R0_DEFAULT_THEMES[type];
}

export function getR0DefaultCssVariables(type: R0DefaultThemeType): Record<string, string> {
  return prefixRecord("--", getR0DefaultTheme(type).colors);
}

export function getR0DefaultSyntaxTokens(type: R0DefaultThemeType): Record<string, string> {
  return prefixRecord("--syntax-", getR0DefaultTheme(type).syntax);
}

export function getR0DefaultColor(type: R0DefaultThemeType, name: string): string | undefined {
  return getR0DefaultTheme(type).colors[name];
}

export function getRequiredR0DefaultColor(type: R0DefaultThemeType, name: string): string {
  const color = getR0DefaultColor(type, name);
  if (!color) {
    throw new Error(`Missing R0 ${type} default color: ${name}`);
  }

  return color;
}

export function getR0DefaultSyntaxColor(
  type: R0DefaultThemeType,
  name: string,
): string | undefined {
  return getR0DefaultTheme(type).syntax[name];
}

export function getRequiredR0DefaultSyntaxColor(type: R0DefaultThemeType, name: string): string {
  const color = getR0DefaultSyntaxColor(type, name);
  if (!color) {
    throw new Error(`Missing R0 ${type} default syntax color: ${name}`);
  }

  return color;
}
