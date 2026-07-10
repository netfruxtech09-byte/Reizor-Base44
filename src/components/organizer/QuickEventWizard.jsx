import { useState } from "react";
import { X, ChevronRight, ChevronLeft, Zap, Calendar, MapPin, Music, Ticket, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const GENRES = ["techno", "house", "drum_and_bass", "trance", "hip_hop", "rnb", "pop", "rock", "electronic", "other"];

const STEPS = ["Basics", "Venue", "Tickets", "Review"];

const blankTier = () => ({ name: "", price: "", quantity: "" });

export default function QuickEventWizard({ onClose, organizerId, organizerName }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "20:00",
    genre: "electronic",
    description: "",
    venue_name: "",
    venue_address: "",
    city: "",
    country: "",
    total_capacity: "",
    age_restriction: "18+",
    tiers: [{ name: "General Admission", price: "", quantity: "" }],
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setTier = (i, key, val) => {
    const tiers = [...form.tiers];
    tiers[i] = { ...tiers[i], [key]: val };
    setForm(f => ({ ...f, tiers }));
  };
  const addTier = () => setForm(f => ({ ...f, tiers: [...f.tiers, blankTier()] }));
  const removeTier = (i) => setForm(f => ({ ...f, tiers: f.tiers.filter((_, idx) => idx !== i) }));

  const canNext = () => {
    if (step === 0) return form.title && form.date;
    if (step === 1) return form.venue_name && form.city;
    if (step === 2) return form.tiers.every(t => t.name && t.price && t.quantity);
    return true;
  };

  const handlePublish = async (status) => {
    setSaving(true);
    const dateTime = new Date(`${form.date}T${form.time}`).toISOString();
    const minPrice = Math.min(...form.tiers.map(t => parseFloat(t.price) || 0));
    const maxPrice = Math.max(...form.tiers.map(t => parseFloat(t.price) || 0));
    const totalCapacity = form.tiers.reduce((s, t) => s + (parseInt(t.quantity) || 0), 0);

    const event = await base44.entities.Event.create({
      title: form.title,
      date: dateTime,
      genre: form.genre,
      description: form.description,
      venue_name: form.venue_name,
      venue_address: form.venue_address,
      city: form.city,
      country: form.country,
      total_capacity: parseInt(form.total_capacity) || totalCapacity,
      age_restriction: form.age_restriction,
      min_price: minPrice,
      max_price: maxPrice,
      organizer_id: organizerId,
      organizer_name: organizerName,
      status,
    });

    await Promise.all(form.tiers.map(t =>
      base44.entities.TicketType.create({
        event_id: event.id,
        name: t.name,
        price: parseFloat(t.price) || 0,
        quantity: parseInt(t.quantity) || 0,
        quantity_remaining: parseInt(t.quantity) || 0,
        status: "active",
      })
    ));

    toast.success(status === "published" ? "Event published!" : "Draft saved!");
    onClose();
    navigate(`/organizer/events/${event.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-card border border-border/80 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-display font-black text-lg">QUICK EVENT SETUP</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex px-5 pt-4 gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary/20 text-primary border border-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[10px] font-mono ${i === step ? "text-primary" : "text-muted-foreground"}`}>{s}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Step 0: Basics */}
          {step === 0 && (
            <>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Event Title *</Label>
                <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Summer Rave 2026" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Date *</Label>
                  <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="mt-1 bg-secondary border-border/50" />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Time</Label>
                  <Input type="time" value={form.time} onChange={e => set("time", e.target.value)} className="mt-1 bg-secondary border-border/50" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Genre</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {GENRES.map(g => (
                    <button key={g} onClick={() => set("genre", g)}
                      className={`px-3 py-1 rounded-full text-xs font-mono font-bold border transition-all ${
                        form.genre === g ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
                      }`}>
                      {g.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Age Restriction</Label>
                <div className="flex gap-2 mt-2">
                  {["all_ages", "16+", "18+", "21+"].map(a => (
                    <button key={a} onClick={() => set("age_restriction", a)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                        form.age_restriction === a ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
                      }`}>
                      {a.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Description</Label>
                <textarea value={form.description} onChange={e => set("description", e.target.value)}
                  placeholder="Describe your event..." rows={3}
                  className="mt-1 w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
              </div>
            </>
          )}

          {/* Step 1: Venue */}
          {step === 1 && (
            <>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Venue Name *</Label>
                <Input value={form.venue_name} onChange={e => set("venue_name", e.target.value)} placeholder="e.g. Club XYZ" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Address</Label>
                <Input value={form.venue_address} onChange={e => set("venue_address", e.target.value)} placeholder="123 Main St" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">City *</Label>
                  <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="New York" className="mt-1 bg-secondary border-border/50" />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Country</Label>
                  <Input value={form.country} onChange={e => set("country", e.target.value)} placeholder="US" className="mt-1 bg-secondary border-border/50" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Total Capacity (optional override)</Label>
                <Input type="number" value={form.total_capacity} onChange={e => set("total_capacity", e.target.value)}
                  placeholder="Auto-calculated from ticket tiers" className="mt-1 bg-secondary border-border/50" />
              </div>
            </>
          )}

          {/* Step 2: Tickets */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs font-mono text-muted-foreground">Define ticket tiers with prices and quantities.</p>
              {form.tiers.map((tier, i) => (
                <div key={i} className="p-4 rounded-xl bg-secondary border border-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm font-mono text-muted-foreground uppercase tracking-wider">Tier {i + 1}</span>
                    {form.tiers.length > 1 && (
                      <button onClick={() => removeTier(i)} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-mono text-muted-foreground">Tier Name *</Label>
                    <Input value={tier.name} onChange={e => setTier(i, "name", e.target.value)}
                      placeholder="e.g. VIP, Early Bird, General" className="mt-1 bg-card border-border/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-mono text-muted-foreground">Price ($) *</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">$</span>
                        <Input type="number" min="0" step="0.01" value={tier.price}
                          onChange={e => setTier(i, "price", e.target.value)}
                          placeholder="0.00" className="pl-7 bg-card border-border/50" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-mono text-muted-foreground">Quantity *</Label>
                      <Input type="number" min="1" value={tier.quantity}
                        onChange={e => setTier(i, "quantity", e.target.value)}
                        placeholder="100" className="mt-1 bg-card border-border/50" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addTier}
                className="w-full py-2.5 rounded-xl border border-dashed border-primary/40 text-primary text-sm font-mono font-bold hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Ticket Tier
              </button>
              {/* Capacity summary */}
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                <p className="font-mono text-xs text-muted-foreground">Total Capacity from tiers</p>
                <p className="font-display font-black text-lg text-primary">
                  {form.tiers.reduce((s, t) => s + (parseInt(t.quantity) || 0), 0).toLocaleString()} tickets
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-secondary border border-border/50 space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold"><Calendar className="w-4 h-4" /> {form.title}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground font-mono text-xs">DATE</span><p>{form.date} @ {form.time}</p></div>
                  <div><span className="text-muted-foreground font-mono text-xs">GENRE</span><p className="capitalize">{form.genre.replace(/_/g, " ")}</p></div>
                  <div><span className="text-muted-foreground font-mono text-xs">VENUE</span><p>{form.venue_name}</p></div>
                  <div><span className="text-muted-foreground font-mono text-xs">CITY</span><p>{form.city}</p></div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Ticket Tiers</p>
                {form.tiers.map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border/50 text-sm">
                    <span className="font-bold">{t.name}</span>
                    <div className="flex gap-4 font-mono text-xs">
                      <span className="text-green-400">${parseFloat(t.price || 0).toFixed(2)}</span>
                      <span className="text-muted-foreground">{t.quantity} tickets</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border/50 flex gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="flex-1 gap-2 font-display font-bold">
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex gap-2 flex-1">
              <Button variant="outline" onClick={() => handlePublish("draft")} disabled={saving} className="flex-1">
                Save Draft
              </Button>
              <Button onClick={() => handlePublish("published")} disabled={saving} className="flex-1 glow-lime font-display font-bold">
                {saving ? "Publishing..." : "🚀 Publish"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}