// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  calculateDiagramFitZoom,
  calculateDiagramPinchTransform,
  calculateDiagramZoomTransform,
  getDefaultDiagramWorkspacePreferences,
  getDiagramWheelZoomDelta,
  readDiagramDocumentPreferences,
  readDiagramWorkspacePreferences,
  saveDiagramDocumentPreferences,
  saveDiagramWorkspacePreferences,
} from "../services/diagram-layout";

const STORAGE_KEY = "r0.diagram-workspace.v1";

describe("Diagram Studio layout preferences", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("uses safe defaults for missing or malformed saved data", () => {
    expect(readDiagramWorkspacePreferences()).toEqual(getDefaultDiagramWorkspacePreferences());
    window.localStorage.setItem(STORAGE_KEY, "{invalid");
    expect(readDiagramWorkspacePreferences()).toEqual(getDefaultDiagramWorkspacePreferences());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ splitRatio: "wide" }));
    expect(readDiagramWorkspacePreferences()).toMatchObject({
      splitRatio: 65,
      assistantRatio: (25 / 65) * 100,
      assistantExpanded: true,
    });
  });

  it("migrates saved diagrams to the balanced three-panel proportions", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 3,
        splitRatio: 50,
        assistantRatio: 40,
        documents: {
          "diagram.mmd": {
            viewMode: "split",
            zoom: 1.5,
            panX: 12,
            panY: -8,
            viewportWidth: 1000,
            viewportHeight: 700,
            assistantChatId: "mermaid-chat",
            splitRatio: 30,
            assistantRatio: 55,
          },
        },
      }),
    );

    expect(readDiagramDocumentPreferences("diagram.mmd")).toMatchObject({
      splitRatio: 65,
      assistantRatio: (25 / 65) * 100,
      zoom: 1.5,
      panX: 12,
      panY: -8,
      assistantChatId: "mermaid-chat",
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").version).toBe(4);
  });

  it("clamps persisted dimensions and restores panel state", () => {
    const saved = saveDiagramWorkspacePreferences({
      splitRatio: 99,
      assistantRatio: 1,
      assistantExpanded: true,
    });
    expect(saved).toEqual({
      splitRatio: 80,
      assistantRatio: 20,
      assistantExpanded: true,
    });
    expect(readDiagramWorkspacePreferences()).toEqual(saved);
  });

  it("persists validated viewport and layout state by document", () => {
    const preferences = saveDiagramDocumentPreferences("C:\\repo\\diagram.mmd", {
      viewMode: "preview",
      zoom: 2.5,
      panX: -45,
      panY: 72,
      viewportWidth: 1200,
      viewportHeight: 720,
      fitToViewport: false,
      splitRatio: 70,
      assistantExpanded: true,
      assistantChatId: "mermaid-chat-1",
    });
    expect(preferences).toMatchObject({
      viewMode: "preview",
      zoom: 2.5,
      panX: -45,
      panY: 72,
      fitToViewport: false,
      splitRatio: 70,
      assistantExpanded: true,
      assistantChatId: "mermaid-chat-1",
    });
    expect(readDiagramDocumentPreferences("C:/repo/diagram.mmd")).toEqual(preferences);

    saveDiagramDocumentPreferences("C:/repo/diagram.mmd", { zoom: 99, panX: Number.NaN });
    expect(readDiagramDocumentPreferences("C:/repo/diagram.mmd")).toMatchObject({
      zoom: 4,
      panX: -45,
    });
  });

  it("clears a deleted document conversation from saved preferences", () => {
    saveDiagramDocumentPreferences("diagram.mmd", { assistantChatId: "mermaid-chat" });

    const saved = saveDiagramDocumentPreferences("diagram.mmd", { assistantChatId: null });

    expect(saved.assistantChatId).toBeNull();
    expect(readDiagramDocumentPreferences("diagram.mmd").assistantChatId).toBeNull();
  });

  it("keeps per-document state when shared layout settings are saved", () => {
    saveDiagramDocumentPreferences("diagram.mmd", { viewMode: "source" });
    saveDiagramWorkspacePreferences({ assistantRatio: 30 });
    expect(readDiagramDocumentPreferences("diagram.mmd").viewMode).toBe("source");
    expect(readDiagramWorkspacePreferences().assistantRatio).toBe(30);
  });

  it("zooms around the pointer without moving its diagram point", () => {
    const viewport = { left: 100, top: 50, width: 800, height: 600 };
    const point = { x: 700, y: 200 };
    const current = { zoom: 1, panX: 25, panY: -10 };
    const next = calculateDiagramZoomTransform(current, 2, point, viewport);
    const oldDiagramPoint = {
      x: (point.x - viewport.left - viewport.width / 2 - current.panX) / current.zoom,
      y: (point.y - viewport.top - viewport.height / 2 - current.panY) / current.zoom,
    };
    const newDiagramPoint = {
      x: (point.x - viewport.left - viewport.width / 2 - next.panX) / next.zoom,
      y: (point.y - viewport.top - viewport.height / 2 - next.panY) / next.zoom,
    };
    expect(newDiagramPoint.x).toBeCloseTo(oldDiagramPoint.x);
    expect(newDiagramPoint.y).toBeCloseTo(oldDiagramPoint.y);
    expect(calculateDiagramZoomTransform(current, 99, point, viewport).zoom).toBe(4);
  });

  it("fits wide and tall diagrams within the viewport with padding", () => {
    const wideZoom = calculateDiagramFitZoom(2400, 800, 900, 600);
    expect(2400 * wideZoom).toBeLessThanOrEqual(900);
    expect(800 * wideZoom).toBeLessThanOrEqual(600);
    expect(wideZoom).toBeCloseTo(0.3375);

    const tallZoom = calculateDiagramFitZoom(800, 2400, 900, 600);
    expect(800 * tallZoom).toBeLessThanOrEqual(900);
    expect(2400 * tallZoom).toBeLessThanOrEqual(600);
    expect(tallZoom).toBeCloseTo(0.225);
  });

  it("zooms in and out around a two-finger pinch while following its center", () => {
    const viewport = { left: 0, top: 0, width: 800, height: 600 };
    const start = { zoom: 1, panX: 0, panY: 0 };
    const startCenter = { x: 400, y: 300 };

    const zoomedIn = calculateDiagramPinchTransform(
      start,
      100,
      180,
      startCenter,
      startCenter,
      viewport,
    );
    expect(zoomedIn.zoom).toBeCloseTo(1.8);

    const zoomedOut = calculateDiagramPinchTransform(
      start,
      100,
      60,
      startCenter,
      { x: 420, y: 310 },
      viewport,
    );
    expect(zoomedOut.zoom).toBeCloseTo(0.6);
    expect(zoomedOut.panX).toBeCloseTo(20);
    expect(zoomedOut.panY).toBeCloseTo(10);
  });

  it("recognizes modifier-wheel and native deltaZ trackpad pinch signals", () => {
    expect(
      getDiagramWheelZoomDelta({ ctrlKey: true, metaKey: false, deltaY: -30, deltaZ: 0 }),
    ).toBe(-30);
    expect(
      getDiagramWheelZoomDelta({
        ctrlKey: true,
        metaKey: false,
        deltaY: 0,
        deltaZ: 12,
      }),
    ).toBe(12);
    expect(
      getDiagramWheelZoomDelta({
        ctrlKey: true,
        metaKey: false,
        deltaY: 0,
        deltaZ: 0,
        deltaX: -16,
      }),
    ).toBe(-16);
    expect(
      getDiagramWheelZoomDelta({ ctrlKey: false, metaKey: false, deltaY: 0, deltaZ: 12 }),
    ).toBe(12);
    expect(
      getDiagramWheelZoomDelta({ ctrlKey: false, metaKey: false, deltaY: 30, deltaZ: 0 }),
    ).toBeNull();
  });
});
