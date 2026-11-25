import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  time,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  RESERVATION_SOURCES,
  RESERVATION_STATUSES,
} from "../../domain/reservation";
import { user } from "./auth";
import { product } from "./catalog";
import { id, isE164, notBlank, sqlList, timestamps } from "./columns";
import { customer } from "./customers";
import { standingOrder } from "./standing-orders";

export const reservation = pgTable(
  "reservation",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    /**
     * Name and phone as they were when the order was made, so later changes
     * to the customer never change past orders. Online orders keep what the
     * customer typed.
     */
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    /** Calendar day in Europe/Prague, kept as 'YYYY-MM-DD'. */
    pickupDate: date("pickup_date", { mode: "string" }).notNull(),
    pickupTime: time("pickup_time"),
    status: text("status", { enum: RESERVATION_STATUSES })
      .default("reserved")
      .notNull(),
    source: text("source", { enum: RESERVATION_SOURCES }).notNull(),
    note: text("note"),
    /** The template this day was created from; only for standing orders. */
    standingOrderId: uuid("standing_order_id").references(
      () => standingOrder.id,
      { onDelete: "restrict" },
    ),
    /** Staff member who took a phone order; null otherwise. */
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    /**
     * SHA-256 (hex) of the secret in the customer's link /objednavka/[token].
     * Only online orders have a link; the token itself is never stored.
     */
    accessTokenHash: text("access_token_hash").unique(),
    /**
     * Sent with the form, so a double submit saves one reservation. Standing
     * order days have none: one day per template is unique instead.
     */
    idempotencyKey: uuid("idempotency_key").unique(),
    /**
     * SHA-256 (hex) of the normalised order, so a key reused with a different
     * order is refused instead of answered with the first one.
     */
    requestHash: text("request_hash"),
    ...timestamps,
  },
  (t) => [
    index("reservation_pickup_date_status_idx").on(t.pickupDate, t.status),
    index("reservation_customer_id_idx").on(t.customerId),
    index("reservation_created_by_user_id_idx").on(t.createdByUserId),
    // One reservation per standing order and day: creating days ahead can run
    // twice (ON CONFLICT DO NOTHING), and a cancelled day is not recreated.
    unique("reservation_standing_order_day_unique").on(
      t.standingOrderId,
      t.pickupDate,
    ),
    check(
      "reservation_status_check",
      sql`${t.status} in (${sqlList(RESERVATION_STATUSES)})`,
    ),
    check(
      "reservation_source_check",
      sql`${t.source} in (${sqlList(RESERVATION_SOURCES)})`,
    ),
    check(
      "reservation_phone_has_staff_check",
      sql`(${t.source} = 'phone') = (${t.createdByUserId} is not null)`,
    ),
    check(
      "reservation_online_has_link_check",
      sql`(${t.source} = 'online') = (${t.accessTokenHash} is not null)`,
    ),
    check(
      "reservation_standing_order_check",
      sql`(${t.source} = 'standing_order') = (${t.standingOrderId} is not null)`,
    ),
    check(
      "reservation_idempotency_check",
      sql`(${t.source} = 'standing_order') = (${t.idempotencyKey} is null) and (${t.idempotencyKey} is null) = (${t.requestHash} is null)`,
    ),
    check("reservation_customer_name_check", notBlank(t.customerName)),
    check("reservation_customer_phone_check", isE164(t.customerPhone)),
    check(
      "reservation_request_hash_check",
      sql`${t.requestHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "reservation_access_token_hash_check",
      sql`${t.accessTokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const reservationItem = pgTable(
  "reservation_item",
  {
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservation.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "restrict" }),
    /** Name and price per piece (haléře) when ordered; later changes keep them. */
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.reservationId, t.productId] }),
    index("reservation_item_product_id_idx").on(t.productId),
    check("reservation_item_product_name_check", notBlank(t.productName)),
    check("reservation_item_quantity_check", sql`${t.quantity} > 0`),
    check("reservation_item_unit_price_check", sql`${t.unitPrice} >= 0`),
  ],
);
