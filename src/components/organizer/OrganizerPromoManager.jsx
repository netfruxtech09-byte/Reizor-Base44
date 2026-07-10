import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check, Pencil, X, Tag, Link, ToggleLeft, ToggleRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
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

function validateForm(f) {
  const errors = {};
  if (!f.code.trim()) errors.code = "Code is required";
  else if (!/^[A-Z0-9]+$/.test(f.code)) errors.code = "Only letters and numbers allowed";
  if (!f.discount_value) errors.discount_value = "Value is required";
  else {
    const val = Number(f.discount_value);
    if (isNaN(val) || val <= 0) errors.discount_value = "Must be a positive number";
    else if (f.discount_type === "percentage" && val > 100) errors.discount_value = "Cannot exceed 100%";
  }
  if (f.valid_from && f.valid_until && new Date(f.valid_until) <= new Date(f.valid_from))
    errors.valid_until = "Expiry must be after start date";
  if (f.max_uses && (isNaN(Number(f.max_uses)) || Number(f.max_uses) < 1))
    errors.max_uses = "Must be a positive number";
  return errors;
}

function getPromoStatus(promo) {
  const now = new Date();
  if (promo.status === "disabled") return { label: "Disabled", color: "text-muted-foreground bg-muted" };
  if (promo.valid_until && new Date(promo.valid_until) < now) return { label: "Expired", color: "text-destructive bg-destructive/10" };
  if (promo.valid_from && new Date(promo.valid_from) > now) return { label: "Scheduled", color: "text-yellow-400 bg-yellow-400/10" };
  if (promo.max_uses && (promo.times_used || 0) >= promo.max_uses) return { label: "Limit Reached", color: "text-orange-400 bg-orange-400/10" };
  return { label: "Active", color: "text-green-400 bg-green-400/10" };
}

