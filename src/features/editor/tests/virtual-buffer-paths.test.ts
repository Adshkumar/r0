import { describe, expect, it } from "vitest";
import { getViewBufferPath } from "@/features/editor/services/virtual-buffer-paths";

describe("view buffer paths", () => {
  it("keeps setup tabs project-scoped", () => {
    expect(getViewBufferPath("/projects/r0")).toBe("view://create/%2Fprojects%2Fr0");
  });

  it("gives each saved view a stable tab path", () => {
    expect(getViewBufferPath("/projects/r0", "release-downloads")).toBe(
      "view://%2Fprojects%2Fr0/release-downloads",
    );
  });
});
