import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

const EMPTY_FORM = {
  code: "",
  discount_type: "percentage",
  discount_value: 10,
  tier_id: "",
  tier_name: "",
  max_uses: -1,
  valid_until: "",
  description: "",
};

export default function PromoCodeManager() {
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null); // null = create mode, object = edit mode
  const [copied, setCopied] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    base44.asServiceRole.entities.PromoCode.filter({}, "-created_date", 100).then((codes) => {
      setPromoCodes(codes);
      setLoading(false);
    });
  }, []);

  const openCreate = () => {
    setEditingPromo(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (promo) => {
    setEditingPromo(promo);
    setFormData({
      code: promo.code || "",
      discount_type: promo.discount_type || "percentage",
      discount_value: promo.discount_value ?? 10,
      tier_id: promo.tier_id || "",
      tier_name: promo.tier_name || "",
      max_uses: promo.max_uses ?? -1,
      valid_until: promo.valid_until
        ? new Date(promo.valid_until).toISOString().slice(0, 16)
        : "",
      description: promo.description || "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPromo(null);
    setFormData(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.tier_id) {
      toast.error("Fill all required fields");
      return;
    }
    setSaving(true);

    if (editingPromo) {
      // Edit existing
      const updated = await base44.asServiceRole.entities.PromoCode.update(editingPromo.id, {
        code: formData.code.toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        tier_id: formData.tier_id,
        tier_name: formData.tier_name,
        max_uses: formData.max_uses === -1 ? null : formData.max_uses,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
        description: formData.description,
      });
      setPromoCodes((prev) => prev.map((p) => p.id === editingPromo.id ? { ...p, ...updated } : p));
      toast.success("Promo code updated");
    } else {
      // Create new
      const res = await base44.functions.invoke("adminCreatePromoCode", {
        code: formData.code,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        tier_id: formData.tier_id,
        tier_name: formData.tier_name,
        max_uses: formData.max_uses === -1 ? null : formData.max_uses,
        valid_until: formData.valid_until || null,
        description: formData.description,
      });
      if (res.data.success) {
        setPromoCodes((prev) => [res.data.promo_code, ...prev]);
        toast.success("Promo code created");
      }
    }

    setSaving(false);
    closeForm();
  };

  const handleDelete = async (promoId) => {
    if (!confirm("Delete this promo code?")) return;
    await base44.asServiceRole.entities.PromoCode.delete(promoId);
    setPromoCodes((prev) => prev.filter((p) => p.id !== promoId));
    toast.success("Promo code deleted");
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-lg">Promo Codes</h2>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Create Code
        </Button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="p-6 rounded-xl bg-card border border-border/50 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-display font-bold text-sm">
              {editingPromo ? `Editing: ${editingPromo.code}` : "New Promo Code"}
            </p>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Code (e.g., SUMMER20)"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
            />
            <select
              value={formData.discount_type}
              onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
              className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
            >
              <option value="percentage">Percentage Off</option>
              <option value="fixed_amount">Fixed Amount</option>
              <option value="free">Free Membership</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {formData.discount_type !== "free" && (
              <input
                type="number"
                placeholder={formData.discount_type === "percentage" ? "Discount %" : "Discount $"}
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
              />
            )}
            <input
              type="text"
              placeholder="Tier ID"
              value={formData.tier_id}
              onChange={(e) => setFormData({ ...formData, tier_id: e.target.value })}
              className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
            />
            <input
              type="text"
              placeholder="Tier Name"
              value={formData.tier_name}
              onChange={(e) => setFormData({ ...formData, tier_name: e.target.value })}
              className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
            />
            <input
              type="number"
              placeholder="Max Uses (-1 for unlimited)"
              value={formData.max_uses}
              onChange={(e) => setFormData({ ...formData, max_uses: parseInt(e.target.value) })}
              className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
            />
          </div>

          <input
            type="datetime-local"
            value={formData.valid_until}
            onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
          />

          <textarea
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm resize-none"
          />

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 font-display font-bold">
              {saving ? "Saving..." : editingPromo ? "Save Changes" : "Create Promo Code"}
            </Button>
            <Button variant="outline" onClick={closeForm} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {promoCodes.length === 0 ? (
        <div className="p-6 rounded-xl bg-card border border-border/50 text-center text-muted-foreground text-sm">
          No promo codes yet
        </div>
      ) : (
        <div className="space-y-3">
          {promoCodes.map((promo) => (
            <div key={promo.id} className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-display font-bold font-mono text-lg">{promo.code}</p>
                  <button
                    onClick={() => handleCopy(promo.code)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                    title="Copy code"
                  >
                    {copied === promo.code ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {promo.discount_type === "free"
                    ? "Free membership"
                    : promo.discount_type === "percentage"
                    ? `${promo.discount_value}% off`
                    : `$${promo.discount_value} off`}{" "}
                  • {promo.tier_name}
                </p>
                {promo.description && <p className="text-xs text-muted-foreground mt-1">{promo.description}</p>}
                <div className="flex flex-wrap gap-2 mt-2 text-xs font-mono text-muted-foreground">
                  <span>Uses: {promo.times_used}{promo.max_uses > 0 ? `/${promo.max_uses}` : ""}</span>
                  {promo.valid_until && <span>• Expires: {format(new Date(promo.valid_until), "MMM dd")}</span>}
                  <span className={promo.is_active ? "text-green-400" : "text-destructive"}>
                    {promo.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <Button
                  onClick={() => openEdit(promo)}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-accent/40 text-accent hover:bg-accent/10"
                  title="Edit promo code"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button
                  onClick={() => handleDelete(promo.id)}
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  title="Delete promo code"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}