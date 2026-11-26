"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { setReservationStatus } from "@/lib/services/reservations.service";
import { requireUser } from "@/lib/session";
import { statusInput } from "@/lib/validators/reservation";

export type SetStatusResult =
  | { status: "updated" | "not_found" | "too_early" | "changed" | "invalid" }
  /** Products that no longer fit the daily limit. */
  | { status: "sold_out"; products: string[] };

/** Staff mark a reservation on "Dnes" or put a wrong mark back (R5). */
export async function setStatus(input: unknown): Promise<SetStatusResult> {
  await requireUser();
  const parsed = statusInput.safeParse(input);
  if (!parsed.success) return { status: "invalid" };

  const result = await setReservationStatus(
    db,
    parsed.data.reservationId,
    parsed.data.status,
    Temporal.Now.instant(),
    parsed.data.from,
  );
  // Also when refused: the list then shows what is really saved.
  refresh();
  if (result.status === "sold_out") {
    return {
      status: "sold_out",
      products: result.overLimit.map((o) => o.productName),
    };
  }
  return result;
}
