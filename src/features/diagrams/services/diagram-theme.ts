export interface MermaidTheme {
  background: string;
  foreground: string;
  surface: string;
  field: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  mutedForeground: string;
}

export type DiagramThemeTokens = Record<string, string>;

const FALLBACK_THEME: MermaidTheme = {
  background: "#ffffff",
  foreground: "#1f2937",
  surface: "#f3f4f6",
  field: "#f9fafb",
  primary: "#2563eb",
  primaryForeground: "#ffffff",
  accent: "#2563eb",
  accentForeground: "#ffffff",
  destructive: "#dc2626",
  border: "#9ca3af",
  mutedForeground: "#4b5563",
};

function readToken(tokens: DiagramThemeTokens, name: string, fallback: string): string {
  return tokens[name]?.trim() || fallback;
}

type Rgb = [number, number, number];

function parseHexColor(value: string): { rgb: Rgb; alpha: number } | null {
  const hex = value.match(/^#([\da-f]{3,8})$/i)?.[1];
  if (!hex) return null;
  const expanded =
    hex.length === 3 || hex.length === 4
      ? Array.from(hex, (character) => character + character).join("")
      : hex;
  if (expanded.length !== 6 && expanded.length !== 8) return null;
  return {
    rgb: [
      Number.parseInt(expanded.slice(0, 2), 16),
      Number.parseInt(expanded.slice(2, 4), 16),
      Number.parseInt(expanded.slice(4, 6), 16),
    ],
    alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  };
}

function parseRgbColor(value: string): { rgb: Rgb; alpha: number } | null {
  const contents = value.match(/^rgba?\((.+)\)$/i)?.[1];
  if (!contents) return null;
  const parts = contents
    .trim()
    .split(/[\s,/]+/)
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;

  const channels = parts.slice(0, 3).map((part) => {
    const parsed = Number.parseFloat(part);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(part.endsWith("%") ? (parsed / 100) * 255 : parsed);
  });
  if (channels.some((channel) => channel === null)) return null;

  const alphaValue = parts[3] ?? "1";
  const parsedAlpha = Number.parseFloat(alphaValue);
  if (!Number.isFinite(parsedAlpha)) return null;
  const alpha = alphaValue.endsWith("%") ? parsedAlpha / 100 : parsedAlpha;
  return {
    rgb: channels.map((channel) => Math.min(255, Math.max(0, channel!))) as Rgb,
    alpha: Math.min(1, Math.max(0, alpha)),
  };
}

function toHexColor(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

function compositeColor(
  color: { rgb: Rgb; alpha: number },
  backdrop: { rgb: Rgb; alpha: number },
): { rgb: Rgb; alpha: number } {
  const alpha = color.alpha + backdrop.alpha * (1 - color.alpha);
  if (alpha === 0) return { rgb: [0, 0, 0], alpha: 0 };
  return {
    rgb: color.rgb.map((channel, index) => {
      const base = backdrop.rgb[index] ?? 0;
      return (channel * color.alpha + base * backdrop.alpha * (1 - color.alpha)) / alpha;
    }) as Rgb,
    alpha,
  };
}

function resolveMermaidColor(value: string, fallback: string, backdrop = "#ffffff"): string {
  const probe = document.createElement("span");
  probe.style.color = value;
  (document.body ?? document.documentElement).append(probe);
  let computed = "";
  try {
    computed = getComputedStyle(probe).color;
  } finally {
    probe.remove();
  }

  const parsedColor = parseRgbColor(computed) ?? parseHexColor(computed) ?? parseHexColor(value);
  if (!parsedColor) return fallback;
  const opaqueBackdrop = parseRgbColor(backdrop) ??
    parseHexColor(backdrop) ??
    parseHexColor(fallback) ?? {
      rgb: [255, 255, 255] as Rgb,
      alpha: 1,
    };
  return toHexColor(compositeColor(parsedColor, opaqueBackdrop).rgb);
}

export function createMermaidTheme(tokens: DiagramThemeTokens): MermaidTheme {
  const background = resolveMermaidColor(
    readToken(tokens, "--background", FALLBACK_THEME.background),
    FALLBACK_THEME.background,
  );
  const foreground = resolveMermaidColor(
    readToken(tokens, "--foreground", FALLBACK_THEME.foreground),
    FALLBACK_THEME.foreground,
    background,
  );
  const surface = resolveMermaidColor(
    readToken(tokens, "--surface", FALLBACK_THEME.surface),
    FALLBACK_THEME.surface,
    background,
  );
  const field = resolveMermaidColor(
    readToken(tokens, "--field", FALLBACK_THEME.field),
    FALLBACK_THEME.field,
    background,
  );
  const primary = resolveMermaidColor(
    readToken(tokens, "--primary", FALLBACK_THEME.primary),
    FALLBACK_THEME.primary,
    background,
  );
  const primaryForeground = resolveMermaidColor(
    readToken(tokens, "--primary-foreground", FALLBACK_THEME.primaryForeground),
    FALLBACK_THEME.primaryForeground,
    primary,
  );
  const accent = resolveMermaidColor(
    readToken(tokens, "--accent", FALLBACK_THEME.accent),
    FALLBACK_THEME.accent,
    background,
  );
  const accentForeground = resolveMermaidColor(
    readToken(tokens, "--accent-foreground", FALLBACK_THEME.accentForeground),
    FALLBACK_THEME.accentForeground,
    accent,
  );
  const destructive = resolveMermaidColor(
    readToken(tokens, "--destructive", FALLBACK_THEME.destructive),
    FALLBACK_THEME.destructive,
    background,
  );
  const border = resolveMermaidColor(
    readToken(tokens, "--border", FALLBACK_THEME.border),
    FALLBACK_THEME.border,
    background,
  );
  const mutedForeground = resolveMermaidColor(
    readToken(
      tokens,
      "--app-muted-foreground",
      readToken(tokens, "--muted-foreground", FALLBACK_THEME.mutedForeground),
    ),
    FALLBACK_THEME.mutedForeground,
    background,
  );

  return {
    background,
    foreground,
    surface,
    field,
    primary,
    primaryForeground,
    accent,
    accentForeground,
    destructive,
    border,
    mutedForeground,
  };
}

export function readCurrentMermaidTheme(): MermaidTheme {
  if (typeof document === "undefined") return FALLBACK_THEME;
  const styles = getComputedStyle(document.body ?? document.documentElement);
  return createMermaidTheme({
    "--background": styles.getPropertyValue("--background"),
    "--foreground": styles.getPropertyValue("--foreground"),
    "--surface": styles.getPropertyValue("--surface"),
    "--field": styles.getPropertyValue("--field"),
    "--primary": styles.getPropertyValue("--primary"),
    "--primary-foreground": styles.getPropertyValue("--primary-foreground"),
    "--accent": styles.getPropertyValue("--accent"),
    "--accent-foreground": styles.getPropertyValue("--accent-foreground"),
    "--destructive": styles.getPropertyValue("--destructive"),
    "--border": styles.getPropertyValue("--border"),
    "--app-muted-foreground": styles.getPropertyValue("--app-muted-foreground"),
    "--muted-foreground": styles.getPropertyValue("--muted-foreground"),
  });
}

export function getMermaidThemeSignature(theme: MermaidTheme): string {
  return JSON.stringify(theme);
}
