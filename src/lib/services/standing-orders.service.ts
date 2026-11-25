/**
 * Standing orders (R7, ADR 0007): a template whose days are ordinary
 * reservations, created STANDING_ORDER_HORIZON_DAYS ahead. Saving a template,
 * the daily job and opening the bake plan all fill in missing days; creating
 * a day twice changes nothing. A day that does not fit the daily limit is not
 * created and is reported; a later fill creates it once there is room.
 */
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db, Tx } from "../db/types";
import {
  customer,
  reservation,
  reservationItem,
  standingOrder,
  standingOrderItem,
} from "../db/schema";
import { normalizePhone } from "../domain/phone";
import { standingOrderDates, unbakedWeekdays } from "../domain/standing-orders";
import { addDays, isBeforeCutoff, today, weekdayOf } from "../domain/time";
import type { StandingOrderInput } from "../validators/reservation";
import {
  type LockedProduct,
  lockProducts,
  orderedPieces,
  overLimit,
  type OverLimit,
} from "./demand";
import { cutoffTime } from "./settings";

/** A product left out of the template's days it is not baked on. */
export type NotBaked = {
  kind: "not_baked";
  weekday: number;
  productId: string;
  productName: string;
};

export type SaveResult =
  | {
      status: "saved";
      standingOrderId: string;
      notBaked: NotBaked[];
      /** Days not created because they do not fit the daily limit. */
      skipped: OverLimit[];
    }
  | {
      status: "rejected";
      reason:
        | "invalid_phone"
        | "unknown_product"
        | "inactive_product"
        | "not_found"
        | "ended";
    };

/**
 * Saving, ending and filling take this lock first, so they run one at a
 * time: a fill never works from a template that is being changed, and the
 * three cannot deadlock on the template and product rows.
 */
