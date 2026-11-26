// Rebuilds the test database from the migrations once per run.
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { connect } from "./db";

export default async function setup() {
  await rebuild(connect());
}

/** Empties the database and applies every migration. */
export async function rebuild({ pool, db }: ReturnType<typeof connect>) {
  try {
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);
    await migrate(db, { migrationsFolder: "src/lib/db/migrations" });
  } finally {
    await pool.end();
  }
}
