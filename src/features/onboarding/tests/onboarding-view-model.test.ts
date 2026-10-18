import { describe, expect, it } from "vite-plus/test";
import { buildOnboardingViewModel } from "../lib/onboarding-view-model";

describe("buildOnboardingViewModel", () => {
  it("keeps first-run onboarding on setup defaults", () => {
    expect(
      buildOnboardingViewModel({
        mode: "first-run",
        currentVersion: "1.2.0",
      }),
    ).toMatchObject({
      title: "Welcome to r0",
      showSettings: true,
      primaryAction: "open-folder",
    });
  });

  it("uses the same release surface when What's New is opened manually", () => {
    expect(
      buildOnboardingViewModel({
        mode: "release-notes",
        currentVersion: "1.2.0",
      }),
    ).toMatchObject({
      title: "What's new in r0 1.2.0",
      showSettings: false,
      primaryAction: "finish",
      primaryLabel: "Done",
    });
  });
});
