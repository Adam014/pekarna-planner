import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  smallint,
  text,
  time,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { id, notBlank, timestamps, weekdaysCheck } from "./columns";

/** Bakery-wide settings. Exactly one row (id = 1). */
export const settings = pgTable(
  "settings",
  {
    id: smallint("id").primaryKey().default(1),
    /** Orders for day D close at D−1 at this time, Europe/Prague. */
    orderCutoffTime: time("order_cutoff_time").default("18:00").notNull(),
    ...timestamps,
  },
  (t) => [check("settings_single_row_check", sql`${t.id} = 1`)],
);

/** Retired products are deactivated, never deleted: past orders refer to them. */
export const product = pgTable(
  "product",
  {
    id: id(),
    name: text("name").notNull(),
    /** Price per piece in haléře (1 Kč = 100). */
    price: integer("price").notNull(),
    /** Pieces that can be reserved per pickup day, standing orders included. */
    dailyLimit: integer("daily_limit").notNull(),
    /** Extra pieces baked for walk-in customers. */
    buffer: integer("buffer").default(0).notNull(),
    /** ISO weekdays the product is baked (1 = Monday). */
    bakeDays: smallint("bake_days").array().notNull(),
    active: boolean("active").default(true).notNull(),
    /** The photo: a Vercel Blob URL, or a path under public/ (demo data). */
    imageUrl: text("image_url"),
    ...timestamps,
  },
  (t) => [
    check("product_name_check", notBlank(t.name)),
    // "Chléb" and "chléb " are the same product.
    uniqueIndex("product_name_unique_idx").on(sql`lower(btrim(${t.name}))`),
    check("product_price_check", sql`${t.price} >= 0`),
    check("product_daily_limit_check", sql`${t.dailyLimit} > 0`),
    check("product_buffer_check", sql`${t.buffer} >= 0`),
    check("product_bake_days_check", weekdaysCheck(t.bakeDays)),
  ],
);
