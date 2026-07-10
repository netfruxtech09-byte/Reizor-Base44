/**
 * WLFeeManager — Fee configuration UI for the White Label dashboard.
 *
 * Usage:
 *   <WLFeeManager agent={wlRecord} currentUser={user} />
 *
 * - Reizor admin: sees the fee Reizor charges THIS WL, and can set it (via AdminWhiteLabels)
 *   — that path is handled in AdminWhiteLabels edit dialog, not here.
 * - WL/Sub-WL admin: sees the fee their parent charges them (read-only),
 *   and can set fees for their own direct Sub-WL children.
 */

import { useState, useEffect } from "react";
import { DollarSign, Lock, Edit2, Check, X, History, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

function feeLabel(config) {
  if (!config) return "No fee configured";
  if (config.fee_type === "percentage") return `${config.fee_percent || 0}% of subtotal`;
  if (config.fee_type === "flat") return `$${Number(config.fee_flat || 0).toFixed(2)} per ticket`;
  return `${config.fee_percent || 0}% + $${Number(config.fee_flat || 0).toFixed(2)} per ticket`;
}

// ── Fee editor for a single child WL ─────────────────────────────────────────
function ChildFeeEditor({ parentWl, childWl, currentUser, onSaved }) {
  const [config, setConfig] = useState(null);
  const [history, setHistory] = useState([]);
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fee_type: "percentage", fee_percent: 0, fee_flat: 0, effective_from: new Date().toISOString().slice(0, 16) });

  useEffect(() => {
    loadConfig();
  }, [childWl.id]);

  const loadConfig = async () => {
    const all = await base44.entities.WLFeeConfig.filter({ child_wl_id: childWl.id }, "-effective_from", 20).catch(() => []);
    const active = all.find(c => c.is_active);
    setConfig(active || null);
    setHistory(all);
    if (active) {
      setForm({
        fee_type: active.fee_type || "percentage",
        fee_percent: active.fee_percent || 0,
        fee_flat: active.fee_flat || 0,
        effective_from: active.effective_from ? active.effective_from.slice(0, 16) : new Date().toISOString().slice(0, 16),
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const effectiveFrom = form.effective_from ? new Date(form.effective_from).toISOString() : now;

    // Deactivate existing active config
    if (config?.id) {
      const newConfigRef = `(pending)`; // will be updated below
      await base44.entities.WLFeeConfig.update(config.id, {
        is_active: false,
        superseded_by: newConfigRef,
      }).catch(() => {});
    }

    // Create new config record (immutable audit entry)
    const isReizorParent = !parentWl; // null parentWl = Reizor is setting the fee
    const newConfig = await base44.entities.WLFeeConfig.create({
      parent_type: isReizorParent ? "reizor" : (parentWl.parent_wl_id ? "sub_white_label" : "white_label"),
      parent_wl_id: parentWl?.id || null,
      parent_wl_name: parentWl ? (parentWl.brand_name || parentWl.name) : "Reizor",
      parent_wl_email: parentWl?.email || currentUser?.email,
      child_wl_id: childWl.id,
      child_wl_name: childWl.brand_name || childWl.name,
      child_wl_email: childWl.email,
      fee_type: form.fee_type,
      fee_percent: parseFloat(form.fee_percent) || 0,
      fee_flat: parseFloat(form.fee_flat) || 0,
      effective_from: effectiveFrom,
      is_active: true,
      notes: "",
      created_by_email: currentUser?.email || "",
      created_by_role: currentUser?.role || "",
    });

    // Backfill superseded_by on the old config
    if (config?.id) {
      await base44.entities.WLFeeConfig.update(config.id, { superseded_by: newConfig.id }).catch(() => {});
    }

    toast.success(`Fee updated for ${childWl.brand_name || childWl.name}`);
    setEditing(false);
    setSaving(false);
    loadConfig();
    onSaved?.();
  };

  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
          {(childWl.brand_name || childWl.name || "?")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{childWl.brand_name || childWl.name}</p>
          <p className="text-xs font-mono text-muted-foreground truncate">{childWl.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${config ? "text-green-400 bg-green-400/10" : "text-yellow-400 bg-yellow-400/10"}`}>
            {config ? feeLabel(config) : "No fee set"}
          </span>
          {!editing && (
            <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit fee">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => setShowHistory(v => !v)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Fee history">
            <History className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="border-t border-border/30 p-4 space-y-4 bg-secondary/20">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold">Set Fee for {childWl.brand_name || childWl.name}</p>

          {/* Fee type */}
          <div className="grid grid-cols-3 gap-2">
            {[{ v: "percentage", l: "% Only" }, { v: "flat", l: "$ Flat" }, { v: "both", l: "% + $" }].map(({ v, l }) => (
              <button key={v} type="button" onClick={() => setForm(f => ({ ...f, fee_type: v }))}
                className={`py-2 rounded-lg text-xs font-mono font-bold border transition-all ${form.fee_type === v ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            {(form.fee_type === "percentage" || form.fee_type === "both") && (
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Percentage (%)</Label>
                <div className="flex items-center gap-1 mt-1">
                  <Input type="number" min="0" max="100" step="0.1" value={form.fee_percent}
                    onChange={e => setForm(f => ({ ...f, fee_percent: e.target.value }))}
                    className="w-24 bg-background border-border/50 h-8 text-sm text-right" />
                  <span className="text-xs font-mono text-muted-foreground">%</span>
                </div>
              </div>
            )}
            {(form.fee_type === "flat" || form.fee_type === "both") && (
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Flat fee per ticket ($)</Label>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs font-mono text-muted-foreground">$</span>
                  <Input type="number" min="0" step="0.01" value={form.fee_flat}
                    onChange={e => setForm(f => ({ ...f, fee_flat: e.target.value }))}
                    className="w-24 bg-background border-border/50 h-8 text-sm text-right" />
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Effective from</Label>
              <Input type="datetime-local" value={form.effective_from}
                onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))}
                className="mt-1 bg-background border-border/50 h-8 text-xs" />
            </div>
          </div>

          <p className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
            This fee is additive — applied on top of the Reizor platform fee. A new audit record is created for every change.
          </p>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm" className="glow-lime font-display font-bold gap-1.5">
              <Check className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Fee"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1.5">
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {/* History */}
      {showHistory && history.length > 0 && (
        <div className="border-t border-border/30 p-4 space-y-2">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-bold mb-3">Fee History ({history.length} records)</p>
          {history.map(h => (
            <div key={h.id} className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-mono ${h.is_active ? "bg-green-400/5 border border-green-400/20" : "bg-muted/30 border border-border/20"}`}>
              <div className="flex-1 min-w-0">
                <span className={`font-bold ${h.is_active ? "text-green-400" : "text-muted-foreground"}`}>
                  {h.is_active ? "● Active" : "○ Inactive"}&nbsp;—&nbsp;
                </span>
                <span className="text-foreground">{feeLabel(h)}</span>
                <span className="text-muted-foreground ml-2">
                  · from {h.effective_from ? format(new Date(h.effective_from), "MMM d, yyyy HH:mm") : "immediately"}
                </span>
              </div>
              <span className="text-muted-foreground shrink-0 hidden sm:inline">by {h.created_by_email || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main WLFeeManager component ───────────────────────────────────────────────
export default function WLFeeManager({ agent, currentUser }) {
  const [parentFee, setParentFee] = useState(null);
  const [subWLs, setSubWLs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [agent?.id]);

  const loadData = async () => {
    setLoading(true);

    // Load the fee this WL's parent charges it (read-only)
    const incoming = await base44.entities.WLFeeConfig.filter({ child_wl_id: agent.id, is_active: true }, "-effective_from", 1).catch(() => []);
    setParentFee(incoming[0] || null);

    // Load all direct Sub-WL children of this agent
    // Sub-WLs are WhiteLabel records with parent_wl_id = agent.id
    const children = await base44.entities.WhiteLabel.filter({ parent_wl_id: agent.id }, "-created_date", 50).catch(() => []);
    setSubWLs(children);

    setLoading(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── What your parent charges you (read-only) ── */}
      <div className="p-4 rounded-xl bg-secondary border border-border/50 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-display font-bold text-sm uppercase tracking-wider">Fee Charged to You</h3>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">Read-only</span>
        </div>
        {parentFee ? (
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">{feeLabel(parentFee)}</p>
            <p className="text-xs font-mono text-muted-foreground">
              Set by: <span className="text-foreground">{parentFee.parent_wl_name || "Reizor"}</span>
              {parentFee.effective_from && <> · Effective {format(new Date(parentFee.effective_from), "MMM d, yyyy")}</>}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground font-mono">No fee configured by parent yet.</p>
        )}
        <p className="text-[10px] font-mono text-muted-foreground">Plus Reizor's base platform fee (tiered $0.50–$5 per ticket) — always applied.</p>
      </div>

      {/* ── Fees you charge your Sub-WLs ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-sm uppercase tracking-wider">Fees You Charge Your Sub-White-Labels</h3>
        </div>

        {subWLs.length === 0 ? (
          <div className="py-8 text-center rounded-xl bg-card border border-dashed border-border/50">
            <DollarSign className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No Sub-White-Labels under your account yet.</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">Propose a Sub-WL below to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {subWLs.map(child => (
              <ChildFeeEditor
                key={child.id}
                parentWl={agent}
                childWl={child}
                currentUser={currentUser}
                onSaved={loadData}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}