/**
 * The test database. Refuses anything but a local Postgres, so tests can
 * never empty a real database (.env.local may point at Neon).
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";

export function testDatabaseUrl(): string {
  return localDatabaseUrl("TEST_DATABASE_URL");
}

/** The URL in that variable, refused unless it is a Postgres on this machine. */
export function localDatabaseUrl(variable: string): string {
  const url = process.env[variable];
  if (!url) {
    throw new Error(
      `${variable} is not set: a local Postgres 18, e.g. from docker-compose.yml.`,
    );
  }
  const parsed = new URL(url);
  // node-postgres takes ?host= over the host in the URL, so refuse it.
  if (parsed.searchParams.has("host") || parsed.searchParams.has("hostaddr")) {
    throw new Error(`${variable} must not set host in the query`);
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
    throw new Error(`${variable} must be local, not ${parsed.hostname}`);
  }
  return url;
}

export function connect(url = testDatabaseUrl()) {
  const pool = new Pool({ connectionString: url, max: 30 });
  return { pool, db: drizzle(pool, { schema }) };
}

/** Empties every app table except the settings row; keeps the schema. */
export async function emptyTables(db: ReturnType<typeof connect>["db"]) {
  await db.execute(
    sql`truncate reservation_item, reservation, standing_order_item, standing_order, customer, product, "user" cascade`,
  );
  await db.execute(sql`update settings set order_cutoff_time = '18:00'`);
}