export default function OrganizerPromoManager({ event, ticketTypes = [] }) {
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(null);

  const eventId = event?.id;
  const eventTitle = event?.title || "";

  useEffect(() => {
    if (!eventId) return;
    base44.entities.PromoCode.filter({ event_id: eventId }, "-created_date", 100)
      .then(setPromoCodes)
      .finally(() => setLoading(false));
  }, [eventId]);

  const promoLink = (code) => getAppUrl(`/events/${eventId}?promo=${encodeURIComponent(code)}`);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied!");
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (promo) => {
    setEditingId(promo.id);
    // Ensure discount_value is always stored as a string for the form.
    // Use explicit Number-to-string to avoid 0 → "" bug or null → "null" bug.
    const rawVal = promo.discount_value;
    const discountStr = (rawVal !== null && rawVal !== undefined) ? String(rawVal) : "";
    setForm({
      code: promo.code || "",
      discount_type: promo.discount_type || "percentage",
      discount_value: discountStr,
      max_uses: promo.max_uses != null ? String(promo.max_uses) : "",
      valid_from: promo.valid_from ? new Date(promo.valid_from).toISOString().slice(0, 16) : "",
      valid_until: promo.valid_until ? new Date(promo.valid_until).toISOString().slice(0, 16) : "",
      status: promo.status || "active",
      tier_id: promo.tier_id || "",
      tier_name: promo.tier_name || "",
    });
    setErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const handleSave = async () => {
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    // Check duplicate code (for new promos)
    if (!editingId) {
      const existing = promoCodes.find(p => p.code === form.code.toUpperCase() && p.id !== editingId);
      if (existing) { setErrors({ code: "This code already exists for this event" }); return; }
    }

    setSaving(true);
    const payload = {
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      status: form.status,
      tier_id: form.tier_id || null,
      tier_name: form.tier_name || null,
      event_id: eventId,
      times_used: editingId ? undefined : 0,
    };

    try {
      if (editingId) {
        const updated = await base44.entities.PromoCode.update(editingId, payload);
        setPromoCodes(prev => prev.map(p => p.id === editingId ? { ...p, ...updated } : p));
        toast.success("Promo code updated");
      } else {
        const created = await base44.entities.PromoCode.create(payload);
        setPromoCodes(prev => [created, ...prev]);
        toast.success(`Promo code "${created.code}" created! Link ready to share.`);
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (promo) => {
    const newStatus = promo.status === "active" ? "disabled" : "active";
    await base44.entities.PromoCode.update(promo.id, { status: newStatus });
    setPromoCodes(prev => prev.map(p => p.id === promo.id ? { ...p, status: newStatus } : p));
    toast.success(newStatus === "active" ? "Promo code activated" : "Promo code disabled");
  };

  const handleDelete = async (promoId) => {
    if (!confirm("Delete this promo code? This cannot be undone.")) return;
    await base44.entities.PromoCode.delete(promoId);
    setPromoCodes(prev => prev.filter(p => p.id !== promoId));
    toast.success("Promo code deleted");
  };

  const updateField = (field, value) => {
    const cleaned = field === "code" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "") : value;
    setForm(f => ({ ...f, [field]: cleaned }));
    if (errors[field]) setErrors(e => { const c = { ...e }; delete c[field]; return c; });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-yellow-400" />
          <h2 className="font-display font-bold text-lg">PROMO CODES</h2>
          {promoCodes.length > 0 && (
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400">
              {promoCodes.length}
            </span>
          )}
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5 font-mono font-bold">
          <Plus className="w-3.5 h-3.5" /> Add Code
        </Button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="p-4 rounded-xl bg-card border border-yellow-600/40 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-display font-bold text-sm text-yellow-400">
              {editingId ? "Edit Promo Code" : "New Promo Code"}
            </p>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] font-mono font-bold text-foreground">Code *</Label>
              <Input
                value={form.code}
                onChange={e => updateField("code", e.target.value)}
                placeholder="SUMMER25"
                maxLength={30}
                className={`mt-1 bg-secondary border-yellow-600/40 font-mono uppercase text-sm ${errors.code ? "border-destructive" : ""}`}
              />
              {errors.code && <p className="text-[10px] text-destructive mt-0.5">{errors.code}</p>}
            </div>
            <div>
              <Label className="text-[10px] font-mono font-bold text-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => updateField("status", v)}>
                <SelectTrigger className="mt-1 bg-secondary border-yellow-600/40 text-sm">
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
                <SelectTrigger className="mt-1 bg-secondary border-yellow-600/40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
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
                className={`mt-1 bg-secondary border-yellow-600/40 text-sm ${errors.discount_value ? "border-destructive" : ""}`}
              />
              {errors.discount_value && <p className="text-[10px] text-destructive mt-0.5">{errors.discount_value}</p>}
            </div>
          </div>

          <div>
            <Label className="text-[10px] font-mono font-bold text-foreground">Usage Limit</Label>
            <Input
              type="number"
              value={form.max_uses}
              onChange={e => updateField("max_uses", e.target.value)}
              placeholder="Unlimited"
              className={`mt-1 bg-secondary border-yellow-600/40 text-sm ${errors.max_uses ? "border-destructive" : ""}`}
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
                className="mt-1 bg-secondary border-yellow-600/40 text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px] font-mono font-bold text-foreground">Expiry Date</Label>
              <Input
                type="datetime-local"
                value={form.valid_until}
                onChange={e => updateField("valid_until", e.target.value)}
                className={`mt-1 bg-secondary border-yellow-600/40 text-sm ${errors.valid_until ? "border-destructive" : ""}`}
              />
              {errors.valid_until && <p className="text-[10px] text-destructive mt-0.5">{errors.valid_until}</p>}
            </div>
          </div>

          {ticketTypes.length > 0 && (
            <div>
              <Label className="text-[10px] font-mono font-bold text-foreground">Applicable Ticket Type (optional)</Label>
              <Select
                value={form.tier_id || "all"}
                onValueChange={v => {
                  if (v === "all") { updateField("tier_id", ""); updateField("tier_name", ""); }
                  else {
                    const tt = ticketTypes.find(t => t.id === v);
                    updateField("tier_id", v);
                    updateField("tier_name", tt?.name || "");
                  }
                }}
              >
                <SelectTrigger className="mt-1 bg-secondary border-yellow-600/40 text-sm">
                  <SelectValue placeholder="All ticket types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ticket types</SelectItem>
                  {ticketTypes.filter(t => t.name).map(tt => (
                    <SelectItem key={tt.id} value={tt.id}>{tt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 font-display font-bold bg-yellow-600 hover:bg-yellow-500 text-black gap-2"
            >
              {saving
                ? <><span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin inline-block" /> Saving...</>
                : editingId
                  ? "Update Promo Code"
                  : "Add Promo Code"}
            </Button>
            <Button variant="outline" onClick={closeForm} className="font-mono">Cancel</Button>
          </div>
        </div>
      )}

      {/* Promo List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : promoCodes.length === 0 ? (
        <div className="p-6 rounded-xl bg-card border border-border/50 text-center text-muted-foreground text-sm">
          <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No promo codes yet for this event.</p>
          <button onClick={openCreate} className="text-primary text-sm font-mono mt-1 hover:underline">Add your first promo code →</button>
        </div>
      ) : (
        <div className="space-y-3">
          {promoCodes.map(promo => {
            const statusInfo = getPromoStatus(promo);
            const usedCount = promo.times_used || 0;
            const remaining = promo.max_uses ? promo.max_uses - usedCount : null;
            const link = promoLink(promo.code);

            return (
              <div key={promo.id} className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
                {/* Top row: code + status + actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-base text-foreground">{promo.code}</span>
                    <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Toggle status */}
                    <button
                      onClick={() => handleToggleStatus(promo)}
                      title={promo.status === "active" ? "Disable" : "Activate"}
                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {promo.status === "active"
                        ? <ToggleRight className="w-4 h-4 text-green-400" />
                        : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(promo)}
                      className="p-1.5 rounded hover:bg-muted transition-colors text-accent"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(promo.id)}
                      className="p-1.5 rounded hover:bg-muted transition-colors text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Discount info row */}
                <div className="flex flex-wrap gap-3 text-xs font-mono text-muted-foreground">
                  <span className="text-foreground font-bold">
                    {promo.discount_type === "percentage"
                      ? `${promo.discount_value}% off`
                      : `$${promo.discount_value} off`}
                    {promo.tier_name ? ` · ${promo.tier_name}` : " · All tickets"}
                  </span>
                  <span>Used: {usedCount}{promo.max_uses ? `/${promo.max_uses}` : ""}</span>
                  {remaining !== null && <span className={remaining <= 0 ? "text-destructive" : remaining <= 5 ? "text-orange-400" : "text-muted-foreground"}>
                    Remaining: {Math.max(0, remaining)}
                  </span>}
                  {promo.valid_until && (
                    <span className={new Date(promo.valid_until) < new Date() ? "text-destructive" : ""}>
                      Expires: {format(new Date(promo.valid_until), "MMM d, yyyy")}
                    </span>
                  )}
                </div>

                {/* Promo link */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/60 border border-border/40">
                  <Link className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{link}</span>
                  <button
                    onClick={() => copyToClipboard(link, `link-${promo.id}`)}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold hover:bg-primary/20 transition-colors"
                  >
                    {copied === `link-${promo.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === `link-${promo.id}` ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}