import { useState, useEffect } from "react";
import { Star, Gift, Trophy, Info, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

const ACTION_LABELS = {
  like: "Liked a post", comment: "Commented", review: "Left a review",
  scan: "Ticket scanned", raffle: "Entered a raffle", poll: "Voted in a poll",
  share: "Verified share", custom_activity: "Custom activity", admin_adjustment: "Admin adjustment",
};

export default function FanLoyaltyDashboard({ userEmail }) {
  const [balances, setBalances] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [history, setHistory] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!userEmail) return;
    base44.entities.LoyaltyPointsBalance.filter({ user_email: userEmail }, "-lifetime_points", 50)
      .then(res => {
        setBalances(res);
        if (res[0]) setSelected(res[0]);
      })
      .finally(() => setLoading(false));
  }, [userEmail]);

  useEffect(() => {
    if (!selected) return;
    setDetailLoading(true);
    Promise.all([
      base44.entities.LoyaltyRewardTier.filter({ owner_type: selected.owner_type, owner_id: selected.owner_id, is_active: true }, "points_required", 100).catch(() => []),
      base44.entities.LoyaltyPointsLedger.filter({ user_email: userEmail, owner_type: selected.owner_type, owner_id: selected.owner_id }, "-created_date", 20).catch(() => []),
      base44.entities.LoyaltyRewardClaim.filter({ fan_email: userEmail, owner_type: selected.owner_type, owner_id: selected.owner_id }, "-claimed_at", 20).catch(() => []),
    ]).then(([t, h, c]) => {
      setTiers(t);
      setHistory(h);
      setClaims(c);
      setDetailLoading(false);
    });
  }, [selected, userEmail]);

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  if (balances.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-card border border-border/50 text-center space-y-2">
        <Star className="w-10 h-10 text-muted-foreground/30 mx-auto" />
        <p className="font-display font-bold">No Loyalty Points Yet</p>
        <p className="text-sm text-muted-foreground">
          Follow an Organizer or Artist and like, comment, review, enter raffles, or vote in polls to start earning points.
        </p>
      </div>
    );
  }

  const nextTier = tiers.filter(t => t.points_required > (selected?.balance || 0)).sort((a, b) => a.points_required - b.points_required)[0];
  const claimedTierIds = new Set(claims.map(c => c.tier_id));

  return (
    <div className="space-y-5">
      {/* Program selector */}
      <div className="flex gap-2 flex-wrap">
        {balances.map(b => {
          const label = b.owner_type === "platform" ? "Reizor Community" : (b.owner_name || "Program");
          const active = selected?.id === b.id;
          return (
            <button key={b.id} onClick={() => setSelected(b)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold capitalize transition-all ${
                active ? "bg-primary text-primary-foreground" : "bg-card border border-border/50 text-muted-foreground hover:border-primary/30"
              }`}>
              {label} {b.owner_type !== "platform" && `(${b.owner_type})`}
            </button>
          );
        })}
      </div>

      {selected && (
        <>
          {/* Balance card */}
          <div className="p-5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-mono text-primary uppercase tracking-widest">
                {selected.owner_type === "platform" ? "Reizor Community" : selected.owner_name} Points
              </p>
              <p className="font-display font-black text-4xl mt-1">{selected.balance}</p>
              <p className="text-xs text-muted-foreground mt-1">Lifetime: {selected.lifetime_points} pts</p>
            </div>
            <Star className="w-10 h-10 text-primary/40" />
          </div>

          {selected.frozen && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              This loyalty account is currently frozen{selected.frozen_reason ? `: ${selected.frozen_reason}` : "."}
            </div>
          )}

          {detailLoading ? (
            <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>
          ) : (
            <>
              {/* Progress to next tier */}
              {nextTier && (
                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Next Reward: {nextTier.tier_name}</p>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (selected.balance / nextTier.points_required) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{selected.balance} / {nextTier.points_required} points</p>
                </div>
              )}

              {/* Tiers */}
              {tiers.length > 0 && (
                <div className="space-y-2">
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Reward Tiers</p>
                  {tiers.map(t => {
                    const unlocked = selected.balance >= t.points_required;
                    const alreadyClaimed = claimedTierIds.has(t.id);
                    return (
                      <div key={t.id} className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${unlocked ? "bg-green-400/5 border-green-400/30" : "bg-card border-border/40"}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <Gift className={`w-4 h-4 shrink-0 ${unlocked ? "text-green-400" : "text-muted-foreground"}`} />
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{t.tier_name} — {t.reward_title}</p>
                            <p className="text-xs text-muted-foreground font-mono">{t.points_required} pts required</p>
                          </div>
                        </div>
                        <span className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          alreadyClaimed ? "bg-primary/10 text-primary" : unlocked ? "bg-green-400/10 text-green-400" : "bg-muted text-muted-foreground"
                        }`}>
                          {alreadyClaimed ? "Earned" : unlocked ? "Unlocked" : "Locked"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Recent activity */}
              <div className="space-y-2">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Recent Activity</p>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No points activity yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {history.map(h => (
                      <div key={h.id} className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-card border border-border/40">
                        <span className={h.status === "reversed" ? "line-through text-muted-foreground" : ""}>
                          {h.note || ACTION_LABELS[h.action_type] || h.action_type}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono text-muted-foreground">{h.created_date ? format(new Date(h.created_date), "MMM d") : ""}</span>
                          <span className={`font-mono font-bold text-xs ${h.points >= 0 ? "text-green-400" : "text-destructive"}`}>
                            {h.points >= 0 ? "+" : ""}{h.points}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Link to="/my-prizes" className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-colors">
                <span className="flex items-center gap-2 text-sm font-bold"><Trophy className="w-4 h-4 text-yellow-400" /> View Earned Rewards in My Prizes</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            </>
          )}
        </>
      )}

      <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 flex gap-2 text-xs text-muted-foreground">
        <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <p>You earn points by following an Organizer or Artist and liking, commenting, reviewing, entering raffles, or voting in their polls. Reizor Community activities never require a follow. Reach a reward tier to unlock it automatically.</p>
      </div>
    </div>
  );
}