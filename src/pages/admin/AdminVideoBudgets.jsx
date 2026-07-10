import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, PauseCircle, Loader2, Clock, Play } from "lucide-react";
import { format } from "date-fns";

export default function AdminVideoBudgets() {
  const [minutePlans, setMinutePlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    (async () => {
      const minuteRes = await base44.entities.VideoMinutePlan.list("-last_funded_at", 200).catch(() => []);
      setMinutePlans(minuteRes);
      setLoading(false);
    })();
  }, []);

  const filtered = filterStatus === "all" ? minutePlans : minutePlans.filter(p => p.status === filterStatus);

  const totals = {
    totalMinutes: minutePlans.reduce((s, p) => s + (p.total_minutes || 0), 0),
    usedMinutes: minutePlans.reduce((s, p) => s + (p.used_minutes || 0), 0),
    remainingMinutes: minutePlans.reduce((s, p) => s + (p.remaining_minutes || 0), 0),
    freeUsed: minutePlans.reduce((s, p) => s + (p.free_minutes_used_this_month || 0), 0),
    active: minutePlans.filter(p => p.status === "active").length,
    exhausted: minutePlans.filter(p => p.status === "exhausted").length,
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">VIDEO MINUTE PLANS</h1>
        <p className="text-sm text-muted-foreground mt-1">Track per-minute streaming plans across all videos. Pricing configured in Storage Usage.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Purchased", value: `${totals.totalMinutes.toLocaleString()} min`, color: "text-primary", icon: Clock },
          { label: "Paid Used", value: `${totals.usedMinutes.toLocaleString()} min`, color: "text-yellow-400", icon: Play },
          { label: "Paid Remaining", value: `${totals.remainingMinutes.toLocaleString()} min`, color: "text-green-400", icon: CheckCircle2 },
          { label: "Active Plans", value: totals.active, color: "text-green-400", icon: CheckCircle2 },
          { label: "Exhausted", value: totals.exhausted, color: "text-destructive", icon: PauseCircle },
        ].map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl bg-card border border-border/40 p-3 text-center">
              <p className="text-[10px] font-mono text-muted-foreground uppercase">{c.label}</p>
              <p className={`font-display font-black text-xl ${c.color}`}>{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["all", "active", "exhausted", "pending_payment"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${filterStatus === s ? "bg-primary border-primary text-white" : "border-border/50 text-muted-foreground hover:border-primary/30"}`}
          >
            {s === "all" ? `All (${minutePlans.length})` : `${s} (${minutePlans.filter(p => p.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Minute Plans */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-card border border-border/40">
          <Play className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm font-mono">No video minute plans found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(plan => {
            const totalAvailable = (plan.total_minutes || 0) + (plan.free_minutes_used_this_month || 0);
            const totalUsed = (plan.used_minutes || 0) + (plan.free_minutes_used_this_month || 0);
            const pct = totalAvailable > 0 ? Math.min(100, (totalUsed / totalAvailable) * 100) : 0;
            return (
              <div key={plan.id} className="rounded-xl bg-card border border-border/40 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-foreground truncate">
                      {plan.video_title || plan.video_url?.split("/").pop() || "Video"}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {plan.organizer_name} · {plan.owner_type} · {plan.video_type === "360" ? "360°" : "Standard"}
                    </p>
                    {plan.last_funded_at && (
                      <p className="text-[10px] font-mono text-muted-foreground">
                        Funded {format(new Date(plan.last_funded_at), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    plan.status === "active" ? "bg-green-400/15 text-green-400 border-green-400/20" :
                    plan.status === "exhausted" ? "bg-destructive/15 text-destructive border-destructive/20" :
                    "bg-yellow-400/15 text-yellow-400 border-yellow-400/20"
                  }`}>
                    {plan.status === "active" ? <CheckCircle2 className="w-3 h-3" /> :
                     plan.status === "exhausted" ? <PauseCircle className="w-3 h-3" /> :
                     <Clock className="w-3 h-3" />}
                    {plan.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-secondary/60 p-1.5">
                    <p className="text-[9px] font-mono text-muted-foreground">Total Purchased</p>
                    <p className="font-bold">{(plan.total_minutes || 0).toLocaleString()} min</p>
                  </div>
                  <div className="rounded-lg bg-secondary/60 p-1.5">
                    <p className="text-[9px] font-mono text-muted-foreground">Paid Used</p>
                    <p className="font-bold text-yellow-400">{(plan.used_minutes || 0).toLocaleString()} min</p>
                  </div>
                  <div className="rounded-lg bg-secondary/60 p-1.5">
                    <p className="text-[9px] font-mono text-muted-foreground">Paid Remaining</p>
                    <p className={`font-bold ${(plan.remaining_minutes || 0) <= 0 ? "text-destructive" : "text-green-400"}`}>
                      {(plan.remaining_minutes || 0).toLocaleString()} min
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/60 p-1.5 hidden sm:block">
                    <p className="text-[9px] font-mono text-muted-foreground">Free Used/Mo</p>
                    <p className="font-bold">{(plan.free_minutes_used_this_month || 0).toFixed(1)} min</p>
                  </div>
                  <div className="rounded-lg bg-secondary/60 p-1.5 hidden sm:block">
                    <p className="text-[9px] font-mono text-muted-foreground">Amount Paid</p>
                    <p className="font-bold">${(plan.amount_paid || 0).toFixed(2)}</p>
                  </div>
                </div>

                {plan.total_minutes > 0 && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-yellow-400" : "bg-green-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}

                <p className="text-[10px] font-mono text-muted-foreground break-all opacity-50 truncate">
                  {plan.video_url}
                </p>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}