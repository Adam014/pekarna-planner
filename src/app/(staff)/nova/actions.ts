"use server";

import { refresh } from "next/cache";
import {
  FIELD_MESSAGE,
  issueMessages,
  type Field,
} from "@/components/new-reservation/messages";
import { db } from "@/lib/db";
import { createReservation } from "@/lib/services/reservations.service";
import { requireUser } from "@/lib/session";
import { phoneReservationInput } from "@/lib/validators/reservation";

export type NewReservationState =
  | { status: "idle" }
  | { status: "created"; customerName: string; date: string; pieces: number }
  /** Products not baked on the day; saved only after staff confirm. */
  | { status: "needs_confirmation"; products: string[] }
  /** Pieces still free, by product id, for each product over the limit. */
  | { status: "sold_out"; remaining: Record<string, number> }
  /** Czech text by field. */
  | { status: "invalid"; fields: Partial<Record<Field, string>> }
  | {
      status: "rejected";
      reason: "day_not_bookable" | "catalog_changed" | "idempotency_conflict";
    };

/** Staff save a reservation taken on the phone (R1). */
export async function createPhoneReservation(
  _prev: NewReservationState,
  input: unknown,
): Promise<NewReservationState> {
  const user = await requireUser();
  const parsed = phoneReservationInput.safeParse(input);
  if (!parsed.success) {
    return { status: "invalid", fields: issueMessages(parsed.error.issues) };
  }
  const { confirmed, ...order } = parsed.data;

  const result = await createReservation(
    db,
    order,
    { source: "phone", userId: user.id, confirmed },
    Temporal.Now.instant(),
  );
  switch (result.status) {
    case "created":
    case "replayed":
      // "Zbývá" on the form counts the new order.
      refresh();
      return {
        status: "created",
        customerName: order.customerName,
        date: order.pickupDate,
        pieces: order.items.reduce((sum, i) => sum + i.quantity, 0),
      };
    case "needs_confirmation":
      return {
        status: "needs_confirmation",
        products: result.warnings.map((w) => w.productName),
      };
    case "rejected":
      switch (result.reason) {
        case "invalid_phone":
          return { status: "invalid", fields: { phone: FIELD_MESSAGE.phone } };
        case "sold_out":
          refresh();
          return {
            status: "sold_out",
            remaining: Object.fromEntries(
              (result.overLimit ?? []).map((o) => [o.productId, o.remaining]),
            ),
          };
        case "unknown_product":
        case "inactive_product":
          refresh();
          return { status: "rejected", reason: "catalog_changed" };
        case "day_not_bookable":
          // A tablet left open overnight still offers yesterday; reload the days.
          refresh();
          return { status: "rejected", reason: result.reason };
        case "idempotency_conflict":
          return { status: "rejected", reason: result.reason };
      }
  }
}
