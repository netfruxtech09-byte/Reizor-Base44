import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";

// Compact Start/End Date & Time inputs, grouped in rows, with a small timezone label.
// Keeps the same "YYYY-MM-DDTHH:mm" combined value format used across the app.
export default function EventDateTimeSection({
  startValue, endValue, onStartChange, onEndChange,
  startError, endError, todayMin, timezoneLabel, isRecurring,
}) {
  const splitDT = (v) => {
    if (!v) return { date: "", time: "" };
    const [date, time] = v.split("T");
    return { date: date || "", time: (time || "").slice(0, 5) };
  };
  const combine = (date, time) => (date ? `${date}T${time || "00:00"}` : "");

  const start = splitDT(startValue);
  const end = splitDT(endValue);
  const minDate = todayMin ? todayMin.slice(0, 10) : undefined;

  const inputClass = (hasError) =>
    `mt-1 h-10 w-full rounded-md border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary ${hasError ? "border-destructive ring-1 ring-destructive/40" : "border-border/50"}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5 text-accent" />
        <h4 className="font-mono text-xs font-bold text-accent uppercase tracking-wide">
          {isRecurring ? "First Occurrence" : "Date & Time"}
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground font-mono">Start Date *</Label>
          <input type="date" value={start.date} min={minDate}
            onChange={e => onStartChange(combine(e.target.value, start.time || "00:00"))}
            className={inputClass(startError)} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground font-mono">Start Time *</Label>
          <input type="time" value={start.time}
            onChange={e => onStartChange(combine(start.date, e.target.value))}
            className={inputClass(startError)} />
        </div>
      </div>
      {startError && <p className="text-xs text-destructive">{startError}</p>}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground font-mono">End Date</Label>
          <input type="date" value={end.date} min={start.date || minDate}
            onChange={e => onEndChange(combine(e.target.value, end.time || start.time || "00:00"))}
            className={inputClass(endError)} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground font-mono">End Time</Label>
          <input type="time" value={end.time}
            onChange={e => onEndChange(combine(end.date || start.date, e.target.value))}
            className={inputClass(endError)} />
        </div>
      </div>
      {endError && <p className="text-xs text-destructive">{endError}</p>}

      {timezoneLabel && (
        <p className="text-[11px] text-muted-foreground font-mono">🕐 Timezone: {timezoneLabel}</p>
      )}
    </div>
  );
}