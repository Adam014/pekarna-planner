/**
 * Czech texts of "Výrobky" (R6). Specific messages instead of Zod's generic
 * ones (GOV.UK error messages).
 */
import { WEEKDAY_SHORT } from "@/components/new-reservation/messages";

export type ProductField =
  "name" | "price" | "dailyLimit" | "buffer" | "bakeDays";

export const FIELD_MESSAGE: Record<ProductField, string> = {
  name: "Zadejte název výrobku.",
  price: "Zadejte cenu v korunách, třeba 45 nebo 45,50.",
  dailyLimit: "Zadejte denní limit jako celé číslo od 1 do 999.",
  buffer: "Zadejte rezervu jako celé číslo od 0 do 999.",
  bakeDays: "Vyberte aspoň jeden den, kdy se peče.",
};

export const NAME_TOO_LONG = "Název může mít nejvýš 60 znaků.";
export const NAME_TAKEN = "Výrobek s tímto názvem už existuje.";
export const PRICE_TOO_HIGH = "Cena může být nejvýš 100 000 Kč.";
export const NOT_FOUND = "Výrobek mezitím zmizel. Načtěte stránku znovu.";
export const CUTOFF_MESSAGE = "Zadejte čas, třeba 18:00.";

const FIELDS = new Set<PropertyKey>(Object.keys(FIELD_MESSAGE));

/** One message per field, from Zod issues of `productInput`. */
export function issueMessages(
  issues: readonly { path: readonly PropertyKey[]; code: string }[],
): Partial<Record<ProductField, string>> {
  const fields: Partial<Record<ProductField, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (!isField(field) || fields[field]) continue;
    fields[field] =
      field === "name" && issue.code === "too_big"
        ? NAME_TOO_LONG
        : field === "price" && issue.code === "too_big"
          ? PRICE_TOO_HIGH
          : FIELD_MESSAGE[field];
  }
  return fields;
}

function isField(key: PropertyKey | undefined): key is ProductField {
  return key !== undefined && FIELDS.has(key);
}

/** "Po Út St Čt Pá", or "Každý den" for all seven. */
export function formatBakeDays(days: readonly number[]): string {
  if (new Set(days).size === 7) return "Každý den";
  return days
    .toSorted((a, b) => a - b)
    .map((day) => WEEKDAY_SHORT[day - 1])
    .join(" ");
}

/** The toast after saving the cutoff. */
export function cutoffSavedMessage(time: string, tomorrowClosed: boolean) {
  return tomorrowClosed
    ? `Uzávěrka je teď v ${time}. Na zítra už nejde objednat.`
    : `Uzávěrka je teď v ${time}.`;
}
