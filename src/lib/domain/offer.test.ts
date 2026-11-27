import { describe, expect, it } from "vitest";
import { offer } from "./offer";

// Friday 27, Saturday 28, Sunday 29 November 2026.
const FRIDAY = "2026-11-27";
const SATURDAY = "2026-11-28";
const SUNDAY = "2026-11-29";

const rohlik = { id: "rohlik", dailyLimit: 10, bakeDays: [1, 2, 3, 4, 5, 6] };
const vanocka = { id: "vanocka", dailyLimit: 5, bakeDays: [5] };
const none = () => 0;

describe("offer", () => {
  it("gives the full limit when nothing is ordered", () => {
    expect(offer([FRIDAY], [rohlik, vanocka], none)).toEqual([
      {
        date: FRIDAY,
        items: [
          { productId: "rohlik", baked: true, remaining: 10 },
          { productId: "vanocka", baked: true, remaining: 5 },
        ],
      },
    ]);
  });

  it("subtracts what is already ordered for that day and product", () => {
    const taken = (date: string, id: string) =>
      date === FRIDAY && id === "rohlik" ? 7 : 0;
    const [friday, saturday] = offer([FRIDAY, SATURDAY], [rohlik], taken);
    expect(friday?.items[0]?.remaining).toBe(3);
    expect(saturday?.items[0]?.remaining).toBe(10);
  });

  it("is sold out at 0, never below", () => {
    const [day] = offer([FRIDAY], [rohlik], () => 12);
    expect(day?.items[0]).toEqual({
      productId: "rohlik",
      baked: true,
      remaining: 0,
    });
  });

  it("marks a product not baked that day, with nothing free", () => {
    const [day] = offer([SATURDAY], [rohlik, vanocka], none);
    expect(day?.items[1]).toEqual({
      productId: "vanocka",
      baked: false,
      remaining: 0,
    });
  });

  it("drops a day on which nothing is baked", () => {
    expect(
      offer([SATURDAY, SUNDAY], [rohlik], none).map((d) => d.date),
    ).toEqual([SATURDAY]);
  });

  it("offers nothing without products", () => {
    expect(offer([FRIDAY], [], none)).toEqual([]);
  });
});
