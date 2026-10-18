import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ExtensionManifest } from "../types/extension-manifest";
import {
  buildInstalledExtensionsMap,
  migrateBundledContributionInstallations,
} from "@/extensions/registry/extension-store-bootstrap";
import type { AvailableExtension } from "@/extensions/registry/extension-store-types";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

function createAvailableExtension(manifest: ExtensionManifest): AvailableExtension {
  return {
    manifest,
    isInstalled: false,
    isEnabled: false,
    isInstalling: false,
    runtimeIssues: [],
  };
}

describe("extension-store bootstrap", () => {
  afterEach(() => {
    mocks.invoke.mockReset();
    vi.unstubAllGlobals();
  });

  it("drops retired installed extensions before activation state is built", () => {
    const availableExtensions = new Map<string, AvailableExtension>([
      [
        "r0.theme.market",
        createAvailableExtension({
          id: "r0.theme.market",
          name: "R0 Themes",
          displayName: "R0 Theme Pack",
          description: "Retired theme pack",
          version: "1.0.0",
          publisher: "R0",
          categories: ["Theme"],
          themes: [
            {
              id: "market-light",
              name: "R0 Light",
              appearance: "light",
              colors: {},
              syntax: {},
            },
          ],
        }),
      ],
      [
        "r0.theme.vercel",
        createAvailableExtension({
          id: "r0.theme.vercel",
          name: "vercel",
          displayName: "Vercel Theme",
          description: "Vercel theme",
          version: "1.0.0",
          publisher: "R0",
          categories: ["Theme"],
          installation: {
            downloadUrl:
              "https://adshkumar.is-a.dev/extensions/packages/theme/vercel/r0.theme.vercel.tar.gz",
            size: 100,
            checksum: "checksum",
          },
          themes: [
            {
              id: "vercel-light",
              name: "Vercel Light",
              appearance: "light",
              colors: {},
              syntax: {},
            },
          ],
        }),
      ],
    ]);

    const installedExtensions = buildInstalledExtensionsMap({
      backendInstalled: [
        {
          id: "r0.theme.market",
          name: "R0 Theme Pack",
          version: "1.0.0",
          installed_at: "2026-07-08T00:00:00.000Z",
          enabled: true,
        },
      ],
      installedLanguageEntries: [
        { languageId: "r0.theme.market", version: "1.0.0", installedAt: 0 },
      ],
      availableExtensions,
    });

    expect(installedExtensions.has("r0.theme.market")).toBe(false);
    expect(installedExtensions.has("r0.theme.vercel")).toBe(false);
  });

  it("migrates installed bundled contributions to downloaded extension packages", async () => {
    const values = new Map([
      ["r0.installedBundledContributionExtensions", JSON.stringify(["r0.ai.v0"])],
    ]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    const manifest: ExtensionManifest = {
      id: "r0.ai.v0",
      name: "v0",
      displayName: "v0",
      description: "External v0 provider",
      version: "1.0.0",
      publisher: "R0",
      categories: ["AI"],
      installation: {
        downloadUrl: "https://adshkumar.is-a.dev/extensions/packages/ai/v0/r0.ai.v0.tar.gz",
        size: 100,
        checksum: "checksum",
      },
    };
    const installed = {
      id: manifest.id,
      name: manifest.displayName,
      version: manifest.version,
      installed_at: "2026-08-30T00:00:00.000Z",
      enabled: true,
    };
    mocks.invoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce([installed]);

    await expect(
      migrateBundledContributionInstallations(
        new Map([[manifest.id, createAvailableExtension(manifest)]]),
        [],
      ),
    ).resolves.toEqual([installed]);
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "install_extension", {
      extensionId: manifest.id,
      url: manifest.installation?.downloadUrl,
      checksum: manifest.installation?.checksum,
      size: manifest.installation?.size,
    });
    expect(values.get("r0.installedBundledContributionExtensions")).toBe("[]");
  });
});
