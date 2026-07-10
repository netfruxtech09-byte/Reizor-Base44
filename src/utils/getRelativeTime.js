/**
 * Convert a timestamp to relative time format
 * Examples: "just now", "5 minutes ago", "2 hours ago", "yesterday", "Mar 2, 2026"
 */
/**
 * Parse a timestamp as UTC — appends 'Z' if the string lacks timezone info.
 * This prevents browsers from misinterpreting UTC timestamps as local time.
 */
function parseUTC(timestamp) {
  if (!timestamp) return new Date(NaN);
  const str = String(timestamp);
  // Already has timezone info (Z, +HH:MM, -HH:MM) — parse as-is
  if (/[Z+\-]\d*$/.test(str.replace(/\.\d+$/, ""))) {
    return new Date(str);
  }
  // No timezone info — treat as UTC by appending Z
  return new Date(str + "Z");
}

export function getRelativeTime(timestamp) {
  if (!timestamp) return "—";

  const date = parseUTC(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // Less than 1 minute
  if (diffSec < 60) {
    return "just now";
  }

  // Less than 1 hour
  if (diffMin < 60) {
    return diffMin === 1 ? "1 minute ago" : `${diffMin} minutes ago`;
  }

  // Less than 1 day
  if (diffHour < 24) {
    return diffHour === 1 ? "1 hour ago" : `${diffHour} hours ago`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return "yesterday";
  }

  // Within the last 7 days
  if (diffDay < 7) {
    return diffDay === 1 ? "1 day ago" : `${diffDay} days ago`;
  }

  // Same year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // Different year
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}