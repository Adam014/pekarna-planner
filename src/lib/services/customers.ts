import { eq } from "drizzle-orm";
import type { Tx } from "../db/types";
import { customer } from "../db/schema";

/**
 * The customer with this phone (E.164), created with `name` if new. An
 * existing customer's name is left alone: the order keeps its own copy.
 */
export async function findOrCreateCustomer(
  tx: Tx,
  name: string,
  phone: string,
): Promise<typeof customer.$inferSelect> {
  const [created] = await tx
    .insert(customer)
    .values({ name, phone })
    .onConflictDoNothing({ target: customer.phone })
    .returning();
  if (created) return created;
  const [existing] = await tx
    .select()
    .from(customer)
    .where(eq(customer.phone, phone));
  if (!existing) throw new Error(`Customer ${phone} vanished`);
  return existing;
}
