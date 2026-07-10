import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

function pad(n) { return String(n).padStart(2, "0"); }

function toICSDate(date) {
  const d = new Date(date);
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    "00Z"
  );
}

export default function AddToCalendarButton({ event, className = "" }) {
  const [open, setOpen] = useState(false);

  if (!event?.date) return null;

  const startDate = new Date(event.date);
  const endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
  const location = [event.venue_name, event.venue_address, event.city, event.country].filter(Boolean).join(", ");
  const details = event.description || "";
  const url = `${window.location.origin}/events/${event.id}`;

  const googleUrl = new URL("https://calendar.google.com/calendar/render");
  googleUrl.searchParams.set("action", "TEMPLATE");
  googleUrl.searchParams.set("text", event.title);
  googleUrl.searchParams.set("dates", `${toICSDate(startDate)}/${toICSDate(endDate)}`);
  googleUrl.searchParams.set("details", details);
  googleUrl.searchParams.set("location", location);

  const outlookUrl = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
  outlookUrl.searchParams.set("subject", event.title);
  outlookUrl.searchParams.set("startdt", startDate.toISOString());
  outlookUrl.searchParams.set("enddt", endDate.toISOString());
  outlookUrl.searchParams.set("body", details);
  outlookUrl.searchParams.set("location", location);
  outlookUrl.searchParams.set("path", "/calendar/action/compose");

  function downloadICS() {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//REIZOR//EN",
      "BEGIN:VEVENT",
      `UID:${event.id}@reizor`,
      `DTSTART:${toICSDate(startDate)}`,
      `DTEND:${toICSDate(endDate)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${details.replace(/\n/g, "\\n")}`,
      `LOCATION:${location}`,
      `URL:${url}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${event.title.replace(/\s+/g, "_")}.ics`;
    a.click();
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className={`gap-2 border-border/50 font-display font-bold ${className}`}
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarPlus className="w-4 h-4" />
        Add to Calendar
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 min-w-[180px] bg-card border border-border/50 rounded-xl shadow-xl overflow-hidden">
            <a
              href={googleUrl.toString()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors"
            >
              <span className="text-base">📅</span> Google Calendar
            </a>
            <a
              href={outlookUrl.toString()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors"
            >
              <span className="text-base">📆</span> Outlook
            </a>
            <button
              onClick={downloadICS}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left"
            >
              <span className="text-base">🍎</span> Apple / iCal (.ics)
            </button>
          </div>
        </>
      )}
    </div>
  );
}