/* eslint-disable react-refresh/only-export-components -- exports the useTheme hook alongside the provider component */
import { createContext, useContext, useState } from "react";
import type { r0Theme } from "./types";
import { applyTheme } from "./applyTheme";

const themeModules = import.meta.glob<{ default: r0Theme }>(
  "./**/theme.json",
  { eager: true }
);

const themeOrder = ["r0 Light", "r0 Dark", "r0 Dracula", "Cobalt2"];
export const builtinThemes: r0Theme[] = Object.values(themeModules)
  .map((m) => m.default)
  .sort((a, b) => themeOrder.indexOf(a.name) - themeOrder.indexOf(b.name));

function resolveDefaultTheme(): r0Theme {
  // 1. Respect saved preference
  const saved = localStorage.getItem("r0-theme");
  if (saved) {
    const match = builtinThemes.find((t) => t.name === saved);
    if (match) return match;
  }
  // 2. Fall back to OS preference
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const fallbackName = prefersDark ? "r0 Dark" : "r0 Light";
  return builtinThemes.find((t) => t.name === fallbackName) ?? builtinThemes[0];
}

interface ThemeContextValue {
  theme: r0Theme;
  themes: r0Theme[];
  setTheme: (theme: r0Theme) => void;
  loadThemeFromJson: (json: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<r0Theme>(() => {
    const t = resolveDefaultTheme();
    applyTheme(t); // apply synchronously so CSS vars are set before any child effect reads them
    return t;
  });

  function setTheme(t: r0Theme) {
    setThemeState(t);
    applyTheme(t);
    localStorage.setItem("r0-theme", t.name);
  }

  function loadThemeFromJson(json: string) {
    try {
      const parsed = JSON.parse(json) as r0Theme;
      if (!parsed.name || !parsed.colors) throw new Error("Invalid theme file");
      setTheme(parsed);
    } catch (e) {
      console.error("Failed to load theme:", e);
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, themes: builtinThemes, setTheme, loadThemeFromJson }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
