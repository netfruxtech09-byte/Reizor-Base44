import { useState, useEffect } from "react";
import { Search, Undo2, ClipboardList, Gift } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function LedgerClaimsPanel() {
  const [tab, setTab] = useState("ledger");
  const [ledger, setLedger] = useState([]);
  const [claims, setClaims] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      base44.entities.LoyaltyPointsLedger.list("-created_date", 300).catch(() => []),
      base44.entities.LoyaltyRewardClaim.list("-claimed_at", 300).catch(() => []),
    ]).then(([l, c]) => { setLedger(l); setClaims(c); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const reverse = async (entry) => {
    await base44.functions.invoke("adminLoyaltyControls", { action: "reverse_points", ledger_id: entry.id, reason: "Admin correction" });
    toast.success("Entry reversed");
    load();
  };

  const q = search.trim().toLowerCase();
  const filteredLedger = q ? ledger.filter(l => l.user_email?.toLowerCase().includes(q) || l.user_name?.toLowerCase().includes(q)) : ledger;
  const filteredClaims = q ? claims.filter(c => c.fan_email?.toLowerCase().includes(q) || c.fan_name?.toLowerCase().includes(q)) : claims;

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by fan email or name..." className="pl-9 bg-secondary border-border/50" />
      </div>

      <div className="flex gap-2 border-b border-border/50 pb-2">
        <button onClick={() => setTab("ledger")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${tab === "ledger" ? "bg-primary/10 border border-primary/30 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          <ClipboardList className="w-3.5 h-3.5" /> Points Ledger ({filteredLedger.length})
        </button>
        <button onClick={() => setTab("claims")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${tab === "claims" ? "bg-primary/10 border border-primary/30 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          <Gift className="w-3.5 h-3.5" /> Reward Claims ({filteredClaims.length})
        </button>
      </div>

      {tab === "ledger" && (
        filteredLedger.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No ledger entries found.</p>
        ) : (
          <div className="space-y-2">
            {filteredLedger.map(entry => (
              <div key={entry.id} className="p-3 rounded-lg bg-card border border-border/40 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-bold text-sm">{entry.user_name || entry.user_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.owner_type} · {entry.owner_name || entry.owner_id} · {entry.action_type}
                    {entry.status === "reversed" && <span className="text-destructive"> · reversed</span>}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {entry.created_date ? format(new Date(entry.created_date), "MMM d, yyyy h:mm a") : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-mono font-bold text-sm ${entry.points >= 0 ? "text-green-400" : "text-destructive"}`}>
                    {entry.points >= 0 ? "+" : ""}{entry.points}
                  </span>
                  {entry.status !== "reversed" && (
                    <Button size="sm" variant="outline" onClick={() => reverse(entry)} className="gap-1.5">
                      <Undo2 className="w-3.5 h-3.5" /> Reverse
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "claims" && (
        filteredClaims.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No reward claims found.</p>
        ) : (
          <div className="space-y-2">
            {filteredClaims.map(c => (
              <div key={c.id} className="p-3 rounded-lg bg-card border border-border/40 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-bold text-sm">{c.fan_name || c.fan_email}</p>
                  <p className="text-xs text-muted-foreground">{c.owner_type} · {c.owner_name || c.owner_id} · {c.tier_name} — {c.reward_title} ({c.points_spent} pts)</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {c.claimed_at ? format(new Date(c.claimed_at), "MMM d, yyyy h:mm a") : ""}
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