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
