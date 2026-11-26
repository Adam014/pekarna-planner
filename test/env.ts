/**
 * Loads the test environment like Next.js does in test mode: `.env.test.local`,
 * then `.env.test`, never `.env.local` (which points at the live database).
 * Values already in the shell or CI win; Next.js itself is not used here
 * because its loader picks files by NODE_ENV, which must stay unset for
 * `next start` under Playwright.
 * https://nextjs.org/docs/app/guides/environment-variables#test-environment-variables
 */
import { existsSync } from "node:fs";

/** Runs from the project root: package scripts, CI and the IDE all do. */
export function loadTestEnv(): void {
  for (const file of [".env.test.local", ".env.test"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
