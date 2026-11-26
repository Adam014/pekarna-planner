/**
 * End-to-end tests of the main flows (AGENTS.md) against a production build
 * on its own port and its own local database (E2E_DATABASE_URL), never the
 * dev server or the database in .env.local.
 */
import { defineConfig, devices } from "@playwright/test";
import { E2E_ENV, STAFF_SESSION } from "./e2e/env";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  // The tests share one database and reset it before each test.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "cs-CZ",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STAFF_SESSION },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // CI builds in an earlier step; locally the build comes first.
    command: process.env.CI
      ? `bun run start -p ${PORT}`
      : `bun run build && bun run start -p ${PORT}`,
    url: `http://localhost:${PORT}/prihlaseni`,
    // Never reuse a server: one on this port could use another database.
    reuseExistingServer: false,
    timeout: 180_000,
    env: E2E_ENV,
  },
});