async function lockStandingOrders(tx: Tx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(7, 1)`);
}

/**
 * Creates a template (no `standingOrderId`) or changes an active one. Its
 * future days still before the cutoff are recreated from the new version;
 * past days, days after the cutoff and cancelled days stay as they are. The
 * name typed by the owner becomes the customer's name.
 */
export async function saveStandingOrder(
  db: Db,
  input: StandingOrderInput,
  now: Temporal.Instant,
  standingOrderId?: string,
): Promise<SaveResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { status: "rejected", reason: "invalid_phone" };

  return db.transaction(async (tx) => {
    await lockStandingOrders(tx);
    if (standingOrderId) {
      const [current] = await tx
        .select({ active: standingOrder.active })
        .from(standingOrder)
        .where(eq(standingOrder.id, standingOrderId));
      if (!current) return { status: "rejected", reason: "not_found" };
      if (!current.active) return { status: "rejected", reason: "ended" };
    }

    const cutoff = await cutoffTime(tx);
    const ids = input.items.map((i) => i.productId);
    const products = await lockProducts(tx, ids);
    if (products.size !== ids.length) {
      return { status: "rejected", reason: "unknown_product" };
    }
    if ([...products.values()].some((p) => !p.active)) {
      return { status: "rejected", reason: "inactive_product" };
    }

    const [owner] = await tx
      .insert(customer)
      .values({ name: input.customerName, phone })
      .onConflictDoUpdate({
        target: customer.phone,
        set: { name: input.customerName },
      })
      .returning();
    if (!owner) throw new Error("Upsert returned no row");

    const values = {
      customerId: owner.id,
      weekdays: input.weekdays,
      pickupTime: input.pickupTime ?? null,
      note: input.note || null,
    };
    let id = standingOrderId;
    if (id) {
      await tx
        .update(standingOrder)
        .set(values)
        .where(eq(standingOrder.id, id));
      await tx
        .delete(standingOrderItem)
        .where(eq(standingOrderItem.standingOrderId, id));
      await deleteOpenDays(tx, id, now, cutoff);
    } else {
      const [created] = await tx
        .insert(standingOrder)
        .values(values)
        .returning({ id: standingOrder.id });
      if (!created) throw new Error("Insert returned no row");
      id = created.id;
    }
    await tx
      .insert(standingOrderItem)
      .values(input.items.map((item) => ({ standingOrderId: id, ...item })));

    const template = { id, ...values, items: input.items };
    const skipped = await createDays(
      tx,
      template,
      owner,
      products,
      now,
      cutoff,
    );
    const notBaked = [...products.values()].flatMap((p) =>
      unbakedWeekdays(input.weekdays, p.bakeDays).map((weekday) => ({
        kind: "not_baked" as const,
        weekday,
        productId: p.id,
        productName: p.name,
      })),
    );
    return { status: "saved", standingOrderId: id, notBaked, skipped };
  });
}

/** Ends a standing order: its open future days go, past days stay. */
export async function endStandingOrder(
  db: Db,
  standingOrderId: string,
  now: Temporal.Instant,
): Promise<"ended" | "not_found"> {
  return db.transaction(async (tx) => {
    await lockStandingOrders(tx);
    const [ended] = await tx
      .update(standingOrder)
      .set({ active: false })
      .where(eq(standingOrder.id, standingOrderId))
      .returning({ id: standingOrder.id });
    if (!ended) return "not_found";
    await deleteOpenDays(tx, standingOrderId, now, await cutoffTime(tx));
    return "ended";
  });
}

/**
 * Creates the missing days of every active standing order. Safe to run any
 * number of times, also concurrently (the daily job, opening the bake plan).
 * Returns the days that do not fit the daily limit; they are reported again
 * on every run until there is room or the day passes.
 */
export async function fillStandingOrderDays(
  db: Db,
  now: Temporal.Instant,
): Promise<{ skipped: OverLimit[] }> {
  return db.transaction(async (tx) => {
    await lockStandingOrders(tx);
    const templates = await tx
      .select()
      .from(standingOrder)
      .where(eq(standingOrder.active, true));
    if (templates.length === 0) return { skipped: [] };

    const templateIds = templates.map((t) => t.id);
    const items = await tx
      .select()
      .from(standingOrderItem)
      .where(inArray(standingOrderItem.standingOrderId, templateIds));
    const owners = await tx
      .select()
      .from(customer)
      .where(
        inArray(
          customer.id,
          templates.map((t) => t.customerId),
        ),
      );
    const cutoff = await cutoffTime(tx);
    const products = await lockProducts(tx, [
      ...new Set(items.map((i) => i.productId)),
    ]);

    const skipped: OverLimit[] = [];
    for (const template of templates) {
      const owner = owners.find((c) => c.id === template.customerId);
      if (!owner) throw new Error(`Customer of ${template.id} is missing`);
      const own = items.filter((i) => i.standingOrderId === template.id);
      skipped.push(
        ...(await createDays(
          tx,
          { ...template, items: own },
          owner,
          products,
          now,
          cutoff,
        )),
      );
    }
    return { skipped };
  });
}

type Template = {
  id: string;
  weekdays: number[];
  pickupTime: string | null;
  note: string | null;
  items: { productId: string; quantity: number }[];
};

/**
 * Inserts the template's missing days as reservations, with each product only
 * on its bake days. A day that would go over a limit is not created; those
 * days are returned. Existing days, including cancelled ones, are left alone.
 */
async function createDays(
  tx: Tx,
  template: Template,
  owner: typeof customer.$inferSelect,
  products: Map<string, LockedProduct>,
  now: Temporal.Instant,
  cutoff: string,
): Promise<OverLimit[]> {
  const dates = standingOrderDates(template.weekdays, now, cutoff);
  if (dates.length === 0) return [];
  const existing = await tx
    .select({ date: reservation.pickupDate })
    .from(reservation)
    .where(
      and(
        eq(reservation.standingOrderId, template.id),
        inArray(reservation.pickupDate, dates),
      ),
    );
  const missing = dates.filter((d) => !existing.some((e) => e.date === d));
  const ordered = await orderedPieces(
    tx,
    missing,
    template.items.map((i) => i.productId),
  );
  const skipped: OverLimit[] = [];

  for (const date of missing) {
    const dayItems = template.items.flatMap((item) => {
      const p = products.get(item.productId);
      return p?.active && p.bakeDays.includes(weekdayOf(date))
        ? [{ item, p }]
        : [];
    });
    if (dayItems.length === 0) continue;

    const over = overLimit(
      date,
      dayItems.map((d) => d.item),
      products,
      ordered,
    );
    if (over.length > 0) {
      skipped.push(...over);
      continue;
    }

    const [created] = await tx
      .insert(reservation)
      .values({
        customerId: owner.id,
        customerName: owner.name,
        customerPhone: owner.phone,
        pickupDate: date,
        pickupTime: template.pickupTime,
        source: "standing_order",
        note: template.note,
        standingOrderId: template.id,
      })
      .onConflictDoNothing({
        target: [reservation.standingOrderId, reservation.pickupDate],
      })
      .returning({ id: reservation.id });
    if (!created) continue;
    await tx.insert(reservationItem).values(
      dayItems.map(({ item, p }) => ({
        reservationId: created.id,
        productId: p.id,
        productName: p.name,
        quantity: item.quantity,
        unitPrice: p.price,
      })),
    );
  }
  return skipped;
}

/** Deletes the template's `reserved` days whose cutoff has not passed. */
async function deleteOpenDays(
  tx: Tx,
  standingOrderId: string,
  now: Temporal.Instant,
  cutoff: string,
): Promise<void> {
  const tomorrow = addDays(today(now), 1);
  const firstOpen = isBeforeCutoff(tomorrow, now, cutoff)
    ? tomorrow
    : addDays(tomorrow, 1);
  await tx
    .delete(reservation)
    .where(
      and(
        eq(reservation.standingOrderId, standingOrderId),
        eq(reservation.status, "reserved"),
        gte(reservation.pickupDate, firstOpen),
      ),
    );
}
