/** Status flow: reserved → picked_up | no_show | cancelled. Nothing else. */
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
