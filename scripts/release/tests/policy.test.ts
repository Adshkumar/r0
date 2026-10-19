import { describe, expect, it } from "vitest";
import {
  forbiddenAssetPatterns,
  normalizedArtifactName,
  requiredAssets,
  stableVersionFromTag,
  versionFromTag,
} from "../assets/policy.mjs";

describe("release asset policy", () => {
  it("derives the version from release tags", () => {
    expect(versionFromTag("v1.2.3")).toBe("1.2.3");
    expect(() => versionFromTag("1.2.3")).toThrow("Invalid release tag");
    expect(() => versionFromTag("v1.2.3-preview.4")).toThrow("Invalid release tag");
  });

  it("accepts beta tags and keeps package managers on stable releases", () => {
    expect(versionFromTag("v1.2.3-beta.4")).toBe("1.2.3-beta.4");
    expect(() => versionFromTag("v1.2.3-beta.0")).toThrow("Invalid release tag");
    expect(() => versionFromTag("v1.2.3-beta")).toThrow("Invalid release tag");
    expect(stableVersionFromTag("v1.2.3")).toBe("1.2.3");
    expect(() => stableVersionFromTag("v1.2.3-beta.4")).toThrow("Expected a stable release tag");
  });

  it("matches beta asset names exactly", () => {
    const assets = requiredAssets("1.2.3-beta.4");
    const matches = (name: string) => assets.some((asset) => asset.pattern.test(name));

    expect(matches("R0_1.2.3-beta.4_x64-setup.exe")).toBe(true);
    expect(matches("R0_1.2.3-beta.4_x64_en-US.msi")).toBe(true);
    expect(matches("R0-1.2.3-beta.4-1.x86_64.rpm")).toBe(true);
    expect(matches("R0-1.2.3~beta.4-1.x86_64.rpm")).toBe(true);
    expect(matches("R0_1.2.3-betaX4_x64-setup.exe")).toBe(false);
    expect(matches("R0_1.2.3_x64-setup.exe")).toBe(false);
  });

  it("normalizes architecture-specific macOS updater names", () => {
    expect(
      normalizedArtifactName("/target/aarch64-apple-darwin/R0.app.tar.gz", "R0.app.tar.gz"),
    ).toBe("R0_aarch64.app.tar.gz");
    expect(
      normalizedArtifactName("/target/x86_64-apple-darwin/R0.app.tar.gz.sig", "R0.app.tar.gz.sig"),
    ).toBe("R0_x64.app.tar.gz.sig");
  });

  it("requires the supported release matrix and rejects unsupported packages", () => {
    const assets = requiredAssets("1.2.3");

    expect(assets).toHaveLength(16);
    expect(assets.some((asset) => asset.pattern.test("R0_1.2.3_amd64.deb"))).toBe(true);
    expect(assets.some((asset) => asset.pattern.test("R0-1.2.3-1.x86_64.rpm"))).toBe(true);
    expect(assets.some((asset) => asset.pattern.test("R0_1.2.3_x64_en-US.msi"))).toBe(true);
    expect(assets.some((asset) => asset.pattern.test("R0_1.2.3_amd64.AppImage"))).toBe(true);
    expect(assets.some((asset) => asset.pattern.test("R0_1.2.3_linux-aarch64.flatpak"))).toBe(
      false,
    );
    expect(assets.some((asset) => asset.pattern.test("R0_1.2.3_linux-x86_64.tar.gz"))).toBe(true);
    expect(
      forbiddenAssetPatterns("1.2.3").some((pattern) =>
        pattern.test("R0_1.2.3_x64-setup-machine.exe"),
      ),
    ).toBe(true);
  });
});
