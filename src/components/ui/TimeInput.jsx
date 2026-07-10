/**
 * TimeInput — shared controlled time picker component
 *
 * Props:
 *   value     : string  — "HH:MM" (24h) or "HH:MM AM" / "HH:MM PM"
 *   onChange  : fn(string) — called with formatted time string
 *   ampm      : bool    — if true, shows 12-hour + AM/PM selector (Doors Open style)
 *                         if false (default), shows 24-hour selector (Set Time style)
 *   className : string
 *   placeholder: string (used as empty label)
 */
import { useState, useEffect } from "react";

function pad(n) { return String(n).padStart(2, "0"); }

function parse24(value) {
  if (!value) return { h: "", m: "" };
  const [h, m] = value.split(":");
  return { h: h || "", m: m || "" };
}

function parseAmpm(value) {
  if (!value) return { h: "", m: "", period: "PM" };
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { h: "", m: "", period: "PM" };
  return { h: match[1], m: match[2], period: match[3].toUpperCase() };
}

export default function TimeInput({ value, onChange, ampm = false, className = "", placeholder }) {
  const parsed = ampm ? parseAmpm(value) : parse24(value);
  const [h, setH] = useState(parsed.h);
  const [m, setM] = useState(parsed.m);
  const [period, setPeriod] = useState(parsed.period || "PM");

  // Sync external value changes
  useEffect(() => {
    const p = ampm ? parseAmpm(value) : parse24(value);
    setH(p.h || "");
    setM(p.m || "");
    if (ampm) setPeriod(p.period || "PM");
  }, [value, ampm]);

  const emit = (newH, newM, newPeriod) => {
    if (!newH || !newM) { onChange(""); return; }
    if (ampm) {
      onChange(`${pad(newH)}:${pad(newM)} ${newPeriod}`);
    } else {
      onChange(`${pad(newH)}:${pad(newM)}`);
    }
  };

  const handleH = (e) => { setH(e.target.value); emit(e.target.value, m, period); };
  const handleM = (e) => { setM(e.target.value); emit(h, e.target.value, period); };
  const handlePeriod = (p) => { setPeriod(p); emit(h, m, p); };

  const hourOptions = ampm
    ? Array.from({ length: 12 }, (_, i) => i + 1)   // 1–12
    : Array.from({ length: 24 }, (_, i) => i);        // 0–23

  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10,...55

  const baseSelect =
    "h-9 rounded-md border border-white/25 bg-secondary text-foreground px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary hover:border-white/40 appearance-none text-center cursor-pointer transition-colors";

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Hour */}
      <select
        value={h}
        onChange={handleH}
        className={`${baseSelect} w-14`}
      >
        <option value="">HH</option>
        {hourOptions.map((n) => (
          <option key={n} value={pad(n)}>{pad(n)}</option>
        ))}
      </select>

      <span className="text-muted-foreground font-bold text-sm">:</span>

      {/* Minute */}
      <select
        value={m}
        onChange={handleM}
        className={`${baseSelect} w-14`}
      >
        <option value="">MM</option>
        {minuteOptions.map((n) => (
          <option key={n} value={pad(n)}>{pad(n)}</option>
        ))}
      </select>

      {/* AM/PM toggle */}
      {ampm && (
        <div className="flex rounded-md border border-white/25 overflow-hidden ml-1">
          {["AM", "PM"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriod(p)}
              className={`min-w-[36px] px-3 py-1.5 text-xs font-mono font-bold transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}