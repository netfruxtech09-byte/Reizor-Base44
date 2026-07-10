/**
 * StreamingUsersList — admin panel showing per-user streaming minute usage.
 *
 * Aggregates VideoMinutePlan + VideoWatchLog records by organizer.
 * Follows the same pattern as the GB StorageUsersList.
 */
import { Play, Clock, AlertCircle, CheckCircle2, PauseCircle, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

export default function StreamingUsersList({ users, monthKey }) {
  if (!users || users.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl bg-card border border-border/40">
        <Play className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm font-mono">No streaming usage records found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {users.length} User{users.length !== 1 ? "s" : ""} · {monthKey || "All time"}
        </p>
      </div>

      <div className="space-y-2">
        {users.map(user => {
          const freePct = user.freeLimit > 0 ? Math.min(100, (user.freeUsed / user.freeLimit) * 100) : 0;
          const isOverFree = user.freeRemaining <= 0;
          const exhaustedPlans = (user.plans || []).filter(p => p.status === "exhausted").length;
          const activePlans = (user.plans || []).filter(p => p.status === "active").length;

          return (
            <div key={user.id} className="rounded-xl bg-card border border-border/40 p-4 space-y-3">
              {/* User header */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-mono text-xs font-bold text-foreground">{user.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {user.email} · {user.userType || "organizer"} · {activePlans} active · {exhaustedPlans} exhausted plans
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  isOverFree ? "bg-yellow-400/15 text-yellow-400 border-yellow-400/20" :
                  "bg-green-400/15 text-green-400 border-green-400/20"
                }`}>
                  {isOverFree ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                  {isOverFree ? "Billable" : "Free active"}
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                <div className="rounded-lg bg-secondary/60 p-2">
                  <p className="text-[9px] font-mono text-muted-foreground">Total Used</p>
                  <p className="font-bold">{user.totalUsed.toFixed(1)} min</p>
                </div>
                <div className="rounded-lg bg-secondary/60 p-2">
                  <p className="text-[9px] font-mono text-muted-foreground">Free Used</p>
                  <p className="font-bold text-green-400">{user.freeUsed.toFixed(1)} min</p>
                </div>
                <div className="rounded-lg bg-secondary/60 p-2">
                  <p className="text-[9px] font-mono text-muted-foreground">Free Limit</p>
                  <p className="font-bold">{user.freeLimit} min</p>
                </div>
                <div className="rounded-lg bg-secondary/60 p-2">
                  <p className="text-[9px] font-mono text-muted-foreground">Free Remaining</p>
                  <p className={`font-bold ${isOverFree ? "text-yellow-400" : "text-green-400"}`}>
                    {user.freeRemaining.toFixed(1)} min
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/60 p-2">
                  <p className="text-[9px] font-mono text-muted-foreground">Billable</p>
                  <p className={`font-bold ${user.billable > 0 ? "text-destructive" : "text-green-400"}`}>
                    {user.billable.toFixed(1)} min
                  </p>
                </div>
              </div>

              {/* Free minutes progress bar */}
              {user.freeLimit > 0 && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${freePct >= 100 ? "bg-yellow-400" : freePct >= 80 ? "bg-yellow-400" : "bg-green-400"}`}
                    style={{ width: `${Math.min(100, freePct)}%` }}
                  />
                </div>
              )}

              {/* Per-video plan summary */}
              {(user.plans || []).filter(p => p.total_minutes > 0).length > 0 && (
                <div className="pt-2 border-t border-border/30">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase mb-2">Per-Video Plans</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(user.plans || []).filter(p => p.total_minutes > 0).map(plan => {
                      const planPct = plan.total_minutes > 0
                        ? Math.min(100, ((plan.used_minutes || 0) / plan.total_minutes) * 100)
                        : 0;
                      return (
                        <div key={plan.id} className="flex items-center justify-between gap-2 text-[10px] font-mono">
                          <span className="truncate flex-1 text-muted-foreground">
                            {plan.video_title || plan.video_url?.split("/").pop() || "Video"}
                          </span>
                          <span className="shrink-0">
                            {(plan.used_minutes || 0).toFixed(0)}/{(plan.total_minutes || 0).toFixed(0)} min
                          </span>
                          <span className={`shrink-0 font-bold ${
                            plan.status === "active" ? "text-green-400" :
                            plan.status === "exhausted" ? "text-destructive" :
                            "text-yellow-400"
                          }`}>
                            {plan.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="text-[10px] font-mono text-muted-foreground">
                {user.sessionCount} session{user.sessionCount !== 1 ? "s" : ""} this month · ${(user.rate || 0.0016).toFixed(4)}/min billable rate
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}