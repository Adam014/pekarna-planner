import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { connect, emptyTables } from "../../../test/db";
import {
  addProduct,
  addStaff,
  at,
  FRIDAY,
  pieces,
  WEDNESDAY_MORNING,
} from "../../../test/fixtures";
import { customer, product, reservation, reservationItem } from "../db/schema";
import type { ReservationInput } from "../validators/reservation";
import {
  cancelByToken,
  createReservation,
  dayReservations,
  orderByToken,
  phoneOrderForm,
  setReservationStatus,
} from "./reservations.service";
import { listCustomers } from "./customers";

const { pool, db } = connect();
afterAll(() => pool.end());

let rohlik: typeof product.$inferSelect;
let staffId: string;

beforeEach(async () => {
  await emptyTables(db);
  rohlik = await addProduct(db, { name: "Rohlík", price: 450, dailyLimit: 5 });
  staffId = (await addStaff(db)).id;
});

function order(overrides: Partial<ReservationInput> = {}): ReservationInput {
  return {
    customerName: "Jana Nováková",
    phone: "601 234 567",
    pickupDate: FRIDAY,
    items: [{ productId: rohlik.id, quantity: 2 }],
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}
const online = { source: "online" } as const;
/** Friday 9:00 in Prague: the pickup day of `order()`. */
const FRIDAY_MORNING = at("2026-11-27T08:00:00Z");
const phone = () => ({ source: "phone" as const, userId: staffId });

describe("createReservation online", () => {
  it("saves the order with copies of the customer, name and price", async () => {
    const result = await createReservation(
      db,
      order(),
      online,
      WEDNESDAY_MORNING,
    );
    expect(result).toMatchObject({ status: "created" });
    if (result.status !== "created") return;
    expect(result.token).toMatch(/^[\w-]{43}$/);

    const [saved] = await db
      .select()
      .from(reservation)
      .where(eq(reservation.id, result.reservationId));
    expect(saved).toMatchObject({
      customerName: "Jana Nováková",
      customerPhone: "+420601234567",
      source: "online",
      status: "reserved",
    });
    expect(saved?.accessTokenHash).not.toBe(result.token);
    const items = await db.select().from(reservationItem);
    expect(items).toEqual([
      expect.objectContaining({
        productName: "Rohlík",
        quantity: 2,
        unitPrice: 450,
      }),
    ]);
  });

  it("keeps a past order as it was when the product changes", async () => {
    await createReservation(db, order(), online, WEDNESDAY_MORNING);
    await db
      .update(product)
      .set({ name: "Rohlík tukový", price: 600 })
      .where(eq(product.id, rohlik.id));
    const [item] = await db.select().from(reservationItem);
    expect(item).toMatchObject({ productName: "Rohlík", unitPrice: 450 });
  });

  it.each([
    ["today", "2026-11-25"],
    ["a day not baked", "2026-11-28"],
    ["more than 21 days ahead", "2026-12-17"],
  ])("refuses %s", async (_, pickupDate) => {
    const result = await createReservation(
      db,
      order({ pickupDate }),
      online,
      WEDNESDAY_MORNING,
    );
    expect(result).toEqual({ status: "rejected", reason: "day_not_bookable" });
  });

  it("refuses tomorrow after the cutoff", async () => {
    const evening = at("2026-11-25T17:00:00Z");
    const result = await createReservation(
      db,
      order({ pickupDate: "2026-11-26" }),
      online,
      evening,
    );
    expect(result).toEqual({ status: "rejected", reason: "day_not_bookable" });
  });

  it("refuses more than is left and says how many are left", async () => {
    await createReservation(
      db,
      order({ items: [{ productId: rohlik.id, quantity: 4 }] }),
      online,
      WEDNESDAY_MORNING,
    );
    const result = await createReservation(
      db,
      order(),
      online,
      WEDNESDAY_MORNING,
    );
    expect(result).toMatchObject({
      status: "rejected",
      reason: "sold_out",
      overLimit: [{ productId: rohlik.id, remaining: 1, requested: 2 }],
    });
  });

  it("refuses an invalid phone and an inactive product", async () => {
    expect(
      await createReservation(
        db,
        order({ phone: "123" }),
        online,
        WEDNESDAY_MORNING,
      ),
    ).toEqual({ status: "rejected", reason: "invalid_phone" });
    await db
      .update(product)
      .set({ active: false })
      .where(eq(product.id, rohlik.id));
    expect(
      await createReservation(db, order(), online, WEDNESDAY_MORNING),
    ).toEqual({
      status: "rejected",
      reason: "inactive_product",
    });
  });

  it("does not rename an existing customer", async () => {
    await db
      .insert(customer)
      .values({ name: "Jana N.", phone: "+420601234567" });
    await createReservation(
      db,
      order({ customerName: "Jana" }),
      online,
      WEDNESDAY_MORNING,
    );
    const customers = await db.select().from(customer);
    expect(customers).toEqual([expect.objectContaining({ name: "Jana N." })]);
    const [saved] = await db.select().from(reservation);
    expect(saved?.customerName).toBe("Jana");
  });

  it("sells exactly the limit to twenty concurrent customers", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createReservation(
          db,
          order({
            phone: `601 234 ${String(100 + i)}`,
            items: [{ productId: rohlik.id, quantity: 1 }],
          }),
          online,
          WEDNESDAY_MORNING,
        ),
      ),
    );
    expect(results.filter((r) => r.status === "created")).toHaveLength(5);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(15);
    expect(await pieces(db, rohlik.id, FRIDAY)).toBe(5);
  });
});

