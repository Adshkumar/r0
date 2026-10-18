import { describe, expect, it } from "vite-plus/test";
import {
  buildPRBufferPath,
  isGitHubEntityLinkForRepository,
  isPRFilesViewPath,
  parseGitHubCheckSuiteId,
  parseGitHubEntityLink,
} from "../utils/github-link-utils";

describe("parseGitHubEntityLink", () => {
  it("parses pull request links with extra path segments and fragments", () => {
    expect(
      parseGitHubEntityLink("https://github.com/Adshkumar/r0/pull/568/files#diff-123"),
    ).toMatchObject({
      kind: "pullRequest",
      owner: "Adshkumar",
      repo: "r0",
      number: 568,
    });
  });

  it("parses issue links with trailing slashes", () => {
    expect(parseGitHubEntityLink("https://github.com/Adshkumar/r0/issues/570/")).toMatchObject({
      kind: "issue",
      owner: "Adshkumar",
      repo: "r0",
      number: 570,
    });
  });

  it("parses action run links", () => {
    expect(
      parseGitHubEntityLink("https://github.com/Adshkumar/r0/actions/runs/23614391340"),
    ).toMatchObject({
      kind: "actionRun",
      owner: "Adshkumar",
      repo: "r0",
      runId: 23614391340,
    });
  });

  it("parses commit links", () => {
    expect(
      parseGitHubEntityLink(
        "https://github.com/Adshkumar/r0/commit/a507c60d7efaf08ec9823e16cf937a731ed2756d",
      ),
    ).toMatchObject({
      kind: "commit",
      owner: "Adshkumar",
      repo: "r0",
      sha: "a507c60d7efaf08ec9823e16cf937a731ed2756d",
    });
  });

  it("accepts www.github.com links", () => {
    expect(parseGitHubEntityLink("https://www.github.com/Adshkumar/r0/pull/568")).toMatchObject({
      kind: "pullRequest",
      owner: "Adshkumar",
      repo: "r0",
      number: 568,
    });
  });

  it("rejects non-GitHub hosts and malformed entity ids", () => {
    expect(parseGitHubEntityLink("https://example.com/Adshkumar/r0/pull/568")).toBeNull();
    expect(parseGitHubEntityLink("https://github.com/Adshkumar/r0/pull/not-a-number")).toBeNull();
  });

  it("matches entity links to their repository", () => {
    const entityLink = parseGitHubEntityLink("https://github.com/Adshkumar/r0/issues/714");

    expect(entityLink).not.toBeNull();
    if (!entityLink) return;

    expect(isGitHubEntityLinkForRepository(entityLink, "https://github.com/Adshkumar/r0")).toBe(
      true,
    );
    expect(isGitHubEntityLinkForRepository(entityLink, "https://github.com/Adshkumar/www")).toBe(
      false,
    );
    expect(isGitHubEntityLinkForRepository(entityLink, "git@github.com:Adshkumar/r0.git")).toBe(
      true,
    );
  });
});

describe("parseGitHubCheckSuiteId", () => {
  it("reads check-suite notification API URLs", () => {
    expect(
      parseGitHubCheckSuiteId("https://api.github.com/repos/Adshkumar/r0/check-suites/501857806"),
    ).toBe(501857806);
  });

  it("rejects unrelated URLs", () => {
    expect(parseGitHubCheckSuiteId("https://github.com/Adshkumar/r0/actions")).toBeNull();
  });
});

describe("pull request buffer paths", () => {
  it("builds and recognizes a changed-files overview path", () => {
    const path = buildPRBufferPath(714, null, "files");

    expect(path).toBe("pr://714?view=files");
    expect(isPRFilesViewPath(path)).toBe(true);
  });

  it("recognizes selected-file paths as the files view", () => {
    const path = buildPRBufferPath(714, "src/app.tsx");

    expect(isPRFilesViewPath(path)).toBe(true);
    expect(isPRFilesViewPath(buildPRBufferPath(714))).toBe(false);
  });
});
