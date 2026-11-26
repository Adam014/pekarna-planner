import { describe, expect, it } from "vitest";
import {
  formatDay,
  formatDayWithYear,
  formatDeadline,
  formatPrice,
  formatStamp,
} from "./format";

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

describe("formatDayWithYear", () => {
  it("adds the year", () => {
    expect(formatDayWithYear("2026-11-27")).toBe("pátek 27. listopadu 2026");
  });
});

describe("formatDeadline and formatStamp", () => {
  // 17:00 UTC is 18:00 in Prague in winter, 19:00 in summer.
  it("show Prague time", () => {
    const winter = Temporal.Instant.from("2026-11-26T17:00:00Z");
    expect(plain(formatDeadline(winter))).toBe("čtvrtek 26. 11. v 18:00");
    expect(plain(formatStamp(winter))).toBe("26. 11. 2026 18:00");
    const summer = Temporal.Instant.from("2026-07-01T03:05:00Z");
    expect(plain(formatStamp(summer))).toBe("1. 7. 2026 5:05");
  });
});