describe("createReservation by phone", () => {
  it("refuses going over the limit, even when confirmed", async () => {
    const big = order({ items: [{ productId: rohlik.id, quantity: 8 }] });
    const result = await createReservation(
      db,
      big,
      { ...phone(), confirmed: true },
      WEDNESDAY_MORNING,
    );
    expect(result).toMatchObject({
      status: "rejected",
      reason: "sold_out",
      overLimit: [{ remaining: 5, requested: 8 }],
    });
    expect(await db.select().from(reservation)).toHaveLength(0);
  });

  it("asks before a day the product is not baked, then saves", async () => {
    const saturday = order({ pickupDate: "2026-11-28" });
    const result = await createReservation(
      db,
      saturday,
      phone(),
      WEDNESDAY_MORNING,
    );
    expect(result).toMatchObject({
      status: "needs_confirmation",
      warnings: [{ kind: "not_baked", productId: rohlik.id }],
    });
    expect(await db.select().from(reservation)).toHaveLength(0);

    const confirmed = await createReservation(
      db,
      saturday,
      { ...phone(), confirmed: true },
      WEDNESDAY_MORNING,
    );
    expect(confirmed).toMatchObject({ status: "created" });
    if (confirmed.status === "created") expect(confirmed.token).toBeUndefined();
  });

  it("refuses a product that does not exist", async () => {
    const result = await createReservation(
      db,
      order({ items: [{ productId: randomUUID(), quantity: 1 }] }),
      phone(),
      WEDNESDAY_MORNING,
    );
    expect(result).toEqual({ status: "rejected", reason: "unknown_product" });
  });

  it("books today and after the cutoff, but not a past day", async () => {
    const evening = at("2026-11-25T17:00:00Z");
    for (const pickupDate of ["2026-11-25", "2026-11-26"]) {
      const result = await createReservation(
        db,
        order({ pickupDate }),
        phone(),
        evening,
      );
      expect(result).toMatchObject({ status: "created" });
    }
    const past = await createReservation(
      db,
      order({ pickupDate: "2026-11-24" }),
      phone(),
      evening,
    );
    expect(past).toEqual({ status: "rejected", reason: "day_not_bookable" });
  });
});

