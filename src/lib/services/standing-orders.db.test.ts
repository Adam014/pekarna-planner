import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { connect, emptyTables } from "../../../test/db";
import {
  addProduct,
  at,
  FRIDAY,
  pieces,
  WEDNESDAY_MORNING,
} from "../../../test/fixtures";
import {
  customer,
  product,
  reservation,
  reservationItem,
  standingOrder,
} from "../db/schema";
import type { StandingOrderInput } from "../validators/reservation";
import {
  createReservation,
  setReservationStatus,
} from "./reservations.service";
import {
  endStandingOrder,
  fillStandingOrderDays,
  saveStandingOrder,
} from "./standing-orders.service";

const { pool, db } = connect();
afterAll(() => pool.end());

let rohlik: typeof product.$inferSelect;
let chleb: typeof product.$inferSelect;

beforeEach(async () => {
  await emptyTables(db);
  rohlik = await addProduct(db, {
    name: "Rohlík",
    price: 450,
    dailyLimit: 100,
  });
  // Baked Monday to Thursday only.
  chleb = await addProduct(db, {
    name: "Chléb",
    price: 6000,
    dailyLimit: 20,
    bakeDays: [1, 2, 3, 4],
  });
});

function template(
  overrides: Partial<StandingOrderInput> = {},
): StandingOrderInput {
  return {
    customerName: "Kavárna U Mostu",
    phone: "+420 777 123 456",
    weekdays: [2, 5],
    pickupTime: "07:00",
    items: [
      { productId: rohlik.id, quantity: 20 },
      { productId: chleb.id, quantity: 2 },
    ],
    ...overrides,
  };
}

async function days() {
  return db
    .select({
      date: reservation.pickupDate,
      status: reservation.status,
      id: reservation.id,
    })
    .from(reservation)
    .where(eq(reservation.source, "standing_order"))
    .orderBy(asc(reservation.pickupDate));
}

/** Pieces of a product on a standing order day. */
async function quantityOn(date: string, productId: string) {
  const [row] = await db
    .select({ quantity: reservationItem.quantity })
    .from(reservationItem)
    .innerJoin(reservation, eq(reservation.id, reservationItem.reservationId))
    .where(
      and(
        eq(reservation.source, "standing_order"),
        eq(reservation.pickupDate, date),
        eq(reservationItem.productId, productId),
      ),
    );
  return row?.quantity;
}

async function save(input = template(), id?: string) {
  const result = await saveStandingOrder(db, input, WEDNESDAY_MORNING, id);
  if (result.status !== "saved") throw new Error(result.status);
  return result;
}

describe("saveStandingOrder", () => {
  it("creates its days 28 days ahead as ordinary reservations", async () => {
    await save();
    expect((await days()).map((d) => d.date)).toEqual([
      "2026-11-27",
      "2026-12-01",
      "2026-12-04",
      "2026-12-08",
      "2026-12-11",
      "2026-12-15",
      "2026-12-18",
      "2026-12-22",
    ]);
    const [first] = await db
      .select()
      .from(reservation)
      .where(eq(reservation.pickupDate, FRIDAY));
    expect(first).toMatchObject({
      customerName: "Kavárna U Mostu",
      customerPhone: "+420777123456",
      pickupTime: "07:00:00",
      status: "reserved",
      idempotencyKey: null,
    });
    expect(await pieces(db, rohlik.id, FRIDAY)).toBe(20);
  });

  it("leaves a product out on days it is not baked and says so", async () => {
    const result = await save();
    expect(result.notBaked).toEqual([
      expect.objectContaining({ weekday: 5, productId: chleb.id }),
    ]);
    expect(await quantityOn(FRIDAY, chleb.id)).toBeUndefined();
    expect(await quantityOn("2026-12-01", chleb.id)).toBe(2);
  });

  it("skips days that do not fit the limit and reports them", async () => {
    // Someone already ordered 15 of the 20 loaves for Tuesday 1 December.
    await createReservation(
      db,
      {
        customerName: "Jana",
        phone: "601 234 567",
        pickupDate: "2026-12-01",
        items: [{ productId: chleb.id, quantity: 15 }],
        idempotencyKey: randomUUID(),
      },
      { source: "online" },
      WEDNESDAY_MORNING,
    );
    const result = await save(
      template({ items: [{ productId: chleb.id, quantity: 10 }] }),
    );
    expect(result.skipped).toEqual([
      expect.objectContaining({
        date: "2026-12-01",
        remaining: 5,
        requested: 10,
      }),
    ]);
    expect((await days()).map((d) => d.date)).toEqual([
      "2026-12-08",
      "2026-12-15",
      "2026-12-22",
    ]);
    expect(await pieces(db, chleb.id, "2026-12-01")).toBe(15);
  });

  it("recreates only open future days on an edit", async () => {
    const { standingOrderId } = await save();
    const [, tuesday] = await days();
    if (!tuesday) throw new Error("No Tuesday");
    await setReservationStatus(db, tuesday.id, "cancelled", WEDNESDAY_MORNING);

    // Thursday evening: Friday's cutoff has passed.
    const thursday = at("2026-11-26T17:00:00Z");
    const edited = await saveStandingOrder(
      db,
      template({ items: [{ productId: rohlik.id, quantity: 30 }] }),
      thursday,
      standingOrderId,
    );
    expect(edited.status).toBe("saved");

    expect(await quantityOn(FRIDAY, rohlik.id)).toBe(20);
    expect(await quantityOn("2026-12-04", rohlik.id)).toBe(30);
    const after = await days();
    expect(after.find((d) => d.date === "2026-12-01")?.status).toBe(
      "cancelled",
    );
    expect(after.map((d) => d.date).at(-1)).toBe("2026-12-22");
  });

  it("keeps one customer per phone and takes the name the owner typed", async () => {
    await save(template({ customerName: "Kavarna" }));
    await save(template({ phone: "777123456", weekdays: [1] }));
    const customers = await db.select().from(customer);
    expect(customers).toEqual([
      expect.objectContaining({ name: "Kavárna U Mostu" }),
    ]);
    await fillStandingOrderDays(db, at("2026-12-02T08:00:00Z"));
    const [latest] = (await db.select().from(reservation)).toSorted((a, b) =>
      b.pickupDate.localeCompare(a.pickupDate),
    );
    expect(latest?.customerName).toBe("Kavárna U Mostu");
  });

  it("does not bring back an ended standing order", async () => {
    const { standingOrderId } = await save();
    await endStandingOrder(db, standingOrderId, WEDNESDAY_MORNING);
    expect(
      await saveStandingOrder(
        db,
        template(),
        WEDNESDAY_MORNING,
        standingOrderId,
      ),
    ).toEqual({ status: "rejected", reason: "ended" });
    expect(
      await saveStandingOrder(db, template(), WEDNESDAY_MORNING, randomUUID()),
    ).toEqual({ status: "rejected", reason: "not_found" });
  });
});

