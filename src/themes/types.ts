export type ThemeType = "dark" | "light";

export interface r0Theme {
  name: string;
  type: ThemeType;
  colors: Record<string, string>;
}
