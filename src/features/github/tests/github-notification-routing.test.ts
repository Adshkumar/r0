import { describe, expect, it } from "vite-plus/test";
import {
  buildGitHubRepositoryRef,
  getGitHubNotificationFallbackUrl,
  getGitHubNotificationTarget,
} from "../services/github-notification-routing";

const workflowNotification = {
  id: "notification-1",
  title: "CI workflow run",
  subjectType: "CheckSuite",
  reason: "ci_activity",
  unread: true,
  updatedAt: "2026-08-14T12:00:00Z",
  lastReadAt: null,
  repositoryFullName: "Adshkumar/r0",
  url: "https://github.com/Adshkumar/r0",
  subjectUrl: "https://api.github.com/repos/Adshkumar/r0/check-suites/501857806",
};

describe("GitHub notification repository routing", () => {
  it("rejects malformed repository names", () => {
    expect(buildGitHubRepositoryRef("Adshkumar/r0/extra")).toBeNull();
    expect(buildGitHubRepositoryRef("../r0")).toBeNull();
  });

  it("routes workflow and release fallbacks to their GitHub surfaces", () => {
    expect(
      getGitHubNotificationFallbackUrl({
        repositoryFullName: "Adshkumar/r0",
        subjectType: "CheckSuite",
        url: "https://github.com/Adshkumar/r0",
      }),
    ).toBe("https://github.com/Adshkumar/r0/actions");
    expect(
      getGitHubNotificationFallbackUrl({
        repositoryFullName: "Adshkumar/r0",
        subjectType: "Release",
        url: "https://github.com/Adshkumar/r0",
      }),
    ).toBe("https://github.com/Adshkumar/r0/releases");
  });

  it("routes unresolved workflow notifications to the native action viewer", () => {
    expect(getGitHubNotificationTarget(workflowNotification)).toEqual({
      type: "actionNotification",
      repoPath: "github://Adshkumar/r0",
      notification: {
        id: "notification-1",
        repositoryFullName: "Adshkumar/r0",
        checkSuiteId: 501857806,
        title: "CI workflow run",
        updatedAt: "2026-08-14T12:00:00Z",
      },
    });
  });

  it("preserves specific notification URLs", () => {
    expect(
      getGitHubNotificationFallbackUrl({
        repositoryFullName: "Adshkumar/r0",
        subjectType: "Discussion",
        url: "https://github.com/Adshkumar/r0/discussions/42",
      }),
    ).toBe("https://github.com/Adshkumar/r0/discussions/42");
  });
});
