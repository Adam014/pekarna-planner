"use server";

import { refresh } from "next/cache";
import {
  CUTOFF_MESSAGE,
  issueMessages,
  NAME_TAKEN,
  type ProductField,
} from "@/components/products/messages";
import { db } from "@/lib/db";
import { addDays, isBeforeCutoff, today } from "@/lib/domain/time";
import { saveProduct as save } from "@/lib/services/products.service";
import { setCutoffTime } from "@/lib/services/settings";
import { requireUser } from "@/lib/session";
import { cutoffInput, productInput } from "@/lib/validators/product";

export type ProductFormState =
  | { status: "idle" }
  | { status: "saved"; name: string }
  /** Czech text by field. */
  | { status: "invalid"; fields: Partial<Record<ProductField, string>> }
  | { status: "rejected"; reason: "not_found" };

/** The owner adds a product (no `id`) or edits one (R6). */
export async function saveProduct(
  _prev: ProductFormState,
  input: unknown,
): Promise<ProductFormState> {
  await requireUser("owner");
  const parsed = productInput.safeParse(input);
  if (!parsed.success) {
    return { status: "invalid", fields: issueMessages(parsed.error.issues) };
  }
  const result = await save(db, parsed.data);
  if (result.status === "saved") {
    refresh();
    return { status: "saved", name: parsed.data.name };
  }
  if (result.reason === "duplicate_name") {
    return { status: "invalid", fields: { name: NAME_TAKEN } };
  }
  refresh();
  return { status: "rejected", reason: result.reason };
}

export type CutoffState =
  | { status: "idle" }
  | { status: "saved"; time: string; tomorrowClosed: boolean }
  | { status: "invalid"; message: string };

/** The owner sets the order cutoff; it applies at once to every open day. */
export async function saveCutoff(
  _prev: CutoffState,
  input: unknown,
): Promise<CutoffState> {
  await requireUser("owner");
  const parsed = cutoffInput.safeParse(input);
  if (!parsed.success) return { status: "invalid", message: CUTOFF_MESSAGE };
  const { time } = parsed.data;
  await setCutoffTime(db, time);
  refresh();
  const now = Temporal.Now.instant();
  return {
    status: "saved",
    time,
    tomorrowClosed: !isBeforeCutoff(addDays(today(now), 1), now, time),
  };
}
