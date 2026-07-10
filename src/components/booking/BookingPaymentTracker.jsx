import { useState } from "react";
import { DollarSign, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const STATUS_CONFIG = {
  pending:        { label: "Pending",        color: "text-muted-foreground bg-muted" },
  partially_paid: { label: "Partially Paid", color: "text-yellow-400 bg-yellow-400/10" },
  paid:           { label: "Paid",           color: "text-green-400 bg-green-400/10" },
};

export default function BookingPaymentTracker({ booking, onUpdate, onHistoryLog }) {
  const [advancePaid, setAdvancePaid] = useState(String(booking.advance_paid || 0));
  const [savedAdvance, setSavedAdvance] = useState(booking.advance_paid || 0);
  const [saving, setSaving] = useState(false);

  const totalFee = booking.budget || 0;
  const advance = parseFloat(advancePaid) || 0;
  const remaining = totalFee - advance;

  const computeStatus = (adv) => {
    if (adv <= 0) return "pending";
    if (adv >= totalFee) return "paid";
    return "partially_paid";
  };

  const handleSave = async () => {
    setSaving(true);
    const newStatus = computeStatus(advance);
    await base44.entities.ArtistBooking.update(booking.id, {
      advance_paid: advance,
      payment_status: newStatus,
    });
    const label = STATUS_CONFIG[newStatus].label;
    onHistoryLog?.("Payment updated", `Advance: $${advance.toFixed(2)} / $${totalFee.toFixed(2)} — Status: ${label}`);
    onUpdate?.({ advance_paid: advance, payment_status: newStatus });
    setSavedAdvance(advance);
    toast.success(`Payment updated — ${label}`);
    setSaving(false);
  };

  const status = computeStatus(advance);
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      <div className="p-4 border-b border-border/30 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-400" />
          <h2 className="font-display font-bold">Payment Tracking</h2>
        </div>
        <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Fee",  value: `$${totalFee.toLocaleString()}` },
            { label: "Advance Paid", value: `$${savedAdvance.toFixed(2)}`, accent: true },
            { label: "Remaining", value: `$${Math.max(0, totalFee - savedAdvance).toFixed(2)}` },
          ].map(({ label, value, accent }) => (
            <div key={label} className="p-3 rounded-lg bg-secondary border border-border/40">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{label}</p>
              <p className={`font-mono font-bold text-sm mt-0.5 ${accent ? "text-green-400" : ""}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {totalFee > 0 && (
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-green-400 transition-all duration-500"
                style={{ width: `${Math.min(100, (savedAdvance / totalFee) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] font-mono text-muted-foreground text-right">
              {totalFee > 0 ? Math.round((savedAdvance / totalFee) * 100) : 0}% paid
            </p>
          </div>
        )}

        {/* Update advance */}
        <div className="space-y-2 pt-2 border-t border-border/30">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Record Advance Payment</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
              <Input
                type="number"
                value={advancePaid}
                onChange={e => setAdvancePaid(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min={0}
                max={totalFee || undefined}
                className="pl-7 bg-secondary border-border/50"
              />
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 font-display font-bold shrink-0">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {saving ? "Saving..." : "Update"}
            </Button>
          </div>
          {totalFee > 0 && advance > 0 && advance < totalFee && (
            <p className="text-xs text-yellow-400 font-mono">
              Remaining balance: ${remaining.toFixed(2)}
            </p>
          )}
          {advance >= totalFee && totalFee > 0 && (
            <p className="text-xs text-green-400 font-mono">✓ Fully paid</p>
          )}
        </div>
      </div>
    </div>
  );
}