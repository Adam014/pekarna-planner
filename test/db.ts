/**
 * The test database. Refuses anything but a local Postgres, so tests can
 * never empty a real database (.env.local may point at Neon).
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set: a local Postgres 18, e.g. from docker-compose.yml.",
    );
  }
  const parsed = new URL(url);
  // node-postgres takes ?host= over the host in the URL, so refuse it.
  if (parsed.searchParams.has("host") || parsed.searchParams.has("hostaddr")) {
    throw new Error("TEST_DATABASE_URL must not set host in the query");
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
    throw new Error(`TEST_DATABASE_URL must be local, not ${parsed.hostname}`);
  }
  return url;
}

export function connect() {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 30 });
  return { pool, db: drizzle(pool, { schema }) };
}

/** Empties every app table except the settings row; keeps the schema. */
export async function emptyTables(db: ReturnType<typeof connect>["db"]) {
  await db.execute(
    sql`truncate reservation_item, reservation, standing_order_item, standing_order, customer, product, "user" cascade`,
  );
  await db.execute(sql`update settings set order_cutoff_time = '18:00'`);
}
