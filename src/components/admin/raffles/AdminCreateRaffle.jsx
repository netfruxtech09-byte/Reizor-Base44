import { useState } from "react";
import { ArrowLeft, Check, Ticket, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { deriveStatusFromDates } from "@/utils/statusUtils";

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs font-mono text-muted-foreground mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

export default function AdminCreateRaffle({ events, onClose, onCreated }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    prize_description: "",
    entry_fee_type: "free",
    entry_fee_amount: "",
    max_entries_per_user: 1,
    start_datetime: "",
    end_datetime: "",
    num_winners: 1,
    winner_selection: "random",
  });

  const filteredEvents = events.filter(e =>
    !search || e.title?.toLowerCase().includes(search.toLowerCase()) || e.city?.toLowerCase().includes(search.toLowerCase())
  );

  const [errors, setErrors] = useState({});
  const nowMin = () => { const d = new Date(); d.setSeconds(0, 0); return d.toISOString().slice(0, 16); };

  const canCreate = form.name && form.description && form.prize_description && form.start_datetime && form.end_datetime;

  const validate = () => {
    const errs = {};
    // Floor "now" to the minute so selecting the current minute is never
    // flagged as "in the past" just because seconds/ms make it slightly earlier.
    const nowFloored = new Date();
    nowFloored.setSeconds(0, 0);
    if (form.start_datetime && new Date(form.start_datetime) < nowFloored) {
      errs.start_datetime = "Start date and time cannot be in the past.";
    }
    if (form.start_datetime && form.end_datetime && new Date(form.end_datetime) <= new Date(form.start_datetime)) {
      errs.end_datetime = "End date/time must be after the start date/time.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);
    const raffle = await base44.entities.EventRaffle.create({
      event_id: selectedEvent?.id || "",
      event_title: selectedEvent?.title || "",
      organizer_id: selectedEvent?.organizer_id || "",
      organizer_name: selectedEvent?.organizer_name || "Reizor",
      name: form.name,
      description: form.description,
      prize_description: form.prize_description,
      entry_fee_type: form.entry_fee_type,
      entry_fee_amount: form.entry_fee_type === "paid" ? Number(form.entry_fee_amount) : 0,
      max_entries_per_user: Number(form.max_entries_per_user),
      start_datetime: new Date(form.start_datetime).toISOString(),
      end_datetime: new Date(form.end_datetime).toISOString(),
      num_winners: Number(form.num_winners),
      winner_selection: form.winner_selection,
      status: deriveStatusFromDates(form.start_datetime, form.end_datetime, "upcoming"),
      total_entries: 0,
      created_by_admin: true,
      is_standalone: !selectedEvent,
    });
    toast.success("Raffle created successfully!");
    onCreated(raffle);
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl w-full">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display font-black text-2xl">CREATE RAFFLE</h1>
          <p className="text-muted-foreground text-sm">Event selection is optional — create standalone or event-linked</p>
        </div>
      </div>

      {/* Optional Event Link */}
      <div className="bg-card border border-border/50 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base flex items-center gap-2">
            <Link2 className="w-4 h-4 text-accent" /> Link to Event <span className="text-muted-foreground font-normal text-xs font-mono">(optional)</span>
          </h2>
          {selectedEvent && (
            <button onClick={() => setSelectedEvent(null)} className="text-xs font-mono text-destructive flex items-center gap-1 hover:underline">
              <X className="w-3 h-3" /> Remove
            </button>
          )}
        </div>
        {selectedEvent ? (
          <div className="p-3 rounded-lg border border-primary/40 bg-primary/5">
            <p className="font-medium text-sm">{selectedEvent.title}</p>
            <p className="text-xs text-muted-foreground">{selectedEvent.city}{selectedEvent.organizer_name ? ` · ${selectedEvent.organizer_name}` : ""}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-mono">No event selected — this will be a standalone raffle</p>
            <Input placeholder="🔍 Search events to link..." value={search} onChange={e => setSearch(e.target.value)} className="bg-secondary border-border/50" />
            {search && (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {filteredEvents.length === 0 && <p className="text-muted-foreground text-sm text-center py-2">No events found</p>}
                {filteredEvents.map(ev => (
                  <button key={ev.id} onClick={() => { setSelectedEvent(ev); setSearch(""); }}
                    className="w-full text-left p-3 rounded-lg border border-border/50 bg-secondary hover:border-primary/40 transition-all">
                    <p className="font-medium text-sm">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">{ev.city}{ev.organizer_name ? ` · ${ev.organizer_name}` : ""} {ev.date ? `· ${format(new Date(ev.date), "MMM d, yyyy")}` : ""}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Raffle Details */}
      <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
        <h2 className="font-display font-bold text-lg">Raffle Details</h2>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Raffle Name *">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Meet & Greet Pass" className="bg-secondary border-border/50" />
          </Field>
          <Field label="Description *">
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Win a chance to meet artists backstage..."
              rows={2} className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm resize-none" />
          </Field>
          <Field label="Prize Description *">
            <Input value={form.prize_description} onChange={e => setForm(f => ({ ...f, prize_description: e.target.value }))}
              placeholder="VIP Meet & Greet + Photo + Autograph" className="bg-secondary border-border/50" />
          </Field>
          <div>
            <Label className="text-xs font-mono text-muted-foreground mb-2 block">Entry Fee</Label>
            <div className="flex gap-4 mb-2">
              {["free", "paid"].map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={form.entry_fee_type === t} onChange={() => setForm(f => ({ ...f, entry_fee_type: t }))} />
                  <span className="text-sm capitalize">{t}</span>
                </label>
              ))}
            </div>
            {form.entry_fee_type === "paid" && (
              <Input type="number" value={form.entry_fee_amount} onChange={e => setForm(f => ({ ...f, entry_fee_amount: e.target.value }))}
                placeholder="5.00" className="bg-secondary border-border/50 w-32" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Max Entries / User">
              <Input type="number" min={1} max={10} value={form.max_entries_per_user}
                onChange={e => setForm(f => ({ ...f, max_entries_per_user: e.target.value }))}
                className="bg-secondary border-border/50" />
            </Field>
            <Field label="Number of Winners">
              <Input type="number" min={1} value={form.num_winners}
                onChange={e => setForm(f => ({ ...f, num_winners: e.target.value }))}
                className="bg-secondary border-border/50" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Field label="Start Date & Time *">
                <Input type="datetime-local" value={form.start_datetime}
                  min={nowMin()}
                  onChange={e => { setForm(f => ({ ...f, start_datetime: e.target.value })); setErrors(er => ({ ...er, start_datetime: null })); }}
                  className={`bg-secondary border-border/50 w-full ${errors.start_datetime ? "border-destructive" : ""}`} />
              </Field>
              {errors.start_datetime && <p className="text-xs text-destructive mt-1">{errors.start_datetime}</p>}
            </div>
            <div>
              <Field label="End Date & Time *">
                <Input type="datetime-local" value={form.end_datetime}
                  min={form.start_datetime || nowMin()}
                  onChange={e => { setForm(f => ({ ...f, end_datetime: e.target.value })); setErrors(er => ({ ...er, end_datetime: null })); }}
                  className={`bg-secondary border-border/50 w-full ${errors.end_datetime ? "border-destructive" : ""}`} />
              </Field>
              {errors.end_datetime && <p className="text-xs text-destructive mt-1">{errors.end_datetime}</p>}
            </div>
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground mb-2 block">Winner Selection</Label>
            <div className="flex gap-4">
              {["random", "manual"].map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={form.winner_selection === t} onChange={() => setForm(f => ({ ...f, winner_selection: t }))} />
                  <span className="text-sm capitalize">{t}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onClose} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !canCreate} className="gap-2 font-display font-bold">
            {saving ? "Creating..." : <><Check className="w-4 h-4" /> Create Raffle</>}
          </Button>
        </div>
      </div>
    </div>
  );
}