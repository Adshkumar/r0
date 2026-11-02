import { useEffect, useState } from "react";
import {
  getMermaidThemeSignature,
  readCurrentMermaidTheme,
  type MermaidTheme,
} from "../services/diagram-theme";

export function useDiagramTheme(): MermaidTheme {
  const [theme, setTheme] = useState(readCurrentMermaidTheme);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const handleColorSchemeChange = () => setTheme(readCurrentMermaidTheme());
    const observer = new MutationObserver(() => {
      const nextTheme = readCurrentMermaidTheme();
      setTheme((currentTheme) =>
        getMermaidThemeSignature(currentTheme) === getMermaidThemeSignature(nextTheme)
          ? currentTheme
          : nextTheme,
      );
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-theme-type", "style"],
    });
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-theme-type", "style"],
    });
    const colorScheme =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    colorScheme?.addEventListener("change", handleColorSchemeChange);
    return () => {
      observer.disconnect();
      colorScheme?.removeEventListener("change", handleColorSchemeChange);
    };
  }, []);

  return theme;
}
