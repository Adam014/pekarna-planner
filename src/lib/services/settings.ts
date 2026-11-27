import { eq } from "drizzle-orm";
import type { Db, Tx } from "../db/types";
import { settings } from "../db/schema";

/** The order cutoff, e.g. '18:00:00'; the row exists from migration 0002. */
export async function cutoffTime(tx: Db | Tx): Promise<string> {
  const [row] = await tx
    .select({ cutoff: settings.orderCutoffTime })
    .from(settings);
  if (!row) throw new Error("The settings row is missing");
  return row.cutoff;
}

/** Sets the order cutoff ('HH:MM'); every check reads it per request. */
export async function setCutoffTime(db: Db, time: string): Promise<void> {
  await db
    .update(settings)
    .set({ orderCutoffTime: time })
    .where(eq(settings.id, 1));
}
