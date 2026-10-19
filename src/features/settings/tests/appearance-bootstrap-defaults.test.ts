import { describe, expect, it } from "vite-plus/test";
import { getR0DefaultColor, getR0DefaultSyntaxColor } from "@/extensions/themes/default-theme";
import {
  R0_BOOTSTRAP_DEFAULTS,
  DEFAULT_APPEARANCE_BOOTSTRAP_CACHE,
} from "../lib/appearance-bootstrap";

describe("appearance bootstrap defaults", () => {
  it("uses the bundled r0 dark theme for startup CSS variables", () => {
    expect(DEFAULT_APPEARANCE_BOOTSTRAP_CACHE.themeId).toBe("r0-dark");
    expect(DEFAULT_APPEARANCE_BOOTSTRAP_CACHE.themeType).toBe("dark");
    expect(DEFAULT_APPEARANCE_BOOTSTRAP_CACHE.windowTransparency).toBe(false);
    expect(DEFAULT_APPEARANCE_BOOTSTRAP_CACHE.cssVariables["--background"]).toBe(
      getR0DefaultColor("dark", "background"),
    );
    expect(DEFAULT_APPEARANCE_BOOTSTRAP_CACHE.syntaxTokens["--syntax-keyword"]).toBe(
      getR0DefaultSyntaxColor("dark", "keyword"),
    );
  });

  it("keeps bootstrap theme metadata aligned with r0 defaults", () => {
    expect(R0_BOOTSTRAP_DEFAULTS.light.colors.background).toBe(
      getR0DefaultColor("light", "background"),
    );
    expect(R0_BOOTSTRAP_DEFAULTS.dark.syntax.keyword).toBe(
      getR0DefaultSyntaxColor("dark", "keyword"),
    );
  });
});
