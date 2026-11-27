/**
 * The public order form (R2): what is on offer, and the order as saved.
 * Saving goes through createReservation() with the online channel.
 */
import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/types";
import { product, reservation, reservationItem } from "../db/schema";
import { offer, type OfferDay } from "../domain/offer";
import { bookableDates } from "../domain/time";
import { demandKey, orderedPieces } from "./demand";
import { cutoffTime } from "./settings";

export type OrderOffer = {
  /** The order cutoff, e.g. '18:00:00'. */
  cutoff: string;
  /** Active products by Czech name. */
  products: {
    id: string;
    name: string;
    /** In haléře. */
    price: number;
    bakeDays: number[];
  }[];
  /** Days a customer can still order for, each with something baked. */
  days: OfferDay[];
};

/**
 * Days and products for the form, with what is left. A snapshot: the order
 * is checked again when it is saved.
 */
export async function orderOffer(
  db: Db,
  now: Temporal.Instant,
): Promise<OrderOffer> {
  const [cutoff, products] = await Promise.all([
    cutoffTime(db),
    db
      .select({
        id: product.id,
        name: product.name,
        price: product.price,
        dailyLimit: product.dailyLimit,
        bakeDays: product.bakeDays,
      })
      .from(product)
      .where(eq(product.active, true))
      .orderBy(sql`${product.name} collate "cs-CZ-x-icu"`),
  ]);
  const dates = bookableDates(now, cutoff);
  const ordered = await orderedPieces(
    db,
    dates,
    products.map((p) => p.id),
  );
  return {
    cutoff,
    products: products.map(({ id, name, price, bakeDays }) => ({
      id,
      name,
      price,
      bakeDays,
    })),
    days: offer(
      dates,
      products,
      (date, id) => ordered.get(demandKey(date, id)) ?? 0,
    ),
  };
}

export type SavedOrder = {
  pickupDate: string;
  items: { productName: string; quantity: number; unitPrice: number }[];
};

/** The saved order with its copied names and prices, for the confirmation. */
export async function savedOrder(
  db: Db,
  reservationId: string,
): Promise<SavedOrder> {
  const [row] = await db
    .select({ pickupDate: reservation.pickupDate })
    .from(reservation)
    .where(eq(reservation.id, reservationId));
  if (!row) throw new Error(`Reservation ${reservationId} not found`);
  const items = await db
    .select({
      productName: reservationItem.productName,
      quantity: reservationItem.quantity,
      unitPrice: reservationItem.unitPrice,
    })
    .from(reservationItem)
    .where(eq(reservationItem.reservationId, reservationId))
    .orderBy(
      sql`${reservationItem.productName} collate "cs-CZ-x-icu"`,
      asc(reservationItem.productId),
    );
  return { pickupDate: row.pickupDate, items };
}
