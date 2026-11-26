/**
 * Data and helpers for the end-to-end tests. Each test starts from fresh
 * demo data plus one order for today, so the tests work on any weekday (the
 * demo bakery is closed on Sundays).
 */
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { resetDemo, seedDemo } from "../src/lib/db/demo-data";
import { product, reservation, user } from "../src/lib/db/schema";
import { today } from "../src/lib/domain/time";
import { createReservation } from "../src/lib/services/reservations.service";
import { connect } from "../test/db";
import { E2E_DATABASE_URL, STAFF } from "./env";

/** The order the tests work with; first in today's list (05:00). */
export const CUSTOMER = "Zkouška Výdeje";

export type E2eDb = ReturnType<typeof connect>;

export function openDb(): E2eDb {
  return connect(E2E_DATABASE_URL);
}

export async function resetData({ db }: E2eDb): Promise<void> {
  const now = Temporal.Now.instant();
  const [staff] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, STAFF.email));
  if (!staff) throw new Error("No staff account: the global setup did not run");

  await resetDemo(db);
  await seedDemo(db, now, staff.id);
  const [rohlik] = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.name, "Rohlík"));
  if (!rohlik) throw new Error("No Rohlík in the demo data");
  const created = await createReservation(
    db,
    {
      customerName: CUSTOMER,
      phone: "+420 777 000 299",
      pickupDate: today(now),
      pickupTime: "05:00",
      items: [{ productId: rohlik.id, quantity: 3 }],
      idempotencyKey: randomUUID(),
    },
    // Confirmed: on a Sunday the product is not baked.
    { source: "phone", userId: staff.id, confirmed: true },
    now,
  );
  if (created.status !== "created") throw new Error(created.status);
}

/** The saved status of the test order. */
export async function orderStatus({ db }: E2eDb): Promise<string | undefined> {
  const [row] = await db
    .select({ status: reservation.status })
    .from(reservation)
    .where(eq(reservation.customerName, CUSTOMER));
  return row?.status;
}

/** The card of a customer's order on "Dnes". */
export function orderCard(page: Page, name: string) {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });
}
