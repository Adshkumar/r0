import DOMPurify from "dompurify";
import { MAX_MERMAID_SOURCE_LENGTH } from "./diagram-document";
import { readCurrentMermaidTheme, type MermaidTheme } from "./diagram-theme";
import { resolveMermaidThemePreset, type MermaidThemePresetId } from "./diagram-theme-presets";
import { getRenderableMermaidSource, normalizeMermaidSource } from "./mermaid-source";

type MermaidEngine = (typeof import("mermaid"))["default"];

let mermaidEngine: Promise<MermaidEngine> | undefined;
let renderQueue: Promise<void> = Promise.resolve();
let nextDiagramId = 0;
let nextRenderRequestId = 0;
const latestRenderRequestByKey = new Map<string, number>();

function assertSourceSize(source: string): void {
  if (source.length > MAX_MERMAID_SOURCE_LENGTH) {
    throw new Error(
      `Mermaid source exceeds the ${MAX_MERMAID_SOURCE_LENGTH.toLocaleString("en-US")} character limit.`,
    );
  }
}

function containsExternalResourceReference(value: string): boolean {
  for (const match of value.matchAll(/url\(([^)]*)\)/gi)) {
    const reference = match[1]?.trim().replace(/^["']|["']$/g, "");
    if (reference && !reference.startsWith("#")) return true;
  }
  return false;
}

function getRgbColor(value: string): [number, number, number] | null {
  const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) {
    const expanded =
      hex.length === 3 ? Array.from(hex, (character) => character + character).join("") : hex;
    return [
      Number.parseInt(expanded.slice(0, 2), 16),
      Number.parseInt(expanded.slice(2, 4), 16),
      Number.parseInt(expanded.slice(4, 6), 16),
    ];
  }

  const channels = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (channels) {
    return [Number(channels[1]), Number(channels[2]), Number(channels[3])];
  }

  if (value.toLowerCase() === "white") return [255, 255, 255];
  if (value.toLowerCase() === "black") return [0, 0, 0];
  return null;
}

function getContrastingTextColor(fill: string): string | null {
  const rgb = getRgbColor(fill);
  if (!rgb) return null;
  const luminance = rgb
    .map((channel) => {
      const linear = channel / 255;
      return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
  return luminance > 0.179 ? "#111827" : "#f9fafb";
}

function ensureNodeTextContrast(container: HTMLDivElement): void {
  for (const node of container.querySelectorAll<SVGGElement>("svg g.node")) {
    const shapes = Array.from(
      node.querySelectorAll<SVGElement>("rect, circle, ellipse, polygon, path"),
    );
    const background = shapes
      .map(
        (shape) =>
          shape.style.fill || shape.getAttribute("fill") || window.getComputedStyle(shape).fill,
      )
      .find((fill) => fill && fill !== "none" && !fill.startsWith("url("));
    if (!background) continue;

    const textColor = getContrastingTextColor(background);
    if (!textColor) continue;
    for (const label of node.querySelectorAll<SVGElement | HTMLElement>(
      "text, tspan, .nodeLabel",
    )) {
      if (label instanceof SVGElement) {
        label.style.setProperty("fill", textColor, "important");
      }
      if (label instanceof HTMLElement || label.classList.contains("nodeLabel")) {
        label.style.setProperty("color", textColor, "important");
      }
    }
  }
}

function loadMermaid(): Promise<MermaidEngine> {
  if (!mermaidEngine) {
    mermaidEngine = import("mermaid")
      .then(({ default: mermaid }) => {
        initializeMermaid(mermaid, readCurrentMermaidTheme());
        return mermaid;
      })
      .catch((error: unknown) => {
        mermaidEngine = undefined;
        throw error;
      });
  }

  return mermaidEngine;
}

function initializeMermaid(
  mermaid: MermaidEngine,
  theme: MermaidTheme,
  themePreset: MermaidThemePresetId = "mermaid-chart",
): void {
  const selectedTheme = resolveMermaidThemePreset(themePreset, theme);
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    suppressErrorRendering: true,
    maxTextSize: MAX_MERMAID_SOURCE_LENGTH,
    secure: ["securityLevel", "startOnLoad", "maxTextSize", "suppressErrorRendering"],
    theme: selectedTheme.mermaidTheme,
    htmlLabels: false,
    fontFamily: "inherit",
    ...(selectedTheme.colors
      ? {
          themeVariables: {
            background: selectedTheme.colors.background,
            primaryColor: selectedTheme.colors.primary,
            primaryTextColor: selectedTheme.colors.primaryForeground,
            primaryBorderColor: selectedTheme.colors.border,
            lineColor: selectedTheme.colors.accent,
            arrowheadColor: selectedTheme.colors.accent,
            defaultLinkColor: selectedTheme.colors.accent,
            nodeTextColor: selectedTheme.colors.foreground,
            secondaryColor: selectedTheme.colors.field,
            secondaryTextColor: selectedTheme.colors.foreground,
            secondaryBorderColor: selectedTheme.colors.border,
            tertiaryColor: selectedTheme.colors.background,
            tertiaryTextColor: selectedTheme.colors.foreground,
            tertiaryBorderColor: selectedTheme.colors.border,
            textColor: selectedTheme.colors.foreground,
            mainBkg: selectedTheme.colors.surface,
            nodeBorder: selectedTheme.colors.border,
            titleColor: selectedTheme.colors.foreground,
            edgeLabelBackground: selectedTheme.colors.background,
            clusterBkg: selectedTheme.colors.surface,
            clusterBorder: selectedTheme.colors.border,
            sectionBkgColor: selectedTheme.colors.surface,
            altSectionBkgColor: selectedTheme.colors.field,
            gridColor: selectedTheme.colors.border,
            actorBkg: selectedTheme.colors.surface,
            actorBorder: selectedTheme.colors.border,
            actorTextColor: selectedTheme.colors.foreground,
            actorLineColor: selectedTheme.colors.border,
            signalColor: selectedTheme.colors.accent,
            signalTextColor: selectedTheme.colors.foreground,
            sequenceNumberColor: selectedTheme.colors.accent,
            labelBoxBkgColor: selectedTheme.colors.field,
            labelBoxBorderColor: selectedTheme.colors.border,
            labelTextColor: selectedTheme.colors.foreground,
            loopTextColor: selectedTheme.colors.foreground,
            noteBkgColor: selectedTheme.colors.field,
            noteTextColor: selectedTheme.colors.foreground,
            noteBorderColor: selectedTheme.colors.border,
            activationBkgColor: selectedTheme.colors.primary,
            activationBorderColor: selectedTheme.colors.border,
            taskBkgColor: selectedTheme.colors.surface,
            taskBorderColor: selectedTheme.colors.border,
            taskTextColor: selectedTheme.colors.foreground,
            taskTextLightColor: selectedTheme.colors.foreground,
            activeTaskBkgColor: selectedTheme.colors.primary,
            activeTaskBorderColor: selectedTheme.colors.border,
            activeTaskTextColor: selectedTheme.colors.primaryForeground,
            todayLineColor: selectedTheme.colors.destructive,
            pie1: selectedTheme.colors.primary,
            pie2: selectedTheme.colors.accent,
            pie3: selectedTheme.colors.field,
            classText: selectedTheme.colors.foreground,
            relationColor: selectedTheme.colors.mutedForeground,
            attributeBackgroundColor: selectedTheme.colors.field,
            attributeBorderColor: selectedTheme.colors.border,
          },
        }
      : {}),
    fontSize: 16,
    sequence: {
      useMaxWidth: false,
      diagramMarginX: 24,
      diagramMarginY: 16,
      actorMargin: 48,
      messageMargin: 32,
      noteMargin: 12,
      actorFontSize: 16,
      messageFontSize: 15,
      noteFontSize: 14,
    },
    flowchart: { useMaxWidth: false },
  });
}

