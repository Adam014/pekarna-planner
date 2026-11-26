/**
 * Pickup days and the cutoff in Europe/Prague (AGENTS.md). Pickup days are
 * 'YYYY-MM-DD' strings, like the Postgres `date` column; never a JS `Date`.
 */
import { BOOKING_HORIZON_DAYS } from "./reservation";

export const TIME_ZONE = "Europe/Prague";

/** Today's date in Prague at the given moment. */
export function today(now: Temporal.Instant): string {
  return now.toZonedDateTimeISO(TIME_ZONE).toPlainDate().toString();
}

export function addDays(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}

/** ISO weekday 1 = Monday … 7 = Sunday, as stored in `bake_days`. */
export function weekdayOf(date: string): number {
  return Temporal.PlainDate.from(date).dayOfWeek;
}

/**
 * The last moment to order for a pickup day: the day before, at the cutoff
 * time in Prague (`'18:00'` or `'18:00:00'` from Postgres). A cutoff in the
 * hour skipped by the spring DST switch moves an hour later.
 */
export function orderDeadline(
  pickupDate: string,
  cutoffTime: string,
): Temporal.Instant {
  return Temporal.PlainDate.from(pickupDate)
    .subtract({ days: 1 })
    .toZonedDateTime({ timeZone: TIME_ZONE, plainTime: cutoffTime })
    .toInstant();
}

/** True until the deadline; at the deadline itself ordering is closed. */
export function isBeforeCutoff(
  pickupDate: string,
  now: Temporal.Instant,
  cutoffTime: string,
): boolean {
  return (
    Temporal.Instant.compare(now, orderDeadline(pickupDate, cutoffTime)) < 0
  );
}

/** Days from `from` to `to`, both included, in order. */
export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  return dates;
}

/**
 * The days a customer can order for: still before the cutoff and at most
 * BOOKING_HORIZON_DAYS from today. With `bakeDays`, only days the product is
 * baked.
 */
export function bookableDates(
  now: Temporal.Instant,
  cutoffTime: string,
  bakeDays?: readonly number[],
): string[] {
  const first = today(now);
  return datesBetween(first, addDays(first, BOOKING_HORIZON_DAYS)).filter(
    (date) =>
      isBeforeCutoff(date, now, cutoffTime) &&
      (bakeDays === undefined || bakeDays.includes(weekdayOf(date))),
  );
}

/** "Dnes" can show days up to this far back or ahead of today. */
export const DAY_VIEW_RANGE_DAYS = 366;

/** The first and last day "Dnes" can show. */
export function dayViewRange(todayDate: string): { min: string; max: string } {
  return {
    min: addDays(todayDate, -DAY_VIEW_RANGE_DAYS),
    max: addDays(todayDate, DAY_VIEW_RANGE_DAYS),
  };
}
