import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AvailableExtension } from "@/extensions/registry/extension-store-types";
import type {
  BundledExtension,
  ExtensionManifest,
  LanguageContribution,
} from "@/extensions/types/extension-manifest";

const mocks = vi.hoisted(() => ({
  subscription: null as unknown,
  bundled: [] as BundledExtension[],
}));

vi.mock("@/features/auth/stores/auth.store", () => ({
  useAuthStore: { getState: () => ({ subscription: mocks.subscription }) },
}));
vi.mock("@/extensions/registry/extension-registry", () => ({
  extensionRegistry: { getAllExtensions: () => mocks.bundled },
}));

const {
  findExtensionForFile,
  isExtensionAllowedByEnterprisePolicy,
  mergeMarketplaceLanguageExtensions,
} = await import("@/extensions/registry/extension-store-helpers");
const { resolveInstalledExtensionId } =
  await import("@/extensions/registry/installed-extension-resolution");

function language(id: string, extensions: string[], extra: Partial<LanguageContribution> = {}) {
  return { id, extensions, ...extra } as LanguageContribution;
}

function manifest(id: string, extra: Partial<ExtensionManifest> = {}): ExtensionManifest {
  return {
    id,
    name: id,
    displayName: id,
    description: `${id} integration`,
    version: "1.0.0",
    publisher: "R0",
    categories: ["Language"],
    ...extra,
  };
}

function available(...manifests: ExtensionManifest[]): Map<string, AvailableExtension> {
  return new Map(
    manifests.map((item) => [
      item.id,
      { manifest: item, isInstalled: false, isEnabled: true, isInstalling: false },
    ]),
  );
}

afterEach(() => {
  mocks.subscription = null;
  mocks.bundled = [];
});

describe("enterprise integration policy", () => {
  it("allows everything without a managed enterprise allowlist", () => {
    expect(isExtensionAllowedByEnterprisePolicy("r0.rust")).toBe(true);

    mocks.subscription = {
      enterprise: {
        has_access: true,
        policy: { managedMode: true, requireExtensionAllowlist: false },
      },
    };
    expect(isExtensionAllowedByEnterprisePolicy("r0.rust")).toBe(true);

    mocks.subscription = {
      enterprise: {
        has_access: false,
        policy: { managedMode: true, requireExtensionAllowlist: true },
      },
    };
    expect(isExtensionAllowedByEnterprisePolicy("r0.rust")).toBe(true);
  });

  it("only allows listed integrations, ignoring case and whitespace", () => {
    mocks.subscription = {
      enterprise: {
        has_access: true,
        policy: {
          managedMode: true,
          requireExtensionAllowlist: true,
          allowedExtensionIds: [" R0.Rust "],
        },
      },
    };

    expect(isExtensionAllowedByEnterprisePolicy("r0.rust")).toBe(true);
    expect(isExtensionAllowedByEnterprisePolicy("r0.go")).toBe(false);
  });

  it("blocks everything when the allowlist is required but missing", () => {
    mocks.subscription = {
      enterprise: {
        has_access: true,
        policy: { managedMode: true, requireExtensionAllowlist: true },
      },
    };

    expect(isExtensionAllowedByEnterprisePolicy("r0.rust")).toBe(false);
  });
});

describe("marketplace language merging", () => {
  it("folds the hidden TSX extension into TypeScript", () => {
    const typescript = manifest("r0.typescript", {
      languages: [language("typescript", [".ts"])],
    });
    const tsx = manifest("r0.tsx", {
      languages: [
        language("typescriptreact", [".tsx"], { aliases: ["TSX"] }),
        language("typescript", [".mts"]),
      ],
    });
    const rust = manifest("r0.rust", { languages: [language("rust", [".rs"])] });

    const merged = mergeMarketplaceLanguageExtensions([typescript, tsx, rust]);

    expect(merged.map((item) => item.id)).toEqual(["r0.typescript", "r0.rust"]);
    expect(merged[0]?.languages?.map((item) => item.id)).toEqual(["typescript", "typescriptreact"]);
    expect(merged[0]?.activationEvents).toEqual([
      "onLanguage:typescript",
      "onLanguage:typescriptreact",
    ]);
    expect(merged[1]).toBe(rust);
  });

  it("hides TSX even when there is no TypeScript extension to merge into", () => {
    const tsx = manifest("r0.tsx", { languages: [language("typescriptreact", [".tsx"])] });

    expect(mergeMarketplaceLanguageExtensions([tsx])).toEqual([]);
  });
});

describe("finding the integration for a file", () => {
  it("matches marketplace integrations by extension, file name, and pattern", () => {
    const extensions = available(
      manifest("r0.rust", { languages: [language("rust", [".rs"])] }),
      manifest("r0.docker", {
        languages: [language("dockerfile", [], { filenames: ["Dockerfile"] })],
      }),
      manifest("r0.env", {
        languages: [language("dotenv", [], { filenamePatterns: [".env.*"] })],
      }),
    );

    expect(findExtensionForFile("/repo/src/MAIN.RS", extensions)?.manifest.id).toBe("r0.rust");
    expect(findExtensionForFile("/repo/Dockerfile", extensions)?.manifest.id).toBe("r0.docker");
    expect(findExtensionForFile("/repo/.env.local", extensions)?.manifest.id).toBe("r0.env");
    expect(findExtensionForFile("/repo/notes.txt", extensions)).toBeUndefined();
  });

  it("falls back to bundled integrations, reported as installed and enabled", () => {
    const markdown = manifest("r0.markdown", { languages: [language("markdown", [".md"])] });
    mocks.bundled = [
      {
        manifest: markdown,
        path: "/bundled/markdown",
        isBundled: true,
        isEnabled: true,
        state: "installed",
      },
    ];

    expect(findExtensionForFile("C:\\repo\\README.md", new Map())).toEqual({
      manifest: markdown,
      isInstalled: true,
      isEnabled: true,
      isInstalling: false,
    });
  });
});

describe("resolving installed language integrations", () => {
  const extensions = available(
    manifest("r0.python", { languages: [language("python", [".py"])] }),
    manifest("community.zig", { languages: [language("zig", [".zig"])] }),
  );

  it("prefers the recorded extension id, with or without the -full suffix", () => {
    expect(
      resolveInstalledExtensionId(
        { languageId: "python", extensionId: "r0.python" },
        extensions,
      ),
    ).toBe("r0.python");
    expect(
      resolveInstalledExtensionId(
        { languageId: "python", extensionId: "r0.python-full" },
        extensions,
      ),
    ).toBe("r0.python");
  });

  it("finds the integration that contributes the language when ids changed", () => {
    expect(resolveInstalledExtensionId({ languageId: "zig" }, extensions)).toBe("community.zig");
    expect(resolveInstalledExtensionId({ languageId: "python" }, extensions)).toBe("r0.python");
  });

  it("keeps the recorded id, or derives one, for unknown languages", () => {
    expect(
      resolveInstalledExtensionId({ languageId: "cobol", extensionId: "legacy.cobol" }, extensions),
    ).toBe("legacy.cobol");
    expect(resolveInstalledExtensionId({ languageId: "cobol" }, extensions)).toBe("r0.cobol");
  });
});
