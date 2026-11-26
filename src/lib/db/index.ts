import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { withVerifiedTls } from "./connection-string";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
}

const pool = new Pool({ connectionString: withVerifiedTls(connectionString) });

// Releases idle connections before a Vercel Fluid instance is suspended
// (ADR 0003). Outside Vercel it does nothing.
attachDatabasePool(pool);

export const db = drizzle(pool, { schema });
