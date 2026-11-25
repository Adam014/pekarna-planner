import { describe, expect, it } from "vitest";
import { standingOrderDates, unbakedWeekdays } from "./standing-orders";

const at = (iso: string) => Temporal.Instant.from(iso);

describe("standingOrderDates", () => {
  // Wednesday 2026-11-25, 17:00 in Prague.
  const now = at("2026-11-25T16:00:00Z");

  it("lists the template's weekdays up to 28 days from today", () => {
    expect(standingOrderDates([2, 5], now, "18:00")).toEqual([
      "2026-11-27",
      "2026-12-01",
      "2026-12-04",
      "2026-12-08",
      "2026-12-11",
      "2026-12-15",
      "2026-12-18",
      "2026-12-22",
    ]);
  });

  it("includes the last day of the horizon", () => {
    // 2026-12-23 is 28 days from today; 12-24 is already outside.
    const everyDay = [1, 2, 3, 4, 5, 6, 7];
    expect(standingOrderDates(everyDay, now, "18:00").at(-1)).toBe(
      "2026-12-23",
    );
  });

  it("leaves out tomorrow once the cutoff has passed", () => {
    const late = at("2026-11-25T17:00:00Z");
    expect(standingOrderDates([4], late, "18:00")[0]).toBe("2026-12-03");
    expect(standingOrderDates([4], now, "18:00")[0]).toBe("2026-11-26");
  });
});

describe("unbakedWeekdays", () => {
  it("returns the template's days the product is not baked", () => {
    expect(unbakedWeekdays([6, 2, 7], [1, 2, 3, 4, 5])).toEqual([6, 7]);
    expect(unbakedWeekdays([2, 5], [1, 2, 3, 4, 5])).toEqual([]);
  });
});
