import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function StreamingUsageWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      const admin = u?.role === "admin";
      setIsAdmin(admin);

      const res = await base44.functions.invoke("videoMinuteBilling", {
        action: "get_organizer_usage",
        organizer_id: u.id,
      }).catch(() => null);

      const usage = res?.data;
      if (usage) {
        const month = usage.current_month;
        const freeUsed = month.free_minutes_used || 0;
        const freeLimit = month.free_minutes_limit || 500;
        const freeRemaining = Math.max(0, freeLimit - freeUsed);
        const paidUsed = month.paid_minutes_used || 0;
        const totalUsed = month.total_watch_minutes || 0;
        const billable = Math.max(0, totalUsed - freeLimit);

        setData({ totalUsed, freeUsed, freeLimit, freeRemaining, paidUsed, billable, sessionCount: month.watch_sessions || 0 });
      } else {
        setData({ totalUsed: 0, freeUsed: 0, freeLimit: 500, freeRemaining: 500, paidUsed: 0, billable: 0, sessionCount: 0 });
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="p-4 rounded-xl bg-card border border-border/50 flex items-center gap-3">
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      <span className="text-xs text-muted-foreground font-mono">Loading streaming usage...</span>
    </div>
  );

  if (!data) return null;

  const { freeUsed, freeLimit, freeRemaining, billable } = data;
  const freePct = freeLimit > 0 ? Math.min(100, (freeUsed / freeLimit) * 100) : 0;
  const isOverFree = !isAdmin && freeRemaining <= 0;

  return (
    <div className="space-y-4">
      {/* Free Limit / Used / Remaining */}
      <div className="rounded-xl bg-card border border-border/50 p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <p className="text-xs font-mono text-muted-foreground">Free Limit</p>
          <p className="text-xs font-mono text-muted-foreground">Used</p>
          <p className="text-xs font-mono text-muted-foreground">Remaining</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <p className="font-display font-black text-sm text-foreground">
            {isAdmin ? "Unlimited" : `${freeLimit} min`}
          </p>
          <p className="font-display font-black text-sm text-foreground">
            {freeUsed.toFixed(1)} min
          </p>
          <p className={`font-display font-black text-sm ${isAdmin ? "text-accent" : isOverFree ? "text-destructive" : "text-green-400"}`}>
            {isAdmin ? "—" : `${freeRemaining.toFixed(1)} min`}
          </p>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isAdmin ? "bg-accent" : freePct >= 100 ? "bg-destructive" : freePct >= 80 ? "bg-yellow-400" : "bg-green-400"}`}
            style={{ width: isAdmin ? "100%" : `${Math.min(100, Math.max(2, freePct))}%` }}
          />
        </div>
      </div>

      {/* Status message */}
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${
        isAdmin ? "bg-accent/10 border-accent/30"
        : billable > 0 ? "bg-yellow-400/10 border-yellow-400/30"
        : "bg-green-500/10 border-green-500/30"
      }`}>
        {isAdmin
          ? <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          : isOverFree
            ? <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            : freePct >= 80
              ? <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              : <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
        }
        <div>
          <p className="font-mono text-xs font-bold uppercase">
            {isAdmin ? "Admin Usage Tracking" : billable > 0 ? "Billable Minutes Active" : "Within Free Limit"}
          </p>
          <p className={`text-xs mt-1 ${isAdmin ? "text-accent" : isOverFree ? "text-destructive" : freePct >= 80 ? "text-yellow-400" : "text-green-400"}`}>
            {isAdmin
              ? `Tracking only — no limits · ${data.sessionCount} sessions this month`
              : isOverFree
                ? `You've used all ${freeLimit} free minutes. Additional streaming is billed at $0.0016/min.`
                : freePct >= 80
                  ? `Approaching your ${freeLimit} min free limit. ${freeRemaining.toFixed(0)} min remaining.`
                  : `${freeUsed.toFixed(1)} min used of ${freeLimit} min · ${freeRemaining.toFixed(1)} min remaining`
            }
          </p>
        </div>
      </div>
    </div>
  );
}