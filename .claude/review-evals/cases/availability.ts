export interface Db {
  reservedQuantity(productId: string, day: string): Promise<number>;
  standingQuantity(productId: string, day: string): Promise<number>;
  dailyLimit(productId: string): Promise<number>;
  insertReservationLine(
    productId: string,
    day: string,
    quantity: number,
  ): Promise<void>;
}

/** Saves a reservation line if enough pieces are left for that day. */
export async function reserve(
  db: Db,
  productId: string,
  day: string,
  quantity: number,
): Promise<{ ok: true } | { ok: false; left: number }> {
  const limit = await db.dailyLimit(productId);
  const reserved = await db.reservedQuantity(productId, day);
  const left = limit - reserved;

  if (quantity > left) return { ok: false, left };

  await db.insertReservationLine(productId, day, quantity);
  return { ok: true };
}
