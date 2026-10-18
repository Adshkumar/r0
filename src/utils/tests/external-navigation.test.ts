import { describe, expect, it } from "vite-plus/test";
import { resolveExternalBrowserUrl } from "../external-navigation";

describe("resolveExternalBrowserUrl", () => {
  it("accepts http and https links", () => {
    expect(resolveExternalBrowserUrl("https://adshkumar.is-a.dev/docs")).toBe("https://adshkumar.is-a.dev/docs");
    expect(resolveExternalBrowserUrl("http://localhost:3000")).toBe("http://localhost:3000/");
  });

  it("accepts mail and phone links", () => {
    expect(resolveExternalBrowserUrl("mailto:hello@adshkumar.is-a.dev")).toBe("mailto:hello@adshkumar.is-a.dev");
    expect(resolveExternalBrowserUrl("tel:+15551234567")).toBe("tel:+15551234567");
  });

  it("resolves protocol-relative links against the app protocol", () => {
    expect(resolveExternalBrowserUrl("//adshkumar.is-a.dev/docs", "https://app.local/")).toBe(
      "https://adshkumar.is-a.dev/docs",
    );
    expect(resolveExternalBrowserUrl("//adshkumar.is-a.dev/docs", "tauri://localhost/")).toBe(
      "https://adshkumar.is-a.dev/docs",
    );
  });

  it("does not treat in-app relative links as external", () => {
    expect(resolveExternalBrowserUrl("/settings", "http://localhost/")).toBe(null);
    expect(resolveExternalBrowserUrl("#section", "http://localhost/")).toBe(null);
  });

  it("rejects unsupported protocols", () => {
    expect(resolveExternalBrowserUrl("javascript:alert(1)")).toBe(null);
    expect(resolveExternalBrowserUrl("file:///Users/test/readme.md")).toBe(null);
    expect(resolveExternalBrowserUrl("r0://open?path=/tmp/test.md")).toBe(null);
  });
});
