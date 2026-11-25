import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    // West of UTC and of Prague, so code that uses the machine's time zone
    // instead of Europe/Prague fails here, not in production.
    env: { TZ: "America/New_York" },
    passWithNoTests: true,
  },
});
