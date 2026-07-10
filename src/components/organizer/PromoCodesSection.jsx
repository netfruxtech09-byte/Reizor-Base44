import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Tag, Pencil, X, Loader2, Copy, Check, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getAppUrl } from "@/lib/appUrl";

const EMPTY_FORM = {
  code: "",
  discount_type: "percentage",
  discount_value: "",
  max_uses: "",
  valid_from: "",
  valid_until: "",
  status: "active",
  tier_id: "",
  tier_name: "",
};

function validateForm(f, existingCodes = [], editingIndex = null) {
  const errors = {};

  if (!f.code.trim()) errors.code = "Code is required";
  else if (!/^[A-Z0-9]+$/.test(f.code)) errors.code = "Only letters and numbers allowed";
  else {
    const dup = existingCodes.find((c, i) => c === f.code && i !== editingIndex);
    if (dup !== undefined) errors.code = "Duplicate promo code";
  }

  if (!f.discount_value) {
    errors.discount_value = "Value is required";
  } else {
    const val = Number(f.discount_value);
    if (isNaN(val) || val <= 0) errors.discount_value = "Must be a positive number";
    else if (f.discount_type === "percentage" && val < 1) errors.discount_value = "Percentage must be at least 1%";
    else if (f.discount_type === "percentage" && val > 100) errors.discount_value = "Percentage cannot exceed 100%";
  }

  if (f.valid_from && f.valid_until && new Date(f.valid_until) <= new Date(f.valid_from))
    errors.valid_until = "Expiry must be after start date";

  if (f.max_uses && (isNaN(Number(f.max_uses)) || Number(f.max_uses) < 1))
    errors.max_uses = "Must be a positive number";

  return errors;
}

// Expose validate so parent can call it before publish
PromoCodesSection.validate = (list) => {
  const codes = list.map(p => p.code);
  const errors = {};
  list.forEach((p, i) => {
    const errs = validateForm(p, codes, i);
    if (Object.keys(errs).length > 0) errors[i] = errs;
  });
  return errors;
};

/**
 * PromoCodesSection — used in Create Event (no eventId yet).
 * Manages a local list of staged promo codes that are saved to DB on publish.
 *
 * Props:
 *   promos       — array of promo objects (controlled by parent)
 *   onChange     — (newPromos) => void
 *   ticketTiers  — optional array of { name } for ticket-type selector
 *   eventId      — if provided, saves immediately to DB per code
 */
