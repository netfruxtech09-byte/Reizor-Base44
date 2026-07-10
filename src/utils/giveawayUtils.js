import { format } from "date-fns";

/**
 * Format a giveaway end date/time for display.
 *
 * Shows date + time when a specific time was saved, otherwise date only.
 * The time is rendered in the viewer's local timezone, consistent with how
 * the rest of the app formats dates (date-fns uses the host locale timezone).
 *
 * A saved value is treated as "no time" when its time-of-day is exactly
 * midnight (00:00) in the stored value — i.e. the organizer picked a date
 * without a specific time.
 *
 * @param {string|null|undefined} value - ISO date-time string
 * @returns {string|null} formatted string, or null when no value / invalid
 */
export function formatGiveawayEndDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const m = String(value).match(/T(\d{2}):(\d{2})/);
  const hasTime = m && !(m[1] === "00" && m[2] === "00");
  return hasTime
    ? format(d, "MMM d, yyyy 'at' h:mm a")
    : format(d, "MMM d, yyyy");
}