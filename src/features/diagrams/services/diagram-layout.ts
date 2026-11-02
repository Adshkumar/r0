const STORAGE_KEY = "r0.diagram-workspace.v1";
const DEFAULT_SPLIT_RATIO = 50;
const DEFAULT_ASSISTANT_RATIO = 18;

export interface DiagramWorkspacePreferences {
  splitRatio: number;
  assistantRatio: number;
  assistantExpanded: boolean;
}

const DEFAULT_PREFERENCES: DiagramWorkspacePreferences = {
  splitRatio: DEFAULT_SPLIT_RATIO,
  assistantRatio: DEFAULT_ASSISTANT_RATIO,
  assistantExpanded: false,
};
const MAX_SAVED_DOCUMENTS = 50;

export interface DiagramDocumentPreferences {
  viewMode: "source" | "split" | "preview";
  zoom: number;
  panX: number;
  panY: number;
  viewportWidth: number;
  viewportHeight: number;
  fitToViewport: boolean;
  splitRatio: number;
  assistantRatio: number;
  assistantExpanded: boolean;
}

const DEFAULT_DOCUMENT_PREFERENCES: DiagramDocumentPreferences = {
  viewMode: "split",
  zoom: 1,
  panX: 0,
  panY: 0,
  viewportWidth: 0,
  viewportHeight: 0,
  fitToViewport: false,
  splitRatio: DEFAULT_SPLIT_RATIO,
  assistantRatio: DEFAULT_ASSISTANT_RATIO,
  assistantExpanded: false,
};

function clampRatio(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(20, Math.min(80, value))
    : fallback;
}

export function readDiagramWorkspacePreferences(): DiagramWorkspacePreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null) return DEFAULT_PREFERENCES;
    const preferences = value as Partial<DiagramWorkspacePreferences>;
    return {
      splitRatio: clampRatio(preferences.splitRatio, DEFAULT_SPLIT_RATIO),
      assistantRatio: clampRatio(preferences.assistantRatio, DEFAULT_ASSISTANT_RATIO),
      assistantExpanded:
        typeof preferences.assistantExpanded === "boolean"
          ? preferences.assistantExpanded
          : DEFAULT_PREFERENCES.assistantExpanded,
    };
  } catch (error) {
    console.warn("Unable to read Diagram Studio layout preferences.", error);
    return DEFAULT_PREFERENCES;
  }
}

function documentKey(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function validateDocumentPreferences(
  value: unknown,
  fallback: DiagramDocumentPreferences,
): DiagramDocumentPreferences {
  if (!isRecord(value)) return fallback;
  const viewMode =
    value.viewMode === "source" || value.viewMode === "preview" || value.viewMode === "split"
      ? value.viewMode
      : fallback.viewMode;
  return {
    viewMode,
    zoom: finiteNumber(value.zoom, fallback.zoom, 0.1, 4),
    panX: finiteNumber(value.panX, fallback.panX, -100_000, 100_000),
    panY: finiteNumber(value.panY, fallback.panY, -100_000, 100_000),
    viewportWidth: finiteNumber(value.viewportWidth, fallback.viewportWidth, 0, 20_000),
    viewportHeight: finiteNumber(value.viewportHeight, fallback.viewportHeight, 0, 20_000),
    fitToViewport:
      typeof value.fitToViewport === "boolean" ? value.fitToViewport : fallback.fitToViewport,
    splitRatio: clampRatio(value.splitRatio, fallback.splitRatio),
    assistantRatio: clampRatio(value.assistantRatio, fallback.assistantRatio),
    assistantExpanded:
      typeof value.assistantExpanded === "boolean"
        ? value.assistantExpanded
        : fallback.assistantExpanded,
  };
}

export function readDiagramDocumentPreferences(filePath: string): DiagramDocumentPreferences {
  const shared = readDiagramWorkspacePreferences();
  const fallback: DiagramDocumentPreferences = {
    ...DEFAULT_DOCUMENT_PREFERENCES,
    ...shared,
  };
  if (typeof window === "undefined" || !filePath) return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;
    const value: unknown = JSON.parse(stored);
    if (!isRecord(value) || !isRecord(value.documents)) return fallback;
    return validateDocumentPreferences(value.documents[documentKey(filePath)], fallback);
  } catch (error) {
    console.warn("Unable to read Diagram Studio document preferences.", error);
    return fallback;
  }
}

