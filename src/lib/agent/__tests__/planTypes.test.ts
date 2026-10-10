import { describe, it, expect } from "vitest";
import { parsePlan } from "../planTypes";

const step = (file: string, action: string, description: string) =>
  `<step file="${file}" action="${action}">${description}</step>`;

describe("parsePlan", () => {
  it("returns null when no <r0-plan> block is present", () => {
    expect(parsePlan("just some text with no plan")).toBeNull();
    expect(parsePlan("")).toBeNull();
  });

  it("returns null when the block has no steps", () => {
    expect(parsePlan("<r0-plan><title>Empty</title></r0-plan>")).toBeNull();
    expect(parsePlan("<r0-plan></r0-plan>")).toBeNull();
  });

  it("parses a minimal valid plan", () => {
    const xml = `<r0-plan><title>Add auth</title>${step("src/auth.ts", "edit", "Add login function")}</r0-plan>`;
    const result = parsePlan(xml);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Add auth");
    expect(result!.steps).toHaveLength(1);
    expect(result!.steps[0]).toEqual({ file: "src/auth.ts", action: "edit", description: "Add login function" });
    expect(result!.rawXml).toBe(xml);
  });

  it("falls back to 'Proposed changes' when <title> is absent", () => {
    const xml = `<r0-plan>${step("a.ts", "create", "make it")}</r0-plan>`;
    const result = parsePlan(xml);
    expect(result!.title).toBe("Proposed changes");
  });

  it("parses multiple steps with all action types", () => {
    const xml = `<r0-plan>
      <title>Multi-step</title>
      ${step("src/a.ts", "edit", "Edit A")}
      ${step("src/b.ts", "create", "Create B")}
      ${step("src/c.ts", "delete", "Delete C")}
    </r0-plan>`;
    const result = parsePlan(xml);
    expect(result!.steps).toHaveLength(3);
    expect(result!.steps[0].action).toBe("edit");
    expect(result!.steps[1].action).toBe("create");
    expect(result!.steps[2].action).toBe("delete");
  });

  it("trims whitespace from title and description", () => {
    const xml = `<r0-plan><title>  My Plan  </title>${step("a.ts", "edit", "  do it  ")}</r0-plan>`;
    const result = parsePlan(xml);
    expect(result!.title).toBe("My Plan");
    expect(result!.steps[0].description).toBe("do it");
  });

  it("extracts the block when surrounded by other content", () => {
    const inner = `<r0-plan><title>T</title>${step("a.ts", "delete", "remove")}</r0-plan>`;
    const content = `Here is my analysis.\n\n${inner}\n\nDone!`;
    const result = parsePlan(content);
    expect(result).not.toBeNull();
    expect(result!.rawXml).toBe(inner);
    expect(result!.title).toBe("T");
  });

  it("rawXml contains only the plan tag, not surrounding text", () => {
    const plan = `<r0-plan><title>X</title>${step("x.ts", "edit", "x")}</r0-plan>`;
    const result = parsePlan(`preamble ${plan} postamble`);
    expect(result!.rawXml).toBe(plan);
  });

  it("handles multi-line descriptions inside steps", () => {
    const xml = `<r0-plan><title>T</title><step file="a.ts" action="edit">line1\nline2</step></r0-plan>`;
    const result = parsePlan(xml);
    expect(result!.steps[0].description).toBe("line1\nline2");
  });

  it("stops at first plan block when multiple are present", () => {
    const xml =
      `<r0-plan><title>First</title>${step("a.ts", "edit", "a")}</r0-plan>` +
      `<r0-plan><title>Second</title>${step("b.ts", "edit", "b")}</r0-plan>`;
    const result = parsePlan(xml);
    expect(result!.title).toBe("First");
  });
});
