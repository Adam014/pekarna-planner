import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { connect, emptyTables } from "../../../test/db";
import {
  addProduct,
  at,
  FRIDAY,
  WEDNESDAY_MORNING,
} from "../../../test/fixtures";
import { product, reservation } from "../db/schema";
import type { ReservationStatus } from "../domain/reservation";
import { orderOffer, savedOrder } from "./online-order.service";
import { createReservation } from "./reservations.service";

const { pool, db } = connect();
afterAll(() => pool.end());

let rohlik: typeof product.$inferSelect;

beforeEach(async () => {
  await emptyTables(db);
  rohlik = await addProduct(db, { name: "Rohlík", price: 450, dailyLimit: 10 });
});

async function book(quantity: number, status: ReservationStatus = "reserved") {
  const result = await createReservation(
    db,
    {
      customerName: "Jana Nováková",
      phone: "601 234 567",
      pickupDate: FRIDAY,
      items: [{ productId: rohlik.id, quantity }],
      idempotencyKey: randomUUID(),
    },
    { source: "online" },
    WEDNESDAY_MORNING,
  );
  if (result.status !== "created") throw new Error(result.status);
  if (status !== "reserved") {
    await db
      .update(reservation)
      .set({ status })
      .where(eq(reservation.id, result.reservationId));
  }
  return result.reservationId;
}

const remainingOn = (
  days: Awaited<ReturnType<typeof orderOffer>>["days"],
  date: string,
) => days.find((d) => d.date === date)?.items[0]?.remaining;

describe("orderOffer", () => {
  it("offers tomorrow until the cutoff, then from the day after", async () => {
    const before = await orderOffer(db, WEDNESDAY_MORNING);
    expect(before.days[0]?.date).toBe("2026-11-26");
    // 18:00 in Prague on Wednesday: orders for Thursday are closed.
    const after = await orderOffer(db, at("2026-11-25T17:00:00Z"));
    expect(after.days[0]?.date).toBe(FRIDAY);
  });

  it("goes at most 21 days ahead and skips days nothing is baked", async () => {
    const { days } = await orderOffer(db, WEDNESDAY_MORNING);
    expect(days.at(-1)?.date).toBe("2026-12-16");
    // Weekdays only: no Saturday 28 or Sunday 29 November.
    expect(days.map((d) => d.date)).not.toContain("2026-11-28");
    expect(days.map((d) => d.date)).not.toContain("2026-11-29");
  });

  it("subtracts reserved and picked-up pieces, not cancelled or no-show", async () => {
    await book(2);
    await book(3, "picked_up");
    await book(1, "cancelled");
    await book(4, "no_show");
    const { days } = await orderOffer(db, WEDNESDAY_MORNING);
    expect(remainingOn(days, FRIDAY)).toBe(5);
    expect(remainingOn(days, "2026-11-26")).toBe(10);
  });

  it("lists active products by Czech name, with the cutoff", async () => {
    await addProduct(db, { name: "Chléb" });
    await addProduct(db, { name: "Čokoládový koláč" });
    await addProduct(db, { name: "Cibulák" });
    await addProduct(db, { name: "Vánočka", active: false });
    const offer = await orderOffer(db, WEDNESDAY_MORNING);
    expect(offer.products.map((p) => p.name)).toEqual([
      "Cibulák",
      "Čokoládový koláč",
      "Chléb",
      "Rohlík",
    ]);
    expect(offer.cutoff).toBe("18:00:00");
  });
});

describe("savedOrder", () => {
  it("gives the day and the copied names and prices", async () => {
    const id = await book(2);
    await db
      .update(product)
      .set({ name: "Rohlík tukový", price: 500 })
      .where(eq(product.id, rohlik.id));
    expect(await savedOrder(db, id)).toEqual({
      pickupDate: FRIDAY,
      items: [{ productName: "Rohlík", quantity: 2, unitPrice: 450 }],
    });
  });
});
