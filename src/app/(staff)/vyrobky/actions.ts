"use server";

import { refresh } from "next/cache";
import {
  CUTOFF_MESSAGE,
  issueMessages,
  NAME_TAKEN,
  NOT_FOUND,
  type ProductField,
} from "@/components/products/messages";
import { db } from "@/lib/db";
import { addDays, isBeforeCutoff, today } from "@/lib/domain/time";
import { deletePhoto, storePhoto } from "@/lib/product-photo";
import {
  saveProduct as save,
  setProductImage,
} from "@/lib/services/products.service";
import { setCutoffTime } from "@/lib/services/settings";
import { requireUser } from "@/lib/session";
import { cutoffInput, productInput } from "@/lib/validators/product";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export type PhotoState =
  | { status: "idle" }
  | { status: "saved"; imageUrl: string | null }
  | { status: "error"; message: string };

const PHOTO_MESSAGES = {
  not_configured: "Nahrávání fotek tu není nastavené.",
  invalid_file: "Tuhle fotku se nepodařilo načíst. Zkuste JPG nebo PNG.",
  not_found: NOT_FOUND,
} as const;

/** The owner sets a product's photo (FormData: productId, photo). */
export async function uploadProductPhoto(
  _prev: PhotoState,
  data: FormData,
): Promise<PhotoState> {
  await requireUser("owner");
  const id = data.get("productId");
  const file = data.get("photo");
  if (typeof id !== "string" || !UUID.test(id) || !(file instanceof File)) {
    return { status: "error", message: PHOTO_MESSAGES.invalid_file };
  }
  const stored = await storePhoto(id, file);
  if ("error" in stored) {
    return { status: "error", message: PHOTO_MESSAGES[stored.error] };
  }
  const result = await setProductImage(db, id, stored.url);
  if (!result) {
    await deletePhoto(stored.url);
    return { status: "error", message: PHOTO_MESSAGES.not_found };
  }
  await deletePhoto(result.previous);
  refresh();
  return { status: "saved", imageUrl: stored.url };
}

/** The owner removes a product's photo. */
export async function removeProductPhoto(id: string): Promise<PhotoState> {
  await requireUser("owner");
  if (!UUID.test(id)) {
    return { status: "error", message: PHOTO_MESSAGES.not_found };
  }
  const result = await setProductImage(db, id, null);
  if (!result) return { status: "error", message: PHOTO_MESSAGES.not_found };
  await deletePhoto(result.previous);
  refresh();
  return { status: "saved", imageUrl: null };
}
