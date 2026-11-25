import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  uuid,
} from "drizzle-orm/pg-core";
import { product } from "./catalog";
import { id, timestamps, weekdaysCheck } from "./columns";
import { customer } from "./customers";

/**
 * A regular customer's weekly order: a template only. Its days exist as
 * ordinary reservations created ahead from it (source 'standing_order'); the
 * bake plan, availability and the day's list read only those (ADR 0007).
 * Editing it recreates only its future reservations still before the cutoff.
 */
export const standingOrder = pgTable(
  "standing_order",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    /** ISO weekdays of pickup (1 = Monday). */
    weekdays: smallint("weekdays").array().notNull(),
    pickupTime: time("pickup_time"),
    note: text("note"),
    /** Ended standing orders stay for their past reservations. */
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    index("standing_order_customer_id_idx").on(t.customerId),
    check("standing_order_weekdays_check", weekdaysCheck(t.weekdays)),
  ],
);

export const standingOrderItem = pgTable(
  "standing_order_item",
  {
    standingOrderId: uuid("standing_order_id")
      .notNull()
      .references(() => standingOrder.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.standingOrderId, t.productId] }),
    index("standing_order_item_product_id_idx").on(t.productId),
    check("standing_order_item_quantity_check", sql`${t.quantity} > 0`),
  ],
);
