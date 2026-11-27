import { describe, expect, it } from "vitest";
import { standingOrderFormInput } from "./reservation";

const order = {
  customerName: "Kavárna U Mostu",
  phone: "777 000 101",
  weekdays: [5, 1, 3],
  items: [{ productId: crypto.randomUUID(), quantity: 15 }],
};

describe("standingOrderFormInput", () => {
  it("takes a new order without an id and sorts the weekdays", () => {
    const parsed = standingOrderFormInput.parse(order);
    expect(parsed.id).toBeUndefined();
    expect(parsed.weekdays).toEqual([1, 3, 5]);
  });

  it("takes an edit with an id", () => {
    const id = crypto.randomUUID();
    expect(standingOrderFormInput.parse({ ...order, id }).id).toBe(id);
    expect(
      standingOrderFormInput.safeParse({ ...order, id: "1" }).success,
    ).toBe(false);
  });

  it("refuses no weekday and the same weekday twice", () => {
    for (const weekdays of [[], [1, 1], [0], [8]]) {
      const parsed = standingOrderFormInput.safeParse({ ...order, weekdays });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.path[0]).toBe("weekdays");
    }
  });
});
