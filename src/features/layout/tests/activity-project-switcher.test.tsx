import { describe, expect, it } from "vitest";
import {
  getProjectNameFromPath,
  isRemoteProjectPath,
} from "@/features/workspace/services/project-tab-path";

describe("activity project switcher", () => {
  it("uses the shared project path rules for local and remote projects", () => {
    expect(getProjectNameFromPath("/Users/mehmet/Git/r0")).toBe("r0");
    expect(getProjectNameFromPath("C:\\Users\\mehmet\\r0")).toBe("r0");
    expect(getProjectNameFromPath()).toBe("Open Project");
    expect(isRemoteProjectPath("remote://server/workspace")).toBe(true);
    expect(isRemoteProjectPath("/Users/mehmet/Git/r0")).toBe(false);
  });
});
