/**
 * Reservations (R1–R3, R5). Every function takes the database, so tests run
 * them against a real Postgres; server actions pass `db` after checking the
 * session (`requireUser`).
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Db, Tx } from "../db/types";
import { reservation, reservationItem } from "../db/schema";
import { normalizePhone } from "../domain/phone";
import {
  BOOKING_HORIZON_DAYS,
  COUNTED_STATUSES,
  ORDER_LINK_DAYS_AFTER_PICKUP,
  type ReservationStatus,
} from "../domain/reservation";
import {
  addDays,
  bookableDates,
  isBeforeCutoff,
  today,
  weekdayOf,
} from "../domain/time";
import type { ReservationInput } from "../validators/reservation";
import { findOrCreateCustomer } from "./customers";
import {
  lockProducts,
  orderedPieces,
  overLimit,
  type OverLimit,
} from "./demand";
import { cutoffTime } from "./settings";

/** A replay of the same order within this time returns the saved one. */
const IDEMPOTENCY_HOURS = 24;

/**
 * Staff confirm this before saving; online the day is not on offer. The daily
 * limit is never a warning: it is refused for everyone.
 */
export type NotBakedWarning = {
  kind: "not_baked";
  date: string;
  productId: string;
  productName: string;
};

export type Rejection =
  | "invalid_phone"
  | "unknown_product"
  | "inactive_product"
  | "day_not_bookable"
  | "sold_out"
  | "idempotency_conflict";

export type CreateResult =
  | { status: "created" | "replayed"; reservationId: string; token?: string }
  | { status: "needs_confirmation"; warnings: NotBakedWarning[] }
  | { status: "rejected"; reason: Rejection; overLimit?: OverLimit[] };

export type Channel =
  | { source: "online" }
  /** Staff on the phone; `confirmed` once they saw the warnings. */
  | { source: "phone"; userId: string; confirmed?: boolean };

/**
 * Saves a reservation; never over the daily limit, for anyone. Online: only
 * days on offer (before the cutoff, within the booking horizon, baked that
 * day). Staff may book any day from today to the horizon, also after the
 * cutoff; a day the product is not baked needs their confirmation.
 */
export async function createReservation(
  db: Db,
  input: ReservationInput,
  channel: Channel,
  now: Temporal.Instant,
): Promise<CreateResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { status: "rejected", reason: "invalid_phone" };
  const requestHash = hashOrder(input, phone, channel.source);

  return db.transaction(async (tx) => {
    // The same key waits for the first request to finish, then replays it.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${input.idempotencyKey}, 0))`,
    );
    const replay = await replayOf(tx, input.idempotencyKey, requestHash, now);
    if (replay) return replay;

    const cutoff = await cutoffTime(tx);
    const ids = input.items.map((i) => i.productId);
    const products = await lockProducts(tx, ids);
    if (products.size !== ids.length) {
      return { status: "rejected", reason: "unknown_product" };
    }
    if ([...products.values()].some((p) => !p.active)) {
      return { status: "rejected", reason: "inactive_product" };
    }

    const date = input.pickupDate;
    const warnings: NotBakedWarning[] = [];
    if (channel.source === "online") {
      const onOffer = [...products.values()].every((p) =>
        bookableDates(now, cutoff, p.bakeDays).includes(date),
      );
      if (!onOffer) return { status: "rejected", reason: "day_not_bookable" };
    } else {
      const first = today(now);
      if (date < first || date > addDays(first, BOOKING_HORIZON_DAYS)) {
        return { status: "rejected", reason: "day_not_bookable" };
      }
      for (const p of products.values()) {
        if (!p.bakeDays.includes(weekdayOf(date))) {
          warnings.push({
            kind: "not_baked",
            date,
            productId: p.id,
            productName: p.name,
          });
        }
      }
    }

    const ordered = await orderedPieces(tx, [date], ids);
    const over = overLimit(date, input.items, products, ordered);
    if (over.length > 0) {
      return { status: "rejected", reason: "sold_out", overLimit: over };
    }
    if (
      warnings.length > 0 &&
      channel.source === "phone" &&
      !channel.confirmed
    ) {
      return { status: "needs_confirmation", warnings };
    }

    const customer = await findOrCreateCustomer(tx, input.customerName, phone);
    const token = channel.source === "online" ? newToken() : undefined;
    const [saved] = await tx
      .insert(reservation)
      .values({
        customerId: customer.id,
        customerName: input.customerName,
        customerPhone: phone,
        pickupDate: date,
        pickupTime: input.pickupTime,
        source: channel.source,
        note: input.note || null,
        createdByUserId: channel.source === "phone" ? channel.userId : null,
        accessTokenHash: token ? sha256(token) : null,
        idempotencyKey: input.idempotencyKey,
        requestHash,
      })
      .returning({ id: reservation.id });
    if (!saved) throw new Error("Insert returned no row");

    await tx.insert(reservationItem).values(
      input.items.map((item) => {
        const p = products.get(item.productId);
        if (!p) throw new Error(`Product ${item.productId} not locked`);
        return {
          reservationId: saved.id,
          productId: p.id,
          productName: p.name,
          quantity: item.quantity,
          unitPrice: p.price,
        };
      }),
    );
    return { status: "created", reservationId: saved.id, token };
  });
}

/**
 * The saved reservation for a repeated key with the same order, if within
 * IDEMPOTENCY_HOURS. Only the link's hash is stored, so an online replay gets
 * a new link that replaces the old one.
 */
