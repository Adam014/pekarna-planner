/**
 * Staff may change a status either way to fix a wrong mark; customers only
 * cancel (AGENTS.md).
 */
export const RESERVATION_STATUSES = [
  "reserved",
  "picked_up",
  "no_show",
  "cancelled",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/**
 * Who created the reservation: staff on the phone, the customer online, or a
 * standing order (created ahead from its template, ADR 0007).
 */
export const RESERVATION_SOURCES = [
  "phone",
  "online",
  "standing_order",
] as const;
export type ReservationSource = (typeof RESERVATION_SOURCES)[number];

/** Standing orders exist as reservations this many days ahead (ADR 0007). */
export const STANDING_ORDER_HORIZON_DAYS = 28;

/**
 * The latest pickup day anyone can book, counted from today. Shorter than the
 * standing order horizon, so a standing order's day exists before anyone else
 * can book it, even if the daily job misses a few runs (ADR 0007).
 */
export const BOOKING_HORIZON_DAYS = 21;

/** An online order's link stops working this many days after pickup. */
export const ORDER_LINK_DAYS_AFTER_PICKUP = 30;

/** Statuses whose pieces count towards the daily limit and the bake plan. */
export const COUNTED_STATUSES = ["reserved", "picked_up"] as const;

/**
 * Picked up and no-show describe what happened at the counter, so they can
 * be set only once the pickup day has come (today or earlier). A future
 * order can only be cancelled or put back.
 */
export function canSetStatus(
  status: ReservationStatus,
  pickupDate: string,
  today: string,
): boolean {
  return status === "reserved" || status === "cancelled" || pickupDate <= today;
}
