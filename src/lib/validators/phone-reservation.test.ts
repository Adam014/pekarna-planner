import { describe, expect, it } from "vitest";
import { phoneReservationInput } from "./reservation";

const order = {
  customerName: "Jana Nováková",
  phone: "601 234 567",
  pickupDate: "2026-11-28",
  items: [{ productId: crypto.randomUUID(), quantity: 2 }],
  idempotencyKey: crypto.randomUUID(),
};

describe("phoneReservationInput", () => {
  it("is not confirmed unless staff confirmed", () => {
    expect(phoneReservationInput.parse(order).confirmed).toBe(false);
    expect(
      phoneReservationInput.parse({ ...order, confirmed: true }).confirmed,
    ).toBe(true);
  });
});
