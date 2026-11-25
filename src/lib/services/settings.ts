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
