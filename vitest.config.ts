import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { loadTestEnv } from "./test/env";

loadTestEnv();

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };
// West of UTC and of Prague, so code that uses the machine's time zone
// instead of Europe/Prague fails here, not in production.
const env = { TZ: "America/New_York" };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.db.test.ts"],
          environment: "node",
          env,
        },
      },
      {
        // Services against a real Postgres 18 (TEST_DATABASE_URL, local only).
        // Files run one after another: they share and empty one database.
        resolve: { alias },
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts"],
          environment: "node",
          env,
          globalSetup: ["test/db-global-setup.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
    ],
  },
});
