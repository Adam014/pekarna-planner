import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Same .env files as Next.js, so the CLI and the app use one DATABASE_URL.
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url)
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
