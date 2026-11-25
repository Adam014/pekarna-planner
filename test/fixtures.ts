/** Shared data for the database tests. */
import { and, eq, inArray } from "drizzle-orm";
import type { connect } from "./db";
import { COUNTED_STATUSES } from "../src/lib/domain/reservation";
import {
  product,
  reservation,
  reservationItem,
  user,
} from "../src/lib/db/schema";

type TestDb = ReturnType<typeof connect>["db"];

export const at = (iso: string) => Temporal.Instant.from(iso);

/** Wednesday 2026-11-25, 9:00 in Prague: before the 18:00 cutoff. */
export const WEDNESDAY_MORNING = at("2026-11-25T08:00:00Z");
export const FRIDAY = "2026-11-27";

export const WEEKDAYS = [1, 2, 3, 4, 5];

export async function addProduct(
  db: TestDb,
  values: Partial<typeof product.$inferInsert> & { name: string },
) {
  const [row] = await db
    .insert(product)
    .values({ price: 500, dailyLimit: 10, bakeDays: WEEKDAYS, ...values })
    .returning();
  if (!row) throw new Error("No product");
  return row;
}

export async function addStaff(db: TestDb) {
  const [row] = await db
    .insert(user)
    .values({
      id: "staff-1",
      name: "Tomáš",
      email: "staff@example.test",
      role: "staff",
    })
    .returning();
  if (!row) throw new Error("No user");
  return row;
}

/** Pieces of a product in reserved or picked-up reservations on a day. */
export async function pieces(db: TestDb, productId: string, date: string) {
  const rows = await db
    .select({ quantity: reservationItem.quantity })
    .from(reservationItem)
    .innerJoin(reservation, eq(reservation.id, reservationItem.reservationId))
    .where(
      and(
        eq(reservationItem.productId, productId),
        eq(reservation.pickupDate, date),
        inArray(reservation.status, [...COUNTED_STATUSES]),
      ),
    );
  return rows.reduce((sum, r) => sum + r.quantity, 0);
}
