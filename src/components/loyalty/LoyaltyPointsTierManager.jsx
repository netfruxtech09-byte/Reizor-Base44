import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TicketTypeSelector from "@/components/organizer/TicketTypeSelector";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const REWARD_TYPES = ["free_drink", "free_entry", "merchandise", "free_ticket", "discount", "credit", "custom"];

export default function LoyaltyPointsTierManager({ ownerType, ownerId, ownerName, ownerEmail }) {
  const [tiers, setTiers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const load = () => {
    base44.entities.LoyaltyRewardTier.filter({ owner_type: ownerType, owner_id: ownerId }, "points_required", 100)
      .then(setTiers).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [ownerType, ownerId]);

  // Only Organizers can link a Free Ticket reward to one of their real events
  useEffect(() => {
    if (ownerType !== "organizer" || !ownerId) return;
    base44.entities.Event.filter({ organizer_id: ownerId }, "-date", 100).then(setEvents).catch(() => setEvents([]));
  }, [ownerType, ownerId]);

  const addTier = () => {
    setTiers(prev => [...prev, {
      id: null, tier_name: "", points_required: "", reward_type: "custom", reward_title: "",
      reward_description: "", redemption_instructions: "", ticket_max_value: "",
      ticket_event_id: "", ticket_event_title: "", ticket_type_id: "", ticket_type_name: "",
      is_repeatable: false, is_active: true,
    }]);
  };

  const updateTier = (idx, field, value) => {
    setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const saveTier = async (idx) => {
    const t = tiers[idx];
    if (!t.tier_name.trim() || !t.points_required || !t.reward_title.trim()) {
      toast.error("Tier name, required points, and reward title are required.");
      return;
    }

    // Validate the selected ticket type doesn't exceed the configured max value
    if (t.reward_type === "free_ticket" && t.ticket_type_id && t.ticket_max_value) {
      const types = await base44.entities.TicketType.filter({ id: t.ticket_type_id }, null, 1).catch(() => []);
      const price = types[0]?.price || 0;
      if (price > Number(t.ticket_max_value)) {
        toast.error(`Selected ticket type ($${price}) exceeds the max value ($${t.ticket_max_value}).`);
        return;
      }
    }

    setSaving(idx);
    const payload = {
      owner_type: ownerType, owner_id: ownerId, owner_name: ownerName, owner_email: ownerEmail,
      tier_name: t.tier_name, points_required: Number(t.points_required), reward_type: t.reward_type,
      reward_title: t.reward_title, reward_description: t.reward_description || "",
      redemption_instructions: t.redemption_instructions || "",
      ticket_max_value: t.ticket_max_value ? Number(t.ticket_max_value) : 0,
      ticket_event_id: t.reward_type === "free_ticket" ? (t.ticket_event_id || "") : "",
      ticket_event_title: t.reward_type === "free_ticket" ? (t.ticket_event_title || "") : "",
      ticket_type_id: t.reward_type === "free_ticket" ? (t.ticket_type_id || "") : "",
      ticket_type_name: t.reward_type === "free_ticket" ? (t.ticket_type_name || "") : "",
      is_repeatable: !!t.is_repeatable, is_active: !!t.is_active,
    };
    if (t.id) {
      await base44.entities.LoyaltyRewardTier.update(t.id, payload);
    } else {
      const created = await base44.entities.LoyaltyRewardTier.create(payload);
      updateTier(idx, "id", created.id);
    }
    toast.success("Tier saved!");
    setSaving(null);
  };

  const removeTier = async (idx) => {
    const t = tiers[idx];
    if (t.id) await base44.entities.LoyaltyRewardTier.delete(t.id).catch(() => {});
    setTiers(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleActive = async (idx) => {
    const t = tiers[idx];
    if (!t.id) return;
    if (t.deactivated_by && !t.is_active) {
      toast.error("This tier was deactivated by Admin. Contact Admin to reactivate it.");
      return;
    }
    await base44.entities.LoyaltyRewardTier.update(t.id, { is_active: !t.is_active });
    updateTier(idx, "is_active", !t.is_active);
  };

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Create your own reward tiers at any points threshold. Fans earn points through standard actions and unlock rewards automatically.
      </p>
      {tiers.map((t, idx) => (
        <div key={t.id || idx} className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Tier Name *</Label>
              <Input value={t.tier_name} onChange={e => updateTier(idx, "tier_name", e.target.value)} placeholder="e.g. Free Drink" className="mt-1 bg-secondary border-border/50" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Required Points *</Label>
              <Input type="number" value={t.points_required} onChange={e => updateTier(idx, "points_required", e.target.value)} placeholder="e.g. 75" className="mt-1 bg-secondary border-border/50" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Reward Title *</Label>
              <Input value={t.reward_title} onChange={e => updateTier(idx, "reward_title", e.target.value)} placeholder="e.g. Free Drink" className="mt-1 bg-secondary border-border/50" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Reward Type</Label>
              <Select value={t.reward_type} onValueChange={v => updateTier(idx, "reward_type", v)}>
                <SelectTrigger className="mt-1 bg-secondary border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REWARD_TYPES.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {t.reward_type === "free_ticket" && (
            <div className="p-3 rounded-lg bg-secondary/60 border border-border/40 space-y-3">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Ticket Max Value ($)</Label>
                <Input type="number" value={t.ticket_max_value} onChange={e => updateTier(idx, "ticket_max_value", e.target.value)} placeholder="e.g. 50" className="mt-1 bg-card border-border/50" />
                <p className="text-[10px] text-muted-foreground mt-1">A ticket type priced above this amount won't be auto-issued.</p>
              </div>
              {ownerType === "organizer" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-mono text-muted-foreground">Select Event</Label>
                    <Select
                      value={t.ticket_event_id || ""}
                      onValueChange={(v) => {
                        updateTier(idx, "ticket_event_id", v);
                        const ev = events.find(e => e.id === v);
                        updateTier(idx, "ticket_event_title", ev?.title || "");
                        updateTier(idx, "ticket_type_id", "");
                        updateTier(idx, "ticket_type_name", "");
                      }}
                    >
                      <SelectTrigger className="mt-1 bg-card border-border/50">
                        <SelectValue placeholder="Choose event..." />
                      </SelectTrigger>
                      <SelectContent>
                        {events.map(ev => <SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-mono text-muted-foreground">Ticket Type</Label>
                    <TicketTypeSelector
                      eventId={t.ticket_event_id}
                      value={t.ticket_type_id || ""}
                      onChange={(typeId, typeName) => {
                        updateTier(idx, "ticket_type_id", typeId);
                        updateTier(idx, "ticket_type_name", typeName);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ticket auto-issue is only available for Organizer tiers. This reward will be delivered as a redemption code in My Prizes.
                </p>
              )}
            </div>
          )}
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Reward Description</Label>
            <Input value={t.reward_description} onChange={e => updateTier(idx, "reward_description", e.target.value)} placeholder="What the fan receives" className="mt-1 bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Redemption Instructions</Label>
            <Input value={t.redemption_instructions} onChange={e => updateTier(idx, "redemption_instructions", e.target.value)} placeholder="How the fan redeems this reward" className="mt-1 bg-secondary border-border/50" />
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <input type="checkbox" checked={!!t.is_repeatable} onChange={e => updateTier(idx, "is_repeatable", e.target.checked)} />
              Repeatable reward
            </label>
            <div className="flex flex-wrap gap-2">
              {t.id && (
                <Button size="sm" variant="outline" onClick={() => toggleActive(idx)} disabled={!!t.deactivated_by && !t.is_active} className="gap-1.5">
                  <Power className="w-3.5 h-3.5" /> {t.is_active ? "Deactivate" : (t.deactivated_by ? "Deactivated by Admin" : "Reactivate")}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => removeTier(idx)} className="gap-1.5 border-destructive/40 text-destructive">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
              <Button size="sm" onClick={() => saveTier(idx)} disabled={saving === idx} className="gap-1.5 glow-lime font-display font-bold">
                <Save className="w-3.5 h-3.5" /> {saving === idx ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={addTier} className="gap-2">
        <Plus className="w-3.5 h-3.5" /> Add Tier
      </Button>
    </div>
  );
}