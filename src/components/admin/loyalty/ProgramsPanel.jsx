import { useState, useEffect } from "react";
import { Power, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function ProgramsPanel() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [tiersByProgram, setTiersByProgram] = useState({});

  const load = () => {
    base44.entities.LoyaltyProgram.list("-created_date", 200).then(setPrograms).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toggle = async (p) => {
    await base44.functions.invoke("adminLoyaltyControls", {
      action: p.status === "active" ? "deactivate_program" : "reactivate_program",
      owner_type: p.owner_type, owner_id: p.owner_id, owner_name: p.owner_name,
    });
    toast.success(p.status === "active" ? "Program deactivated" : "Program reactivated");
    load();
  };

  const deleteProgram = async (p) => {
    if (!window.confirm(`Permanently delete the ${p.owner_type} program for "${p.owner_name || p.owner_id}"? This also deletes all its reward tiers. Fan balances and history are kept.`)) return;
    await base44.functions.invoke("adminLoyaltyControls", {
      action: "delete_program",
      owner_type: p.owner_type, owner_id: p.owner_id, owner_name: p.owner_name,
    });
    toast.success("Program deleted");
    load();
  };

  const toggleExpand = async (p) => {
    const key = `${p.owner_type}|${p.owner_id}`;
    if (expanded === key) { setExpanded(null); return; }
    setExpanded(key);
    if (!tiersByProgram[key]) {
      const tiers = await base44.entities.LoyaltyRewardTier.filter({ owner_type: p.owner_type, owner_id: p.owner_id }, "points_required", 100).catch(() => []);
      setTiersByProgram(prev => ({ ...prev, [key]: tiers }));
    }
  };

  const deleteTier = async (tier, key) => {
    if (!window.confirm(`Permanently delete the tier "${tier.tier_name}"?`)) return;
    await base44.functions.invoke("adminLoyaltyControls", { action: "delete_tier", tier_id: tier.id });
    toast.success("Tier deleted");
    setTiersByProgram(prev => ({ ...prev, [key]: prev[key].filter(t => t.id !== tier.id) }));
  };

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-2">
      {programs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No loyalty programs created yet.</p>
      ) : programs.map(p => {
        const key = `${p.owner_type}|${p.owner_id}`;
        const isOpen = expanded === key;
        const tiers = tiersByProgram[key] || [];
        return (
          <div key={p.id} className="rounded-lg bg-card border border-border/40 overflow-hidden">
            <div className="p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-bold text-sm capitalize">{p.owner_type} — {p.owner_name || p.owner_id}</p>
                <p className={`text-[10px] font-mono mt-0.5 ${p.status === "active" ? "text-green-400" : "text-destructive"}`}>{p.status.toUpperCase()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleExpand(p)} className="gap-1.5">
                  {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Tiers
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggle(p)} className={`gap-1.5 ${p.status === "active" ? "border-destructive/40 text-destructive" : ""}`}>
                  <Power className="w-3.5 h-3.5" /> {p.status === "active" ? "Deactivate" : "Reactivate"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteProgram(p)} className="gap-1.5 border-destructive/40 text-destructive">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            </div>
            {isOpen && (
              <div className="border-t border-border/40 p-3 space-y-2 bg-secondary/20">
                {tiers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No reward tiers for this program.</p>
                ) : tiers.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-card border border-border/40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.tier_name} — {t.reward_title}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{t.points_required} pts · {t.is_active ? "active" : "inactive"}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => deleteTier(t, key)} className="gap-1.5 shrink-0 border-destructive/40 text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}