import { AlertTriangle, DollarSign } from "lucide-react";

/**
 * Shown when the organizer has an unpaid AI flyer balance from a previous event.
 * Informs them that AI flyer generation is blocked until the balance is settled via payout.
 */
export default function AIFlyerBlockedBanner({ pendingAmount, pendingCount }) {
  return (
    <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/30 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="font-display font-black text-base text-destructive">AI Flyer Generation Blocked</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You have an unpaid AI flyer balance of{" "}
            <span className="font-bold text-destructive">${pendingAmount?.toFixed(2)}</span>{" "}
            ({pendingCount} generation{pendingCount !== 1 ? "s" : ""}) from a previous event.
          </p>
          <p className="text-xs text-muted-foreground font-mono leading-relaxed">
            AI flyer generation is restricted until your pending balance is settled. This will happen automatically when your next event payout is processed. Contact support if you need this resolved sooner.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/60 border border-border/40">
        <DollarSign className="w-4 h-4 text-yellow-400 shrink-0" />
        <p className="text-xs font-mono text-muted-foreground">
          Pending balance: <span className="text-yellow-400 font-bold">${pendingAmount?.toFixed(2)}</span> — will be deducted from your next event payout automatically.
        </p>
      </div>
    </div>
  );
}