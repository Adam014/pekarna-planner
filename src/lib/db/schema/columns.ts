import { sql } from "drizzle-orm";
import { type AnyPgColumn, timestamp, uuid } from "drizzle-orm/pg-core";

/** UUIDv7 primary key: time-ordered for the index, not a
 * countable 1, 2, 3 in URLs. Never an access token (RFC 9562 §8). */
export const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`);

/** `updated_at` is maintained by a trigger (migration 0002), not by the ORM. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

/** ISO weekdays, 1 = Monday … 7 = Sunday; a flat list with at least one. */
export const weekdaysCheck = (column: AnyPgColumn) =>
  sql`${column} <@ '{1,2,3,4,5,6,7}'::smallint[] and cardinality(${column}) > 0 and array_ndims(${column}) = 1`;

/** Text with at least one character other than whitespace. */
export const notBlank = (column: AnyPgColumn) => sql`btrim(${column}) <> ''`;

/**
 * `'a', 'b'` for a CHECK … IN (…). Only for constant lists in the schema:
 * the values end up in a reviewed migration, not in a query.
 */
export const sqlList = (values: readonly string[]) => {
  if (values.length === 0) throw new Error("sqlList needs at least one value");
  return sql.raw(
    values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", "),
  );
};

/** Phone number in E.164, e.g. +420601234567. */
export const isE164 = (column: AnyPgColumn) =>
  sql`${column} ~ '^\\+[1-9][0-9]{6,14}$'`;
