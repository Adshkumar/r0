// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  markBundledContributionExtensionUninstalled,
  readInstalledBundledContributionExtensionIds,
} from "@/extensions/registry/bundled-contribution-install-state";
import {
  markExtensionDisabled,
  markExtensionEnabled,
  readDisabledExtensionIds,
} from "@/extensions/registry/extension-enabled-state";

afterEach(() => {
  localStorage.clear();
});

describe("disabled integration state", () => {
  it("starts with every integration enabled", () => {
    expect(readDisabledExtensionIds()).toEqual(new Set());
  });

  it("remembers disabled integrations and re-enables them", () => {
    markExtensionDisabled("r0.rust");
    markExtensionDisabled("r0.go");
    markExtensionDisabled("r0.rust");

    expect(readDisabledExtensionIds()).toEqual(new Set(["r0.go", "r0.rust"]));
    expect(localStorage.getItem("r0.disabledExtensions")).toBe('["r0.go","r0.rust"]');

    markExtensionEnabled("r0.rust");
    expect(readDisabledExtensionIds()).toEqual(new Set(["r0.go"]));
  });

  it("recovers from corrupt or unexpected stored values", () => {
    localStorage.setItem("r0.disabledExtensions", "{not json");
    expect(readDisabledExtensionIds()).toEqual(new Set());

    localStorage.setItem("r0.disabledExtensions", '{"r0.rust":true}');
    expect(readDisabledExtensionIds()).toEqual(new Set());

    localStorage.setItem("r0.disabledExtensions", '["r0.rust", "", 42, null]');
    expect(readDisabledExtensionIds()).toEqual(new Set(["r0.rust"]));
  });
});

describe("bundled contribution install state", () => {
  it("drops an uninstalled bundled integration and keeps the rest", () => {
    localStorage.setItem(
      "r0.installedBundledContributionExtensions",
      '["r0.postgres", "r0.sqlite", 7]',
    );

    markBundledContributionExtensionUninstalled("r0.postgres");

    expect(readInstalledBundledContributionExtensionIds()).toEqual(new Set(["r0.sqlite"]));
  });

  it("treats corrupt storage as nothing installed", () => {
    localStorage.setItem("r0.installedBundledContributionExtensions", "[");

    expect(readInstalledBundledContributionExtensionIds()).toEqual(new Set());
  });
});
