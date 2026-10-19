import { describe, expect, it } from "vitest";
import {
  getNewProjectPath,
  getProjectNameError,
  getStarterCommand,
  inferProjectNameFromRepositoryUrl,
} from "../project-picker/utils/new-project-model";

describe("new project model", () => {
  it("validates portable project names", () => {
    expect(getProjectNameError("r0-app")).toBeNull();
    expect(getProjectNameError("../r0")).toBe(
      "Project names cannot contain path separators or reserved characters.",
    );
    expect(getProjectNameError("CON")).toBe(
      "Choose a project name that is supported on every platform.",
    );
    expect(getProjectNameError("r0.")).toBe("Project names cannot end with a period or space.");
  });

  it("infers project names from common repository URLs", () => {
    expect(inferProjectNameFromRepositoryUrl("https://github.com/Adshkumar/r0.git")).toBe("r0");
    expect(inferProjectNameFromRepositoryUrl("git@github.com:Adshkumar/r0.git")).toBe("r0");
    expect(inferProjectNameFromRepositoryUrl("https://example.com/my%20project/")).toBe(
      "my project",
    );
  });

  it("builds the destination path with the location separator", () => {
    expect(getNewProjectPath("/Users/mehmet/Code", "r0")).toBe("/Users/mehmet/Code/r0");
    expect(getNewProjectPath("C:\\Users\\mehmet\\Code", "r0")).toBe("C:\\Users\\mehmet\\Code\\r0");
  });

  it("builds fixed starter commands for the selected package manager", () => {
    expect(getStarterCommand("nextjs", "pnpm")).toContain("pnpm dlx create-next-app@latest .");
    expect(getStarterCommand("nextjs", "pnpm")).toContain("--use-pnpm");
    expect(getStarterCommand("vite-react", "bun")).toBe(
      "bun create vite@latest . --template react-ts && bun install",
    );
  });
});
