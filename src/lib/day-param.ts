import { dayViewRange } from "./domain/time";
import { dayParam } from "./validators/reservation";

/**
 * The day in `?den=`, or `fallback` when it is missing, not a date or more
 * than a year from today; Postgres and Intl also misbehave on dates like
 * 0000-01-01. Shared by "Dnes" and "Plán pečení".
 */
export function pickDay(den: unknown, todayDate: string, fallback: string) {
  const range = dayViewRange(todayDate);
  const parsed = dayParam.safeParse(den);
  const date =
    parsed.success && parsed.data >= range.min && parsed.data <= range.max
      ? parsed.data
      : fallback;
  return { date, ...range };
}
