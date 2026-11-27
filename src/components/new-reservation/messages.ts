/**
 * Czech texts of the phone form (R1). Specific messages instead of Zod's
 * generic ones (GOV.UK error messages); the same text shows in the summary
 * and by the field.
 */
import type { NewReservationState } from "@/app/(staff)/nova/actions";

/** Form fields an error can belong to; "customer" is the search itself. */
export type Field =
  | "customer"
  | "customerName"
  | "phone"
  | "pickupDate"
  | "pickupTime"
  | "note"
  | "items";

export const FIELD_MESSAGE: Record<Field, string> = {
  customer: "Vyberte zákazníka nebo zadejte nového.",
  customerName: "Zadejte jméno zákazníka.",
  phone: "Zadejte telefonní číslo ve správném tvaru, třeba 601 234 567.",
  pickupDate: "Vyberte den vyzvednutí.",
  pickupTime: "Zadejte čas, třeba 7:30.",
  note: "Poznámka může mít nejvýš 500 znaků.",
  items: "Vyberte aspoň jeden výrobek.",
};

const FIELDS = new Set<PropertyKey>(Object.keys(FIELD_MESSAGE));

/** One message per field, from Zod issues of `phoneReservationInput`. */
export function issueMessages(
  issues: readonly { path: readonly PropertyKey[] }[],
): Partial<Record<Field, string>> {
  const fields: Partial<Record<Field, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (isField(field)) fields[field] = FIELD_MESSAGE[field];
  }
  return fields;
}

function isField(key: PropertyKey | undefined): key is Field {
  return key !== undefined && FIELDS.has(key);
}

/** Why the server refused the order. */
export const REJECTED_MESSAGE: Record<
  Extract<NewReservationState, { status: "rejected" }>["reason"],
  string
> = {
  day_not_bookable: "Vyberte den od dneška do 21 dní.",
  catalog_changed: "Nabídka se mezitím změnila. Zkontrolujte výrobky.",
  idempotency_conflict: "Tahle rezervace už je uložená. Začněte novou.",
};

/** A product over what is left on the chosen day. */
export function soldOutMessage(remaining: number): string {
  return remaining === 0
    ? "Na tento den je vyprodáno."
    : `Zbývá jen ${remaining} ks.`;
}

/** ISO weekday (1 = Monday) as on the day pills: "So 29.". */
export const WEEKDAY_SHORT = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

/** "v sobotu": the weekday after a preposition. */
const WEEKDAY_ON = [
  "v pondělí",
  "v úterý",
  "ve středu",
  "ve čtvrtek",
  "v pátek",
  "v sobotu",
  "v neděli",
];

export function weekdayOn(weekday: number): string {
  return WEEKDAY_ON[weekday - 1] ?? "";
}

/** The warning before saving products on a day they are not baked. */
export function notBakedMessage(products: string[], weekday: number): string {
  const verb = products.length > 1 ? "nepečou" : "nepeče";
  return `${products.join(", ")} se ${weekdayOn(weekday)} ${verb}. Uložit i tak?`;
}

/** The toast after saving: "Uloženo: Jana Nováková, pátek 28. 11., 6 ks". */
export function savedMessage(name: string, day: string, pieces: number) {
  return `Uloženo: ${name}, ${day}, ${pieces} ks`;
}
