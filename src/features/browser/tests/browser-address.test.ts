import { describe, expect, it } from "vitest";
import { getBrowserTabName, resolveBrowserAddress } from "../services/browser-address";

describe("resolveBrowserAddress", () => {
  it("keeps full web addresses as typed", () => {
    expect(resolveBrowserAddress(" https://adshkumar.is-a.dev/docs ")).toBe("https://adshkumar.is-a.dev/docs");
    expect(resolveBrowserAddress("http://localhost:3000/api?x=1")).toBe(
      "http://localhost:3000/api?x=1",
    );
    expect(resolveBrowserAddress("about:blank")).toBe("about:blank");
  });

  it("opens local development servers over http", () => {
    expect(resolveBrowserAddress("localhost:5173")).toBe("http://localhost:5173");
    expect(resolveBrowserAddress("localhost")).toBe("http://localhost");
    expect(resolveBrowserAddress("127.0.0.1:8080/health")).toBe("http://127.0.0.1:8080/health");
    expect(resolveBrowserAddress("[::1]:3000")).toBe("http://[::1]:3000");
    expect(resolveBrowserAddress("app.localhost:3000")).toBe("http://app.localhost:3000");
    expect(resolveBrowserAddress(":4321")).toBe("http://localhost:4321");
  });

  it("opens bare domains over https", () => {
    expect(resolveBrowserAddress("adshkumar.is-a.dev")).toBe("https://adshkumar.is-a.dev");
    expect(resolveBrowserAddress("github.com/Adshkumar/r0")).toBe(
      "https://github.com/Adshkumar/r0",
    );
    expect(resolveBrowserAddress("docs.rs:443/tauri")).toBe("https://docs.rs:443/tauri");
  });

  it("searches for anything that is not an address", () => {
    expect(resolveBrowserAddress("tauri child webview")).toBe(
      "https://www.google.com/search?q=tauri%20child%20webview",
    );
    expect(resolveBrowserAddress("react")).toBe("https://www.google.com/search?q=react");
    expect(resolveBrowserAddress("file:///etc/hosts")).toBe(
      "https://www.google.com/search?q=file%3A%2F%2F%2Fetc%2Fhosts",
    );
    expect(resolveBrowserAddress("javascript:alert(1)")).toBe(
      "https://www.google.com/search?q=javascript%3Aalert(1)",
    );
  });

  it("ignores empty input", () => {
    expect(resolveBrowserAddress("   ")).toBeNull();
  });
});

describe("getBrowserTabName", () => {
  it("prefers the page title and falls back to the host", () => {
    expect(getBrowserTabName("https://adshkumar.is-a.dev/docs", " R0 Docs ")).toBe("R0 Docs");
    expect(getBrowserTabName("http://localhost:5173/")).toBe("localhost:5173");
    expect(getBrowserTabName("about:blank")).toBe("New Tab");
  });
});
