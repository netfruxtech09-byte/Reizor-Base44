import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, Gift, Calendar, Image, Upload, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import ActivityRequirementsSection from "./ActivityRequirementsSection";

// WHO can participate (access eligibility) — single-select, mutually exclusive.
const ACCESS_OPTIONS = [
  { key: "open_to_all", label: "Open to All Fans" },
  { key: "ticket_holders", label: "Ticket Holders Only" },
  { key: "followers", label: "Followers Only" },
  { key: "paid_members", label: "Paid Members Only" },
];

const PRESET_PRIZES = [
  { key: "free_drink", label: "Free Drink", defaultTitle: "Free Drink" },
  { key: "free_ticket", label: "Free Ticket", defaultTitle: "Free Event Ticket" },
  { key: "physical_item", label: "T-Shirt / Merchandise", defaultTitle: "T-Shirt" },
  { key: "wallet_credit", label: "Wallet Credit", defaultTitle: "Wallet Credit" },
];

const PRIZE_TYPES = [
  { key: "custom", label: "Custom Prize" },
  { key: "physical_item", label: "Physical Item (merch, T-shirt, etc.)" },
  { key: "wallet_credit", label: "Wallet / Reward Credit" },
  { key: "free_ticket", label: "Free Reizor Ticket" },
];

const WINNER_SELECTION = [
  { key: "random", label: "Random Draw" },
  { key: "manual", label: "Manual Selection" },
];

