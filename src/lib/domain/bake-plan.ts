/** "Plán pečení" for one day (R4). */
import {
  COUNTED_STATUSES,
  type ReservationSource,
  type ReservationStatus,
} from "./reservation";
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
  source: ReservationSource;
};

export type PlanRow = {
  productId: string;
  name: string;
  /** Phone and online orders. */
  orders: number;
  /** Standing orders of regular customers. */
  standing: number;
  /** Extra pieces for walk-in customers. */
  buffer: number;
  toBake: number;
};

export type PlanTotals = Pick<
  PlanRow,
  "orders" | "standing" | "buffer" | "toBake"
>;

/**
 * Per product: orders + standing orders + buffer. Lists every active product
 * baked that day, and any product that has orders for it, so no order is
 * left out of the plan (for example after its bake days changed). Sorted by
 * name. `products` must hold every product, inactive ones included, or
 * orders for the missing ones are left out.
 */
export function bakePlan(
  date: string,
  products: readonly PlanProduct[],
  items: readonly PlanItem[],
): PlanRow[] {
  const orders = new Map<string, number>();
  const standing = new Map<string, number>();
  for (const item of items) {
    // Cancelled and no-show pieces are not baked.
    if (!COUNTED_STATUSES.some((s) => s === item.status)) continue;
    const sums = item.source === "standing_order" ? standing : orders;
    sums.set(item.productId, (sums.get(item.productId) ?? 0) + item.quantity);
  }

  const weekday = weekdayOf(date);
  return products
    .filter(
      (p) =>
        (p.active && p.bakeDays.includes(weekday)) ||
        orders.has(p.id) ||
        standing.has(p.id),
    )
    .map((p) => {
      const ordered = orders.get(p.id) ?? 0;
      const regular = standing.get(p.id) ?? 0;
      // The buffer is for walk-in customers, so only on a day the product is
      // on sale: active and baked that weekday.
      const onSale = p.active && p.bakeDays.includes(weekday);
      const buffer = onSale ? p.buffer : 0;
      return {
        productId: p.id,
        name: p.name,
        orders: ordered,
        standing: regular,
        buffer,
        toBake: ordered + regular + buffer,
      };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name, "cs", { numeric: true }));
}

/** Column sums for the plan's last row. */
export function planTotals(rows: readonly PlanRow[]): PlanTotals {
  const totals = { orders: 0, standing: 0, buffer: 0, toBake: 0 };
  for (const row of rows) {
    totals.orders += row.orders;
    totals.standing += row.standing;
    totals.buffer += row.buffer;
    totals.toBake += row.toBake;
  }
  return totals;
}