export default function PromoCodesSection({ promos, onChange, ticketTiers = [], eventId }) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null); // null = new, number = editing existing
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(null);

  // savedIds: map from promo index → DB id (when eventId present)
  const [savedIds, setSavedIds] = useState({});

  const openCreate = () => {
    setEditingIndex(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowForm(true);
    setOpen(true);
  };

  const openEdit = (i) => {
    setEditingIndex(i);
    const p = promos[i];
    setForm({
      code: p.code || "",
      discount_type: p.discount_type || "percentage",
      discount_value: p.discount_value ?? "",
      max_uses: p.max_uses ?? "",
      valid_from: p.valid_from || "",
      valid_until: p.valid_until || "",
      status: p.status || "active",
      tier_id: p.tier_id || "",
      tier_name: p.tier_name || "",
    });
    setErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingIndex(null);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const updateField = (field, value) => {
    const cleaned = field === "code" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "") : value;
    setForm(f => ({ ...f, [field]: cleaned }));
    if (errors[field]) setErrors(e => { const c = { ...e }; delete c[field]; return c; });
  };

  const handleAddOrUpdate = async () => {
    const existingCodes = promos.map(p => p.code);
    const errs = validateForm(form, existingCodes, editingIndex);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        code: form.code.toUpperCase(),
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        max_uses: form.max_uses ? Number(form.max_uses) : "",
        valid_from: form.valid_from || "",
        valid_until: form.valid_until || "",
        status: form.status || "active",
        tier_id: form.tier_id || "",
        tier_name: form.tier_name || "",
      };

      if (eventId) {
        // Save immediately to DB
        const dbPayload = {
          ...payload,
          event_id: eventId,
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
          valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
          tier_id: form.tier_id || null,
          tier_name: form.tier_name || null,
        };

        const existingDbId = editingIndex !== null ? savedIds[editingIndex] : null;
        if (existingDbId) {
          await base44.entities.PromoCode.update(existingDbId, dbPayload);
          toast.success("Promo code updated successfully.");
        } else {
          const created = await base44.entities.PromoCode.create({ ...dbPayload, times_used: 0 });
          const newIndex = editingIndex !== null ? editingIndex : promos.length;
          setSavedIds(prev => ({ ...prev, [newIndex]: created.id }));
          toast.success("Promo code added successfully.");
        }
      } else {
        // Stage locally — will be saved when event is published
        if (editingIndex !== null) {
          toast.success("Promo code updated successfully.");
        } else {
          toast.success("Promo code added successfully.");
        }
      }

      if (editingIndex !== null) {
        const updated = promos.map((p, i) => i === editingIndex ? { ...p, ...payload } : p);
        onChange(updated);
      } else {
        onChange([...promos, payload]);
      }

      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (i) => {
    if (!confirm("Delete this promo code?")) return;
    const dbId = savedIds[i];
    if (dbId) {
      await base44.entities.PromoCode.delete(dbId).catch(() => {});
    }
    onChange(promos.filter((_, idx) => idx !== i));
    // Shift savedIds
    const newIds = {};
    Object.keys(savedIds).forEach(k => {
      const ki = Number(k);
      if (ki < i) newIds[ki] = savedIds[ki];
      else if (ki > i) newIds[ki - 1] = savedIds[ki];
    });
    setSavedIds(newIds);
    toast.success("Promo code deleted successfully.");
  };

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied!");
  };

  const isEditing = editingIndex !== null;

  return (
    <div className="space-y-0">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-yellow-700/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🏷️</span>
          <div className="text-left">
            <p className="font-display font-bold text-sm text-foreground">Promo Codes</p>
            <p className="text-xs text-muted-foreground font-mono">
              {promos.length === 0
                ? "Optional — add discount codes for this event"
                : `${promos.length} promo code${promos.length > 1 ? "s" : ""} added`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {promos.length > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-yellow-600/40 text-yellow-400">
              {promos.length} CODE{promos.length > 1 ? "S" : ""}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-yellow-600" /> : <ChevronDown className="w-4 h-4 text-yellow-600" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t-2 border-yellow-600/50 space-y-4 pt-4 bg-yellow-900/10">

          {/* Add/Edit Form */}
          {showForm && (
            <div className="p-4 rounded-xl bg-card border border-yellow-600/50 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-display font-bold text-sm text-yellow-400">
                  {isEditing ? "Edit Promo Code" : "New Promo Code"}
                </p>
                <button type="button" onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-mono font-bold text-foreground">Promo Code *</Label>
                  <Input
                    value={form.code}
                    onChange={e => updateField("code", e.target.value)}
                    placeholder="SUMMER25"
                    maxLength={30}
                    disabled={isEditing}
                    className={`mt-1 bg-secondary border border-yellow-600/40 font-mono uppercase text-sm ${errors.code ? "border-destructive" : ""} ${isEditing ? "opacity-60" : ""}`}
                  />
                  {errors.code && <p className="text-[10px] text-destructive mt-0.5">{errors.code}</p>}
                </div>
                <div>
                  <Label className="text-[10px] font-mono font-bold text-foreground">Status</Label>
                  <Select value={form.status} onValueChange={v => updateField("status", v)}>
                    <SelectTrigger className="mt-1 bg-secondary border border-yellow-600/40 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-mono font-bold text-foreground">Discount Type *</Label>
                  <Select value={form.discount_type} onValueChange={v => updateField("discount_type", v)}>
                    <SelectTrigger className="mt-1 bg-secondary border border-yellow-600/40 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-mono font-bold text-foreground">
                    {form.discount_type === "percentage" ? "Discount %" : "Discount Amount"} *
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={form.discount_value}
                    onChange={e => { if (/^(\d*\.?\d*)$/.test(e.target.value)) updateField("discount_value", e.target.value); }}
                    placeholder={form.discount_type === "percentage" ? "20" : "10"}
                    className={`mt-1 bg-secondary border border-yellow-600/40 text-sm ${errors.discount_value ? "border-destructive" : ""}`}
                  />
                  {errors.discount_value && <p className="text-[10px] text-destructive mt-0.5">{errors.discount_value}</p>}
                </div>
              </div>

              {ticketTiers.length > 0 && (
                <div>
                  <Label className="text-[10px] font-mono font-bold text-foreground">Applicable Ticket Type (optional)</Label>
                  <Select
                    value={form.tier_id || "all"}
                    onValueChange={v => {
                      if (v === "all") { updateField("tier_id", ""); updateField("tier_name", ""); }
                      else {
                        const t = ticketTiers.find((_, i) => `tier_${i}` === v);
                        updateField("tier_id", v);
                        updateField("tier_name", t?.name || "");
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1 bg-secondary border border-yellow-600/40 text-sm">
                      <SelectValue placeholder="All ticket types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ticket types</SelectItem>
                      {ticketTiers.filter(t => t.name).map((t, ti) => (
                        <SelectItem key={ti} value={`tier_${ti}`}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className="text-[10px] font-mono font-bold text-foreground">Usage Limit</Label>
                <Input
                  type="number"
                  value={form.max_uses}
                  onChange={e => updateField("max_uses", e.target.value)}
                  placeholder="Unlimited"
                  className={`mt-1 bg-secondary border border-yellow-600/40 text-sm ${errors.max_uses ? "border-destructive" : ""}`}
                />
                {errors.max_uses && <p className="text-[10px] text-destructive mt-0.5">{errors.max_uses}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-mono font-bold text-foreground">Valid From</Label>
                  <Input
                    type="datetime-local"
                    value={form.valid_from}
                    onChange={e => updateField("valid_from", e.target.value)}
                    className="mt-1 bg-secondary border border-yellow-600/40 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-mono font-bold text-foreground">Expiry Date</Label>
                  <Input
                    type="datetime-local"
                    value={form.valid_until}
                    onChange={e => updateField("valid_until", e.target.value)}
                    className={`mt-1 bg-secondary border border-yellow-600/40 text-sm ${errors.valid_until ? "border-destructive" : ""}`}
                  />
                  {errors.valid_until && <p className="text-[10px] text-destructive mt-0.5">{errors.valid_until}</p>}
                </div>
              </div>

              {/* ACTION BUTTON — always visible */}
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  onClick={handleAddOrUpdate}
                  disabled={saving}
                  className="flex-1 font-display font-bold bg-yellow-600 hover:bg-yellow-500 text-black gap-2"
                >
                  {saving
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                    : isEditing
                      ? "Update Promo Code"
                      : "Add Promo Code"}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm} className="font-mono">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Staged / saved promo list */}
          {promos.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground font-mono text-center py-4">
              No promo codes added yet.
            </p>
          )}

          {promos.map((promo, i) => {
            const link = eventId ? getAppUrl(`/events/${eventId}?promo=${encodeURIComponent(promo.code)}`) : null;
            return (
              <div key={i} className="p-4 rounded-lg bg-card border border-yellow-600/30 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                    <span className="font-mono font-black text-sm text-foreground">{promo.code}</span>
                    <span className="font-mono text-xs text-yellow-400 font-bold">
                      {promo.discount_type === "percentage" ? `${promo.discount_value}% off` : `$${promo.discount_value} off`}
                    </span>
                    {promo.tier_name && (
                      <span className="font-mono text-[10px] text-muted-foreground">· {promo.tier_name}</span>
                    )}
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-bold ${promo.status === "active" ? "bg-green-400/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {promo.status === "active" ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(i)}
                      className="p-1.5 rounded hover:bg-muted text-accent"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(i)}
                      className="p-1.5 rounded hover:bg-muted text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Meta info */}
                <div className="flex flex-wrap gap-3 text-[10px] font-mono text-muted-foreground">
                  {promo.max_uses ? <span>Limit: {promo.max_uses} uses</span> : <span>Unlimited uses</span>}
                  {promo.valid_from && <span>From: {new Date(promo.valid_from).toLocaleDateString()}</span>}
                  {promo.valid_until && <span>Until: {new Date(promo.valid_until).toLocaleDateString()}</span>}
                </div>

                {/* Copy link (only if saved to event) */}
                {link && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/60 border border-border/40">
                    <Link className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{link}</span>
                    <button
                      type="button"
                      onClick={() => copyText(link, `link-${i}`)}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold hover:bg-primary/20 transition-colors"
                    >
                      {copied === `link-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === `link-${i}` ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add new code button */}
          {!showForm && (
            <Button
              type="button"
              onClick={openCreate}
              className="w-full gap-2 bg-yellow-600 hover:bg-yellow-500 text-black font-display font-bold"
            >
              <Plus className="w-4 h-4" /> Add Promo Code
            </Button>
          )}

          {!eventId && promos.length > 0 && (
            <p className="text-[10px] text-muted-foreground font-mono text-center">
              Promo codes will be saved and linked to this event automatically when you publish.
            </p>
          )}
        </div>
      )}
    </div>
  );
}