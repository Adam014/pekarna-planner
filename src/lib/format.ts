import { TIME_ZONE } from "./domain/time";

/** Czech display formats; computed on the server, so the browser's time zone and Temporal support do not matter. */

/** "čtvrtek 26. listopadu" for a 'YYYY-MM-DD' day. */
export function formatDay(date: string): string {
  return Temporal.PlainDate.from(date).toLocaleString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "64,50 Kč" from haléře; whole crowns without decimals ("60 Kč"). */
export function formatPrice(halere: number): string {
  const digits = halere % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(halere / 100);
}

/** "čtvrtek 26. listopadu 2026": the printed plan is kept, so with the year. */
export function formatDayWithYear(date: string): string {
  return Temporal.PlainDate.from(date).toLocaleString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "čtvrtek 26. 11. v 18:00" in Prague: when orders for a day close. */
export function formatDeadline(instant: Temporal.Instant): string {
  const time = instant.toZonedDateTimeISO(TIME_ZONE);
  const day = time.toPlainDate().toLocaleString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
  });
  return `${day} v ${time.hour}:${String(time.minute).padStart(2, "0")}`;
}

/** "26. 11. 2026 5:12" in Prague: when a page was printed. */
export function formatStamp(instant: Temporal.Instant): string {
  const time = instant.toZonedDateTimeISO(TIME_ZONE);
  const day = time.toPlainDate().toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  return `${day} ${time.hour}:${String(time.minute).padStart(2, "0")}`;
}
