import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { withVerifiedTls } from "./src/lib/db/connection-string";

// Same .env files as Next.js, so the CLI and the app use one DATABASE_URL.
loadEnvConfig(process.cwd());

// Migrations use the direct (unpooled) connection when there is one, as Neon
// recommends for schema changes; locally there is only DATABASE_URL.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url)
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: withVerifiedTls(url) },
  strict: true,
  verbose: true,
});
