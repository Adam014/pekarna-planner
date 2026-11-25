/** Hour on the previous day when online orders for a pickup day close. */
const CUTOFF_HOUR = 18

/** True when an online order for `pickupDay` (YYYY-MM-DD) is still accepted. */
export function isBeforeCutoff(pickupDay: string, now: Date = new Date()): boolean {
  const cutoff = new Date(pickupDay)
  cutoff.setDate(cutoff.getDate() - 1)
  cutoff.setHours(CUTOFF_HOUR, 0, 0, 0)
  return now < cutoff
}
