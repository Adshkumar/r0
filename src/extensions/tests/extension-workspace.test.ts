import { describe, expect, it } from "vite-plus/test";
import {
  createDeployableExtensionManifest,
  getReservedBuiltInThemeContribution,
  inspectExtensionPackageLayout,
} from "../../../extensions/tooling/extension-workspace";

describe("extension workspace theme ownership", () => {
  it("reserves R0 default theme identities for built-in themes", () => {
    expect(
      getReservedBuiltInThemeContribution({
        id: "market-light",
        name: "R0 Light",
      }),
    ).toEqual({ id: "market-light", name: "r0 light" });

    expect(
      getReservedBuiltInThemeContribution({
        id: "r0-dark",
        name: "Custom Dark",
      }),
    ).toEqual({ id: "r0-dark", name: "custom dark" });
  });

  it("allows non-R0 marketplace theme identities", () => {
    expect(
      getReservedBuiltInThemeContribution({
        id: "vercel-light",
        name: "Vercel Light",
      }),
    ).toBeNull();
  });
});

describe("extension artifact metadata", () => {
  it("adds installation metadata without mutating the source manifest", () => {
    const source = { id: "r0.example", name: "Example" };
    const installation = {
      downloadUrl: "https://adshkumar.is-a.dev/extensions/example.tar.gz",
      size: 42,
      checksum: "checksum",
    };

    expect(
      createDeployableExtensionManifest(source, {
        version: 1,
        installations: { "r0.example": installation },
      }),
    ).toEqual({ ...source, installation });
    expect(source).toEqual({ id: "r0.example", name: "Example" });
  });
});

describe("extension package layout", () => {
  it("keeps every package in a declared kebab-case folder", async () => {
    await expect(inspectExtensionPackageLayout()).resolves.toEqual([]);
  });
});
