import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AvailableExtension } from "@/extensions/registry/extension-store-types";
import type { ExtensionManifest } from "@/extensions/types/extension-manifest";

const mocks = vi.hoisted(() => ({
  addInstalledLanguage: vi.fn(async () => {}),
  bundledManifests: new Map<string, unknown>(),
}));

vi.mock("@/extensions/installer/installed-languages", () => ({
  installedLanguages: { add: mocks.addInstalledLanguage },
}));
vi.mock("@/extensions/languages/language-packager", () => ({
  getLanguageExtensionById: (id: string) => mocks.bundledManifests.get(id),
}));

const { getExtensionManifestForLanguage, installLanguageExtensionManifest } =
  await import("@/extensions/runtime/language-extension-installation");

function manifest(id: string, languageIds: string[]): ExtensionManifest {
  return {
    id,
    name: id,
    displayName: id,
    description: id,
    version: "3.0.0",
    publisher: "R0",
    categories: ["Language"],
    languages: languageIds.map((languageId) => ({
      id: languageId,
      extensions: [`.${languageId}`],
    })),
  };
}

afterEach(() => {
  mocks.addInstalledLanguage.mockClear();
  mocks.bundledManifests.clear();
});

describe("language integration installation", () => {
  it("records every contributed language as installed without downloading anything", async () => {
    const onProgress = vi.fn();

    await installLanguageExtensionManifest(
      "r0.web",
      manifest("r0.web", ["css", "python"]),
      onProgress,
    );

    expect(mocks.addInstalledLanguage.mock.calls).toEqual([
      [{ languageId: "css", extensionId: "r0.web", version: "3.0.0" }],
      [{ languageId: "python", extensionId: "r0.web", version: "3.0.0" }],
    ]);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it("finds a language manifest from the catalog before the bundled packager", () => {
    const catalogManifest = manifest("r0.go", ["go"]);
    const bundled = manifest("bundled.go", ["go"]);
    mocks.bundledManifests.set("go", bundled);
    const available = new Map<string, AvailableExtension>([
      [
        "r0.go",
        { manifest: catalogManifest, isInstalled: false, isEnabled: true, isInstalling: false },
      ],
    ]);

    expect(getExtensionManifestForLanguage("r0.go", available, "go")).toBe(catalogManifest);
    expect(getExtensionManifestForLanguage("other.go", available, "go")).toBe(bundled);
  });
});