describe("double submit", () => {
  it("returns the same order with a new link that replaces the old one", async () => {
    const input = order();
    const first = await createReservation(db, input, online, WEDNESDAY_MORNING);
    const again = await createReservation(db, input, online, WEDNESDAY_MORNING);
    if (first.status !== "created" || again.status !== "replayed") {
      throw new Error(`Unexpected ${first.status} / ${again.status}`);
    }
    expect(again.reservationId).toBe(first.reservationId);
    expect(again.token).not.toBe(first.token);
    expect(
      await orderByToken(db, again.token ?? "", WEDNESDAY_MORNING),
    ).not.toBeNull();
    expect(
      await orderByToken(db, first.token ?? "", WEDNESDAY_MORNING),
    ).toBeNull();
    expect(await db.select().from(reservation)).toHaveLength(1);
  });

  it("saves once when both submits arrive at the same time", async () => {
    const input = order();
    const results = await Promise.all([
      createReservation(db, input, online, WEDNESDAY_MORNING),
      createReservation(db, input, online, WEDNESDAY_MORNING),
    ]);
    expect(results.map((r) => r.status).toSorted()).toEqual([
      "created",
      "replayed",
    ]);
    expect(await db.select().from(reservation)).toHaveLength(1);
  });

  it("refuses the same key with a different order or after 24 hours", async () => {
    const input = order();
    await createReservation(db, input, online, WEDNESDAY_MORNING);
    const changed = await createReservation(
      db,
      { ...input, items: [{ productId: rohlik.id, quantity: 3 }] },
      online,
      WEDNESDAY_MORNING,
    );
    expect(changed).toEqual({
      status: "rejected",
      reason: "idempotency_conflict",
    });
    const late = await createReservation(
      db,
      input,
      online,
      Temporal.Now.instant().add({ hours: 25 }),
    );
    expect(late).toEqual({
      status: "rejected",
      reason: "idempotency_conflict",
    });
  });
});

describe("setReservationStatus", () => {
  it("marks a reservation and can put the mark back", async () => {
    const created = await createReservation(
      db,
      order(),
      online,
      WEDNESDAY_MORNING,
    );
    if (created.status !== "created") throw new Error(created.status);
    expect(
      await setReservationStatus(
        db,
        created.reservationId,
        "picked_up",
        FRIDAY_MORNING,
      ),
    ).toEqual({
      status: "updated",
    });
    expect(
      await setReservationStatus(
        db,
        created.reservationId,
        "reserved",
        FRIDAY_MORNING,
      ),
    ).toEqual({
      status: "updated",
    });
  });

  it("refuses bringing back an order that no longer fits", async () => {
    const first = await createReservation(
      db,
      order(),
      online,
      WEDNESDAY_MORNING,
    );
    if (first.status !== "created") throw new Error(first.status);
    await setReservationStatus(
      db,
      first.reservationId,
      "cancelled",
      FRIDAY_MORNING,
    );
    await createReservation(
      db,
      order({ items: [{ productId: rohlik.id, quantity: 5 }] }),
      online,
      WEDNESDAY_MORNING,
    );
    expect(
      await setReservationStatus(
        db,
        first.reservationId,
        "reserved",
        FRIDAY_MORNING,
      ),
    ).toMatchObject({
      status: "sold_out",
      overLimit: [{ remaining: 0, requested: 2 }],
    });
    expect(await pieces(db, rohlik.id, FRIDAY)).toBe(5);
  });

  it("marks picked up or no-show only once the day has come", async () => {
    const created = await createReservation(
      db,
      order(),
      online,
      WEDNESDAY_MORNING,
    );
    if (created.status !== "created") throw new Error(created.status);
    const id = created.reservationId;
    for (const status of ["picked_up", "no_show"] as const) {
      expect(
        await setReservationStatus(db, id, status, WEDNESDAY_MORNING),
      ).toEqual({ status: "too_early" });
    }
    expect(
      await setReservationStatus(db, id, "cancelled", WEDNESDAY_MORNING),
    ).toEqual({ status: "updated" });
  });

  it("refuses a change made from a stale list", async () => {
    const created = await createReservation(
      db,
      order(),
      online,
      WEDNESDAY_MORNING,
    );
    if (created.status !== "created") throw new Error(created.status);
    const id = created.reservationId;
    // One tablet marks it picked up; another, still showing "reserved",
    // marks a no-show.
    await setReservationStatus(db, id, "picked_up", FRIDAY_MORNING, "reserved");
    expect(
      await setReservationStatus(db, id, "no_show", FRIDAY_MORNING, "reserved"),
    ).toEqual({ status: "changed" });
    const [row] = await db
      .select({ status: reservation.status })
      .from(reservation)
      .where(eq(reservation.id, id));
    expect(row?.status).toBe("picked_up");
  });

  it("reports an unknown reservation", async () => {
    expect(
      await setReservationStatus(db, randomUUID(), "picked_up", FRIDAY_MORNING),
    ).toEqual({
      status: "not_found",
    });
  });
});

