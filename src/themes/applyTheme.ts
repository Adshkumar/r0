import type { r0Theme } from "./types";

// "bg.editor" → "--r0-bg-editor"
function tokenToCssVar(token: string): string {
  return "--r0-" + token.replace(/\./g, "-");
}

export function applyTheme(theme: r0Theme): void {
  const root = document.documentElement;
  for (const [token, value] of Object.entries(theme.colors)) {
    root.style.setProperty(tokenToCssVar(token), value);
  }
  root.setAttribute("data-theme", theme.type);
  root.setAttribute("data-theme-name", theme.name.toLowerCase().replace(/^r0\s+/, ""));
  root.style.colorScheme = theme.type;
}
