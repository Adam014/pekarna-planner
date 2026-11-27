/**
 * The public order form (R2) as sent by the browser, with or without
 * JavaScript. Every message is Czech and says which rule failed (Baymard),
 * so the form can show it next to the field and in the error summary.
 * Server only: the phone check uses the full libphonenumber metadata.
 */
import { z } from "zod";
import { normalizePhone } from "../domain/phone";
import { reservationInput, type ReservationInput } from "./reservation";

export type OrderField =
  "pickupDate" | "items" | "pickupTime" | "customerName" | "phone";

export type OrderErrors = Partial<Record<OrderField, string[]>>;

/** What was typed, sent back after an error so nothing is lost. */
export type OrderFormValues = {
  pickupDate: string;
  pickupTime: string;
  customerName: string;
  phone: string;
  remember: boolean;
  /** Pieces by product id, as typed. */
  quantities: Record<string, string>;
};

export type ParsedOrderForm =
  | { success: true; input: ReservationInput; values: OrderFormValues }
  | {
      success: false;
      errors: OrderErrors;
      /** A problem with no field to point at. */
      message?: string;
      values: OrderFormValues;
    };

export const ORDER_FORM_MESSAGES = {
  day: "Na tento den už objednávat nejde. Vyberte jiný den.",
  noItems: "Vyberte aspoň jeden výrobek.",
  quantity: "Zadejte počet kusů celým číslem.",
  tooMany: "Jednoho výrobku jde objednat nejvýš 999 kusů.",
  changed: "Nabídka se mezitím změnila. Zkontrolujte objednávku.",
  time: "Zadejte čas jako 8:30.",
  name: "Zadejte jméno.",
  nameLength: "Jméno může mít nejvýš 100 znaků.",
  phone: "Zadejte telefon.",
  phoneInvalid: "Zadejte telefon ve tvaru 601 234 567 nebo +420 601 234 567.",
  failed: "Objednávku se nepodařilo odeslat.",
  reload: "Objednávku se nepodařilo odeslat. Načtěte stránku znovu.",
} as const;

const M = ORDER_FORM_MESSAGES;

/** Quantity inputs are named `qty.<productId>`. */
export const QUANTITY_PREFIX = "qty.";

/** A hidden field people never fill; form bots often do. */
export const HONEYPOT_FIELD = "website";

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

export function parseOrderForm(formData: FormData): ParsedOrderForm {
  const quantities: Record<string, string> = {};
  for (const [name, value] of formData) {
    if (name.startsWith(QUANTITY_PREFIX) && typeof value === "string") {
      quantities[name.slice(QUANTITY_PREFIX.length)] = value;
    }
  }
  const values: OrderFormValues = {
    pickupDate: text(formData, "pickupDate"),
    pickupTime: text(formData, "pickupTime"),
    customerName: text(formData, "customerName"),
    phone: text(formData, "phone"),
    remember: formData.get("remember") === "on",
    quantities,
  };

  if (text(formData, HONEYPOT_FIELD) !== "") {
    return { success: false, errors: {}, message: M.failed, values };
  }

  const errors: OrderErrors = {};
  const add = (field: OrderField, message: string) => {
    (errors[field] ??= []).push(message);
  };

  if (!z.iso.date().safeParse(values.pickupDate).success) {
    add("pickupDate", M.day);
  }

  const items: { productId: string; quantity: number }[] = [];
  for (const [productId, raw] of Object.entries(quantities)) {
    const value = raw.trim();
    if (value === "" || value === "0") continue;
    if (!/^\d+$/.test(value)) {
      add("items", M.quantity);
    } else if (Number(value) > 999) {
      add("items", M.tooMany);
    } else if (Number(value) > 0) {
      items.push({ productId, quantity: Number(value) });
    }
  }
  if (items.length === 0 && !errors.items) add("items", M.noItems);

  const pickupTime = parseTime(values.pickupTime);
  if (pickupTime === null) add("pickupTime", M.time);

  const name = values.customerName.trim();
  if (name === "") add("customerName", M.name);
  else if (name.length > 100) add("customerName", M.nameLength);

  const phone = values.phone.trim();
  if (phone === "") add("phone", M.phone);
  else if (phone.length > 40 || !normalizePhone(phone)) {
    add("phone", M.phoneInvalid);
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors: dedupe(errors), values };
  }

  const parsed = reservationInput.safeParse({
    customerName: name,
    phone,
    pickupDate: values.pickupDate,
    pickupTime: pickupTime ?? undefined,
    items,
    idempotencyKey: text(formData, "idempotencyKey"),
  });
  if (!parsed.success) {
    // Only a changed page gets here: product ids or the key not from the form.
    const badItems = parsed.error.issues.some((i) => i.path[0] === "items");
    return badItems
      ? { success: false, errors: { items: [M.changed] }, values }
      : { success: false, errors: {}, message: M.reload, values };
  }
  return { success: true, input: parsed.data, values };
}

/**
 * "08:30" from "8:30" or "08:30" (browsers without a time picker send what
 * was typed); undefined when empty, null when not a time.
 */
function parseTime(value: string): string | undefined | null {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(trimmed);
  if (!match) return null;
  const [, h = "", m = ""] = match;
  if (Number(h) > 23 || Number(m) > 59) return null;
  return `${h.padStart(2, "0")}:${m}`;
}

function dedupe(errors: OrderErrors): OrderErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, list]) => [field, [...new Set(list)]]),
  );
}