export function saveDiagramDocumentPreferences(
  filePath: string,
  changes: Partial<DiagramDocumentPreferences>,
): DiagramDocumentPreferences {
  const current = readDiagramDocumentPreferences(filePath);
  const next = validateDocumentPreferences({ ...current, ...changes }, current);
  if (typeof window === "undefined" || !filePath) return next;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const value: unknown = stored ? JSON.parse(stored) : {};
    const record = isRecord(value) ? value : {};
    const documents = isRecord(record.documents) ? record.documents : {};
    const key = documentKey(filePath);
    const nextDocuments = Object.fromEntries([
      ...Object.entries(documents).filter(([documentPath]) => documentPath !== key),
      [key, next],
    ]);
    const retainedDocuments = Object.fromEntries(
      Object.entries(nextDocuments).slice(-MAX_SAVED_DOCUMENTS),
    );
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...record,
        version: 2,
        documents: retainedDocuments,
      }),
    );
  } catch (error) {
    console.warn("Unable to save Diagram Studio document preferences.", error);
  }
  return next;
}

export function saveDiagramWorkspacePreferences(
  changes: Partial<DiagramWorkspacePreferences>,
): DiagramWorkspacePreferences {
  const current = readDiagramWorkspacePreferences();
  const next: DiagramWorkspacePreferences = {
    ...current,
    ...changes,
    splitRatio: clampRatio(changes.splitRatio ?? current.splitRatio, DEFAULT_SPLIT_RATIO),
    assistantRatio: clampRatio(
      changes.assistantRatio ?? current.assistantRatio,
      DEFAULT_ASSISTANT_RATIO,
    ),
  };
  if (typeof window === "undefined") return next;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const value: unknown = stored ? JSON.parse(stored) : {};
    const record = isRecord(value) ? value : {};
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...record,
        ...next,
        version: 2,
      }),
    );
  } catch (error) {
    console.warn("Unable to save Diagram Studio layout preferences.", error);
  }
  return next;
}

export function getDefaultDiagramWorkspacePreferences(): DiagramWorkspacePreferences {
  return { ...DEFAULT_PREFERENCES };
}

export interface DiagramViewportTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export interface DiagramPoint {
  x: number;
  y: number;
}

export function calculateDiagramFitZoom(
  diagramWidth: number,
  diagramHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding = 0.9,
): number {
  if (
    !Number.isFinite(diagramWidth) ||
    !Number.isFinite(diagramHeight) ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    diagramWidth <= 0 ||
    diagramHeight <= 0 ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return 1;
  }
  return Math.min(
    4,
    Math.max(
      0.01,
      Math.min(viewportWidth / diagramWidth, viewportHeight / diagramHeight) * padding,
    ),
  );
}

export function getDiagramWheelZoomDelta(event: {
  ctrlKey: boolean;
  metaKey: boolean;
  deltaY: number;
  deltaX?: number;
  deltaZ: number;
}): number | null {
  if (event.ctrlKey || event.metaKey) {
    return [event.deltaY, event.deltaZ, event.deltaX ?? 0].find((delta) => delta !== 0) ?? null;
  }
  if (event.deltaZ !== 0) return event.deltaZ;
  return null;
}

export function calculateDiagramZoomTransform(
  current: DiagramViewportTransform,
  nextZoomValue: number,
  point: DiagramPoint,
  viewport: { left: number; top: number; width: number; height: number },
): DiagramViewportTransform {
  const zoom = Math.min(4, Math.max(0.1, nextZoomValue));
  const anchorX = point.x - (viewport.left + viewport.width / 2);
  const anchorY = point.y - (viewport.top + viewport.height / 2);
  const scale = zoom / current.zoom;
  return {
    zoom,
    panX: anchorX - (anchorX - current.panX) * scale,
    panY: anchorY - (anchorY - current.panY) * scale,
  };
}

export function calculateDiagramPinchTransform(
  start: DiagramViewportTransform,
  startDistance: number,
  currentDistance: number,
  startCenter: DiagramPoint,
  currentCenter: DiagramPoint,
  viewport: { left: number; top: number; width: number; height: number },
): DiagramViewportTransform {
  if (startDistance <= 0) return start;
  const zoomed = calculateDiagramZoomTransform(
    start,
    start.zoom * (currentDistance / startDistance),
    startCenter,
    viewport,
  );
  return {
    ...zoomed,
    panX: zoomed.panX + currentCenter.x - startCenter.x,
    panY: zoomed.panY + currentCenter.y - startCenter.y,
  };
}
