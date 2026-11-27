"use server";

import { refresh } from "next/cache";
import {
  FIELD_MESSAGE,
  issueMessages,
  notBakedSaved,
  skippedDays,
  type StandingOrderField,
} from "@/components/standing-orders/messages";
import { db } from "@/lib/db";
import {
  endStandingOrder as end,
  saveStandingOrder as save,
} from "@/lib/services/standing-orders.service";
import { requireUser } from "@/lib/session";
import {
  standingOrderFormInput,
  standingOrderId,
} from "@/lib/validators/reservation";

export type StandingOrderFormState =
  | { status: "idle" }
  | {
      status: "saved";
      customerName: string;
      /** "út 1. 12. (Chléb, zbývá 5 ks)": days not created, limit. */
      skipped: string[];
      /** "Chléb se v pátek nepeče.", from notBaked. */
      notBaked: string[];
    }
  /** Czech text by field. */
  | { status: "invalid"; fields: Partial<Record<StandingOrderField, string>> }
  | {
      status: "rejected";
      reason: "not_found" | "ended" | "catalog_changed";
    };

/** The owner adds a standing order (no `id`) or edits one (R7). */
export async function saveStandingOrder(
  _prev: StandingOrderFormState,
  input: unknown,
): Promise<StandingOrderFormState> {
  await requireUser("owner");
  const parsed = standingOrderFormInput.safeParse(input);
  if (!parsed.success) {
    return { status: "invalid", fields: issueMessages(parsed.error.issues) };
  }
  const { id, ...order } = parsed.data;
  const result = await save(db, order, Temporal.Now.instant(), id);
  if (result.status === "saved") {
    refresh();
    const notBaked = Map.groupBy(result.notBaked, (n) => n.productName);
    return {
      status: "saved",
      customerName: order.customerName,
      skipped: skippedDays(result.skipped),
      notBaked: [...notBaked].map(([name, rows]) =>
        notBakedSaved(
          name,
          rows.map((r) => r.weekday),
        ),
      ),
    };
  }
  switch (result.reason) {
    case "invalid_phone":
      return { status: "invalid", fields: { phone: FIELD_MESSAGE.phone } };
    case "unknown_product":
    case "inactive_product":
      refresh();
      return { status: "rejected", reason: "catalog_changed" };
    case "not_found":
    case "ended":
      refresh();
      return { status: "rejected", reason: result.reason };
  }
}

export type EndState =
  | { status: "idle" }
  | { status: "ended" }
  | { status: "rejected"; reason: "not_found" };

/** The owner ends a standing order; its open future days go (R7). */
export async function endStandingOrder(
  _prev: EndState,
  id: unknown,
): Promise<EndState> {
  await requireUser("owner");
  const parsed = standingOrderId.safeParse(id);
  if (!parsed.success) return { status: "rejected", reason: "not_found" };
  const result = await end(db, parsed.data, Temporal.Now.instant());
  refresh();
  return result === "ended"
    ? { status: "ended" }
    : { status: "rejected", reason: "not_found" };
}