async function replayOf(
  tx: Tx,
  key: string,
  requestHash: string,
  now: Temporal.Instant,
): Promise<CreateResult | null> {
  const [existing] = await tx
    .select()
    .from(reservation)
    .where(eq(reservation.idempotencyKey, key));
  if (!existing) return null;

  const age = now.since(
    Temporal.Instant.fromEpochMilliseconds(existing.createdAt.getTime()),
  );
  if (
    existing.requestHash !== requestHash ||
    age.total("hours") > IDEMPOTENCY_HOURS
  ) {
    return { status: "rejected", reason: "idempotency_conflict" };
  }
  if (existing.source !== "online") {
    return { status: "replayed", reservationId: existing.id };
  }
  const token = newToken();
  await tx
    .update(reservation)
    .set({ accessTokenHash: sha256(token) })
    .where(eq(reservation.id, existing.id));
  return { status: "replayed", reservationId: existing.id, token };
}

export type StatusResult =
  | { status: "updated" }
  | { status: "not_found" }
  | { status: "sold_out"; overLimit: OverLimit[] };

/**
 * Staff mark a reservation on "Dnes" (R5), and can put a wrong mark back.
 * Bringing a cancelled or no-show order back counts its pieces again, so it
 * is checked against the limit and refused when it no longer fits.
 */
export async function setReservationStatus(
  db: Db,
  reservationId: string,
  status: ReservationStatus,
): Promise<StatusResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(reservation)
      .where(eq(reservation.id, reservationId))
      .for("update");
    if (!current) return { status: "not_found" };

    const counts = (s: ReservationStatus) =>
      COUNTED_STATUSES.some((c) => c === s);
    if (!counts(current.status) && counts(status)) {
      const items = await tx
        .select({
          productId: reservationItem.productId,
          quantity: reservationItem.quantity,
        })
        .from(reservationItem)
        .where(eq(reservationItem.reservationId, reservationId));
      const ids = items.map((i) => i.productId);
      const products = await lockProducts(tx, ids);
      const ordered = await orderedPieces(tx, [current.pickupDate], ids);
      const over = overLimit(current.pickupDate, items, products, ordered);
      if (over.length > 0) return { status: "sold_out", overLimit: over };
    }

    await tx
      .update(reservation)
      .set({ status })
      .where(eq(reservation.id, reservationId));
    return { status: "updated" };
  });
}

export type OrderView = {
  id: string;
  customerName: string;
  pickupDate: string;
  pickupTime: string | null;
  status: ReservationStatus;
  note: string | null;
  items: { productName: string; quantity: number; unitPrice: number }[];
  /** The customer can still cancel it themselves. */
  cancellable: boolean;
};

/** The order behind a link (R3), or null when unknown or expired. */
export async function orderByToken(
  db: Db,
  token: string,
  now: Temporal.Instant,
): Promise<OrderView | null> {
  const [row] = await db
    .select()
    .from(reservation)
    .where(eq(reservation.accessTokenHash, sha256(token)));
  if (!row || linkExpired(row.pickupDate, now)) return null;

  const items = await db
    .select({
      productName: reservationItem.productName,
      quantity: reservationItem.quantity,
      unitPrice: reservationItem.unitPrice,
    })
    .from(reservationItem)
    .where(eq(reservationItem.reservationId, row.id))
    .orderBy(reservationItem.productName);
  const cutoff = await cutoffTime(db);
  return {
    id: row.id,
    customerName: row.customerName,
    pickupDate: row.pickupDate,
    pickupTime: row.pickupTime,
    status: row.status,
    note: row.note,
    items,
    cancellable:
      row.status === "reserved" && isBeforeCutoff(row.pickupDate, now, cutoff),
  };
}

export type CancelResult = "cancelled" | "not_found" | "too_late";

/** The customer cancels through the link, until the cutoff (R3). */
export async function cancelByToken(
  db: Db,
  token: string,
  now: Temporal.Instant,
): Promise<CancelResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(reservation)
      .where(eq(reservation.accessTokenHash, sha256(token)))
      .for("update");
    if (!row || linkExpired(row.pickupDate, now)) return "not_found";
    if (row.status === "cancelled") return "cancelled";
    if (row.status !== "reserved") return "too_late";
    if (!isBeforeCutoff(row.pickupDate, now, await cutoffTime(tx)))
      return "too_late";

    await tx
      .update(reservation)
      .set({ status: "cancelled" })
      .where(
        and(eq(reservation.id, row.id), eq(reservation.status, "reserved")),
      );
    return "cancelled";
  });
}

function linkExpired(pickupDate: string, now: Temporal.Instant): boolean {
  return today(now) > addDays(pickupDate, ORDER_LINK_DAYS_AFTER_PICKUP);
}

/** 256 random bits, URL-safe; only its hash is stored (ADR 0007). */
function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** The order as the server understood it, independent of key order. */
function hashOrder(
  input: ReservationInput,
  phone: string,
  source: string,
): string {
  return sha256(
    JSON.stringify({
      source,
      customerName: input.customerName,
      phone,
      pickupDate: input.pickupDate,
      pickupTime: input.pickupTime ?? null,
      note: input.note || null,
      items: input.items
        .toSorted((a, b) => a.productId.localeCompare(b.productId))
        .map((i) => [i.productId, i.quantity]),
    }),
  );
}
