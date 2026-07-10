import { useState, useEffect } from "react";
import { Users, Gift, Trophy } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function PointsProgramMembersPanel({ ownerType, ownerId }) {
  const [balances, setBalances] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("fans");

  useEffect(() => {
    if (!ownerId) { setLoading(false); return; }
    Promise.all([
      base44.entities.LoyaltyPointsBalance.filter({ owner_type: ownerType, owner_id: ownerId }, "-lifetime_points", 200).catch(() => []),
      base44.entities.LoyaltyRewardClaim.filter({ owner_type: ownerType, owner_id: ownerId }, "-claimed_at", 100).catch(() => []),
    ]).then(([b, c]) => { setBalances(b); setClaims(c); }).finally(() => setLoading(false));
  }, [ownerType, ownerId]);

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border/50 pb-2">
        <button
          onClick={() => setTab("fans")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
            tab === "fans" ? "bg-primary/10 border border-primary/30 text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Fans ({balances.length})
        </button>
        <button
          onClick={() => setTab("rewards")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
            tab === "rewards" ? "bg-primary/10 border border-primary/30 text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Gift className="w-3.5 h-3.5" /> Rewards Issued ({claims.length})
        </button>
      </div>

      {tab === "fans" && (
        balances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No fans have earned points with you yet.</p>
            <p className="text-xs font-mono mt-1">Fans appear here once they follow you and earn points from likes, comments, reviews, raffles, or polls.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {balances.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/40 border border-border/40">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{b.user_name || b.user_email}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{b.user_email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-xs font-bold text-foreground">{b.balance} pts</p>
                  <p className="text-[10px] font-mono text-muted-foreground">lifetime {b.lifetime_points}</p>
                  {b.frozen && <p className="text-[10px] font-mono text-destructive mt-0.5">FROZEN</p>}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "rewards" && (
        claims.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Gift className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No reward claims yet.</p>
            <p className="text-xs font-mono mt-1">When fans reach a points tier, their claim will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {claims.map(c => (
              <div key={c.id} className="p-3 rounded-lg bg-secondary/40 border border-border/40 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{c.fan_name || c.fan_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.tier_name} — {c.reward_title} <span className="font-mono">({c.points_spent} pts)</span>
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  c.status === "fulfilled" ? "bg-green-400/10 text-green-400" : c.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-yellow-400/10 text-yellow-400"
                }`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}