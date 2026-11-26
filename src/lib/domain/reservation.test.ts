import { describe, expect, it } from "vitest";
import { canSetStatus } from "./reservation";

describe("canSetStatus", () => {
  const today = "2026-11-26";

  it.each(["picked_up", "no_show"] as const)(
    "allows %s today and on past days only",
    (status) => {
      expect(canSetStatus(status, today, today)).toBe(true);
      expect(canSetStatus(status, "2026-11-25", today)).toBe(true);
      expect(canSetStatus(status, "2026-11-27", today)).toBe(false);
    },
  );

  it.each(["reserved", "cancelled"] as const)(
    "allows %s on any day",
    (status) => {
      expect(canSetStatus(status, "2026-12-10", today)).toBe(true);
      expect(canSetStatus(status, "2026-11-01", today)).toBe(true);
    },
  );

  it("compares whole dates across a month and a year", () => {
    expect(canSetStatus("picked_up", "2027-01-01", "2026-12-31")).toBe(false);
    expect(canSetStatus("picked_up", "2026-12-31", "2027-01-01")).toBe(true);
  });
});