describe("fillStandingOrderDays", () => {
  it("adds the days that came into the horizon and nothing twice", async () => {
    await save();
    await fillStandingOrderDays(db, WEDNESDAY_MORNING);
    expect(await days()).toHaveLength(8);

    const nextWeek = at("2026-12-02T08:00:00Z");
    await Promise.all([
      fillStandingOrderDays(db, nextWeek),
      fillStandingOrderDays(db, nextWeek),
    ]);
    const dates = (await days()).map((d) => d.date);
    expect(dates.at(-1)).toBe("2026-12-29");
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("leaves room for online customers only after its days", async () => {
    await db
      .update(product)
      .set({ dailyLimit: 21 })
      .where(eq(product.id, rohlik.id));
    await save();
    const online = await createReservation(
      db,
      {
        customerName: "Jana",
        phone: "601 234 567",
        pickupDate: FRIDAY,
        items: [{ productId: rohlik.id, quantity: 2 }],
        idempotencyKey: randomUUID(),
      },
      { source: "online" },
      WEDNESDAY_MORNING,
    );
    expect(online).toMatchObject({ status: "rejected", reason: "sold_out" });
  });

  it("creates a skipped day once there is room", async () => {
    const jana = await createReservation(
      db,
      {
        customerName: "Jana",
        phone: "601 234 567",
        pickupDate: "2026-12-01",
        items: [{ productId: chleb.id, quantity: 15 }],
        idempotencyKey: randomUUID(),
      },
      { source: "online" },
      WEDNESDAY_MORNING,
    );
    if (jana.status !== "created") throw new Error(jana.status);
    await save(template({ items: [{ productId: chleb.id, quantity: 10 }] }));
    expect(
      (await fillStandingOrderDays(db, WEDNESDAY_MORNING)).skipped,
    ).toHaveLength(1);

    await setReservationStatus(
      db,
      jana.reservationId,
      "cancelled",
      WEDNESDAY_MORNING,
    );
    expect(
      (await fillStandingOrderDays(db, WEDNESDAY_MORNING)).skipped,
    ).toEqual([]);
    expect(await quantityOn("2026-12-01", chleb.id)).toBe(10);
  });
});

describe("endStandingOrder", () => {
  it("removes open future days and keeps the rest", async () => {
    const { standingOrderId } = await save();
    const thursday = at("2026-11-26T17:00:00Z");
    expect(await endStandingOrder(db, standingOrderId, thursday)).toBe("ended");
    expect((await days()).map((d) => d.date)).toEqual([FRIDAY]);
    await fillStandingOrderDays(db, thursday);
    expect(await days()).toHaveLength(1);
  });
});

describe("running at the same time", () => {
  it("never brings back days of an order ended during a fill", async () => {
    for (let run = 0; run < 10; run++) {
      await emptyTables(db);
      rohlik = await addProduct(db, { name: "Rohlík", dailyLimit: 100 });
      const { standingOrderId } = await save(
        template({ items: [{ productId: rohlik.id, quantity: 5 }] }),
      );
      const later = at("2026-12-09T08:00:00Z");
      await Promise.all([
        fillStandingOrderDays(db, later),
        endStandingOrder(db, standingOrderId, later),
      ]);
      const open = (await days()).filter((d) => d.date > "2026-12-10");
      expect(open).toEqual([]);
    }
  });

  it("edits and fills without a deadlock", async () => {
    const { standingOrderId } = await save();
    const later = at("2026-12-09T08:00:00Z");
    for (let run = 0; run < 10; run++) {
      const [edit] = await Promise.all([
        saveStandingOrder(
          db,
          template({ items: [{ productId: rohlik.id, quantity: 20 + run }] }),
          later,
          standingOrderId,
        ),
        fillStandingOrderDays(db, later),
      ]);
      expect(edit.status).toBe("saved");
    }
  });
});
