import type { r0Theme } from "./types";

// "bg.editor" → "--r0-bg-editor"
function tokenToCssVar(token: string): string {
  return "--r0-" + token.replace(/\./g, "-");
}

let appliedThemeTokens = new Set<string>();

export function applyTheme(theme: r0Theme): void {
  const root = document.documentElement;
  for (const token of appliedThemeTokens) {
    root.style.removeProperty(tokenToCssVar(token));
  }
  appliedThemeTokens = new Set(Object.keys(theme.colors));
  for (const [token, value] of Object.entries(theme.colors)) {
    root.style.setProperty(tokenToCssVar(token), value);
  }
  root.setAttribute("data-theme", theme.type);
  root.setAttribute("data-contrast", theme.contrast ?? "normal");
  root.setAttribute("data-theme-name", theme.name.toLowerCase().replace(/^r0\s+/, ""));
  root.style.colorScheme = theme.type;
}
