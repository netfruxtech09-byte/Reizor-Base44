import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Trash2, Save, Pencil, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function RaffleSetupCard({ value, onChange }) {
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

  const update = (field, val) => onChange({ ...(value || defaultRaffle()), [field]: val });

  const defaultRaffle = () => ({
    title: "",
    prize_name: "",
    prize_description: "",
    num_winners: 1,
    eligibility_action: "other",
    eligibility_notes: "",
    prize_collection_instructions: "",
    start_datetime: "",
    close_datetime: "",
    draw_datetime: "",
  });

  const handleSaveTemplate = async () => {
    if (!currentUser || !value?.prize_name?.trim()) {
      toast.error("Enter a prize/reward name before saving.");
      return;
    }
    setSavingTemplate(true);
    try {
      const t = await base44.entities.SavedRewardTemplate.create({
        organizer_id: currentUser.id,
        organizer_email: currentUser.email,
        reward_name: value.prize_name.trim(),
        reward_description: value.prize_description?.trim() || "",
        redemption_instructions: value.prize_collection_instructions?.trim() || "",
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
    });
  };

  const cancelEditTemplate = () => { setEditingTemplateId(null); setEditForm({}); };

  const saveEditTemplate = async (id) => {
    if (!editForm.reward_name?.trim()) { toast.error("Reward name is required."); return; }
    const updated = await base44.entities.SavedRewardTemplate.update(id, {
      reward_name: editForm.reward_name.trim(),
      reward_description: editForm.reward_description?.trim() || "",
      redemption_instructions: editForm.redemption_instructions?.trim() || "",
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
      ...(value || defaultRaffle()),
      prize_name: t.reward_name || "",
      prize_description: t.reward_description || "",
      prize_collection_instructions: t.redemption_instructions || "",
    });
  };

  const toggle = () => {
    if (enabled) {
      onChange(null);
      setOpen(false);
    } else {
      onChange(defaultRaffle());
      setOpen(true);
    }
  };

  return (
    <div className="rounded-xl bg-orange-500/10 border-2 border-orange-500/40 overflow-hidden shadow-lg shadow-orange-500/10">
      <button type="button" onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-500/15 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-lg">🎲</span>
          <div className="text-left">
            <p className="font-display font-bold text-sm text-foreground">Raffle — Random Draw</p>
            <p className="text-xs text-muted-foreground font-mono">All eligible users enter a pool; winners are selected randomly</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${enabled ? "bg-orange-500 text-white" : "bg-orange-500/20 text-orange-400"}`}>
            {enabled ? "ENABLED" : "OFF"}
          </span>
          {enabled
            ? (open ? <ChevronUp className="w-4 h-4 text-orange-400" /> : <ChevronDown className="w-4 h-4 text-orange-400" />)
            : <ChevronDown className="w-4 h-4 text-orange-400" />}
        </div>
      </button>

      {enabled && (
        <button type="button" onClick={() => setOpen(v => !v)}
          className="w-full text-[10px] font-mono text-orange-400/70 py-1 hover:text-orange-400 transition-colors border-t border-orange-500/20 bg-orange-500/5">
          {open ? "▲ Hide settings" : "▼ Edit raffle settings"}
        </button>
      )}

      {enabled && open && (
        <div className="px-4 pb-4 pt-3 space-y-4 border-t-2 border-orange-500/30 bg-orange-500/5">
          {/* Key difference banner */}
          <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-[10px] font-mono text-orange-300 leading-relaxed">
            🎲 <strong>Raffle:</strong> All eligible users enter the pool. Winners are selected <strong>randomly</strong> after the raffle closes — not on a first-come-first-served basis.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-xs text-foreground font-mono font-bold">Raffle Title *</Label>
              <Input value={value.title} onChange={e => update("title", e.target.value)}
                placeholder="e.g. VIP Upgrade Draw" className="mt-1 bg-card border border-orange-500/30" />
            </div>
            {savedTemplates.length > 0 && (
              <div className="sm:col-span-2">
                <Label className="text-xs text-foreground font-mono font-bold">Use Saved Reward</Label>
                <Select onValueChange={handleSelectTemplate}>
                  <SelectTrigger className="mt-1 bg-card border border-orange-500/30">
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
            <div>
              <Label className="text-xs text-foreground font-mono font-bold">Prize / Reward Name *</Label>
              <Input value={value.prize_name} onChange={e => update("prize_name", e.target.value)}
                placeholder="e.g. T-Shirt, Backstage Pass" className="mt-1 bg-card border border-orange-500/30" />
            </div>
            <div>
              <Label className="text-xs text-foreground font-mono font-bold">Number of Winners *</Label>
              <Input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={value.num_winners}
                onChange={e => { if (/^\d*$/.test(e.target.value)) update("num_winners", e.target.value === "" ? "" : Number(e.target.value)); }}
                placeholder="1"
                className="mt-1 bg-card border border-orange-500/30"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-foreground font-mono font-bold">Prize Description</Label>
              <textarea value={value.prize_description} onChange={e => update("prize_description", e.target.value)}
                rows={2} placeholder="Describe the prize..."
                className="mt-1 w-full rounded-md bg-card border border-orange-500/30 px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !value?.prize_name?.trim()}
                className="gap-1.5 text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10 h-8"
              >
                <Save className="w-3.5 h-3.5" />
                {savingTemplate ? "Saving…" : "Save this reward for future use"}
              </Button>
            </div>
            <div>
              <Label className="text-xs text-foreground font-mono font-bold">Entries Open</Label>
              <input type="datetime-local" value={value.start_datetime} onChange={e => update("start_datetime", e.target.value)}
                style={{ WebkitAppearance: "none", appearance: "none" }}
                className="mt-1 h-9 w-full rounded-md border border-orange-500/30 bg-card px-3 text-sm text-foreground" />
            </div>
            <div>
              <Label className="text-xs text-foreground font-mono font-bold">Entries Close</Label>
              <input type="datetime-local" value={value.close_datetime} onChange={e => update("close_datetime", e.target.value)}
                style={{ WebkitAppearance: "none", appearance: "none" }}
                className="mt-1 h-9 w-full rounded-md border border-orange-500/30 bg-card px-3 text-sm text-foreground" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-foreground font-mono font-bold">Winner Draw Date</Label>
              <input type="datetime-local" value={value.draw_datetime} onChange={e => update("draw_datetime", e.target.value)}
                style={{ WebkitAppearance: "none", appearance: "none" }}
                className="mt-1 h-9 w-full rounded-md border border-orange-500/30 bg-card px-3 text-sm text-foreground" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-foreground font-mono font-bold">Prize Collection Instructions</Label>
              <Input value={value.prize_collection_instructions} onChange={e => update("prize_collection_instructions", e.target.value)}
                placeholder="e.g. Collect from info desk at door with ID" className="mt-1 bg-card border border-orange-500/30" />
            </div>
          </div>
          {savedTemplates.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-orange-500/20">
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
                        <div className="flex gap-2 justify-end">
                          <button type="button" onClick={cancelEditTemplate} className="p-1.5 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => saveEditTemplate(t.id)} className="p-1.5 text-orange-400 hover:text-orange-300"><Check className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{t.reward_name}</p>
                          {t.reward_description && <p className="text-[10px] text-muted-foreground truncate">{t.reward_description}</p>}
                        </div>
                        <button type="button" onClick={() => startEditTemplate(t)} className="shrink-0 p-1 text-muted-foreground hover:text-orange-400 transition-colors" title="Edit">
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
          <p className="text-[10px] text-muted-foreground font-mono">Raffle will be created and linked to this event on publish. Winners drawn randomly after close date.</p>
        </div>
      )}
    </div>
  );
}