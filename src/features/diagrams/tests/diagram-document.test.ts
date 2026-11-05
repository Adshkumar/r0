// @vitest-environment jsdom

import { describe, expect, it } from "vite-plus/test";
import {
  DIAGRAM_TEMPLATES,
  extractMermaidProposal,
  isMermaidDiagramPath,
  normalizeGeneratedDiagram,
  shouldConfirmTemplateReplacement,
} from "../services/diagram-document";
import { validateMermaidSource } from "../services/mermaid-renderer";

describe("Mermaid diagram documents", () => {
  it("recognizes Mermaid source extensions case-insensitively on Windows and POSIX paths", () => {
    expect(isMermaidDiagramPath("C:\\project\\architecture.MMD")).toBe(true);
    expect(isMermaidDiagramPath("/workspace/flows.mermaid")).toBe(true);
    expect(isMermaidDiagramPath("/workspace/flows.md")).toBe(false);
    expect(isMermaidDiagramPath("/workspace/flows.mmd.txt")).toBe(false);
  });

  it("provides unique, non-empty starter templates", () => {
    expect(new Set(DIAGRAM_TEMPLATES.map(({ id }) => id)).size).toBe(DIAGRAM_TEMPLATES.length);
    expect(DIAGRAM_TEMPLATES.map(({ id }) => id)).toContain("flowchart");
    for (const template of DIAGRAM_TEMPLATES) {
      expect(template.label).not.toBe("");
      expect(template.category).not.toBe("");
      expect(template.description).not.toBe("");
      expect(template.content).not.toBe("");
    }
  });

  it("provides valid Mermaid source for every template", async () => {
    for (const template of DIAGRAM_TEMPLATES) {
      await expect(
        validateMermaidSource(template.content),
        template.label,
      ).resolves.toBeUndefined();
    }
  }, 180_000);

  it("requires confirmation before replacing any different non-empty source", () => {
    expect(shouldConfirmTemplateReplacement("", "flowchart TD\n  A --> B")).toBe(false);
    expect(
      shouldConfirmTemplateReplacement("flowchart TD\n  A --> B", "flowchart TD\n  A --> B"),
    ).toBe(false);
    expect(shouldConfirmTemplateReplacement(" ", "flowchart TD\n  A --> B")).toBe(true);
    expect(shouldConfirmTemplateReplacement("flowchart TD\n  A --> B", "sequenceDiagram")).toBe(
      true,
    );
  });

  it("strips only a complete Mermaid code fence from generated text", () => {
    expect(normalizeGeneratedDiagram("```mermaid\nflowchart TD\n  A --> B\n```")).toBe(
      "flowchart TD\n  A --> B",
    );
    expect(normalizeGeneratedDiagram("flowchart TD\n  A --> B")).toBe("flowchart TD\n  A --> B");
    expect(normalizeGeneratedDiagram("```mermaid\nincomplete")).toBe("```mermaid\nincomplete");
  });

  it("extracts the last complete Mermaid code block as a reviewable proposal", () => {
    expect(
      extractMermaidProposal(
        "Here is the revised diagram:\n```mermaid\nflowchart TD\n  A --> B\n```\nDone.",
      ),
    ).toBe("flowchart TD\n  A --> B");
    expect(extractMermaidProposal("```typescript\nconst x = 1;\n```")).toBeNull();
    expect(extractMermaidProposal("```mermaid\nincomplete")).toBeNull();
  });
});
