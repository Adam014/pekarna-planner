import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { connect, emptyTables } from "../../../test/db";
import {
  addProduct,
  addStaff,
  FRIDAY,
  WEDNESDAY_MORNING,
} from "../../../test/fixtures";
import { reservation } from "../db/schema";
import { dayPlan } from "./bake-plan.service";
import { createReservation } from "./reservations.service";

const { pool, db } = connect();
afterAll(() => pool.end());

let rohlikId: string;
let staffId: string;

beforeEach(async () => {
  await emptyTables(db);
  rohlikId = (
    await addProduct(db, {
      name: "Rohlík",
      price: 450,
      dailyLimit: 100,
      buffer: 10,
    })
  ).id;
  staffId = (await addStaff(db)).id;
});

async function book(
  quantity: number,
  extra: { note?: string; pickupTime?: string; customerName?: string } = {},
) {
  const result = await createReservation(
    db,
    {
      customerName: extra.customerName ?? "Jana Nováková",
      phone: "601 234 567",
      pickupDate: FRIDAY,
      items: [{ productId: rohlikId, quantity }],
      idempotencyKey: randomUUID(),
      ...extra,
    },
    { source: "phone", userId: staffId },
    WEDNESDAY_MORNING,
  );
  if (result.status !== "created") throw new Error(result.status);
  return result.reservationId;
}

describe("dayPlan", () => {
  it("sums the day's orders with the buffer", async () => {
    await book(20);
    await book(5);
    const plan = await dayPlan(db, FRIDAY);
    expect(plan.rows).toEqual([
      expect.objectContaining({
        name: "Rohlík",
        orders: 25,
        standing: 0,
        buffer: 10,
        toBake: 35,
      }),
    ]);
  });

  it("leaves out cancelled orders and their notes", async () => {
    const id = await book(20, { note: "Bez mašle" });
    await db
      .update(reservation)
      .set({ status: "cancelled" })
      .where(eq(reservation.id, id));
    const plan = await dayPlan(db, FRIDAY);
    expect(plan.rows[0]?.toBake).toBe(10);
    expect(plan.notes).toEqual([]);
  });

  it("lists notes by pickup time, without blank ones", async () => {
    await book(1, {
      customerName: "Petr",
      note: "Nakrájet",
      pickupTime: "10:00",
    });
    await book(1, {
      customerName: "Eva",
      note: "Dobře upečené",
      pickupTime: "07:30",
    });
    await book(1, { customerName: "Ota", note: "   " });
    expect((await dayPlan(db, FRIDAY)).notes).toEqual([
      { customerName: "Eva", pickupTime: "07:30", note: "Dobře upečené" },
      { customerName: "Petr", pickupTime: "10:00", note: "Nakrájet" },
    ]);
  });

  it("gives the order deadline: the cutoff the day before", async () => {
    const plan = await dayPlan(db, FRIDAY);
    // 18:00 in Prague on Thursday 26 November is 17:00 UTC.
    expect(plan.deadline.toString()).toBe("2026-11-26T17:00:00Z");
  });
});
