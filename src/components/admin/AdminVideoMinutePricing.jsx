/**
 * AdminVideoMinutePricing — admin panel to configure per-minute video pricing.
 *
 * Controls:
 *   - base_rate_per_minute (8K Mux reference)
 *   - multiplier (profit/safety margin)
 *   - free_minutes_per_month
 */
import { useState, useEffect } from "react";
import { Settings2, Save, Loader2, DollarSign, Calculator, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function AdminVideoMinutePricing() {
  const [pricing, setPricing] = useState({
    base_rate_per_minute: 0.0008,
    multiplier: 2.0,
    free_minutes_per_month: 100,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await base44.functions.invoke("videoMinuteBilling", { action: "get_pricing" });
      if (res.data) setPricing(res.data);
      setLoading(false);
    })();
  }, []);

  const effectiveRate = pricing.base_rate_per_minute * pricing.multiplier;

  const handleSave = async () => {
    setSaving(true);
    await base44.functions.invoke("videoMinuteBilling", {
      action: "update_pricing",
      base_rate_per_minute: pricing.base_rate_per_minute,
      multiplier: pricing.multiplier,
      free_minutes_per_month: pricing.free_minutes_per_month,
    });
    setSaving(false);
    toast.success("Video minute pricing updated");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border/40 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-primary" />
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Per-Minute Streaming Pricing
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-mono text-muted-foreground block mb-1">
            8K Base Rate ($/min)
          </label>
          <Input
            type="number"
            step="0.0001"
            min="0"
            value={pricing.base_rate_per_minute}
            onChange={e => setPricing(p => ({ ...p, base_rate_per_minute: parseFloat(e.target.value) || 0 }))}
            className="bg-secondary border-border/50 font-mono"
          />
          <p className="text-[9px] font-mono text-muted-foreground mt-1">
            Mux 8K reference cost. All resolutions charged at this rate.
          </p>
        </div>

        <div>
          <label className="text-xs font-mono text-muted-foreground block mb-1">
            Multiplier
          </label>
          <Input
            type="number"
            step="0.1"
            min="1"
            value={pricing.multiplier}
            onChange={e => setPricing(p => ({ ...p, multiplier: parseFloat(e.target.value) || 1 }))}
            className="bg-secondary border-border/50 font-mono"
          />
          <p className="text-[9px] font-mono text-muted-foreground mt-1">
            Profit/safety margin. Final rate = base × multiplier.
          </p>
        </div>

        <div>
          <label className="text-xs font-mono text-muted-foreground block mb-1">
            Free Minutes/Month
          </label>
          <Input
            type="number"
            step="10"
            min="0"
            value={pricing.free_minutes_per_month}
            onChange={e => setPricing(p => ({ ...p, free_minutes_per_month: parseInt(e.target.value) || 0 }))}
            className="bg-secondary border-border/50 font-mono"
          />
          <p className="text-[9px] font-mono text-muted-foreground mt-1">
            Free streaming minutes per organizer before billing.
          </p>
        </div>
      </div>

      {/* Breakdown panel */}
      <div className="p-3 rounded-lg bg-primary/8 border border-primary/20 space-y-2">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          <p className="text-xs font-mono font-bold text-primary uppercase">Effective Pricing</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground">Per Minute</p>
            <p className="font-display font-bold text-sm">${effectiveRate.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground">Per Hour</p>
            <p className="font-display font-bold text-sm">${(effectiveRate * 60).toFixed(3)}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground">100 Min</p>
            <p className="font-display font-bold text-sm">${(effectiveRate * 100).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground">1000 Min</p>
            <p className="font-display font-bold text-sm">${(effectiveRate * 1000).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2 font-bold">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Save Pricing
      </Button>
    </div>
  );
}