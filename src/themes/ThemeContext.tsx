/* eslint-disable react-refresh/only-export-components -- exports the useTheme hook alongside the provider component */
import { createContext, useContext, useEffect, useState } from "react";
import type { r0Theme } from "./types";
import { applyTheme } from "./applyTheme";
import { listExtensions } from "../lib/extensions";

const themeModules = import.meta.glob<{ default: r0Theme }>(
  "./**/theme.json",
  { eager: true }
);

const themeOrder = ["Dark Modern", "Dracula", "One Dark Pro", "GitHub Dark", "Light Modern"];
export const builtinThemes: r0Theme[] = Object.values(themeModules)
  .map((m) => m.default)
  .sort((a, b) => themeOrder.indexOf(a.name) - themeOrder.indexOf(b.name));

function resolveDefaultTheme(): r0Theme {
  // 1. Respect saved preference
  const saved = localStorage.getItem("r0-theme");
  if (saved) {
    const legacyNames: Record<string, string> = {
      "r0 Light": "Light Modern",
      "r0 Dark": "Dark Modern",
      "r0 Dracula": "Dracula",
      "Cobalt2": "One Dark Pro",
    };
    const match = builtinThemes.find((t) => t.name === (legacyNames[saved] ?? saved));
    if (match) return match;
    if (saved.startsWith("Open VSX: ")) {
      try {
        const custom = JSON.parse(localStorage.getItem("r0-custom-theme") ?? "null") as r0Theme | null;
        if (custom?.name === saved && (custom.type === "dark" || custom.type === "light") && custom.colors) {
          return custom;
        }
      } catch {
        localStorage.removeItem("r0-custom-theme");
      }
    }
  }
  // 2. Fall back to OS preference
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const fallbackName = prefersDark ? "Dark Modern" : "Light Modern";
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

  useEffect(() => {
    if (!theme.name.startsWith("Open VSX: ")) return;
    const activeTheme = theme.name.slice("Open VSX: ".length).split(" / ")[0];
    const [namespace, ...nameParts] = activeTheme.split(".");
    const extensionName = nameParts.join(".");
    let cancelled = false;
    listExtensions()
      .then((extensions) => {
        const extension = extensions.find((item) =>
          item.namespace.toLowerCase() === namespace?.toLowerCase()
          && item.name.toLowerCase() === extensionName.toLowerCase()
          && item.enabled
        );
        if (!cancelled && !extension) {
          const fallback = builtinThemes[0];
          setThemeState(fallback);
          applyTheme(fallback);
          localStorage.setItem("r0-theme", fallback.name);
          localStorage.removeItem("r0-custom-theme");
        }
      })
      .catch((error) => console.error("Could not validate the active extension theme:", error));
    return () => { cancelled = true; };
  }, [theme.name]);

  function setTheme(t: r0Theme) {
    setThemeState(t);
    applyTheme(t);
    localStorage.setItem("r0-theme", t.name);
    if (t.name.startsWith("Open VSX: ")) {
      localStorage.setItem("r0-custom-theme", JSON.stringify(t));
    } else {
      localStorage.removeItem("r0-custom-theme");
    }
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
