import { describe, expect, it } from "vite-plus/test";
import {
  getSequenceDiagramCorrection,
  getRenderableMermaidSource,
  hasMermaidDeclaration,
  needsSequenceDiagramDeclaration,
  normalizeMermaidSource,
} from "../services/mermaid-source";

describe("Mermaid source inspection", () => {
  it("preserves leading directives, comments, and whitespace while normalizing line endings", () => {
    const source =
      '\uFEFF\n%% diagram comment\r\n%%{init: {"theme":"base"}}%%\r\n sequenceDiagram\r\n  autonumber';
    expect(normalizeMermaidSource(source)).toBe(
      '\n%% diagram comment\n%%{init: {"theme":"base"}}%%\n sequenceDiagram\n  autonumber',
    );
    expect(hasMermaidDeclaration(source)).toBe(true);
  });

  it("extracts a complete Mermaid Markdown fence for the parser", () => {
    expect(normalizeMermaidSource("```mermaid\nsequenceDiagram\n  A->>B: Request\n```")).toBe(
      "sequenceDiagram\n  A->>B: Request",
    );
  });

  it("detects sequence-only syntax without mistaking ordinary prose or flowcharts", () => {
    expect(
      needsSequenceDiagramDeclaration(
        "actor User\nparticipant API\nUser->>API: Send request\nactivate API",
      ),
    ).toBe(true);
    expect(needsSequenceDiagramDeclaration("A->>B: Request\nactivate B")).toBe(true);
    expect(needsSequenceDiagramDeclaration("A user participates in a normal workflow")).toBe(false);
    expect(
      needsSequenceDiagramDeclaration(
        "flowchart LR\n  actor[An actor] --> participant[API participant]",
      ),
    ).toBe(false);
  });

  it("inserts a missing sequence declaration without changing existing lines", () => {
    const source = "%% keep this comment\nactor User\nparticipant API\nUser->>API: Request";
    expect(getSequenceDiagramCorrection(source)).toBe(
      "%% keep this comment\nsequenceDiagram\nactor User\nparticipant API\nUser->>API: Request",
    );
    expect(getSequenceDiagramCorrection("sequenceDiagram\nactor User\nUser->>API: Request")).toBe(
      null,
    );
  });

  it("corrects a malformed sequence declaration only when explicitly requested", () => {
    expect(getSequenceDiagramCorrection("sequence diagram\nactor User\nUser->>API: Request")).toBe(
      "sequenceDiagram\nactor User\nUser->>API: Request",
    );
  });

  it("inserts the declaration inside Mermaid code fences", () => {
    expect(
      getSequenceDiagramCorrection(
        "```mermaid\nactor User\nparticipant API\nUser->>API: Request\n```",
      ),
    ).toBe("```mermaid\nsequenceDiagram\nactor User\nparticipant API\nUser->>API: Request\n```");
  });

  it("keeps Mermaid directives ahead of an inferred sequence declaration", () => {
    const source =
      '%%{init: {"sequence": {"showSequenceNumbers": true}}}%%\nA->>B: Request\nactivate B';
    expect(getRenderableMermaidSource(source)).toBe(
      '%%{init: {"sequence": {"showSequenceNumbers": true}}}%%\nsequenceDiagram\nA->>B: Request\nactivate B',
    );
  });
});
