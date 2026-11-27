/**
 * What the public order form offers (R2): per pickup day, each active product
 * with whether it is baked that day and how many pieces are still free. The
 * numbers are for showing only; the order itself is checked again under row
 * locks when it is saved (ADR 0007).
 */
import { weekdayOf } from "./time";

export type OfferProduct = {
  id: string;
  dailyLimit: number;
  /** ISO weekdays the product is baked (1 = Monday). */
  bakeDays: readonly number[];
};

export type OfferItem = {
  productId: string;
  baked: boolean;
  /** Pieces still free that day; 0 when not baked or sold out. */
  remaining: number;
};

export type OfferDay = { date: string; items: OfferItem[] };

/**
 * The days in `dates` on which at least one product is baked, with every
 * product in the given order. `taken` returns the pieces already ordered
 * (reserved or picked up) for a day and product.
 */
export function offer(
  dates: readonly string[],
  products: readonly OfferProduct[],
  taken: (date: string, productId: string) => number,
): OfferDay[] {
  return dates.flatMap((date) => {
    const weekday = weekdayOf(date);
    const items = products.map((p) => {
      const baked = p.bakeDays.includes(weekday);
      return {
        productId: p.id,
        baked,
        remaining: baked ? Math.max(0, p.dailyLimit - taken(date, p.id)) : 0,
      };
    });
    return items.some((i) => i.baked) ? [{ date, items }] : [];
  });
}
