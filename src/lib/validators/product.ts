import { z } from "zod";

/** 100 000 Kč in haléře: far above any bakery price, catches a typo. */
export const MAX_PRICE_HALERE = 10_000_000;

/**
 * A price typed in crowns ("45", "45,50", "45.5", "1 200") as haléře, or
 * null when it is not a price. Integers only, no floats: the crowns and the
 * decimals are parsed as separate whole numbers.
 */
export function parsePriceHalere(text: string): number | null {
  const match = /^(\d{1,3}(?:[   ]\d{3})+|\d{1,9})(?:[.,](\d{1,2}))?$/.exec(
    text.trim(),
  );
  if (!match) return null;
  const crowns = Number((match[1] ?? "").replace(/\D/g, ""));
  const decimals = Number((match[2] ?? "").padEnd(2, "0"));
  return crowns * 100 + decimals;
}

/** Haléře as the price field shows them: "45" or "45,50". */
export function priceInputValue(halere: number): string {
  const crowns = Math.floor(halere / 100);
  const decimals = halere % 100;
  return decimals === 0
    ? String(crowns)
    : `${crowns},${String(decimals).padStart(2, "0")}`;
}

const price = z
  .string()
  .transform((text, ctx) => {
    const halere = parsePriceHalere(text);
    if (halere === null) {
      ctx.issues.push({ code: "custom", input: text, message: "Not a price" });
      return z.NEVER;
    }
    return halere;
  })
  .pipe(z.int().max(MAX_PRICE_HALERE));

/** A whole number typed into a text field, e.g. "40". */
const pieces = (min: number) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,3}$/)
    .transform(Number)
    .pipe(z.int().min(min).max(999));

/** What the owner sends for a new or edited product (R6). */
export const productInput = z.object({
  /** Absent for a new product. */
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(60),
  price,
  dailyLimit: pieces(1),
  buffer: pieces(0),
  bakeDays: z
    .array(z.int().min(1).max(7))
    .min(1)
    .refine((days) => new Set(days).size === days.length, {
      message: "Each weekday only once",
    })
    .transform((days) => days.toSorted((a, b) => a - b)),
  active: z.boolean(),
});
export type ProductInput = z.input<typeof productInput>;
export type ProductValues = z.output<typeof productInput>;

/** The order cutoff as HH:MM; the column is a Postgres `time`. */
export const cutoffInput = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export type CutoffInput = z.infer<typeof cutoffInput>;
