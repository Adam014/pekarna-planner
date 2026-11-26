import { describe, expect, it } from "vitest";
import { formatDay, formatPrice } from "./format";

// Intl separates thousands and the currency with a no-break space.
const plain = (text: string) => text.replace(/\s/gu, " ");

describe("formatDay", () => {
  it("names the weekday and the month in Czech", () => {
    expect(formatDay("2026-11-26")).toBe("čtvrtek 26. listopadu");
    expect(formatDay("2027-03-28")).toBe("neděle 28. března");
  });
});

describe("formatPrice", () => {
  it("shows whole crowns without decimals and the rest with two", () => {
    expect(plain(formatPrice(6000))).toBe("60 Kč");
    expect(plain(formatPrice(6450))).toBe("64,50 Kč");
    expect(plain(formatPrice(149_900))).toBe("1 499 Kč");
    expect(plain(formatPrice(0))).toBe("0 Kč");
  });
});
