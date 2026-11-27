/** Which days a standing order creates as reservations (ADR 0007). */
import { STANDING_ORDER_HORIZON_DAYS } from "./reservation";
import {
  addDays,
  datesBetween,
  isBeforeCutoff,
  today,
  weekdayOf,
} from "./time";

/**
 * The template's pickup days that should exist as reservations: on its
 * weekdays, still before the cutoff, at most STANDING_ORDER_HORIZON_DAYS from
 * today. The service skips days that already exist.
 */
export function standingOrderDates(
  weekdays: readonly number[],
  now: Temporal.Instant,
  cutoffTime: string,
): string[] {
  const first = today(now);
  return datesBetween(
    first,
    addDays(first, STANDING_ORDER_HORIZON_DAYS),
  ).filter(
    (date) =>
      weekdays.includes(weekdayOf(date)) &&
      isBeforeCutoff(date, now, cutoffTime),
  );
}

/**
 * The first day an edit or the end of a standing order changes: tomorrow
 * while its cutoff has not passed, otherwise the day after. Today and days
 * past their cutoff are already being baked and stay as they are.
 */
export function firstOpenDay(
  now: Temporal.Instant,
  cutoffTime: string,
): string {
  const tomorrow = addDays(today(now), 1);
  return isBeforeCutoff(tomorrow, now, cutoffTime)
    ? tomorrow
    : addDays(tomorrow, 1);
}

/**
 * Weekdays of the template on which the product is not baked. The product is
 * left out of those days and the owner is told.
 */
export function unbakedWeekdays(
  weekdays: readonly number[],
  bakeDays: readonly number[],
): number[] {
  return weekdays
    .filter((day) => !bakeDays.includes(day))
    .toSorted((a, b) => a - b);
}