export default function GiveawayFormModal({ user, ownerType, editGiveaway, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    cover_image: "",
    giveaway_type: "community",
    linked_event_id: "",
    linked_event_title: "",
    num_winners: 1,
    start_date: "",
    end_date: "",
    winner_announcement_date: "",
    eligibility_rules: ["open_to_all"],
    entry_instructions: "",
    winner_selection: "random",
    prize_type: "custom",
    prize_description: "",
    prize_details: "",
    redemption_instructions: "",
    prize_quantity: 1,
    prize_value: "",
    terms_and_conditions: "",
    status: "draft",
  });
  const [events, setEvents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (editGiveaway) {
      setForm({
        title: editGiveaway.title || "",
        description: editGiveaway.description || "",
        cover_image: editGiveaway.cover_image || "",
        giveaway_type: editGiveaway.giveaway_type || "community",
        linked_event_id: editGiveaway.linked_event_id || "",
        linked_event_title: editGiveaway.linked_event_title || "",
        num_winners: editGiveaway.num_winners || 1,
        start_date: editGiveaway.start_date ? editGiveaway.start_date.slice(0, 16) : "",
        end_date: editGiveaway.end_date ? editGiveaway.end_date.slice(0, 16) : "",
        winner_announcement_date: editGiveaway.winner_announcement_date ? editGiveaway.winner_announcement_date.slice(0, 16) : "",
        eligibility_rules: editGiveaway.eligibility_rules || ["open_to_all"],
        entry_instructions: editGiveaway.entry_instructions || "",
        winner_selection: editGiveaway.winner_selection || "random",
        prize_type: editGiveaway.prize_type || "custom",
        prize_description: editGiveaway.prize_description || "",
        prize_details: editGiveaway.prize_details || "",
        redemption_instructions: editGiveaway.redemption_instructions || "",
        prize_quantity: editGiveaway.prize_quantity || 1,
        prize_value: editGiveaway.prize_value || "",
        terms_and_conditions: editGiveaway.terms_and_conditions || "",
        status: editGiveaway.status || "draft",
      });
    }

    // Load events for event-linked selection
    if (user) {
      const query = ownerType === "admin" ? {} : { owner_email: user.email };
      base44.entities.Event.filter({ organizer_id: user.id }, "-date", 50).catch(() => [])
        .then(evs => {
          if (evs.length === 0) {
            return base44.entities.Event.filter({ created_by_id: user.id }, "-date", 50).catch(() => []);
          }
          return evs;
        })
        .then(evs => setEvents(evs));
    }
  }, [editGiveaway, user]);

  const set = (key, val) => { setForm(p => ({ ...p, [key]: val })); setErrors(p => ({ ...p, [key]: "" })); };

  // Single-select: choosing any option replaces the previous selection entirely.
  const selectEligibility = (key) => {
    setForm(p => ({ ...p, eligibility_rules: [key] }));
    setErrors(p => ({ ...p, eligibility_rules: "" }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("cover_image", file_url);
    setUploadingImage(false);
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.end_date) e.end_date = "End date is required";
    if (!form.prize_description.trim()) {
      e.prize_description = form.prize_type === "custom"
        ? "Prize name is required for a custom prize."
        : "Prize title is required";
    }
    if (!form.prize_quantity || Number(form.prize_quantity) < 1) e.prize_quantity = "Must have at least 1 prize";
    if (form.start_date && form.end_date && new Date(form.start_date) >= new Date(form.end_date)) {
      e.end_date = "End date must be after start date";
    }
    if (form.giveaway_type === "event_linked" && !form.linked_event_id) e.linked_event_id = "Select an event";
    if ((form.eligibility_rules || []).length === 0) e.eligibility_rules = "Choose one eligibility option";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (status) => {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      ...form,
      num_winners: Number(form.num_winners) || 1,
      prize_quantity: Number(form.prize_quantity) || 1,
      prize_value: form.prize_value ? Number(form.prize_value) : null,
      status,
      owner_type: ownerType,
      owner_email: user.email,
      owner_name: user.full_name || user.email,
    };

    let giveawayId;
    if (editGiveaway) {
      await base44.entities.Giveaway.update(editGiveaway.id, payload);
      giveawayId = editGiveaway.id;
      toast.success("Giveaway updated!");
    } else {
      const created = await base44.entities.Giveaway.create(payload);
      giveawayId = created.id;
      toast.success(status === "active" ? "Giveaway published!" : "Giveaway saved as draft!");
    }

    // Fire announcement notifications when publishing as active
    // (only if not already sent — backend handles idempotency via announcement_sent_at)
    if (status === "active" && giveawayId) {
      const wasAlreadyActive = editGiveaway?.status === "active" && editGiveaway?.announcement_sent_at;
      if (!wasAlreadyActive) {
        base44.functions.invoke("notifyGiveawayAnnouncement", { giveaway_id: giveawayId }).catch(() => {});
      }
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 bg-black/60 overflow-y-auto">
      <div className="w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl my-4 sm:my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="font-display font-black text-xl flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            {editGiveaway ? "Edit Giveaway" : "Create Giveaway"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Giveaway Title *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Win 2 VIP Tickets to Future Bass Night" className="mt-1" />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Description</Label>
            <textarea
              value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Describe the giveaway..."
              className="mt-1 w-full px-3 py-2 rounded-md border border-white/25 bg-transparent text-sm resize-none h-20 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Cover image */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Cover Image</Label>
            <div className="mt-1 flex items-center gap-3">
              {form.cover_image && <img src={form.cover_image} alt="" className="w-16 h-16 rounded-lg object-cover border border-border/50" />}
              <label className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 text-sm hover:border-primary/40 transition-colors">
                {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadingImage ? "Uploading..." : "Upload Image"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
          </div>

          {/* Type */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Giveaway Type</Label>
            <div className="mt-1 flex gap-2">
              {[{ key: "community", label: "Community" }, { key: "event_linked", label: "Event-Linked" }].map(t => (
                <button key={t.key} type="button" onClick={() => set("giveaway_type", t.key)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${form.giveaway_type === t.key ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Event link */}
          {form.giveaway_type === "event_linked" && (
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Linked Event *</Label>
              <select value={form.linked_event_id}
                onChange={e => {
                  const ev = events.find(ev => ev.id === e.target.value);
                  set("linked_event_id", e.target.value);
                  set("linked_event_title", ev?.title || "");
                }}
                className="mt-1 w-full px-3 py-2 rounded-md border border-white/25 bg-secondary text-sm text-foreground">
                <option value="">Select event...</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
              {errors.linked_event_id && <p className="text-xs text-destructive mt-1">{errors.linked_event_id}</p>}
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Start Date</Label>
              <Input type="datetime-local" value={form.start_date} onChange={e => set("start_date", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">End Date *</Label>
              <Input type="datetime-local" value={form.end_date} onChange={e => set("end_date", e.target.value)} className="mt-1" />
              {errors.end_date && <p className="text-xs text-destructive mt-1">{errors.end_date}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Winner Announcement Date</Label>
              <Input type="datetime-local" value={form.winner_announcement_date} onChange={e => set("winner_announcement_date", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Number of Winners</Label>
              <Input type="number" min={1} value={form.num_winners} onChange={e => set("num_winners", e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* Who Can Participate — single-select eligibility */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Who Can Participate? *</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">Choose one eligibility option for this activity.</p>
            <div className="space-y-2">
              {ACCESS_OPTIONS.map(opt => {
                const selected = (form.eligibility_rules || [])[0] === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => selectEligibility(opt.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all touch-manipulation ${
                      selected ? "border-primary bg-primary/10" : "border-white/20 hover:border-white/40"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-primary" : "border-white/35"}`}>
                      {selected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                    <span className="text-sm">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            {errors.eligibility_rules && <p className="text-xs text-destructive mt-1">{errors.eligibility_rules}</p>}
          </div>

          {/* Activity Requirements — free text, with saved templates + optional proof toggle */}
          <ActivityRequirementsSection
            user={user}
            value={form.entry_instructions}
            onChange={val => set("entry_instructions", val)}
          />

          {/* Winner selection */}
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Winner Selection</Label>
            <div className="mt-1 flex gap-2">
              {WINNER_SELECTION.map(t => (
                <button key={t.key} type="button" onClick={() => set("winner_selection", t.key)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${form.winner_selection === t.key ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prize */}
          <div className="p-4 rounded-xl bg-secondary/40 border border-border/50 space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Gift className="w-3 h-3" /> Prize Configuration
            </p>

            {/* Preset Prize Options */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Preset Prize</Label>
              <div className="mt-2 space-y-2">
                {PRESET_PRIZES.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      set("prize_type", p.key);
                      set("prize_description", p.defaultTitle);
                    }}
                    className={`relative w-full px-4 py-3 rounded-lg border-2 text-xs font-medium text-left transition-all ${
                      form.prize_type === p.key && !form.prize_description.includes("custom")
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border/50 text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{p.label}</span>
                      {form.prize_type === p.key && !form.prize_description.includes("custom") && (
                        <Check className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => set("prize_type", "custom")}
                  className={`relative w-full px-4 py-3 rounded-lg border-2 text-xs font-medium text-left transition-all ${
                    form.prize_type === "custom"
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>✨ Custom Prize</span>
                    {form.prize_type === "custom" && <Check className="w-4 h-4" />}
                  </div>
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-mono text-muted-foreground">
                {form.prize_type === "custom" ? "Prize Name / What will the winner receive? *" : "Prize Title *"}
              </Label>
              <Input value={form.prize_description} onChange={e => set("prize_description", e.target.value)} placeholder={
                form.prize_type === "custom" ? "Example: Free bottle service, VIP table upgrade, signed merchandise package" :
                form.prize_type === "free_ticket" ? "e.g. Free VIP Ticket" :
                form.prize_type === "physical_item" ? "e.g. Free T-Shirt, Merch Bundle" :
                "e.g. $20 Wallet Credit"
              } className="mt-1" />
              {errors.prize_description && <p className="text-xs text-destructive mt-1">{errors.prize_description}</p>}
            </div>

            <div>
              <Label className="text-xs font-mono text-muted-foreground">Prize Description (optional)</Label>
              <textarea
                value={form.prize_details || ""} onChange={e => set("prize_details", e.target.value)}
                placeholder="Add more detail about the prize..."
                className="mt-1 w-full px-3 py-2 rounded-md border border-white/25 bg-transparent text-sm resize-none h-16 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Quantity Available *</Label>
                <Input type="number" min={1} value={form.prize_quantity} onChange={e => set("prize_quantity", e.target.value)} className="mt-1" />
                {errors.prize_quantity && <p className="text-xs text-destructive mt-1">{errors.prize_quantity}</p>}
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Prize Value (optional)</Label>
                <Input type="number" min={0} value={form.prize_value} onChange={e => set("prize_value", e.target.value)} placeholder="$" className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-mono text-muted-foreground">Redemption Instructions (optional)</Label>
              <textarea
                value={form.redemption_instructions || ""} onChange={e => set("redemption_instructions", e.target.value)}
                placeholder="e.g. Show this QR code to the bar staff at the event to claim your prize."
                className="mt-1 w-full px-3 py-2 rounded-md border border-white/25 bg-transparent text-sm resize-none h-16 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 p-6 border-t border-border/50">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            By publishing, this activity is subject to Reizor's platform{" "}
            <Link to="/terms" target="_blank" className="text-primary hover:underline">Terms & Conditions</Link>.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
            <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto order-3 sm:order-1">Cancel</Button>
            <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving} className="w-full sm:w-auto order-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save as Draft"}
            </Button>
            <Button onClick={() => handleSave("active")} disabled={saving} className="w-full sm:w-auto order-1 sm:order-3 glow-lime">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editGiveaway ? "Update" : "Publish"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}