export async function validateMermaidSource(source: string): Promise<void> {
  const mermaidSource = normalizeMermaidSource(source);
  assertSourceSize(mermaidSource);
  const mermaid = await loadMermaid();
  await mermaid.parse(mermaidSource);
}

export async function detectMermaidDiagramType(source: string): Promise<string | null> {
  const mermaidSource = normalizeMermaidSource(source);
  if (!mermaidSource.trim()) return null;
  const mermaid = await loadMermaid();
  try {
    return mermaid.detectType(mermaidSource);
  } catch {
    return null;
  }
}

export function sanitizeMermaidSvg(svg: string): string {
  const sanitized = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
  const container = document.createElement("div");
  container.innerHTML = sanitized;

  for (const element of container.querySelectorAll<SVGElement>("*")) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (
        (["href", "xlink:href", "src"].includes(name) && value && !value.startsWith("#")) ||
        containsExternalResourceReference(value)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  ensureNodeTextContrast(container);
  return container.innerHTML;
}

export function cancelMermaidRender(renderKey: string): void {
  latestRenderRequestByKey.delete(renderKey);
}

export async function renderMermaidSvg(
  source: string,
  renderKey?: string,
  theme: MermaidTheme = readCurrentMermaidTheme(),
  themePreset: MermaidThemePresetId = "mermaid-chart",
): Promise<string> {
  const mermaidSource = normalizeMermaidSource(getRenderableMermaidSource(source));
  assertSourceSize(mermaidSource);
  const requestId = ++nextRenderRequestId;
  if (renderKey) latestRenderRequestByKey.set(renderKey, requestId);
  let svg = "";
  const render = renderQueue.then(async () => {
    if (renderKey && latestRenderRequestByKey.get(renderKey) !== requestId) return;
    const mermaid = await loadMermaid();
    if (renderKey && latestRenderRequestByKey.get(renderKey) !== requestId) return;
    initializeMermaid(mermaid, theme, themePreset);
    const result = await mermaid.render(`r0-diagram-${++nextDiagramId}`, mermaidSource);
    svg = sanitizeMermaidSvg(result.svg);
  });
  renderQueue = render.then(
    () => {},
    () => {},
  );
  try {
    await render;
  } finally {
    if (renderKey && latestRenderRequestByKey.get(renderKey) === requestId) {
      latestRenderRequestByKey.delete(renderKey);
    }
  }
  return svg;
}
