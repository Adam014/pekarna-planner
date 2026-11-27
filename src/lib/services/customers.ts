import { eq, sql } from "drizzle-orm";
import type { Db, Tx } from "../db/types";
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

/**
 * Every customer for the phone form's search, by name the Czech way. The form
 * filters them in the browser: a small bakery has hundreds at most. A product
 * with thousands of customers would search on the server instead.
 */
export async function listCustomers(
  db: Db,
): Promise<{ name: string; phone: string }[]> {
  return db
    .select({ name: customer.name, phone: customer.phone })
    .from(customer)
    .orderBy(sql`${customer.name} collate "cs-CZ-x-icu"`, customer.phone);
}
