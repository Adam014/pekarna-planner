import { describe, expect, it } from "vitest";
import { bakePlan, planTotals, type PlanProduct } from "./bake-plan";

const weekdays = [1, 2, 3, 4, 5];
const products: PlanProduct[] = [
  {
    id: "rohlik",
    name: "Rohlík",
    buffer: 10,
    bakeDays: weekdays,
    active: true,
  },
  {
    id: "chleb",
    name: "Chléb",
    buffer: 2,
    bakeDays: weekdays,
    active: true,
  },
  {
    id: "babovka",
    name: "Bábovka",
    buffer: 1,
    bakeDays: [6],
    active: true,
  },
  {
    id: "stary",
    name: "Starý koláč",
    buffer: 3,
    bakeDays: weekdays,
    active: false,
  },
];
const friday = "2026-11-27";

describe("bakePlan", () => {
  it("adds standing orders and the buffer to orders", () => {
    const plan = bakePlan(friday, products, [
      {
        productId: "rohlik",
        quantity: 20,
        status: "reserved",
        source: "phone",
      },
      {
        productId: "rohlik",
        quantity: 5,
        status: "picked_up",
        source: "online",
      },
      {
        productId: "rohlik",
        quantity: 40,
        status: "reserved",
        source: "standing_order",
      },
      { productId: "chleb", quantity: 3, status: "reserved", source: "phone" },
    ]);
    expect(plan).toEqual([
      {
        productId: "chleb",
        name: "Chléb",
        orders: 3,
        standing: 0,
        buffer: 2,
        toBake: 5,
      },
      {
        productId: "rohlik",
        name: "Rohlík",
        orders: 25,
        standing: 40,
        buffer: 10,
        toBake: 75,
      },
    ]);
  });

  it("does not count cancelled or no-show pieces", () => {
    const plan = bakePlan(friday, products, [
      { productId: "chleb", quantity: 4, status: "cancelled", source: "phone" },
      {
        productId: "chleb",
        quantity: 6,
        status: "no_show",
        source: "standing_order",
      },
    ]);
    expect(plan.find((r) => r.productId === "chleb")?.toBake).toBe(2);
  });

  it("lists a product baked that day with only its buffer", () => {
    const plan = bakePlan(friday, products, []);
    expect(plan.map((r) => r.productId)).toEqual(["chleb", "rohlik"]);
    expect(plan[1]?.toBake).toBe(10);
  });

  it("keeps a product with orders not baked that day, without its buffer", () => {
    const plan = bakePlan(friday, products, [
      {
        productId: "babovka",
        quantity: 2,
        status: "reserved",
        source: "phone",
      },
      {
        productId: "stary",
        quantity: 1,
        status: "reserved",
        source: "standing_order",
      },
    ]);
    expect(plan.map((r) => r.productId)).toEqual([
      "babovka",
      "chleb",
      "rohlik",
      "stary",
    ]);
    expect(plan.find((r) => r.productId === "babovka")).toMatchObject({
      buffer: 0,
      toBake: 2,
    });
    expect(plan.find((r) => r.productId === "stary")).toMatchObject({
      standing: 1,
      buffer: 0,
      toBake: 1,
    });
  });

  it("sorts by Czech name, with ch after h", () => {
    const housky: PlanProduct = {
      id: "housky",
      name: "Housky",
      buffer: 0,
      bakeDays: weekdays,
      active: true,
    };
    const plan = bakePlan(friday, [...products, housky], []);
    expect(plan.map((r) => r.name)).toEqual(["Housky", "Chléb", "Rohlík"]);
  });

  it("sorts numbers in names by value", () => {
    const loaves = [2, 10, 1].map((n) => ({
      id: `bochnik-${n}`,
      name: `Bochník ${n} kg`,
      buffer: 1,
      bakeDays: weekdays,
      active: true,
    }));
    expect(bakePlan(friday, loaves, []).map((r) => r.name)).toEqual([
      "Bochník 1 kg",
      "Bochník 2 kg",
      "Bochník 10 kg",
    ]);
  });
});

describe("planTotals", () => {
  it("sums every column", () => {
    const plan = bakePlan(friday, products, [
      {
        productId: "rohlik",
        quantity: 20,
        status: "reserved",
        source: "phone",
      },
      {
        productId: "chleb",
        quantity: 3,
        status: "reserved",
        source: "standing_order",
      },
    ]);
    expect(planTotals(plan)).toEqual({
      orders: 20,
      standing: 3,
      buffer: 12,
      toBake: 35,
    });
  });

  it("is zero for an empty plan", () => {
    expect(planTotals([])).toEqual({
      orders: 0,
      standing: 0,
      buffer: 0,
      toBake: 0,
    });
  });
});
