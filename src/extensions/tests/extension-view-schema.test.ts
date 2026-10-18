import { describe, expect, it } from "vite-plus/test";
import {
  EXTENSION_VIEW_LIMITS,
  ExtensionViewValidationError,
  parseExtensionViewNode,
} from "../ui/services/extension-view-schema";

describe("integration view schema", () => {
  it("accepts and normalizes a rich structured view", () => {
    const view = parseExtensionViewNode({
      type: "screen",
      title: "Deployments",
      actions: [
        {
          label: "Refresh",
          icon: "arrow-clockwise",
          action: { command: "r0.deployments.refresh", args: ["production"] },
        },
      ],
      children: [
        {
          type: "card",
          title: "Production",
          variant: "muted",
          children: [
            { type: "metric", label: "Healthy", value: 12, tone: "success" },
            { type: "progress", label: "Rollout", value: 140 },
            {
              type: "sparkline",
              label: "Build duration",
              values: [42, 38, 35, 31],
              detail: "31s",
              tone: "success",
            },
            {
              type: "barChart",
              label: "Checks",
              items: [
                { label: "Passed", value: 18, tone: "success" },
                { label: "Failed", value: 1, tone: "error" },
              ],
            },
            {
              type: "table",
              columns: ["Service", "State"],
              rows: [["api", "ready"]],
            },
            { type: "code", value: "bun check", language: "shell" },
            {
              type: "diff",
              filePath: "src/main.ts",
              language: "typescript",
              lines: [
                { type: "header", content: "-10,2 +10,2" },
                { type: "removed", content: "const ready = false;", oldLine: 10 },
                { type: "added", content: "const ready = true;", newLine: 10 },
              ],
            },
            {
              type: "activity",
              items: [
                {
                  title: "Build",
                  description: "Linux ARM64",
                  meta: "running",
                  state: "running",
                  onSelect: { command: "r0.deployments.openBuild" },
                },
              ],
            },
            {
              type: "input",
              label: "Release note",
              onSubmit: { command: "r0.deployments.note" },
            },
            {
              type: "button",
              label: "Deploy",
              pendingLabel: "Deploying",
              action: { command: "r0.deployments.start" },
              tone: "accent",
            },
            {
              type: "textarea",
              label: "Deployment summary",
              rows: 5,
              onSubmit: { command: "r0.deployments.summary" },
            },
            {
              type: "numberInput",
              label: "Replica count",
              value: 3,
              min: 1,
              max: 10,
              step: 1,
              onChange: { command: "r0.deployments.replicas" },
            },
            {
              type: "select",
              label: "Environment",
              value: "production",
              options: [
                { label: "Production", value: "production" },
                { label: "Staging", value: "staging" },
              ],
              onChange: { command: "r0.deployments.environment" },
            },
            {
              type: "toggle",
              label: "Auto deploy",
              checked: true,
              onChange: { command: "r0.deployments.autoDeploy" },
            },
            {
              type: "checkbox",
              label: "Include migration notes",
              checked: false,
              onChange: { command: "r0.deployments.includeMigrations" },
            },
            {
              type: "choice",
              label: "Regions",
              multiple: true,
              value: ["eu"],
              options: [
                { label: "Europe", value: "eu" },
                { label: "US", value: "us" },
              ],
              onChange: { command: "r0.deployments.regions" },
            },
            {
              type: "tabs",
              value: "summary",
              tabs: [
                {
                  value: "summary",
                  label: "Summary",
                  children: [{ type: "text", value: "Ready" }],
                },
                {
                  value: "logs",
                  label: "Logs",
                  children: [{ type: "code", value: "Build passed" }],
                },
              ],
            },
            {
              type: "disclosure",
              title: "Build details",
              open: true,
              children: [{ type: "code", value: "Build passed" }],
            },
            {
              type: "keyValue",
              items: [
                { label: "Commit", value: "8ad3f1", monospace: true },
                { label: "Duration", value: 42, tone: "success" },
              ],
            },
            {
              type: "tree",
              label: "Workspace dependencies",
              items: [
                {
                  id: "src",
                  title: "src",
                  icon: "folder",
                  expanded: true,
                  children: [
                    {
                      id: "src-main",
                      title: "main.ts",
                      icon: "file-text",
                      badges: [{ label: "Changed", tone: "warning" }],
                      onSelect: { command: "r0.workspace.open", args: ["src/main.ts"] },
                    },
                  ],
                },
              ],
            },
            {
              type: "form",
              submitLabel: "Create release",
              pendingLabel: "Creating",
              onSubmit: { command: "r0.deployments.create" },
              children: [
                {
                  type: "input",
                  name: "name",
                  required: true,
                  label: "Release name",
                },
                {
                  type: "select",
                  name: "environment",
                  required: true,
                  value: "production",
                  options: [{ label: "Production", value: "production" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(view.type).toBe("screen");
    if (view.type !== "screen") throw new Error("Expected a screen");
    const card = view.children[0];
    if (card.type !== "card") throw new Error("Expected a card");
    expect(card.children[1]).toEqual({
      type: "progress",
      label: "Rollout",
      value: 100,
      detail: undefined,
    });
  });

  it("rejects unsupported node types with their tree path", () => {
    expect(() =>
      parseExtensionViewNode({
        type: "stack",
        children: [{ type: "chart", values: [1, 2, 3] }],
      }),
    ).toThrow('Invalid integration view at $.children[0].type: unsupported node type "chart"');
  });

  it("rejects malformed actions before they reach the renderer", () => {
    expect(() =>
      parseExtensionViewNode({
        type: "button",
        label: "Run",
        action: { command: "", args: [] },
      }),
    ).toThrow("Invalid integration view at $.action.command: must not be empty");
  });

  it("bounds generated trees and table data", () => {
    expect(() =>
      parseExtensionViewNode({
        type: "stack",
        children: Array.from({ length: EXTENSION_VIEW_LIMITS.maxChildren + 1 }, () => ({
          type: "divider",
        })),
      }),
    ).toThrow(`must contain at most ${EXTENSION_VIEW_LIMITS.maxChildren} nodes`);

    expect(() =>
      parseExtensionViewNode({
        type: "table",
        columns: ["Name"],
        rows: [["R0", "extra"]],
      }),
    ).toThrow("contains more cells than the table has columns");

    expect(() =>
      parseExtensionViewNode({
        type: "sparkline",
        label: "Build duration",
        values: [42],
      }),
    ).toThrow("must contain at least two points");

    expect(() =>
      parseExtensionViewNode({
        type: "barChart",
        items: [{ label: "Failed", value: -1 }],
      }),
    ).toThrow("must not be negative");

    expect(() =>
      parseExtensionViewNode({
        type: "diff",
        filePath: "src/main.ts",
        lines: Array.from({ length: EXTENSION_VIEW_LIMITS.maxDiffLines + 1 }, () => ({
          type: "context",
          content: "const ready = true;",
        })),
      }),
    ).toThrow(`must contain at most ${EXTENSION_VIEW_LIMITS.maxDiffLines} lines`);

    expect(() =>
      parseExtensionViewNode({
        type: "diff",
        filePath: "src/main.ts",
        lines: [{ type: "changed", content: "const ready = true;" }],
      }),
    ).toThrow("expected one of context, added, removed, header");
  });

  it("validates interactive control options and state", () => {
    expect(() =>
      parseExtensionViewNode({
        type: "input",
        label: "Release note",
      }),
    ).toThrow("requires onChange, onSubmit, or a form field name");

    expect(() =>
      parseExtensionViewNode({
        type: "textarea",
        rows: 20,
        onSubmit: { command: "r0.release.note" },
      }),
    ).toThrow("must be an integer between 2 and 12");

    expect(() =>
      parseExtensionViewNode({
        type: "numberInput",
        value: 2,
        step: 0,
        onChange: { command: "r0.replicas.change" },
      }),
    ).toThrow("must be greater than zero");

    expect(() =>
      parseExtensionViewNode({
        type: "select",
        options: [
          { label: "Production", value: "production" },
          { label: "Live", value: "production" },
        ],
        onChange: { command: "r0.environment.change" },
      }),
    ).toThrow("must contain unique values");

    expect(() =>
      parseExtensionViewNode({
        type: "toggle",
        label: "Auto deploy",
        checked: "yes",
        onChange: { command: "r0.autoDeploy.change" },
      }),
    ).toThrow("Invalid integration view at $.checked: expected a boolean");

    expect(() =>
      parseExtensionViewNode({
        type: "tabs",
        value: "missing",
        tabs: [{ value: "summary", label: "Summary", children: [] }],
      }),
    ).toThrow("must reference an enabled tab");

    expect(() =>
      parseExtensionViewNode({
        type: "choice",
        multiple: true,
        value: "eu",
        options: [{ label: "Europe", value: "eu" }],
        onChange: { command: "r0.regions.change" },
      }),
    ).toThrow("Invalid integration view at $.value: expected an array");

    expect(() =>
      parseExtensionViewNode({
        type: "activity",
        items: [{ title: "Deploy", state: "unknown" }],
      }),
    ).toThrow("expected one of default, running, success, warning, error");

    expect(() => parseExtensionViewNode({ type: "keyValue", items: [] })).toThrow(
      "must contain at least one item",
    );

    expect(() =>
      parseExtensionViewNode({
        type: "tree",
        label: "Duplicate ids",
        items: [
          { id: "same", title: "First" },
          { id: "same", title: "Second" },
        ],
      }),
    ).toThrow('contains duplicate tree item id "same"');
  });

  it("validates atomic form fields and rejects ambiguous bindings", () => {
    expect(
      parseExtensionViewNode({
        type: "form",
        submitLabel: "Connect",
        onSubmit: { command: "r0.connect" },
        children: [
          { type: "input", name: "host", required: true, value: "https://example.com" },
          { type: "checkbox", name: "confirmed", required: true, label: "Confirm", checked: false },
        ],
      }),
    ).toMatchObject({
      type: "form",
      submitLabel: "Connect",
      children: [
        { type: "input", name: "host", required: true },
        { type: "checkbox", name: "confirmed", required: true },
      ],
    });

    expect(() =>
      parseExtensionViewNode({
        type: "input",
        name: "host",
        onChange: { command: "r0.host.change" },
      }),
    ).toThrow("form field metadata is only valid inside a form");

    expect(() =>
      parseExtensionViewNode({
        type: "form",
        submitLabel: "Connect",
        onSubmit: { command: "r0.connect" },
        children: [
          { type: "input", name: "host" },
          { type: "input", name: "host" },
        ],
      }),
    ).toThrow('contains duplicate field name "host"');

    expect(() =>
      parseExtensionViewNode({
        type: "form",
        submitLabel: "Connect",
        onSubmit: { command: "r0.connect" },
        children: [{ type: "input", name: "host", required: true, disabled: true }],
      }),
    ).toThrow("must not be used on a disabled field");
  });

  it("bounds the complete payload including deferred action arguments", () => {
    expect(() =>
      parseExtensionViewNode({
        type: "button",
        label: "Run",
        action: {
          command: "r0.run",
          args: ["x".repeat(EXTENSION_VIEW_LIMITS.maxPayloadCharacters + 1)],
        },
      }),
    ).toThrow(
      `exceeds the maximum text payload of ${EXTENSION_VIEW_LIMITS.maxPayloadCharacters} characters`,
    );
  });

  it("uses a dedicated validation error type", () => {
    expect(() => parseExtensionViewNode(null)).toThrow(ExtensionViewValidationError);
  });
});
