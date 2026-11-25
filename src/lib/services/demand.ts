/**
 * The daily limit (ADR 0007): lock the product rows, then sum what is
 * already ordered. Two orders for the same product wait for each other, so
 * both cannot take the last pieces.
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "../db/types";
import { COUNTED_STATUSES } from "../domain/reservation";
import { product, reservation, reservationItem } from "../db/schema";

export type LockedProduct = typeof product.$inferSelect;

/**
 * Locks the products until the transaction ends. Sorted by id, so two
 * transactions always lock in the same order and cannot deadlock.
 */
export async function lockProducts(
  tx: Tx,
  ids: readonly string[],
): Promise<Map<string, LockedProduct>> {
  if (ids.length === 0) return new Map();
  const rows = await tx
    .select()
    .from(product)
    .where(inArray(product.id, [...ids]))
    .orderBy(asc(product.id))
    .for("update");
  return new Map(rows.map((row) => [row.id, row]));
}

/** Pieces already ordered (reserved or picked up), by day and product. */
export async function orderedPieces(
  tx: Tx,
  dates: readonly string[],
  productIds: readonly string[],
): Promise<Map<string, number>> {
  if (dates.length === 0 || productIds.length === 0) return new Map();
  const rows = await tx
    .select({
      pickupDate: reservation.pickupDate,
      productId: reservationItem.productId,
      // sum() is bigint, which node-postgres returns as a string.
      pieces: sql<number>`sum(${reservationItem.quantity})::int`,
    })
    .from(reservationItem)
    .innerJoin(reservation, eq(reservation.id, reservationItem.reservationId))
    .where(
      and(
        inArray(reservation.pickupDate, [...dates]),
        inArray(reservation.status, [...COUNTED_STATUSES]),
        inArray(reservationItem.productId, [...productIds]),
      ),
    )
    .groupBy(reservation.pickupDate, reservationItem.productId);
  return new Map(
    rows.map((r) => [demandKey(r.pickupDate, r.productId), r.pieces]),
  );
}

export const demandKey = (date: string, productId: string) =>
  `${date}|${productId}`;

/** A product that would go over its daily limit on a day. */
export type OverLimit = {
  kind: "over_limit";
  date: string;
  productId: string;
  productName: string;
  /** Pieces still free before this order (never below 0). */
  remaining: number;
  requested: number;
};

export function overLimit(
  date: string,
  items: readonly { productId: string; quantity: number }[],
  products: Map<string, LockedProduct>,
  ordered: Map<string, number>,
): OverLimit[] {
  return items.flatMap((item) => {
    const p = products.get(item.productId);
    if (!p) return [];
    const taken = ordered.get(demandKey(date, item.productId)) ?? 0;
    const remaining = Math.max(0, p.dailyLimit - taken);
    return item.quantity > remaining
      ? [
          {
            kind: "over_limit" as const,
            date,
            productId: p.id,
            productName: p.name,
            remaining,
            requested: item.quantity,
          },
        ]
      : [];
  });
}
