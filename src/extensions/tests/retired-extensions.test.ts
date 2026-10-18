import { describe, expect, it } from "vite-plus/test";
import {
  filterRetiredExtensions,
  isRetiredExtensionId,
} from "@/extensions/registry/retired-extensions";

describe("retired extensions", () => {
  it("retires the marketplace R0 theme pack", () => {
    expect(isRetiredExtensionId("r0.theme.market")).toBe(true);
    expect(isRetiredExtensionId("r0.theme.vercel")).toBe(false);
  });

  it("filters retired extensions from marketplace and installed extension lists", () => {
    expect(
      filterRetiredExtensions([
        { id: "r0.theme.market", name: "R0 Theme Pack" },
        { id: "r0.theme.vercel", name: "Vercel Theme" },
      ]),
    ).toEqual([{ id: "r0.theme.vercel", name: "Vercel Theme" }]);
  });
});
