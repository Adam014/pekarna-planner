// Rebuilds the end-to-end database and creates the accounts, once per run.
import { execFileSync } from "node:child_process";
import { connect } from "../test/db";
import { rebuild } from "../test/db-global-setup";
import { E2E_DATABASE_URL, E2E_ENV } from "./env";

export default async function setup() {
  await rebuild(connect(E2E_DATABASE_URL));
  execFileSync("bun", ["src/lib/db/seed.ts"], {
    env: { ...process.env, ...E2E_ENV },
    stdio: "inherit",
  });
}
