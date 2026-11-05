import { describe, expect, it } from "vite-plus/test";
import { calculateResponsiveFontSize } from "../engines/codemirror/responsive-font-size";

describe("calculateResponsiveFontSize", () => {
  it("keeps the configured font size when the longest line fits", () => {
    expect(calculateResponsiveFontSize(16, 800, 8, 80)).toBe(16);
  });

  it("shrinks the font size to fit the available editor width", () => {
    expect(calculateResponsiveFontSize(16, 600, 8, 100)).toBe(12);
  });

  it("stops shrinking at the readable minimum", () => {
    expect(calculateResponsiveFontSize(16, 300, 8, 100)).toBe(10);
  });
});
