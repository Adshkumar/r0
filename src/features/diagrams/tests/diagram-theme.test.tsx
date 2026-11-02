// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";
import { useDiagramTheme } from "../hooks/use-diagram-theme";
import { createMermaidTheme } from "../services/diagram-theme";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Mermaid theme adapter", () => {
  it("maps dark and light r0 tokens to diagram colors", () => {
    const dark = createMermaidTheme({
      "--background": "rgb(16, 18, 22)",
      "--foreground": "rgb(244, 246, 250)",
      "--surface": "rgb(30, 34, 40)",
      "--field": "rgb(24, 27, 33)",
      "--primary": "rgb(255, 116, 35)",
      "--primary-foreground": "rgb(20, 20, 20)",
      "--accent": "rgb(52, 152, 219)",
      "--accent-foreground": "rgb(10, 10, 10)",
      "--destructive": "rgb(220, 38, 38)",
      "--border": "rgb(74, 80, 90)",
      "--app-muted-foreground": "rgb(170, 178, 190)",
    });
    const light = createMermaidTheme({
      "--background": "rgb(250, 250, 248)",
      "--foreground": "rgb(24, 26, 30)",
      "--surface": "rgb(238, 239, 236)",
      "--field": "rgb(255, 255, 255)",
      "--primary": "rgb(110, 42, 170)",
      "--border": "rgb(140, 142, 146)",
      "--muted-foreground": "rgb(80, 84, 90)",
    });

    expect(dark).toMatchObject({
      background: "#101216",
      foreground: "#f4f6fa",
      primary: "#ff7423",
      primaryForeground: "#141414",
      accent: "#3498db",
      accentForeground: "#0a0a0a",
      destructive: "#dc2626",
      mutedForeground: "#aab2be",
    });
    expect(light).toMatchObject({
      background: "#fafaf8",
      foreground: "#181a1e",
      primary: "#6e2aaa",
      mutedForeground: "#50545a",
    });
  });

  it("resolves color-mix theme tokens before passing them to Mermaid", () => {
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    const getComputedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element, pseudoElement) => {
        if (element instanceof HTMLSpanElement && element.style.color.startsWith("color-mix(")) {
          return { color: "rgb(13, 17, 23)" } as CSSStyleDeclaration;
        }
        return originalGetComputedStyle(element, pseudoElement);
      });

    try {
      const theme = createMermaidTheme({
        "--background": "color-mix(in srgb, #0d1117 94%, #6e6d3f 6%)",
      });
      expect(theme.background).toBe("#0d1117");
      expect(theme.background).not.toContain("color-mix");
    } finally {
      getComputedStyleSpy.mockRestore();
    }
  });

  it("updates the active diagram theme when root theme tokens change", async () => {
    const rootElement = document.documentElement;
    const originalStyle = rootElement.getAttribute("style");
    const originalTheme = rootElement.getAttribute("data-theme");
    const container = document.createElement("div");
    const root = createRoot(container);
    let activeTheme = createMermaidTheme({});
    function Probe() {
      activeTheme = useDiagramTheme();
      return null;
    }

    try {
      act(() => root.render(createElement(Probe)));
      await act(async () => {
        rootElement.style.setProperty("--background", "rgb(12, 14, 18)");
        rootElement.style.setProperty("--foreground", "rgb(250, 250, 250)");
        rootElement.style.setProperty("--accent", "rgb(255, 116, 35)");
        rootElement.setAttribute("data-theme", "test-dark");
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(activeTheme.background).toBe("#0c0e12");
      expect(activeTheme.foreground).toBe("#fafafa");
      expect(activeTheme.accent).toBe("#ff7423");

      await act(async () => {
        rootElement.style.setProperty("--background", "rgb(250, 250, 250)");
        rootElement.style.setProperty("--foreground", "rgb(20, 20, 20)");
        rootElement.style.setProperty("--accent", "rgb(42, 42, 42)");
        rootElement.setAttribute("data-theme", "test-light");
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(activeTheme.background).toBe("#fafafa");
      expect(activeTheme.foreground).toBe("#141414");
      expect(activeTheme.accent).toBe("#2a2a2a");
    } finally {
      act(() => root.unmount());
      if (originalStyle === null) rootElement.removeAttribute("style");
      else rootElement.setAttribute("style", originalStyle);
      if (originalTheme === null) rootElement.removeAttribute("data-theme");
      else rootElement.setAttribute("data-theme", originalTheme);
    }
  });
});
