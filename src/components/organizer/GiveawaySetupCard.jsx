import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Trash2, Save, Pencil, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function GiveawaySetupCard({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const enabled = !!value;

  useEffect(() => {
    base44.auth.me().then(u => {
      setCurrentUser(u);
      if (u) {
        base44.entities.SavedRewardTemplate.filter({ organizer_id: u.id }, "-created_date", 50)
          .then(setSavedTemplates).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const update = (field, val) => onChange({ ...(value || defaultGiveaway()), [field]: val });

  const defaultGiveaway = () => ({
    title: "",
    reward_name: "",
    reward_description: "",
    reward_value: "",
    total_quantity: "",
    eligibility_action: "other",
    eligibility_notes: "",
    collection_instructions: "",
    start_datetime: "",
    end_datetime: "",
  });

  const toggle = () => {
    if (enabled) {
      onChange(null);
      setOpen(false);
    } else {
      onChange(defaultGiveaway());
      setOpen(true);
    }
  };

  const handleSaveTemplate = async () => {
    if (!currentUser || !value?.reward_name?.trim()) {
      toast.error("Enter a reward name before saving.");
      return;
    }
    setSavingTemplate(true);
    try {
      const t = await base44.entities.SavedRewardTemplate.create({
        organizer_id: currentUser.id,
        organizer_email: currentUser.email,
        reward_name: value.reward_name.trim(),
        reward_description: value.reward_description?.trim() || "",
        redemption_instructions: value.collection_instructions?.trim() || "",
        reward_value: value.reward_value === "" || value.reward_value == null ? undefined : Number(value.reward_value),
      });
      setSavedTemplates(prev => [t, ...prev]);
      toast.success("Reward saved for future use!");
    } catch {
      toast.error("Failed to save reward template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    await base44.entities.SavedRewardTemplate.delete(id).catch(() => {});
    setSavedTemplates(prev => prev.filter(t => t.id !== id));
    toast.success("Saved reward deleted");
  };

  const startEditTemplate = (t) => {
    setEditingTemplateId(t.id);
    setEditForm({
      reward_name: t.reward_name || "",
      reward_description: t.reward_description || "",
      redemption_instructions: t.redemption_instructions || "",
      reward_value: t.reward_value ?? "",
    });
  };

  const cancelEditTemplate = () => { setEditingTemplateId(null); setEditForm({}); };

  const saveEditTemplate = async (id) => {
    if (!editForm.reward_name?.trim()) { toast.error("Reward name is required."); return; }
    const updated = await base44.entities.SavedRewardTemplate.update(id, {
      reward_name: editForm.reward_name.trim(),
      reward_description: editForm.reward_description?.trim() || "",
      redemption_instructions: editForm.redemption_instructions?.trim() || "",
      reward_value: editForm.reward_value === "" ? undefined : Number(editForm.reward_value),
    }).catch(() => null);
    if (updated) {
      setSavedTemplates(prev => prev.map(t => t.id === id ? updated : t));
      toast.success("Saved reward updated");
    }
    cancelEditTemplate();
  };

  const handleSelectTemplate = (templateId) => {
    const t = savedTemplates.find(s => s.id === templateId);
    if (!t) return;
    onChange({
      ...(value || defaultGiveaway()),
      reward_name: t.reward_name || "",
      reward_description: t.reward_description || "",
      collection_instructions: t.redemption_instructions || "",
      eligibility_notes: t.redemption_instructions || "",
      reward_value: t.reward_value ?? "",
    });
  };

  return (
    <div className="rounded-xl bg-card border-2 border-primary/30 overflow-hidden shadow-lg shadow-primary/10">
      <button type="button" onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-lg">🎁</span>
          <div className="text-left">
            <p className="font-display font-bold text-sm text-foreground">Giveaway — First to Claim</p>
            <p className="text-xs text-muted-foreground font-mono">First eligible users receive the reward until quantity runs out</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${enabled ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
            {enabled ? "ENABLED" : "OFF"}
          </span>
          {enabled
            ? (open ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />)
            : <ChevronDown className="w-4 h-4 text-primary" />}
        </div>
      </button>

      {enabled && (
        <button type="button" onClick={() => setOpen(v => !v)}
          className="w-full text-[10px] font-mono text-primary/70 py-1 hover:text-primary transition-colors border-t border-primary/20 bg-primary/5">
          {open ? "▲ Hide settings" : "▼ Edit giveaway settings"}
        </button>
      )}

      {enabled && open && (
        <div className="px-4 pb-4 pt-3 space-y-4 border-t-2 border-primary/20 bg-primary/5">
          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/30 text-[10px] font-mono text-primary leading-relaxed">
            🎁 <strong>Giveaway:</strong> The <strong>first eligible users</strong> to complete your required action receive the reward automatically — until the available quantity is exhausted. No random draw.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Giveaway Title */}
            <div className="sm:col-span-2">
              <Label className="text-xs text-foreground font-mono font-bold">Giveaway Title *</Label>
              <Input value={value.title} onChange={e => update("title", e.target.value)}
                placeholder="e.g. Free T-Shirt for First 10 Ticket Buyers" className="mt-1 bg-card border border-border/50" />
            </div>

            {/* Use saved reward dropdown */}
            {savedTemplates.length > 0 && (
              <div className="sm:col-span-2">
                <Label className="text-xs text-foreground font-mono font-bold">Use Saved Reward</Label>
                <Select onValueChange={handleSelectTemplate}>
                  <SelectTrigger className="mt-1 bg-card border border-border/50">
                    <SelectValue placeholder="Select a previously saved reward…" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.reward_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Reward Name */}
            <div className="sm:col-span-2">
              <Label className="text-xs text-foreground font-mono font-bold">Reward Name / Prize Title *</Label>
              <Input value={value.reward_name} onChange={e => update("reward_name", e.target.value)}
                placeholder="e.g. Event T-Shirt, Free Drink, VIP Upgrade" className="mt-1 bg-card border border-border/50" />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <Label className="text-xs text-foreground font-mono font-bold">Description</Label>
              <textarea value={value.reward_description} onChange={e => update("reward_description", e.target.value)}
                rows={2} placeholder="Describe the reward..."
                className="mt-1 w-full rounded-md bg-card border border-border/50 px-3 py-2 text-sm text-foreground" />
            </div>

            {/* Optional value */}
            <div>
              <Label className="text-xs text-foreground font-mono font-bold">Value (Optional)</Label>
              <Input
                type="text" inputMode="decimal"
                value={value.reward_value}
                onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) update("reward_value", e.target.value); }}
                placeholder="e.g. 25"
                className="mt-1 bg-card border border-border/50"
              />
            </div>

            {/* Quantity */}
            <div>
              <Label className="text-xs text-foreground font-mono font-bold">Reward Quantity *</Label>
              <Input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={value.total_quantity}
                onChange={e => { if (/^\d*$/.test(e.target.value)) update("total_quantity", e.target.value === "" ? "" : Number(e.target.value)); }}
                placeholder="e.g. 10"
                className="mt-1 bg-card border border-border/50"
              />
            </div>

            {/* Redemption instructions */}
            <div className="sm:col-span-2">
              <Label className="text-xs text-foreground font-mono font-bold">Redemption Instructions</Label>
              <textarea
                value={value.collection_instructions}
                onChange={e => { update("collection_instructions", e.target.value); update("eligibility_notes", e.target.value); }}
                rows={2}
                placeholder="e.g. Must purchase a ticket before the giveaway ends. Show confirmation email at merch desk."
                className="mt-1 w-full rounded-md bg-card border border-border/50 px-3 py-2 text-sm text-foreground"
              />
            </div>

            {/* Save this reward for future use */}
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !value?.reward_name?.trim()}
                className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10 h-8"
              >
                <Save className="w-3.5 h-3.5" />
                {savingTemplate ? "Saving…" : "Save this reward for future use"}
              </Button>
            </div>

            <div>
              <Label className="text-xs text-foreground font-mono font-bold">Giveaway Starts</Label>
              <input type="datetime-local" value={value.start_datetime} onChange={e => update("start_datetime", e.target.value)}
                style={{ WebkitAppearance: "none", appearance: "none" }}
                className="mt-1 h-9 w-full rounded-md border border-border/50 bg-card px-3 text-sm text-foreground" />
            </div>
            <div>
              <Label className="text-xs text-foreground font-mono font-bold">Giveaway Ends</Label>
              <input type="datetime-local" value={value.end_datetime} onChange={e => update("end_datetime", e.target.value)}
                style={{ WebkitAppearance: "none", appearance: "none" }}
                className="mt-1 h-9 w-full rounded-md border border-border/50 bg-card px-3 text-sm text-foreground" />
            </div>
          </div>

          {/* Manage saved reward templates */}
          {savedTemplates.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-primary/20">
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">Manage saved rewards</p>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {savedTemplates.map(t => (
                  <div key={t.id} className="p-2.5 rounded-lg bg-card border border-border/50">
                    {editingTemplateId === t.id ? (
                      <div className="space-y-1.5">
                        <Input value={editForm.reward_name} onChange={e => setEditForm(f => ({ ...f, reward_name: e.target.value }))}
                          placeholder="Reward name" className="h-8 text-xs bg-secondary border-border/50" />
                        <Input value={editForm.reward_description} onChange={e => setEditForm(f => ({ ...f, reward_description: e.target.value }))}
                          placeholder="Description" className="h-8 text-xs bg-secondary border-border/50" />
                        <Input value={editForm.redemption_instructions} onChange={e => setEditForm(f => ({ ...f, redemption_instructions: e.target.value }))}
                          placeholder="Redemption instructions" className="h-8 text-xs bg-secondary border-border/50" />
                        <Input
                          type="text" inputMode="decimal"
                          value={editForm.reward_value}
                          onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setEditForm(f => ({ ...f, reward_value: e.target.value })); }}
                          placeholder="Value (optional)" className="h-8 text-xs bg-secondary border-border/50" />
                        <div className="flex gap-2 justify-end">
                          <button type="button" onClick={cancelEditTemplate} className="p-1.5 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => saveEditTemplate(t.id)} className="p-1.5 text-primary hover:text-primary/80"><Check className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{t.reward_name}</p>
                          {t.reward_description && <p className="text-[10px] text-muted-foreground truncate">{t.reward_description}</p>}
                        </div>
                        <button type="button" onClick={() => startEditTemplate(t)} className="shrink-0 p-1 text-muted-foreground hover:text-primary transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteTemplate(t.id)} className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground font-mono">Giveaway will be created and linked to this event on publish. Claims are first-come-first-served.</p>
        </div>
      )}
    </div>
  );
}