/**
 * Name and phone kept in this browser, only when the customer ticks
 * "Zapamatovat" (WP194 §3.6: storage the user asked for needs no consent
 * banner). Never sent to the server and never a credential; the order link
 * stays out of it (ADR 0007). Storage can be missing or throw (private mode,
 * blocked site data), so every access is guarded and the form works without.
 */

export const CONTACT_KEY = "pekarna.contact";

export type SavedContact = { name: string; phone: string };

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The browser's localStorage, or null when it cannot be used. */
function browserStorage(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Reading the property itself throws when site data is blocked.
    return null;
  }
}

export function readContact(
  storage: Store | null = browserStorage(),
): SavedContact | null {
  try {
    const raw = storage?.getItem(CONTACT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      "name" in value &&
      "phone" in value &&
      typeof value.name === "string" &&
      typeof value.phone === "string"
    ) {
      return { name: value.name, phone: value.phone };
    }
    return null;
  } catch {
    // Unreadable storage or a broken value: the form starts empty.
    return null;
  }
}

/** Saves the contact, or forgets it when `contact` is null. */
export function writeContact(
  contact: SavedContact | null,
  storage: Store | null = browserStorage(),
): void {
  try {
    if (contact) storage?.setItem(CONTACT_KEY, JSON.stringify(contact));
    else storage?.removeItem(CONTACT_KEY);
  } catch {
    // Full or blocked storage: the order is saved, only the prefill is lost.
  }
}