describe("dayReservations", () => {
  it("lists a day by pickup time, without a time last, with totals", async () => {
    const chleb = await addProduct(db, { name: "Chléb", price: 6000 });
    for (const [customerName, pickupTime] of [
      ["Bez času", undefined],
      ["Pozdě", "16:30"],
      ["Brzy", "07:15"],
    ] as const) {
      await createReservation(
        db,
        order({
          customerName,
          pickupTime,
          items: [
            { productId: rohlik.id, quantity: 1 },
            { productId: chleb.id, quantity: 1 },
          ],
        }),
        phone(),
        WEDNESDAY_MORNING,
      );
    }
    await createReservation(
      db,
      order({ pickupDate: "2026-11-28" }),
      online,
      WEDNESDAY_MORNING,
    );

    const day = await dayReservations(db, FRIDAY);
    expect(day.map((r) => [r.customerName, r.pickupTime])).toEqual([
      ["Brzy", "07:15"],
      ["Pozdě", "16:30"],
      ["Bez času", null],
    ]);
    expect(day[0]).toMatchObject({
      customerPhone: "+420601234567",
      source: "phone",
      status: "reserved",
      items: [
        { productName: "Chléb", quantity: 1 },
        { productName: "Rohlík", quantity: 1 },
      ],
      total: 6450,
    });
  });

  it("sorts names the Czech way", async () => {
    for (const customerName of ["Zeman", "Čermák", "Chalupa", "Hana"]) {
      await createReservation(
        db,
        order({
          customerName,
          pickupTime: "08:00",
          items: [{ productId: rohlik.id, quantity: 1 }],
        }),
        phone(),
        WEDNESDAY_MORNING,
      );
    }
    expect(
      (await dayReservations(db, FRIDAY)).map((r) => r.customerName),
    ).toEqual(["Čermák", "Hana", "Chalupa", "Zeman"]);
  });

  it("keeps the prices saved with the order", async () => {
    await createReservation(db, order(), online, WEDNESDAY_MORNING);
    await db.update(product).set({ price: 900, name: "Rohlík velký" });
    const [row] = await dayReservations(db, FRIDAY);
    expect(row).toMatchObject({
      items: [{ productName: "Rohlík", quantity: 2 }],
      total: 900,
    });
  });

  it("is empty on a day without orders", async () => {
    expect(await dayReservations(db, "2026-12-24")).toEqual([]);
  });
});

