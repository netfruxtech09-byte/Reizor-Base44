import { useState, useEffect } from "react";
import { Snowflake, Undo2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const FLAG_THRESHOLD = 15; // ledger entries within 24h considered rapid/suspicious activity

export default function FanAccountsPanel() {
  const [balances, setBalances] = useState([]);
  const [flagged, setFlagged] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      base44.entities.LoyaltyPointsBalance.list("-lifetime_points", 200),
      base44.entities.LoyaltyPointsLedger.list("-created_date", 500).catch(() => []),
    ]).then(([b, ledger]) => {
      setBalances(b);
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const counts = {};
      for (const entry of ledger) {
        if (!entry.created_date || new Date(entry.created_date).getTime() < dayAgo) continue;
        counts[entry.user_email] = (counts[entry.user_email] || 0) + 1;
      }
      setFlagged(new Set(Object.keys(counts).filter(email => counts[email] >= FLAG_THRESHOLD)));
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toggleFreeze = async (b) => {
    await base44.functions.invoke("adminLoyaltyControls", {
      action: b.frozen ? "unfreeze_account" : "freeze_account",
      user_email: b.user_email, owner_type: b.owner_type, owner_id: b.owner_id,
      reason: b.frozen ? "" : "Suspicious activity",
    });
    toast.success(b.frozen ? "Account unfrozen" : "Account frozen");
    load();
  };

  const reverseLast = async (b) => {
    const entries = await base44.entities.LoyaltyPointsLedger.filter(
      { user_email: b.user_email, owner_type: b.owner_type, owner_id: b.owner_id, status: "awarded" }, "-created_date", 1
    );
    if (!entries[0]) { toast.error("No ledger entry to reverse."); return; }
    await base44.functions.invoke("adminLoyaltyControls", { action: "reverse_points", ledger_id: entries[0].id, reason: "Admin correction" });
    toast.success("Last points entry reversed.");
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-2">
      {balances.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No fan loyalty accounts yet.</p>
      ) : balances.map(b => (
        <div key={b.id} className="p-3 rounded-lg bg-card border border-border/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-bold text-sm">{b.user_name || b.user_email}</p>
              {flagged.has(b.user_email) && (
                <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> Flagged: rapid activity
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{b.owner_type} · {b.owner_name || b.owner_id} · {b.balance} pts (lifetime {b.lifetime_points})</p>
            {b.frozen && <p className="text-[10px] font-mono text-destructive mt-0.5">FROZEN {b.frozen_reason ? `— ${b.frozen_reason}` : ""}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => reverseLast(b)} className="gap-1.5">
              <Undo2 className="w-3.5 h-3.5" /> Reverse Last
            </Button>
            <Button size="sm" variant="outline" onClick={() => toggleFreeze(b)} className={`gap-1.5 ${b.frozen ? "" : "border-destructive/40 text-destructive"}`}>
              <Snowflake className="w-3.5 h-3.5" /> {b.frozen ? "Unfreeze" : "Freeze"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}