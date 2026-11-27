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
  listStandingOrders,
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

  it("keeps one customer per phone and renames only its own customer", async () => {
    const { standingOrderId } = await save(
      template({ customerName: "Kavarna" }),
    );
    // An edit of the order renames its customer (the owner fixed a typo).
    await save(template({ customerName: "Kavárna U Mostu" }), standingOrderId);
    // A new order with a known phone keeps that customer's name.
    await save(template({ customerName: "Jiný název", weekdays: [1] }));
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

  it("does not rename another customer when the phone changes to theirs", async () => {
    await save(template({ customerName: "MŠ Sluníčko", phone: "777000102" }));
    const { standingOrderId } = await save(
      template({ customerName: "Bistro", phone: "777000103", weekdays: [1] }),
    );
    await save(
      template({
        customerName: "Školní jídelna",
        phone: "777000102",
        weekdays: [1],
      }),
      standingOrderId,
    );
    const names = (await db.select().from(customer))
      .map((c) => c.name)
      .toSorted();
    expect(names).toEqual(["Bistro", "MŠ Sluníčko"]);
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

describe("editing (R7 screen)", () => {
  it("drops the open days of a removed weekday and keeps a cancelled one", async () => {
    const { standingOrderId } = await save();
    const tuesdays = (await days()).filter((d) => d.date === "2026-12-08");
    const [cancelled] = tuesdays;
    if (!cancelled) throw new Error("No Tuesday");
    await setReservationStatus(
      db,
      cancelled.id,
      "cancelled",
      WEDNESDAY_MORNING,
    );

    await save(template({ weekdays: [5] }), standingOrderId);
    const after = await days();
    expect(
      after.filter((d) => d.status === "reserved").map((d) => d.date),
    ).toEqual(["2026-11-27", "2026-12-04", "2026-12-11", "2026-12-18"]);
    expect(after.find((d) => d.date === "2026-12-08")?.status).toBe(
      "cancelled",
    );
  });

  it("saves an edit that no longer fits the limit and reports the day", async () => {
    const { standingOrderId } = await save(
      template({ items: [{ productId: chleb.id, quantity: 5 }] }),
    );
    // Someone else takes 12 of the 20 loaves for Tuesday 1 December.
    await createReservation(
      db,
      {
        customerName: "Jana",
        phone: "601 234 567",
        pickupDate: "2026-12-01",
        items: [{ productId: chleb.id, quantity: 12 }],
        idempotencyKey: randomUUID(),
      },
      { source: "online" },
      WEDNESDAY_MORNING,
    );

    const edited = await save(
      template({ items: [{ productId: chleb.id, quantity: 10 }] }),
      standingOrderId,
    );
    expect(edited.skipped).toEqual([
      expect.objectContaining({
        date: "2026-12-01",
        productName: "Chléb",
        remaining: 8,
        standingOrderId,
      }),
    ]);
    // The old day was deleted and could not be recreated.
    expect((await days()).map((d) => d.date)).not.toContain("2026-12-01");
    expect(await quantityOn("2026-12-08", chleb.id)).toBe(10);
  });
});

describe("listStandingOrders", () => {
  it("lists active orders first, by name the Czech way, with their items", async () => {
    const dilna = await save(
      template({ customerName: "Dílna", phone: "777 000 001" }),
    );
    await save(
      template({
        customerName: "Čajovna",
        phone: "777 000 002",
        items: [{ productId: rohlik.id, quantity: 3 }],
      }),
    );
    await save(template({ customerName: "Cukrárna", phone: "777 000 003" }));
    await endStandingOrder(db, dilna.standingOrderId, WEDNESDAY_MORNING);
    await db
      .update(product)
      .set({ active: false })
      .where(eq(product.id, chleb.id));

    const rows = await listStandingOrders(db);
    expect(rows.map((r) => [r.customerName, r.active])).toEqual([
      ["Cukrárna", true],
      ["Čajovna", true],
      ["Dílna", false],
    ]);
    expect(rows[0]).toMatchObject({
      phone: "+420777000003",
      weekdays: [2, 5],
      pickupTime: "07:00",
      note: null,
      items: [
        {
          productId: chleb.id,
          productName: "Chléb",
          quantity: 2,
          productActive: false,
        },
        {
          productId: rohlik.id,
          productName: "Rohlík",
          quantity: 20,
          productActive: true,
        },
      ],
    });
    expect(rows[1]?.items).toHaveLength(1);
    const [ended] = await db
      .select({ active: standingOrder.active })
      .from(standingOrder)
      .where(eq(standingOrder.id, dilna.standingOrderId));
    expect(ended?.active).toBe(false);
  });

  it("is empty without standing orders", async () => {
    expect(await listStandingOrders(db)).toEqual([]);
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
    const { standingOrderId } = await save(
      template({ items: [{ productId: chleb.id, quantity: 10 }] }),
    );
    // Tagged with its standing order, so the screen shows it on that row.
    expect(
      (await fillStandingOrderDays(db, WEDNESDAY_MORNING)).skipped,
    ).toEqual([
      expect.objectContaining({ date: "2026-12-01", standingOrderId }),
    ]);

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
