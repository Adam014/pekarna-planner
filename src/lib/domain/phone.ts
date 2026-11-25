/**
 * Phone numbers are stored in E.164 (+420601234567) so the same number typed
 * in any format finds the same customer (AGENTS.md). Uses the full metadata
 * (`max`): it checks the digits against the assigned number ranges and knows
 * the number type, not only the length. New ranges arrive with library
 * upgrades. Server only: the metadata is large.
 */
import {
  type NumberType,
  parsePhoneNumberFromString,
} from "libphonenumber-js/max";

const DEFAULT_COUNTRY = "CZ";

/** Numbers a customer can be called on; not premium-rate, toll-free etc. */
const CALLABLE: readonly NumberType[] = [
  "MOBILE",
  "FIXED_LINE",
  "FIXED_LINE_OR_MOBILE",
  "VOIP",
];

/**
 * The number in E.164, or null when it is not one callable number. Without a
 * country code it is read as Czech. The whole input must be the number:
 * nothing is taken out of surrounding text, and an extension or a second
 * number makes it invalid instead of being dropped.
 */
export function normalizePhone(input: string): string | null {
  // Pasted from contacts, numbers carry direction marks and unusual spaces.
  const cleaned = input.replace(/\p{Cf}/gu, "").replace(/\s+/gu, " ");
  const phone = parsePhoneNumberFromString(cleaned, {
    defaultCountry: DEFAULT_COUNTRY,
    extract: false,
  });
  if (!phone?.isValid() || phone.ext) return null;
  return CALLABLE.includes(phone.getType()) ? phone.number : null;
}

/** For display: Czech numbers as "601 234 567", others with the country code. */
export function formatPhone(e164: string): string {
  const phone = parsePhoneNumberFromString(e164);
  if (!phone) return e164;
  return phone.country === DEFAULT_COUNTRY
    ? phone.formatNational()
    : phone.formatInternational();
}
