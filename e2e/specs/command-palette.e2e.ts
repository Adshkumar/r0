import { beforeAll, describe } from "bun:test";
import {
  runPaletteCommand,
  waitForSidebarHidden,
  waitForSidebarShown,
  waitForProjectTree,
} from "../support/app.ts";
import { e2eTest, useAppSession } from "../support/session.ts";

describe("command palette", () => {
  useAppSession("command-palette");

  beforeAll(async () => {
    await waitForProjectTree();
  });

  e2eTest("opens and runs a command", async () => {
    await runPaletteCommand("View: Hide Sidebar");
    await waitForSidebarHidden();

    await runPaletteCommand("View: Show Sidebar");
    await waitForSidebarShown();
  });
});
