import { describe, expect, it } from "vitest";
import {
  bookableDates,
  isBeforeCutoff,
  orderDeadline,
  today,
  weekdayOf,
} from "./time";

const at = (iso: string) => Temporal.Instant.from(iso);

describe("today", () => {
  it("is the Prague date, not the machine's or UTC", () => {
    // Tests run in America/New_York (vitest.config.ts).
    expect(today(at("2026-11-25T22:59:59Z"))).toBe("2026-11-25");
    expect(today(at("2026-11-25T23:00:00Z"))).toBe("2026-11-26");
  });

  it("follows summer time", () => {
    expect(today(at("2026-07-01T21:59:59Z"))).toBe("2026-07-01");
    expect(today(at("2026-07-01T22:00:00Z"))).toBe("2026-07-02");
  });
});

describe("weekdayOf", () => {
  it("uses ISO weekdays", () => {
    expect(weekdayOf("2026-11-23")).toBe(1); // Monday
    expect(weekdayOf("2026-11-29")).toBe(7); // Sunday
  });
});

describe("orderDeadline", () => {
  it("is the day before at the cutoff, Prague time", () => {
    expect(orderDeadline("2026-11-26", "18:00").toString()).toBe(
      "2026-11-25T17:00:00Z",
    );
  });

  it("reads the time format Postgres returns", () => {
    expect(orderDeadline("2026-11-26", "18:00:00").toString()).toBe(
      "2026-11-25T17:00:00Z",
    );
  });

  it("uses the offset of the day before across the DST switches", () => {
    // Summer time starts 2026-03-29 and ends 2026-10-25.
    expect(orderDeadline("2026-03-29", "18:00").toString()).toBe(
      "2026-03-28T17:00:00Z",
    );
    expect(orderDeadline("2026-03-30", "18:00").toString()).toBe(
      "2026-03-29T16:00:00Z",
    );
    expect(orderDeadline("2026-10-26", "18:00").toString()).toBe(
      "2026-10-25T17:00:00Z",
    );
  });

  it("moves a cutoff in the skipped hour an hour later", () => {
    expect(orderDeadline("2026-03-30", "02:30").toString()).toBe(
      "2026-03-29T01:30:00Z",
    );
  });
});

describe("isBeforeCutoff", () => {
  it("closes exactly at the cutoff", () => {
    expect(
      isBeforeCutoff("2026-11-26", at("2026-11-25T16:59:59Z"), "18:00"),
    ).toBe(true);
    expect(
      isBeforeCutoff("2026-11-26", at("2026-11-25T17:00:00Z"), "18:00"),
    ).toBe(false);
  });

  it("is closed for today and past days", () => {
    const now = at("2026-11-25T08:00:00Z");
    expect(isBeforeCutoff("2026-11-25", now, "18:00")).toBe(false);
    expect(isBeforeCutoff("2026-11-20", now, "18:00")).toBe(false);
  });
});

describe("bookableDates", () => {
  it("starts tomorrow before the cutoff and ends 21 days from today", () => {
    const dates = bookableDates(at("2026-11-25T16:00:00Z"), "18:00");
    expect(dates[0]).toBe("2026-11-26");
    expect(dates.at(-1)).toBe("2026-12-16");
    expect(dates).toHaveLength(21);
  });

  it("starts the day after tomorrow once the cutoff has passed", () => {
    const dates = bookableDates(at("2026-11-25T17:00:00Z"), "18:00");
    expect(dates[0]).toBe("2026-11-27");
    expect(dates.at(-1)).toBe("2026-12-16");
  });

  it("keeps only the product's bake days", () => {
    const weekdays = [1, 2, 3, 4, 5];
    const dates = bookableDates(at("2026-11-25T16:00:00Z"), "18:00", weekdays);
    expect(dates).not.toContain("2026-11-28"); // Saturday
    expect(dates).not.toContain("2026-11-29"); // Sunday
    expect(dates.every((d) => weekdays.includes(weekdayOf(d)))).toBe(true);
    expect(dates).toHaveLength(15);
  });
});
