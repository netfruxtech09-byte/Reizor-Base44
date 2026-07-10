/**
 * VideoMinuteManager — account-level streaming usage display.
 * No plans. No selection. Fully automatic.
 *
 * Props:
 *   videoUrl  — CDN URL of the video
 *   videoTitle — display title
 *   videoId   — context ID (organizer media post ID, etc.)
 */
import { useState, useEffect } from "react";
import { Play, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function VideoMinuteManager({
  videoUrl,
  videoTitle = "",
  videoId = "",
}) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await base44.functions.invoke("videoMinuteBilling", {
      action: "get_account_usage",
      video_url: videoUrl,
      video_id: videoId,
    }).catch(() => null);

    const acct = res?.data?.account_usage || {};
    const pricing = res?.data?.pricing || {};
    setUsage({
      total_used: acct.total_used || 0,
      free_used: acct.free_used || 0,
      free_limit: acct.free_limit || 0,
      free_remaining: acct.free_remaining || 0,
      billable: acct.billable || 0,
      billable_credit: acct.billable_credit_remaining || 0,
      session_count: acct.session_count || 0,
      rate: pricing.per_minute_rate || 0.0016,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [videoUrl, videoId]);

  if (!videoUrl && !videoId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground font-mono">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading minutes...
      </div>
    );
  }

  if (!usage) return null;

  const { total_used, free_used, free_limit, free_remaining, billable_credit, session_count, rate } = usage;
  const withinFree = free_remaining > 0;
  const pct = Math.min(100, (free_used / free_limit) * 100);

  return (
    <div className="rounded-xl bg-card border border-border/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Play className="w-4 h-4 text-accent shrink-0" />
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Streaming Minutes
        </p>
      </div>

      {/* Free allowance */}
      <div className="p-3 rounded-lg bg-green-400/8 border border-green-400/20 space-y-2">
        <p className="text-xs font-mono font-bold text-green-400 uppercase">Free Monthly Allowance</p>
        <div className="flex justify-between text-xs font-mono">
          <span className="text-muted-foreground">Limit</span>
          <span>{free_limit} min</span>
        </div>
        <div className="flex justify-between text-xs font-mono">
          <span className="text-muted-foreground">Used this month</span>
          <span>{free_used.toFixed(1)} min</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${!withinFree ? "bg-destructive" : "bg-green-400"}`}
            style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
          />
        </div>
        <p className="text-[10px] font-mono text-green-400">
          ✓ {free_remaining.toFixed(1)} free minutes remaining this month
        </p>
      </div>

      {/* Billable info */}
      {!withinFree && (
        <div className="p-3 rounded-lg bg-yellow-400/8 border border-yellow-400/20 space-y-1">
          <p className="text-xs font-mono font-bold text-yellow-400 uppercase">Billable Usage</p>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">Rate</span>
            <span>${rate.toFixed(4)}/min</span>
          </div>
          {billable_credit > 0 && (
            <div className="flex justify-between text-xs font-mono">
              <span className="text-muted-foreground">Credit Remaining</span>
              <span className="text-green-400 font-bold">{billable_credit.toFixed(0)} min</span>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] font-mono text-muted-foreground">
        Tracked automatically · {session_count} sessions this month · ${rate.toFixed(4)}/min billable rate
      </p>
    </div>
  );
}