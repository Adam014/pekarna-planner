"use server";

import { refresh } from "next/cache";
import { rejectionErrors } from "@/components/order/messages";
import { db } from "@/lib/db";
import { formatDay, formatPrice } from "@/lib/format";
import { savedOrder } from "@/lib/services/online-order.service";
import { createReservation } from "@/lib/services/reservations.service";
import {
  parseOrderForm,
  type OrderErrors,
  type OrderFormValues,
} from "@/lib/validators/order-form";

export type OrderSummary = {
  /** "pátek 27. listopadu" */
  day: string;
  items: { name: string; quantity: number; price: string }[];
  total: string;
};

export type OrderFormState =
  | { status: "idle" }
  | {
      status: "error";
      errors: OrderErrors;
      message?: string;
      values: OrderFormValues;
    }
  | {
      status: "created";
      orderPath: string;
      summary: OrderSummary;
      /** Name and phone to keep in this browser, or null to forget them. */
      remember: { name: string; phone: string } | null;
    };

/**
 * A customer's order from the public form (R2). Public, so no session check
 * (ADR 0006 covers staff actions); the service enforces the online rules:
 * cutoff, booking horizon, bake days and the daily limit.
 */
export async function placeOrder(
  _previous: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const parsed = parseOrderForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.errors,
      message: parsed.message,
      values: parsed.values,
    };
  }

  const result = await createReservation(
    db,
    parsed.input,
    { source: "online" },
    Temporal.Now.instant(),
  );
  if (result.status === "rejected") {
    // The offer changed under the customer: show what is left now.
    refresh();
    return {
      status: "error",
      ...rejectionErrors(result.reason, result.overLimit),
      values: parsed.values,
    };
  }
  if (result.status === "needs_confirmation" || !result.token) {
    throw new Error(`Unexpected online result: ${result.status}`);
  }

  const order = await savedOrder(db, result.reservationId);
  const total = order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  return {
    status: "created",
    orderPath: `/objednavka/${result.token}`,
    summary: {
      day: formatDay(order.pickupDate),
      items: order.items.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
        price: formatPrice(i.quantity * i.unitPrice),
      })),
      total: formatPrice(total),
    },
    remember: parsed.values.remember
      ? { name: parsed.input.customerName, phone: parsed.values.phone.trim() }
      : null,
  };
}
