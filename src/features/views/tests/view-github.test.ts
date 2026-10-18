import { describe, expect, it, vi } from "vitest";
import {
  buildProjectGitHubApiUrl,
  parseGitHubRepository,
  resolveProjectGitHubRepository,
} from "@/features/views/services/view-github";

describe("custom view GitHub integration", () => {
  it.each([
    ["https://github.com/Adshkumar/r0.git", { owner: "Adshkumar", repo: "r0" }],
    ["git@github.com:Adshkumar/r0.git", { owner: "Adshkumar", repo: "r0" }],
    ["github://Adshkumar/r0", { owner: "Adshkumar", repo: "r0" }],
  ])("parses GitHub repository references", (value, expected) => {
    expect(parseGitHubRepository(value)).toEqual(expected);
  });

  it("ignores remotes without a usable URL", () => {
    expect(parseGitHubRepository(undefined)).toBeNull();
    expect(parseGitHubRepository("")).toBeNull();
  });

  it("prefers the origin GitHub remote", async () => {
    const loadRemotes = vi.fn().mockResolvedValue([
      { name: "backup", url: "https://github.com/example/backup.git" },
      { name: "origin", url: "git@github.com:Adshkumar/r0.git" },
    ]);

    await expect(resolveProjectGitHubRepository("/projects/r0", loadRemotes)).resolves.toEqual({
      owner: "Adshkumar",
      repo: "r0",
    });
  });

  it("builds project-scoped API URLs and rejects unsafe paths", () => {
    const repository = { owner: "Adshkumar", repo: "r0" };

    expect(buildProjectGitHubApiUrl(repository, "/releases?per_page=100")).toBe(
      "https://api.github.com/repos/Adshkumar/r0/releases?per_page=100",
    );
    expect(() => buildProjectGitHubApiUrl(repository, "https://example.com/data")).toThrow(
      "invalid endpoint path",
    );
    expect(() => buildProjectGitHubApiUrl(repository, "/../other-repo")).toThrow(
      "invalid endpoint path",
    );
  });
});