describe("the customer's link", () => {
  async function placed() {
    const result = await createReservation(
      db,
      order(),
      online,
      WEDNESDAY_MORNING,
    );
    if (result.status !== "created" || !result.token)
      throw new Error(result.status);
    return result.token;
  }

  it("shows the order and cancels it before the cutoff", async () => {
    const token = await placed();
    expect(await orderByToken(db, token, WEDNESDAY_MORNING)).toMatchObject({
      customerName: "Jana Nováková",
      cancellable: true,
      items: [{ productName: "Rohlík", quantity: 2 }],
    });
    expect(await cancelByToken(db, token, WEDNESDAY_MORNING)).toBe("cancelled");
    expect(await cancelByToken(db, token, WEDNESDAY_MORNING)).toBe("cancelled");
    expect(await pieces(db, rohlik.id, FRIDAY)).toBe(0);
  });

  it("does not cancel after the cutoff", async () => {
    const token = await placed();
    const thursdayEvening = at("2026-11-26T17:00:00Z");
    expect(await cancelByToken(db, token, thursdayEvening)).toBe("too_late");
    expect(await orderByToken(db, token, thursdayEvening)).toMatchObject({
      cancellable: false,
    });
  });

  it("does not cancel an order already picked up", async () => {
    const token = await placed();
    const [row] = await db.select().from(reservation);
    if (!row) throw new Error("No reservation");
    await setReservationStatus(db, row.id, "picked_up", FRIDAY_MORNING);
    expect(await cancelByToken(db, token, WEDNESDAY_MORNING)).toBe("too_late");
  });

  it("stops working 30 days after pickup, and for an unknown token", async () => {
    const token = await placed();
    expect(
      await orderByToken(db, token, at("2026-12-27T12:00:00Z")),
    ).not.toBeNull();
    expect(
      await orderByToken(db, token, at("2026-12-28T12:00:00Z")),
    ).toBeNull();
    expect(await orderByToken(db, "nonsense", WEDNESDAY_MORNING)).toBeNull();
  });
});

describe("phoneOrderForm", () => {
  it("counts reserved and picked-up pieces per day, not cancelled or no-show", async () => {
    for (const status of [
      "reserved",
      "picked_up",
      "cancelled",
      "no_show",
    ] as const) {
      const result = await createReservation(
        db,
        order({ items: [{ productId: rohlik.id, quantity: 1 }] }),
        phone(),
        WEDNESDAY_MORNING,
      );
      if (result.status !== "created") throw new Error(result.status);
      await db
        .update(reservation)
        .set({ status })
        .where(eq(reservation.id, result.reservationId));
    }

    const form = await phoneOrderForm(db, WEDNESDAY_MORNING);
    expect(form.remaining[FRIDAY]?.[rohlik.id]).toBe(3);
    expect(form.remaining["2026-11-26"]?.[rohlik.id]).toBe(5);
  });

  it("covers today to 21 days ahead and lists only active products by name", async () => {
    await addProduct(db, { name: "Čokoládový dort", bakeDays: [6] });
    await addProduct(db, { name: "Bábovka", active: false });

    const form = await phoneOrderForm(db, WEDNESDAY_MORNING);
    expect(form.dates[0]).toBe("2026-11-25");
    expect(form.dates.at(-1)).toBe("2026-12-16");
    expect(form.dates).toHaveLength(22);
    expect(form.products.map((p) => p.name)).toEqual([
      "Čokoládový dort",
      "Rohlík",
    ]);
    expect(form.products[0]).toEqual({
      id: expect.any(String),
      name: "Čokoládový dort",
      price: 500,
      bakeDays: [6],
    });
  });
});

describe("listCustomers", () => {
  it("lists every customer by name the Czech way", async () => {
    await db.insert(customer).values([
      { name: "Zeman", phone: "+420601000001" },
      { name: "Čermák", phone: "+420601000002" },
      { name: "Chalupa", phone: "+420601000003" },
      { name: "Hana", phone: "+420601000004" },
    ]);
    expect(await listCustomers(db)).toEqual([
      { name: "Čermák", phone: "+420601000002" },
      { name: "Hana", phone: "+420601000004" },
      { name: "Chalupa", phone: "+420601000003" },
      { name: "Zeman", phone: "+420601000001" },
    ]);
  });
});
