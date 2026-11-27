/**
 * Environment of the server under test and of the seed. Set explicitly, so
 * nothing falls back to .env.local (process variables win over env files).
 */
import { localDatabaseUrl } from "../test/db";
import { loadTestEnv } from "../test/env";

// Imports are evaluated first, so the file is loaded here, before it is read.
loadTestEnv();

/** Throwaway values for a local database that every run rebuilds. */
export const STAFF = {
  email: "pekar@pekarna.com",
  password: "e2e-staff-7f3c9a1d5b2e8f40",
};

export const OWNER = {
  email: "majitel@pekarna.com",
  password: "e2e-owner-2b8d6e0c4a9f1735",
};

/** The signed-in sessions, written by auth.setup.ts (gitignored). */
export const STAFF_SESSION = "playwright/.auth/staff.json";
export const OWNER_SESSION = "playwright/.auth/owner.json";

export const E2E_DATABASE_URL = localDatabaseUrl("E2E_DATABASE_URL");

export const E2E_ENV = {
  DATABASE_URL: E2E_DATABASE_URL,
  BETTER_AUTH_SECRET: "e2e-only-not-a-real-secret-0123456789abcdef",
  SEED_OWNER_PASSWORD: OWNER.password,
  SEED_STAFF_PASSWORD: STAFF.password,
};
