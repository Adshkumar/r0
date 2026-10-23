import { describe, expect, it } from "vite-plus/test";
import { getServiceUrls } from "./services";

describe("getServiceUrls", () => {
  it("uses the live r0 website for documentation links", () => {
    expect(getServiceUrls()).toMatchObject({
      docsUrl: "https://r0-ide.vercel.app/docs",
      telemetryDocsUrl: "https://r0-ide.vercel.app/docs/telemetry",
      releasesUrl: "https://r0-ide.vercel.app/releases",
    });
  });
});
