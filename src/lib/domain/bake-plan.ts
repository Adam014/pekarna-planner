/** "Plán pečení" for one day (R4). */
import { COUNTED_STATUSES, type ReservationStatus } from "./reservation";
import { weekdayOf } from "./time";

export type PlanProduct = {
  id: string;
  name: string;
  buffer: number;
  bakeDays: readonly number[];
  active: boolean;
};

/** One item of a reservation for the planned day. */
export type PlanItem = {
  productId: string;
  quantity: number;
  status: ReservationStatus;
};

export type PlanRow = {
  productId: string;
  name: string;
  ordered: number;
  buffer: number;
  toBake: number;
};

/**
 * Per product: ordered pieces + buffer. Lists every active product baked that
 * day, and any product that has orders for it, so no order is left out of
 * the plan (for example after its bake days changed). Sorted by name.
 * `products` must hold every product, inactive ones included, or orders for
 * the missing ones are left out.
 */
export function bakePlan(
  date: string,
  products: readonly PlanProduct[],
  items: readonly PlanItem[],
): PlanRow[] {
  const ordered = new Map<string, number>();
  for (const item of items) {
    // Cancelled and no-show pieces are not baked.
    if (!COUNTED_STATUSES.some((s) => s === item.status)) continue;
    ordered.set(
      item.productId,
      (ordered.get(item.productId) ?? 0) + item.quantity,
    );
  }

  const weekday = weekdayOf(date);
  return products
    .filter(
      (p) => (p.active && p.bakeDays.includes(weekday)) || ordered.has(p.id),
    )
    .map((p) => {
      const count = ordered.get(p.id) ?? 0;
      // The buffer is for walk-in customers, so only on a day the product is
      // on sale: active and baked that weekday.
      const buffer = p.active && p.bakeDays.includes(weekday) ? p.buffer : 0;
      return {
        productId: p.id,
        name: p.name,
        ordered: count,
        buffer,
        toBake: count + buffer,
      };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name, "cs"));
}
