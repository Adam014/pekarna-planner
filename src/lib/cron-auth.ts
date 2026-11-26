/**
 * Vercel Schedules call the daily job on a public path and send
 * `Authorization: Bearer <CRON_SECRET>` (docs: vercel.com/docs/schedules/handle-runs).
 */
import { createHash, timingSafeEqual } from "node:crypto";

/** At least this long, as Vercel recommends for `CRON_SECRET`. */
const MIN_SECRET_LENGTH = 16;

/** A secret long enough to use; a trailing newline from pasting is ignored. */
export function cronSecret(value: string | undefined): string | null {
  const secret = value?.trim();
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

/**
 * True only for the right secret. Without a usable secret configured,
 * nothing is let in. Compared in constant time (hashes have equal length).
 */
export function isScheduledRequest(
  authorization: string | null,
  secret: string | null,
): boolean {
  if (!secret || !authorization) return false;
  const sha = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(sha(authorization), sha(`Bearer ${secret}`));
}
