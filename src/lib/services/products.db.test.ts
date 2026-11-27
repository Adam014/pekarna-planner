import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { connect, emptyTables } from "../../../test/db";
import {
  addProduct,
  at,
  FRIDAY,
  pieces,
  WEDNESDAY_MORNING,
} from "../../../test/fixtures";
import { product } from "../db/schema";
import { productInput, type ProductInput } from "../validators/product";
import { dayPlan } from "./bake-plan.service";
import { orderOffer } from "./online-order.service";
import { listProducts, saveProduct } from "./products.service";
import { createReservation, phoneOrderForm } from "./reservations.service";
import { cutoffTime, setCutoffTime } from "./settings";

const { pool, db } = connect();
afterAll(() => pool.end());

let rohlik: typeof product.$inferSelect;

beforeEach(async () => {
  await emptyTables(db);
  rohlik = await addProduct(db, { name: "Rohlík", price: 450, dailyLimit: 5 });
});

const values = (input: Partial<ProductInput> = {}) =>
  productInput.parse({
    name: "Bageta",
    price: "35",
    dailyLimit: "50",
    buffer: "8",
    bakeDays: [1, 2, 3, 4, 5],
    active: true,
    ...input,
  });

/** Two pieces of Rohlík for Friday, ordered online on Wednesday. */
async function orderRohlik() {
  const result = await createReservation(
    db,
    {
      customerName: "Jana Nováková",
      phone: "601 234 567",
      pickupDate: FRIDAY,
      items: [{ productId: rohlik.id, quantity: 2 }],
      idempotencyKey: randomUUID(),
    },
    { source: "online" },
    WEDNESDAY_MORNING,
  );
  expect(result.status).toBe("created");
}

describe("saveProduct", () => {
  it("creates a product", async () => {
    expect(await saveProduct(db, values())).toEqual({ status: "saved" });
    const [saved] = await db
      .select()
      .from(product)
      .where(eq(product.name, "Bageta"));
    expect(saved).toMatchObject({
      price: 3500,
      dailyLimit: 50,
      buffer: 8,
      bakeDays: [1, 2, 3, 4, 5],
      active: true,
    });
  });

  it("updates a product", async () => {
    const result = await saveProduct(
      db,
      values({ id: rohlik.id, name: "Rohlík tukový", price: "5,50" }),
    );
    expect(result).toEqual({ status: "saved" });
    const [saved] = await db
      .select()
      .from(product)
      .where(eq(product.id, rohlik.id));
    expect(saved).toMatchObject({ name: "Rohlík tukový", price: 550 });
  });

  it("refuses a name another product has, in any case and spacing", async () => {
    expect(await saveProduct(db, values({ name: " ROHLÍK " }))).toEqual({
      status: "rejected",
      reason: "duplicate_name",
    });
    const bageta = await addProduct(db, { name: "Bageta" });
    expect(
      await saveProduct(db, values({ id: bageta.id, name: "rohlík" })),
    ).toEqual({ status: "rejected", reason: "duplicate_name" });
  });

  it("keeps its own name when only the case changes", async () => {
    expect(
      await saveProduct(db, values({ id: rohlik.id, name: "ROHLÍK" })),
    ).toEqual({ status: "saved" });
  });

  it("says when the product is gone", async () => {
    expect(await saveProduct(db, values({ id: randomUUID() }))).toEqual({
      status: "rejected",
      reason: "not_found",
    });
  });
});

describe("listProducts", () => {
  it("puts products on offer first, each group by Czech name", async () => {
    await addProduct(db, { name: "Chléb" });
    await addProduct(db, { name: "Bageta", active: false });
    await addProduct(db, { name: "Cibulka" });
    // "Ch" is a letter of its own, after "H".
    expect((await listProducts(db)).map((p) => p.name)).toEqual([
      "Cibulka",
      "Chléb",
      "Rohlík",
      "Bageta",
    ]);
  });
});

describe("effect on orders", () => {
  it("a deactivated product leaves the forms but keeps its orders", async () => {
    await orderRohlik();
    await saveProduct(
      db,
      values({ id: rohlik.id, name: "Rohlík", active: false }),
    );

    expect(await pieces(db, rohlik.id, FRIDAY)).toBe(2);
    const phone = await phoneOrderForm(db, WEDNESDAY_MORNING);
    expect(phone.products).toEqual([]);
    const online = await orderOffer(db, WEDNESDAY_MORNING);
    expect(online.products).toEqual([]);
    const plan = await dayPlan(db, FRIDAY);
    expect(plan.rows).toEqual([
      expect.objectContaining({ productId: rohlik.id, orders: 2 }),
    ]);
  });

  it("a limit below what is reserved keeps the orders and leaves 0", async () => {
    await orderRohlik();
    await saveProduct(
      db,
      values({ id: rohlik.id, name: "Rohlík", dailyLimit: "1" }),
    );

    expect(await pieces(db, rohlik.id, FRIDAY)).toBe(2);
    const form = await phoneOrderForm(db, WEDNESDAY_MORNING);
    expect(form.remaining[FRIDAY]?.[rohlik.id]).toBe(0);
  });
});

describe("setCutoffTime", () => {
  it("changes which days the online form offers at once", async () => {
    // Wednesday 17:30 in Prague: Thursday is open until 18:00.
    const now = at("2026-11-25T16:30:00Z");
    const thursday = "2026-11-26";
    expect((await orderOffer(db, now)).days[0]?.date).toBe(thursday);

    await setCutoffTime(db, "17:00");
    expect(await cutoffTime(db)).toBe("17:00:00");
    expect((await orderOffer(db, now)).days[0]?.date).toBe(FRIDAY);
  });
});
