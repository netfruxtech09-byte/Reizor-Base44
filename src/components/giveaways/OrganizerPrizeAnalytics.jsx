import { useState, useEffect } from "react";
import { BarChart3, Gift, CheckCircle, Clock, AlertCircle, User, Filter, Scan } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import OrganizerPrizeScanner from "@/components/organizer/OrganizerPrizeScanner";

export default function OrganizerPrizeAnalytics({ giveaway }) {
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showScanner, setShowScanner] = useState(false);

  const load = () => {
    if (!giveaway?.id) return;
    base44.entities.PrizeWallet.filter(
      { giveaway_id: giveaway.id },
      "-created_date",
      200
    ).then(data => {
      setPrizes(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [giveaway?.id]);

  const total = prizes.length;
  const redeemed = prizes.filter(p => p.status === "redeemed").length;
  const unclaimed = prizes.filter(p => p.status === "unclaimed" || p.status === "won").length;
  const expired = prizes.filter(p => p.status === "expired").length;

  const filtered = prizes.filter(p => {
    const statusMatch = filterStatus === "all" || p.status === filterStatus;
    const typeMatch = filterType === "all" || p.prize_type === filterType;
    return statusMatch && typeMatch;
  });

  const STATUS_META = {
    unclaimed: { label: "Unclaimed", color: "text-yellow-400 bg-yellow-400/10", icon: Clock },
    won:       { label: "Won",       color: "text-yellow-400 bg-yellow-400/10", icon: Clock },
    redeemed:  { label: "Redeemed", color: "text-green-400 bg-green-400/10",  icon: CheckCircle },
    expired:   { label: "Expired",  color: "text-destructive bg-destructive/10", icon: AlertCircle },
  };

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (total === 0) return (
    <div className="text-center py-6 text-muted-foreground">
      <Gift className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">No prizes awarded yet for this giveaway.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Scanner Button */}
      <Button 
        onClick={() => setShowScanner(true)} 
        className="w-full gap-2 bg-accent hover:bg-accent/90 text-white font-bold"
      >
        <Scan className="w-4 h-4" /> Scan Prize for Redemption
      </Button>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Awarded", value: total, color: "text-primary" },
          { label: "Redeemed", value: redeemed, color: "text-green-400" },
          { label: "Unclaimed", value: unclaimed, color: "text-yellow-400" },
          { label: "Expired", value: expired, color: "text-destructive" },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border/50 text-center">
            <p className={`font-mono text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-muted-foreground" />
          {["all", "unclaimed", "redeemed", "expired"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-colors ${filterStatus === s ? "bg-primary text-white" : "bg-card border border-border/50 text-muted-foreground"}`}>
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Winner List */}
      <div className="space-y-2">
        {filtered.map(prize => {
          const meta = STATUS_META[prize.status] || STATUS_META.unclaimed;
          const Icon = meta.icon;
          return (
            <div key={prize.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{prize.user_name || prize.user_email}</p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{prize.prize_title}</p>
                  {prize.redeemed_at && (
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Claimed {format(new Date(prize.redeemed_at), "MMM d, yyyy h:mm a")}
                      {prize.redeemed_by_email ? ` by ${prize.redeemed_by_email}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${meta.color}`}>
                <Icon className="w-3 h-3" /> {meta.label}
              </span>
            </div>
          );
        })}
      </div>

      {showScanner && (
        <OrganizerPrizeScanner
          giveaway={giveaway}
          onClose={() => setShowScanner(false)}
          onRedeemed={() => load()}
        />
      )}
    </div>
  );
}