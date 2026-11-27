/**
 * Czech texts of "Trvalé objednávky" (R7). Specific messages instead of Zod's
 * generic ones (GOV.UK error messages); the reservation form's texts are
 * reused where they say the same thing.
 */
import {
  FIELD_MESSAGE as RESERVATION_MESSAGE,
  weekdayOn,
} from "@/components/new-reservation/messages";
import { formatShortDay } from "@/lib/format";

/** Form fields an error can belong to; "customer" is the search itself. */
export type StandingOrderField =
  | "customer"
  | "customerName"
  | "phone"
  | "weekdays"
  | "pickupTime"
  | "note"
  | "items";

export const FIELD_MESSAGE: Record<StandingOrderField, string> = {
  customer: RESERVATION_MESSAGE.customer,
  customerName: RESERVATION_MESSAGE.customerName,
  phone: RESERVATION_MESSAGE.phone,
  weekdays: "Vyberte aspoň jeden den vyzvednutí.",
  pickupTime: RESERVATION_MESSAGE.pickupTime,
  note: RESERVATION_MESSAGE.note,
  items: RESERVATION_MESSAGE.items,
};

const FIELDS = new Set<PropertyKey>(Object.keys(FIELD_MESSAGE));

/** One message per field, from Zod issues of `standingOrderFormInput`. */
export function issueMessages(
  issues: readonly { path: readonly PropertyKey[] }[],
): Partial<Record<StandingOrderField, string>> {
  const fields: Partial<Record<StandingOrderField, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (isField(field)) fields[field] = FIELD_MESSAGE[field];
  }
  return fields;
}

function isField(key: PropertyKey | undefined): key is StandingOrderField {
  return key !== undefined && FIELDS.has(key);
}

/** Why the server refused a save. */
export const REJECTED_MESSAGE = {
  not_found: "Trvalá objednávka mezitím zmizela. Načtěte stránku znovu.",
  ended: "Tahle objednávka už je ukončená. Načtěte stránku znovu.",
  catalog_changed: "Nabídka se mezitím změnila. Zkontrolujte výrobky.",
} as const;

/** "6:45" from '06:45'. */
export function formatTime(time: string): string {
  const [h = "", m = ""] = time.split(":");
  return `${Number(h)}:${m}`;
}

/** What the toasts say after a save or an end. */
export const savedMessage = (name: string) => `Uloženo: ${name}`;
export const endedMessage = (name: string) => `Ukončeno: ${name}`;

/** Under "Jméno" on an edit: the service renames the customer. */
export const RENAME_HINT = "Jméno se změní i u zákazníka.";

/** Above the footer of a new standing order. */
export const NEW_ORDER_HINT =
  "Objednávky vzniknou na 4 týdny dopředu a pak se samy doplňují.";

/** After the list of skipped days in the toast. */
export const SKIPPED_HINT =
  "Uvolněte místo nebo snižte množství; den se doplní sám, až bude místo.";

export const EMPTY_TITLE = "Zatím tu nejsou žádné trvalé objednávky.";
export const EMPTY_TEXT =
  "Pravidelní zákazníci, třeba kavárna nebo školka, tu mají své objednávky na každý týden. Objednávky se pak samy objeví v plánu pečení i na Dnes.";

/** Weekdays after "od": "od pátku". */
const FROM_WEEKDAY = [
  "pondělí",
  "úterý",
  "středy",
  "čtvrtka",
  "pátku",
  "soboty",
  "neděle",
];

/** "pátku 28. listopadu" for a 'YYYY-MM-DD' day, to follow "od". */
export function formatDayFrom(date: string): string {
  const day = Temporal.PlainDate.from(date);
  return `${FROM_WEEKDAY[day.dayOfWeek - 1]} ${day.toLocaleString("cs-CZ", {
    day: "numeric",
    month: "long",
  })}`;
}

/** On an edit: from which day the change applies. */
export function appliesFromMessage(date: string): string {
  return `Změny platí od ${formatDayFrom(date)}. Dny před tím zůstanou, jak jsou.`;
}

/** The end confirmation; `closedTomorrow` when tomorrow's day stays. */
export function endConfirmMessage(
  name: string,
  from: string,
  closedTomorrow: boolean,
): string {
  const text = `${name} přestane dostávat objednávky od ${from}.`;
  return closedTomorrow
    ? `${text} Zítřejší objednávka už je po uzávěrce a zůstane; zrušíte ji na stránce Dnes.`
    : text;
}

/** "Chléb, zbývá 5 ks": one product that did not fit on a day. */
export function skippedMessage(productName: string, remaining: number): string {
  return remaining === 0
    ? `${productName}, už nic nezbývá`
    : `${productName}, zbývá ${remaining} ks`;
}

/**
 * "út 1. 12. (Chléb, zbývá 5 ks)", one per day, in date order. Formats with
 * Temporal, so it runs on the server.
 */
export function skippedDays(
  skipped: readonly { date: string; productName: string; remaining: number }[],
): string[] {
  const byDate = new Map<string, string[]>();
  for (const s of skipped.toSorted((a, b) => a.date.localeCompare(b.date))) {
    const products = byDate.get(s.date) ?? [];
    products.push(skippedMessage(s.productName, s.remaining));
    byDate.set(s.date, products);
  }
  return [...byDate].map(
    ([date, products]) => `${formatShortDay(date)} (${products.join("; ")})`,
  );
}

/** "1 den se nevešel do limitu: út 1. 12. (Chléb, zbývá 5 ks)". */
export function skippedSummary(days: readonly string[]): string {
  const n = days.length;
  const head =
    n === 1
      ? "1 den se nevešel"
      : n < 5
        ? `${n} dny se nevešly`
        : `${n} dní se nevešlo`;
  return `${head} do limitu: ${days.join(", ")}`;
}

/** The warning toast after a save with skipped days. */
export function skippedToast(days: readonly string[]): string {
  return `Nevešlo se do limitu: ${days.join(", ")}.`;
}

/**
 * Under a product: "V sobotu se nepeče, ten den v objednávce nebude." The
 * messages below avoid pronouns and verb agreement with the product name,
 * which can be of any gender or number ("Makové buchty", "Vánočka").
 */
export function notBakedHint(weekdays: readonly number[]): string {
  const rest =
    weekdays.length > 1
      ? "ty dny v objednávce nebude."
      : "ten den v objednávce nebude.";
  return `${capitalize(onWeekdays(weekdays))} se nepeče, ${rest}`;
}

/** After a save: "V pátek se nepeče: Chléb." */
export function notBakedSaved(
  productName: string,
  weekdays: readonly number[],
): string {
  return `${capitalize(onWeekdays(weekdays))} se nepeče: ${productName}.`;
}

/** "v sobotu a v neděli". */
function onWeekdays(weekdays: readonly number[]): string {
  const days = weekdays.map(weekdayOn);
  return days.length > 1
    ? `${days.slice(0, -1).join(", ")} a ${days.at(-1)}`
    : (days[0] ?? "");
}

/** On an edit, products taken off the offer since. */
export function inactiveNotice(names: readonly string[]): string {
  return names.length > 1
    ? `Už nejsou v nabídce: ${names.join(", ")}. Uložením se z objednávky odeberou.`
    : `Už není v nabídce: ${names[0]}. Uložením se z objednávky odebere.`;
}

/** On a row: "Už není v nabídce: Croissant." */
export function inactiveRowMessage(names: readonly string[]): string {
  return names.length > 1
    ? `Už nejsou v nabídce: ${names.join(", ")}.`
    : `Už není v nabídce: ${names[0]}.`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
