// @vitest-environment jsdom

import { describe, expect, it } from "vite-plus/test";
import { MAX_MERMAID_SOURCE_LENGTH } from "../services/diagram-document";
import {
  detectMermaidDiagramType,
  sanitizeMermaidSvg,
  validateMermaidSource,
} from "../services/mermaid-renderer";
import { getRenderableMermaidSource } from "../services/mermaid-source";

const sequenceFixture = `%%{init: {"sequence": {"showSequenceNumbers": true}}}%%
sequenceDiagram
  autonumber
  actor User as User / Client
  participant GW as API Gateway
  participant Auth as Auth & Identity Service
  participant Cache as Redis Cache
  participant DB as Main Database (PostgreSQL)
  participant Broker as Message Broker (Kafka)
  participant Worker as Notification Worker
  User->>GW: POST /api/v1/register (Payload)
  Note over GW: Rate limiting and TLS termination
  GW->>Auth: Validate input and check idempotency
  activate Auth
  Auth->>Cache: Check if email exists
  activate Cache
  Cache-->>Auth: Cache miss
  deactivate Cache
  Auth->>DB: Insert new user
  activate DB
  DB-->>Auth: User created
  deactivate DB
  Auth->>Cache: Write session metadata
  Cache-->>Auth: OK
  Auth-)Broker: Publish UserRegisteredEvent
  Broker-->>Auth: Acknowledged
  Auth-->>GW: HTTP 201 and token
  deactivate Auth
  GW-->>User: Registration successful
  Broker->>Worker: Consume UserRegisteredEvent
  Worker-->>User: Send verification email`;

describe("Mermaid renderer", () => {
  it("sanitizes unsafe SVG while preserving diagram labels", () => {
    const svg = sanitizeMermaidSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>Safe label</text><script>alert(1)</script><foreignObject><img src=x onerror="alert(1)"></foreignObject></svg>',
    );

    expect(svg).toContain("Safe label");
    expect(svg).not.toMatch(/<script\b|foreignObject|onerror=|javascript:/i);
  });

  it("blocks external SVG references while preserving local fragment links", () => {
    const svg = sanitizeMermaidSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" /></defs><path marker-end="url(#arrow)" filter="url(https://attacker.example/filter)" style="stroke:url(https://attacker.example/paint)" /><image href="https://attacker.example/image.svg" /></svg>',
    );

    expect(svg).toContain('marker-end="url(#arrow)"');
    expect(svg).not.toContain("attacker.example");
    expect(svg).not.toContain("https://");
  });

  it("chooses readable node-label colors from each node fill", () => {
    const svg = sanitizeMermaidSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><g class="node"><rect fill="#ffffff" /><text fill="#ffffff">Light node</text></g><g class="node"><rect fill="#111827" /><text fill="#111827">Dark node</text></g></svg>',
    );
    const container = document.createElement("div");
    container.innerHTML = svg;
    const labels = container.querySelectorAll("text");

    expect(labels[0]?.getAttribute("style")).toContain("fill: rgb(17, 24, 39)");
    expect(labels[1]?.getAttribute("style")).toContain("fill: rgb(249, 250, 251)");
  });

  it("rejects oversized source before loading Mermaid", async () => {
    await expect(validateMermaidSource("x".repeat(MAX_MERMAID_SOURCE_LENGTH + 1))).rejects.toThrow(
      "character limit",
    );
  });

  it("recognizes and parses a complete sequence diagram with directives and sequence syntax", async () => {
    await expect(detectMermaidDiagramType(sequenceFixture)).resolves.toMatch(/sequence/i);
    await expect(validateMermaidSource(sequenceFixture)).resolves.toBeUndefined();
  }, 30_000);

  it("prepares recognizable sequence source for rendering when its declaration is omitted", async () => {
    const renderSource = getRenderableMermaidSource(
      '%%{init: {"sequence": {"showSequenceNumbers": true}}}%%\nA->>B: Request\nactivate B',
    );
    expect(renderSource).toBe(
      '%%{init: {"sequence": {"showSequenceNumbers": true}}}%%\nsequenceDiagram\nA->>B: Request\nactivate B',
    );
    await expect(validateMermaidSource(renderSource)).resolves.toBeUndefined();
  });

  it("parses sequence declarations after leading whitespace and blank lines", async () => {
    await expect(
      validateMermaidSource("\n  \nsequenceDiagram\n  autonumber\n  A->>B: Request"),
    ).resolves.toBeUndefined();
  });

  it("parses Mermaid source inside a complete Mermaid code fence", async () => {
    await expect(
      validateMermaidSource("```mermaid\nsequenceDiagram\n  A->>B: Request\n```"),
    ).resolves.toBeUndefined();
  });

  it("continues to parse flowchart, class, and ER declarations", async () => {
    await expect(validateMermaidSource("flowchart LR\n  A --> B")).resolves.toBeUndefined();
    await expect(validateMermaidSource("classDiagram\n  A --> B")).resolves.toBeUndefined();
    await expect(
      validateMermaidSource("erDiagram\n  USER ||--o{ ORDER : places"),
    ).resolves.toBeUndefined();
  });

  it("reports invalid source with the Mermaid parser's syntax error", async () => {
    await expect(
      validateMermaidSource("sequenceDiagram\n  A->>: missing target"),
    ).rejects.toThrow();
  });

  it("parses a long sequence without truncating its messages", async () => {
    const messages = Array.from({ length: 150 }, (_, index) => `  A->>B: Message ${index + 1}`);
    const source = ["sequenceDiagram", "  participant A", "  participant B", ...messages].join(
      "\n",
    );
    await expect(validateMermaidSource(source)).resolves.toBeUndefined();
  });
});
