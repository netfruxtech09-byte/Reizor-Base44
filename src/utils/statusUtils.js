/**
 * Computes the effective status of a poll or raffle based on current date/time.
 *
 * Rules:
 * - "cancelled" and "drawn" are manual overrides — always respected as-is.
 * - If end_datetime has passed → "ended" (safety net so an expired item never
 *   displays as active/upcoming even if a status update was missed).
 * - Otherwise, the stored status is trusted as-is. Promoting "upcoming" → "active"
 *   once start_datetime passes is handled server-side by the periodic sync job
 *   (syncRafflePollStatuses) and by explicit admin edits — NOT recomputed here.
 *   Re-deriving it on the client would silently override a manual status change
 *   (e.g. an admin intentionally reverting an item back to "upcoming").
 */
export function computeStatus(item) {
  // Manual terminal states are always respected
  if (item.status === "cancelled" || item.status === "drawn") return item.status;

  const now = new Date();
  const end = item.end_datetime ? new Date(item.end_datetime) : null;

  if (end && end < now) return "ended";

  return item.status || "upcoming";
}

/**
 * Derives the correct raffle/poll status purely from its start/end datetimes —
 * used to auto-suggest the Status field as the admin edits dates.
 * - "cancelled"/"drawn" are manual terminal states and always pass through.
 * - end has passed → "ended"
 * - start is now or earlier (and end hasn't passed) → "active"
 * - start is in the future → "upcoming"
 */
export function deriveStatusFromDates(startStr, endStr, currentStatus) {
  if (["cancelled", "drawn"].includes(currentStatus)) return currentStatus;
  if (!startStr) return currentStatus || "upcoming";
  const now = new Date();
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : null;
  if (end && end <= now) return "ended";
  if (start <= now) return "active";
  return "upcoming";
}