import { describe, expect, it } from "vite-plus/test";
import { __test__ } from "../hooks/use-deep-link";

const { isSupportedDeepLinkProtocol, parseDeepLinkAction } = __test__;

describe("isSupportedDeepLinkProtocol", () => {
  it("accepts registered stable and dev schemes", () => {
    expect(isSupportedDeepLinkProtocol("r0:")).toBe(true);
    expect(isSupportedDeepLinkProtocol("r0-dev:")).toBe(true);
  });

  it("rejects unrelated schemes", () => {
    expect(isSupportedDeepLinkProtocol("https:")).toBe(false);
    expect(isSupportedDeepLinkProtocol("file:")).toBe(false);
    expect(isSupportedDeepLinkProtocol("r0-preview:")).toBe(false);
  });
});

describe("parseDeepLinkAction", () => {
  it("maps supported open URLs to queued window requests", () => {
    expect(parseDeepLinkAction("r0://open?path=/Users/test/project/file.ts&line=42")).toEqual({
      type: "windowOpen",
      request: {
        type: "path",
        source: "deepLink",
        path: "/Users/test/project/file.ts",
        isDirectory: false,
        line: 42,
      },
    });
  });

  it("maps extension install URLs without touching extension state", () => {
    expect(parseDeepLinkAction("r0://extension/install/theme-dark")).toEqual({
      type: "extensionInstall",
      extensionId: "theme-dark",
    });
  });

  it("maps settings URLs to settings dialog actions", () => {
    expect(parseDeepLinkAction("r0://settings?tab=features")).toEqual({
      type: "settings",
      tab: "advanced",
      extensionsCategory: undefined,
    });

    expect(parseDeepLinkAction("r0://settings?tab=advanced")).toEqual({
      type: "settings",
      tab: "advanced",
      extensionsCategory: undefined,
    });
  });

  it("maps legacy extension settings URLs to the extensions tab", () => {
    expect(parseDeepLinkAction("r0://settings?tab=extensions&category=agent")).toEqual({
      type: "extensions",
      extensionsCategory: "agent",
    });

    expect(parseDeepLinkAction("r0://open?type=settings&tab=extensions")).toEqual({
      type: "extensions",
      extensionsCategory: undefined,
    });

    expect(parseDeepLinkAction("r0://settings?tab=extensions&category=ai")).toEqual({
      type: "extensions",
      extensionsCategory: "ai",
    });
  });

  it("drops unsupported schemes and malformed actions", () => {
    expect(parseDeepLinkAction("r0-alpha://open?path=/Users/test/file.ts")).toBeNull();
    expect(parseDeepLinkAction("r0://open")).toBeNull();
  });

  it("hands MCP install links to the MCP settings", () => {
    const url = "r0://mcp/install?name=Server&config=e30";
    expect(parseDeepLinkAction(url)).toEqual({ type: "mcpInstall", url });
  });
});
