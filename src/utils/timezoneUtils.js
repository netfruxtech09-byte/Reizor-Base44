import { base44 } from "@/api/base44Client";

// Detect the IANA timezone for an event location using AI + web context.
export async function detectTimezoneForLocation({ venue_address, city, state, country }) {
  if (!city?.trim() && !country?.trim()) return null;
  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `What is the IANA timezone identifier for this event location?\nVenue address: ${venue_address || "N/A"}\nCity: ${city || "N/A"}\nState/Region: ${state || "N/A"}\nCountry: ${country || "N/A"}\n\nRespond with only the correct IANA timezone name (e.g. "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Bangkok").`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: { timezone: { type: "string" } },
        required: ["timezone"],
      },
    });
    return result?.timezone?.trim() || null;
  } catch {
    return null;
  }
}

// Human-readable label, e.g. "America/New_York (EDT)"
export function getTimezoneLabel(tz, dateStr) {
  if (!tz) return "";
  try {
    const date = dateStr ? new Date(dateStr) : new Date();
    const abbr = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(date)
      .find(p => p.type === "timeZoneName")?.value || "";
    return abbr ? `${tz} (${abbr})` : tz;
  } catch {
    return tz;
  }
}

// Offset (in minutes) of a timezone relative to UTC at a given instant.
function getOffsetMinutes(tz, date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return (asUTC - date.getTime()) / 60000;
}

// Shift a "YYYY-MM-DDTHH:mm" local string so the same absolute instant is preserved
// when moving from oldTz to newTz (i.e. "convert" the displayed wall-clock time).
export function convertLocalDateTimeBetweenTimezones(localDateTimeStr, oldTz, newTz) {
  if (!localDateTimeStr || !oldTz || !newTz) return localDateTimeStr;
  try {
    const base = new Date(localDateTimeStr);
    const diffMinutes = getOffsetMinutes(newTz, base) - getOffsetMinutes(oldTz, base);
    const shifted = new Date(base.getTime() + diffMinutes * 60000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}T${pad(shifted.getHours())}:${pad(shifted.getMinutes())}`;
  } catch {
    return localDateTimeStr;
  }
}