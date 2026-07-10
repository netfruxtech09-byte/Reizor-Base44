/**
 * Compact number formatting utility (Instagram-style).
 *
 *   999          → "999"
 *   1000         → "1K"
 *   1500         → "1.5K"
 *   10000        → "10K"
 *   99999        → "100K"
 *   1000000      → "1M"
 *   1500000      → "1.5M"
 *   10000000     → "10M"
 *   1000000000   → "1B"
 *
 * Rules:
 *  - Max one decimal place, only when it improves readability (1.5K, not 10.0K).
 *  - Trailing ".0" is always stripped.
 *  - Non-finite / non-numeric input is returned as-is (e.g. "—", "N/A").
 *
 * This is a DISPLAY-ONLY transform. Never persist the compacted string —
 * always store the raw numeric value in the database.
 */

const UNITS = [
  { value: 1_000_000_000, symbol: "B" },
  { value: 1_000_000, symbol: "M" },
  { value: 1_000, symbol: "K" },
];

export function compactNumber(value) {
  if (value === null || value === undefined || value === "") return value;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return value;

  const abs = Math.abs(num);
  if (abs < 1000) return String(num);

  for (const { value: unit, symbol } of UNITS) {
    if (abs >= unit) {
      const rounded = num / unit;
      // One decimal max, strip trailing .0
      const formatted = rounded >= 100
        ? String(Math.round(rounded))
        : (Math.round(rounded * 10) / 10).toString().replace(/\.0$/, "");
      return `${formatted}${symbol}`;
    }
  }
  return String(num);
}

/**
 * Full, locale-formatted number with thousands separators.
 * Used for tooltips / detail screens where the exact value matters.
 *   12450 → "12,450"
 */
export function fullNumber(value) {
  if (value === null || value === undefined || value === "") return value;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return value;
  return num.toLocaleString("en-US");
}