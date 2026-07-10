import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

const FREQUENCY_LABELS = {
  weekly: "Weekly",
  biweekly: "Bi-weekly (every 2 weeks)",
  monthly: "Monthly",
};

/**
 * RecurringEventSection
 *
 * Props:
 *   enabled: boolean
 *   onToggle: (bool) => void
 *   config: { frequency, end_condition, end_date, end_after_occurrences }
 *   onChange: (field, value) => void
 *   todayMin: string (datetime-local min)
 */
export default function RecurringEventSection({ enabled, onToggle, config, onChange, todayMin, errors = {} }) {
  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-accent shrink-0" />
          <div className="text-left">
            <p className="font-display font-bold text-sm">Recurring Event?</p>
            <p className="text-xs text-muted-foreground font-mono">Automatically generate future occurrences</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Yes / No toggle */}
          <div className="flex rounded-lg border border-border/50 overflow-hidden">
            <span className={`px-4 py-1.5 text-xs font-mono font-bold transition-all ${enabled ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground"}`}>
              Yes
            </span>
            <span className={`px-4 py-1.5 text-xs font-mono font-bold transition-all ${!enabled ? "bg-secondary text-foreground" : "bg-card text-muted-foreground"}`}>
              No
            </span>
          </div>
        </div>
      </button>

      {enabled && (
        <div className="border-t border-border/30 px-5 pb-5 pt-4 space-y-4">
          <p className="text-xs text-muted-foreground font-mono">
            Each occurrence is a separate event with its own tickets, QR entry, capacity, and sales. The date you set below is the <strong>first occurrence</strong>.
          </p>

          {/* Frequency */}
          <div>
            <Label className="text-xs text-muted-foreground font-mono">Frequency *</Label>
            <Select value={config.frequency} onValueChange={v => onChange("frequency", v)}>
              <SelectTrigger className={`mt-1 bg-card border-border/50 ${errors.frequency ? "border-destructive ring-1 ring-destructive/40" : ""}`}>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FREQUENCY_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.frequency && <p className="text-xs text-destructive mt-1">{errors.frequency}</p>}
          </div>

          {/* End condition */}
          <div>
            <Label className="text-xs text-muted-foreground font-mono">End Condition *</Label>
            <div className="mt-1 flex rounded-lg border border-border/50 overflow-hidden">
              <button
                type="button"
                onClick={() => onChange("end_condition", "by_date")}
                className={`flex-1 py-2 text-xs font-mono font-bold transition-all ${config.end_condition === "by_date" ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
              >
                End by Date
              </button>
              <button
                type="button"
                onClick={() => onChange("end_condition", "by_count")}
                className={`flex-1 py-2 text-xs font-mono font-bold transition-all ${config.end_condition === "by_count" ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
              >
                End after N Occurrences
              </button>
            </div>
          </div>

          {/* End by date */}
          {config.end_condition === "by_date" && (
            <div>
              <Label className="text-xs text-muted-foreground font-mono">Series End Date *</Label>
              <div className="mt-1 w-full overflow-hidden">
                <input
                  type="datetime-local"
                  value={config.end_date || ""}
                  min={todayMin}
                  onChange={e => onChange("end_date", e.target.value)}
                  style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", WebkitAppearance: "none", appearance: "none", lineHeight: "normal", display: "flex", alignItems: "center" }}
                  className={`h-9 w-full rounded-md border bg-card px-3 py-0 text-sm shadow-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary ${errors.end_date ? "border-destructive ring-1 ring-destructive/40" : "border-border/50"}`}
                />
              </div>
              {errors.end_date
                ? <p className="text-xs text-destructive mt-1">{errors.end_date}</p>
                : <p className="text-[10px] text-muted-foreground font-mono mt-1">No new occurrences will be created after this date.</p>
              }
            </div>
          )}

          {/* End after N occurrences */}
          {config.end_condition === "by_count" && (
            <div>
              <Label className="text-xs text-muted-foreground font-mono">Number of Occurrences *</Label>
              <Input
                type="number"
                min={2}
                max={104}
                value={config.end_after_occurrences || ""}
                onChange={e => onChange("end_after_occurrences", e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Enter number of occurrences"
                className={`mt-1 bg-card ${errors.end_count ? "border-destructive ring-1 ring-destructive/40" : "border-border/50"}`}
              />
              {errors.end_count
                ? <p className="text-xs text-destructive mt-1">{errors.end_count}</p>
                : <p className="text-[10px] text-muted-foreground font-mono mt-1">Min 2, max 104 (2 years of weekly events).</p>
              }
            </div>
          )}

          {/* Summary */}
          {config.frequency && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-xs text-white font-mono">
              📅 Occurrences will repeat <strong className="text-primary">{FREQUENCY_LABELS[config.frequency]?.toLowerCase()}</strong> starting from the date you set in <strong className="text-primary">Event Details → Date</strong>
              {config.end_condition === "by_count" && config.end_after_occurrences
                ? `, for ${config.end_after_occurrences} total occurrences.`
                : config.end_condition === "by_date" && config.end_date
                ? `, until ${new Date(config.end_date).toLocaleDateString()}.`
                : "."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}