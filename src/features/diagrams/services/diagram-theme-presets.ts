import type { MermaidTheme } from "./diagram-theme";

export type MermaidThemePresetId =
  | "mermaid-chart"
  | "neo"
  | "neo-dark"
  | "default"
  | "forest"
  | "base"
  | "dark"
  | "neutral"
  | "redux-dark"
  | "redux-color"
  | "redux-dark-color";

type NativeMermaidTheme = "default" | "forest" | "base" | "dark" | "neutral";

interface MermaidThemePreset {
  id: MermaidThemePresetId;
  label: string;
  mermaidTheme: NativeMermaidTheme;
  colors?: MermaidTheme;
}

function createPresetColors(
  background: string,
  foreground: string,
  surface: string,
  field: string,
  primary: string,
  primaryForeground: string,
  accent: string,
  border: string,
  mutedForeground: string,
): MermaidTheme {
  return {
    background,
    foreground,
    surface,
    field,
    primary,
    primaryForeground,
    accent,
    accentForeground: foreground,
    destructive: "#dc2626",
    border,
    mutedForeground,
  };
}

export const MERMAID_THEME_PRESETS: MermaidThemePreset[] = [
  {
    id: "mermaid-chart",
    label: "Mermaid Chart",
    mermaidTheme: "base",
  },
  {
    id: "neo",
    label: "Neo",
    mermaidTheme: "base",
    colors: createPresetColors(
      "#ffffff",
      "#263238",
      "#f4f7f8",
      "#e8eef0",
      "#c9e6a5",
      "#263238",
      "#638f64",
      "#87969a",
      "#54656b",
    ),
  },
  {
    id: "neo-dark",
    label: "Neo Dark",
    mermaidTheme: "base",
    colors: createPresetColors(
      "#171b20",
      "#edf2f4",
      "#242b31",
      "#2d363d",
      "#638f64",
      "#ffffff",
      "#9ac87d",
      "#58656d",
      "#b0bdc4",
    ),
  },
  { id: "default", label: "Default", mermaidTheme: "default" },
  { id: "forest", label: "Forest", mermaidTheme: "forest" },
  { id: "base", label: "Base", mermaidTheme: "base" },
  { id: "dark", label: "Dark", mermaidTheme: "dark" },
  { id: "neutral", label: "Neutral", mermaidTheme: "neutral" },
  {
    id: "redux-dark",
    label: "Redux Dark",
    mermaidTheme: "base",
    colors: createPresetColors(
      "#151a23",
      "#e7edf5",
      "#202938",
      "#293449",
      "#5a78c7",
      "#ffffff",
      "#58c4c6",
      "#46546b",
      "#aab7ca",
    ),
  },
  {
    id: "redux-color",
    label: "Redux Color",
    mermaidTheme: "base",
    colors: createPresetColors(
      "#ffffff",
      "#202938",
      "#f1f4fb",
      "#e7ecf7",
      "#8097e8",
      "#17203a",
      "#45a9a0",
      "#8994ab",
      "#505b70",
    ),
  },
  {
    id: "redux-dark-color",
    label: "Redux Dark Color",
    mermaidTheme: "base",
    colors: createPresetColors(
      "#111722",
      "#edf1f8",
      "#1d2737",
      "#273247",
      "#8998f2",
      "#111722",
      "#53c9b5",
      "#46536a",
      "#aeb9ca",
    ),
  },
];

export function isMermaidThemePresetId(value: string): value is MermaidThemePresetId {
  return MERMAID_THEME_PRESETS.some((preset) => preset.id === value);
}

export function resolveMermaidThemePreset(
  id: MermaidThemePresetId,
  activeTheme: MermaidTheme,
): { mermaidTheme: NativeMermaidTheme; colors?: MermaidTheme; backgroundColor: string } {
  const preset = MERMAID_THEME_PRESETS.find((item) => item.id === id);
  if (!preset) {
    throw new Error(`Unknown Mermaid theme preset: ${id}`);
  }

  const colors = preset.colors ?? (id === "mermaid-chart" ? activeTheme : undefined);
  const nativeBackgrounds: Record<NativeMermaidTheme, string> = {
    default: "#ffffff",
    forest: "#ffffff",
    base: "#f4f4f4",
    dark: "#333333",
    neutral: "#f4f4f4",
  };

  return {
    mermaidTheme: preset.mermaidTheme,
    colors,
    backgroundColor: colors?.background ?? nativeBackgrounds[preset.mermaidTheme],
  };
}
