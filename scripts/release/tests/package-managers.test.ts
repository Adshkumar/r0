import { describe, expect, it } from "vitest";
import {
  parseChecksums,
  renderScoopManifest,
  renderWingetManifests,
} from "../package-managers/manifests.mjs";

const x64 = "a".repeat(64);
const arm64 = "b".repeat(64);
const checksums = parseChecksums(
  `${x64}  R0_1.2.3_x64-setup.exe\n${arm64}  R0_1.2.3_arm64-setup.exe\n${"c".repeat(64)}  latest.json\n`,
);
const input = { tag: "v1.2.3", repo: "Adshkumar/r0", checksums, releaseDate: "2026-10-08" };

describe("package manager manifests", () => {
  it("reads SHA256SUMS lines", () => {
    expect(checksums.get("R0_1.2.3_x64-setup.exe")).toBe(x64);
    expect(parseChecksums(`${x64} *R0.exe`).get("R0.exe")).toBe(x64);
  });

  it("renders a winget manifest set for both NSIS installers", () => {
    const files = renderWingetManifests(input);

    expect(Object.keys(files)).toEqual([
      "Adshkumar.r0.yaml",
      "Adshkumar.r0.installer.yaml",
      "Adshkumar.r0.locale.en-US.yaml",
    ]);
    const installer = files["Adshkumar.r0.installer.yaml"];
    expect(installer).toContain("InstallerType: nullsoft");
    expect(installer).toContain(
      "InstallerUrl: https://github.com/Adshkumar/r0/releases/download/v1.2.3/R0_1.2.3_arm64-setup.exe",
    );
    expect(installer).toContain(`InstallerSha256: ${x64.toUpperCase()}`);
    expect(installer).toContain("ReleaseDate: 2026-10-08");
    expect(files["Adshkumar.r0.locale.en-US.yaml"]).toContain("Publisher: Adshkumar\n");
    expect(files["Adshkumar.r0.yaml"]).toMatch(/^# yaml-language-server: .+\nPackageIdentifier/);
  });

  it("renders a Scoop manifest that turns the in-app updater off", () => {
    const manifest = JSON.parse(renderScoopManifest(input)["r0.json"]);

    expect(manifest.version).toBe("1.2.3");
    expect(manifest.architecture["64bit"]).toEqual({
      url: "https://github.com/Adshkumar/r0/releases/download/v1.2.3/R0_1.2.3_x64-setup.exe#/dl.7z",
      hash: x64,
    });
    expect(manifest.autoupdate.architecture.arm64.url).toBe(
      "https://github.com/Adshkumar/r0/releases/download/v$version/R0_$version_arm64-setup.exe#/dl.7z",
    );
    expect(manifest.pre_install.join("\n")).toContain("managed-by-package-manager");
  });

  it("refuses beta releases", () => {
    expect(() => renderWingetManifests({ ...input, tag: "v1.2.4-beta.1" })).toThrow(
      "Expected a stable release tag",
    );
    expect(() => renderScoopManifest({ ...input, tag: "v1.2.4-beta.1" })).toThrow(
      "Expected a stable release tag",
    );
  });

  it("fails when an installer is missing from the checksums", () => {
    expect(() => renderScoopManifest({ ...input, tag: "v9.9.9" })).toThrow(
      "SHA256SUMS.txt has no entry for R0_9.9.9_x64-setup.exe",
    );
  });
});
