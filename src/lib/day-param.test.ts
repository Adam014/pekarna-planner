import { describe, expect, it } from "vitest";
import { pickDay } from "./day-param";

const today = "2026-11-26";
const tomorrow = "2026-11-27";

describe("pickDay", () => {
  it("takes a valid day within a year", () => {
    expect(pickDay("2026-12-24", today, tomorrow)).toEqual({
      date: "2026-12-24",
      min: "2025-11-25",
      max: "2027-11-27",
    });
  });

  it.each([
    undefined,
    "",
    "zitra",
    "2026-02-30",
    ["2026-12-24"],
    "0000-01-01",
    "2028-01-01",
  ])("falls back for %j", (den) =>
    expect(pickDay(den, today, tomorrow).date).toBe(tomorrow),
  );
});
