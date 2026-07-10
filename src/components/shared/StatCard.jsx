import { Link } from "react-router-dom";
import { compactNumber, fullNumber } from "@/utils/formatNumber";

/**
 * Shared stat card used across Admin / Organizer / Artist dashboards.
 * Numeric `value` is auto compact-formatted (1K, 1.5M, …) to prevent
 * overflow on mobile. The exact full number is shown in a `title` tooltip
 * on hover / long-press.
 */
export default function StatCard({ label, value, icon: Icon, accent = false, to }) {
  const isNumeric = typeof value === "number" || (typeof value === "string" && value !== "" && Number.isFinite(Number(value)));
  const display = isNumeric ? compactNumber(value) : value;
  const tooltip = isNumeric ? fullNumber(value) : undefined;

  const inner = (
    <div
      title={tooltip}
      className={`h-full p-4 sm:p-5 rounded-xl bg-card border border-border/50 overflow-hidden transition-all duration-150 ${
        to ? "cursor-pointer hover:border-primary/40 hover:bg-card/80 hover:scale-[1.02] active:scale-[0.99]" : ""
      } ${accent ? "bg-primary/10 border-primary/30" : ""}`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="font-mono text-xs sm:text-sm text-muted-foreground uppercase tracking-wider leading-tight truncate">
          {label}
        </span>
        {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${accent ? "text-primary" : "text-muted-foreground"}`} />}
      </div>
      <p className={`font-display font-black text-3xl sm:text-4xl mt-1 truncate leading-none ${accent ? "text-primary" : "text-foreground"}`}>
        {display}
      </p>
    </div>
  );

  if (to) {
    return <Link to={to} className="block">{inner}</Link>;
  }

  return inner;
}