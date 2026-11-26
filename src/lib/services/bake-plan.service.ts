/** "Plán pečení" (R4): what to bake for a day, read from the reservations. */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Db } from "../db/types";
import { product, reservation, reservationItem } from "../db/schema";
import { bakePlan, type PlanRow } from "../domain/bake-plan";
import { COUNTED_STATUSES } from "../domain/reservation";
import { orderDeadline } from "../domain/time";
import { cutoffTime } from "./settings";

export type PlanNote = {
  customerName: string;
  pickupTime: string | null;
  note: string;
};

export type DayPlan = {
  rows: PlanRow[];
  /** Notes of the day's orders; they may change what is baked. */
  notes: PlanNote[];
  /** Orders for the day close at this moment (the cutoff the day before). */
  deadline: Temporal.Instant;
};

export async function dayPlan(db: Db, date: string): Promise<DayPlan> {
  const [products, items, notes, cutoff] = await Promise.all([
    // Every product, inactive ones too: bakePlan keeps those with orders.
    db
      .select({
        id: product.id,
        name: product.name,
        buffer: product.buffer,
        bakeDays: product.bakeDays,
        active: product.active,
      })
      .from(product),
    db
      .select({
        productId: reservationItem.productId,
        quantity: reservationItem.quantity,
        status: reservation.status,
        source: reservation.source,
      })
      .from(reservationItem)
      .innerJoin(reservation, eq(reservation.id, reservationItem.reservationId))
      .where(eq(reservation.pickupDate, date)),
    db
      .select({
        customerName: reservation.customerName,
        pickupTime: reservation.pickupTime,
        note: reservation.note,
      })
      .from(reservation)
      .where(
        and(
          eq(reservation.pickupDate, date),
          inArray(reservation.status, [...COUNTED_STATUSES]),
          isNotNull(reservation.note),
          sql`btrim(${reservation.note}) <> ''`,
        ),
      )
      .orderBy(
        sql`${reservation.pickupTime} asc nulls last`,
        sql`${reservation.customerName} collate "cs-CZ-x-icu"`,
        reservation.createdAt,
      ),
    cutoffTime(db),
  ]);

  return {
    rows: bakePlan(date, products, items),
    notes: notes.map((n) => ({
      customerName: n.customerName,
      pickupTime: n.pickupTime?.slice(0, 5) ?? null,
      note: n.note ?? "",
    })),
    deadline: orderDeadline(date, cutoff),
  };
}
