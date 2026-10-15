export type ThemeType = "dark" | "light";

export interface r0Theme {
  name: string;
  type: ThemeType;
  contrast?: "normal" | "high";
  extends?: string;
  colors: Record<string, string>;
}
