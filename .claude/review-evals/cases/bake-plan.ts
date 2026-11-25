export type ReservationStatus =
  "reserved" | "picked_up" | "no_show" | "cancelled";

export interface ReservationLine {
  productId: string;
  quantity: number;
  status: ReservationStatus;
}

export interface Product {
  id: string;
  /** Extra pieces baked for walk-in customers. */
  buffer: number;
}

/** Pieces to bake per product for one day. */
export function bakePlan(
  products: Product[],
  lines: ReservationLine[],
): Map<string, number> {
  const plan = new Map<string, number>();
  for (const product of products) plan.set(product.id, 0);

  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId);
    if (!product) continue;
    const current = plan.get(product.id) ?? 0;
    plan.set(product.id, current + line.quantity + product.buffer);
  }

  return plan;
}
