import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { connect, emptyTables } from "../../../test/db";
import { addStaff, at, WEDNESDAY_MORNING } from "../../../test/fixtures";
import { today } from "../domain/time";
import { resetDemo, seedDemo } from "./demo-data";
import { product, reservation, standingOrder } from "./schema";

const { pool, db } = connect();
afterAll(() => pool.end());

let staffId: string;
beforeEach(async () => {
  await emptyTables(db);
  staffId = (await addStaff(db)).id;
});

/** Pieces per product and day that count towards the limit, over it. */
async function overLimit() {
  const { rows } = await db.execute(sql`
    select p.name, r.pickup_date, sum(i.quantity)::int as pieces, p.daily_limit
    from reservation_item i
    join reservation r on r.id = i.reservation_id
    join product p on p.id = i.product_id
    where r.status in ('reserved', 'picked_up')
    group by p.name, p.daily_limit, r.pickup_date
    having sum(i.quantity) > p.daily_limit`);
  return rows;
}

describe("seedDemo", () => {
  it("fills an empty database within every limit", async () => {
    expect(await seedDemo(db, WEDNESDAY_MORNING, staffId)).toBe("created");

    expect(await db.select().from(product)).toHaveLength(9);
    expect(await db.select().from(standingOrder)).toHaveLength(3);
    const todays = await db
      .select({ status: reservation.status, source: reservation.source })
      .from(reservation)
      .where(sql`${reservation.pickupDate} = '2026-11-25'`);
    expect(todays.map((r) => r.status)).toEqual(
      expect.arrayContaining(["reserved", "picked_up", "no_show"]),
    );
    // The café and the kindergarten already have today's day.
    expect(todays.filter((r) => r.source === "standing_order")).toHaveLength(2);

    const orders = await db
      .select({ source: reservation.source })
      .from(reservation)
      .where(inArray(reservation.source, ["phone", "online"]));
    expect(orders).toHaveLength(19);
    expect(orders.filter((o) => o.source === "online").length).toBeGreaterThan(
      3,
    );
    expect(await overLimit()).toEqual([]);
  });

  it("does nothing when there already are products", async () => {
    await seedDemo(db, WEDNESDAY_MORNING, staffId);
    const before = await db.select().from(reservation);
    expect(await seedDemo(db, WEDNESDAY_MORNING, staffId)).toBe("skipped");
    expect(await db.select().from(reservation)).toHaveLength(before.length);
  });

  it("starts over after a reset", async () => {
    await seedDemo(db, WEDNESDAY_MORNING, staffId);
    await resetDemo(db);
    expect(await seedDemo(db, WEDNESDAY_MORNING, staffId)).toBe("created");
  });

  // Evening after the cutoff, Saturday evening (tomorrow closed), Sunday.
  it.each([
    "2026-11-25T19:00:00Z",
    "2026-11-28T19:00:00Z",
    "2026-11-29T09:00:00Z",
  ])("keeps every order on any day and time (%s)", async (iso) => {
    expect(await seedDemo(db, at(iso), staffId)).toBe("created");
    const orders = await db
      .select({ date: reservation.pickupDate, status: reservation.status })
      .from(reservation)
      .where(inArray(reservation.source, ["phone", "online"]));
    expect(orders).toHaveLength(19);
    // Marks only on today's orders; on Sunday there are none.
    const marked = orders.filter((o) => o.status !== "reserved");
    expect(marked.every((o) => o.date === today(at(iso)))).toBe(true);
    expect(await overLimit()).toEqual([]);
  });
});
