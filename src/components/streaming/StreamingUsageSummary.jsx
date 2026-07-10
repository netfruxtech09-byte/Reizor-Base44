/**
 * StreamingUsageSummary — compact streaming minutes overview for dashboards.
 * Follows the same UI pattern as StorageUsageSummary.
 *
 * Props:
 *   isAdmin — if true, shows unlimited with no warnings
 */
import { useState, useEffect } from "react";
import { Play, AlertTriangle, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function StreamingUsageSummary({ isAdmin = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await base44.functions.invoke("videoMinuteBilling", {
        action: "get_organizer_usage",
      }).catch(() => null);

      const usage = res?.data;
      if (usage && usage.current_month) {
        const month = usage.current_month;
        const freeUsed = month.free_minutes_used || 0;
        const freeLimit = month.free_minutes_limit || 500;
        const freeRemaining = Math.max(0, freeLimit - freeUsed);
        const paidUsed = month.paid_minutes_used || 0;
        const totalUsed = month.total_watch_minutes || 0;
        const billable = Math.max(0, totalUsed - freeLimit);

        setData({
          totalUsed, freeUsed, freeLimit, freeRemaining,
          paidUsed, billable, sessionCount: month.watch_sessions || 0,
        });
      } else {
        setData({
          totalUsed: 0, freeUsed: 0, freeLimit: 500,
          freeRemaining: 500, paidUsed: 0, billable: 0, sessionCount: 0,
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl bg-card border border-border/40 p-4 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { totalUsed, freeUsed, freeLimit, freeRemaining, paidUsed, billable } = data;
  const freePct = freeLimit > 0 ? Math.min(100, (freeUsed / freeLimit) * 100) : 0;

  const statusColor = isAdmin
    ? "bg-accent/10 border-accent/30"
    : billable > 0 ? "bg-yellow-400/10 border-yellow-400/30" : "bg-green-500/10 border-green-500/30";
  const statusIcon = isAdmin
    ? <Play className="w-4 h-4 text-accent" />
    : billable > 0
      ? <AlertTriangle className="w-4 h-4 text-yellow-400" />
      : <CheckCircle2 className="w-4 h-4 text-green-500" />;
  const statusText = isAdmin ? "Admin Usage Tracking" : billable > 0 ? "Billable Minutes Active" : "Within Free Limit";

  return (
    <div className="space-y-4">
      {/* Free Limit / Used / Remaining table */}
      <div className="rounded-lg bg-[#1a1d26] border border-border/30 p-4 space-y-3">
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
          <p className={`font-display font-black text-sm ${isAdmin ? "text-accent" : billable > 0 ? "text-destructive" : "text-green-400"}`}>
            {isAdmin ? "—" : `${freeRemaining.toFixed(1)} min`}
          </p>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isAdmin ? "bg-accent" : freePct >= 100 ? "bg-destructive" : freePct >= 80 ? "bg-yellow-400" : "bg-green-400"}`}
            style={{ width: `${Math.min(100, Math.max(2, isAdmin ? 100 : freePct))}%` }}
          />
        </div>
      </div>

      {/* Status */}
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${statusColor}`}>
        {statusIcon}
        <div>
          <p className="font-mono text-xs font-bold uppercase">{statusText}</p>
          {isAdmin ? (
            <p className="text-xs text-accent mt-1">
              Tracking only — no limits · {data.sessionCount} sessions this month
            </p>
          ) : billable > 0 ? (
            <p className="text-xs text-yellow-400 mt-1">
              {freeUsed.toFixed(1)} free min used of {freeLimit} · {billable.toFixed(1)} min billable
            </p>
          ) : (
            <p className="text-xs text-green-400 mt-1">
              {freeUsed.toFixed(1)} min used of {freeLimit} min · {freeRemaining.toFixed(1)} min remaining
            </p>
          )}
        </div>
      </div>

      {/* Note + button */}
      {!isAdmin && (
        <>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {freeRemaining <= 0 && billable > 0
              ? "Your videos are not publicly playable. Add streaming minutes to reactivate streaming for your fans."
              : billable > 0
                ? "You're using billable minutes. Add credit to keep your videos playing without interruption."
                : "Add streaming credit or set per-video budgets to control costs. Always available when you need it. · $0.0016 per minute after the free limit."}
          </p>
          <Button
            className="w-full gap-1.5 font-bold glow-lime"
            onClick={() => {
              const el = document.getElementById("streaming-minutes-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
              else window.location.href = "/organizer/storage#streaming-minutes-section";
            }}
          >
            {billable > 0 ? "Add Streaming Budget" : "Manage Streaming Budget"}
          </Button>
        </>
      )}
    </div>
  );
}