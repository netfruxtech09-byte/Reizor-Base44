import { TICKET_FEE_SCALE, TABLE_PLATFORM_FEE } from "@/utils/ticketFeeCalculator";
import { Info } from "lucide-react";

/**
 * Displays the platform default fee scale in the Payment Settings section.
 * Purely informational — no inputs.
 */
export default function PlatformFeeScale() {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30 bg-muted/50">
        <Info className="w-3.5 h-3.5 text-primary shrink-0" />
        <p className="text-xs font-mono font-bold text-primary uppercase tracking-widest">
          Platform Fee Scale
        </p>
      </div>

      {/* Ticket fee table */}
      <div className="px-3 pt-2.5 pb-1">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
          Ticket Sales — per ticket
        </p>
        <div className="space-y-1">
          {TICKET_FEE_SCALE.map(({ range, fee }) => (
            <div key={range} className="flex justify-between text-xs">
              <span className="text-muted-foreground font-mono">{range}</span>
              <span className="font-mono font-bold text-foreground">{fee}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 border-t border-border/30" />

      {/* Table fee */}
      <div className="px-3 pb-2.5">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
          Table Sales — per table
        </p>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground font-mono">Any table price</span>
          <span className="font-mono font-bold text-foreground">${TABLE_PLATFORM_FEE}.00</span>
        </div>
      </div>

      <div className="px-3 pb-2.5">
        <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
          Platform fees are applied automatically. Only admin or authorized managers may override per-event fees.
        </p>
      </div>
    </div>
  );
}