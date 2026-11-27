/**
 * The order links this browser remembers (R3), in one HttpOnly cookie
 * (ADR 0007; docs/research/reports/order-link-page). The value is the raw
 * tokens the customer already holds as links, newest first, joined by "."
 * (not in base64url, so nothing needs escaping).
 */
import { cookies } from "next/headers";
import {
  BOOKING_HORIZON_DAYS,
  ORDER_LINK_DAYS_AFTER_PICKUP,
} from "./domain/reservation";
import { orderToken } from "./validators/order-token";

/** `__Host-`: only over HTTPS, for this host and every path (MDN). */
export const ORDER_COOKIE = "__Host-pekarna-orders";

/** 5 × 43 characters + 4 dots: far below the 4 kB a cookie may hold. */
export const MAX_REMEMBERED = 5;

/** The longest a token still works: booked 21 days ahead + 30 days after. */
const REMEMBER_SECONDS =
  (BOOKING_HORIZON_DAYS + ORDER_LINK_DAYS_AFTER_PICKUP) * 24 * 60 * 60;

/** The tokens in a cookie value; anything not shaped like a token is dropped. */
export function parseTokens(value: string | undefined): string[] {
  if (!value) return [];
  const tokens = value
    .split(".")
    .filter((t) => orderToken.safeParse(t).success);
  return [...new Set(tokens)].slice(0, MAX_REMEMBERED);
}

/** `token` first, without a duplicate, at most MAX_REMEMBERED. */
export function withToken(tokens: readonly string[], token: string): string[] {
  return [token, ...tokens.filter((t) => t !== token)].slice(0, MAX_REMEMBERED);
}

/** The remembered tokens; read in a Server Component or a Server Function. */
export async function readOrderTokens(): Promise<string[]> {
  return parseTokens((await cookies()).get(ORDER_COOKIE)?.value);
}

/**
 * Saves the tokens; only in a Server Function. A session cookie by default,
 * which needs no consent (WP194 §3.2); a persistent one only when the
 * customer ticked "Zapamatovat si mě" (WP194: persistent login tokens are
 * not exempt, a "remember me" box is the consent).
 */
export async function writeOrderTokens(
  tokens: readonly string[],
  persistent: boolean,
): Promise<void> {
  (await cookies()).set(ORDER_COOKIE, tokens.join("."), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    ...(persistent ? { maxAge: REMEMBER_SECONDS } : {}),
  });
}
