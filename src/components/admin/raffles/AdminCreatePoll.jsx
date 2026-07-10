import { useState } from "react";
import { ArrowLeft, Check, Plus, Trash2, BarChart3, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminCreatePoll({ events, onClose, onCreated }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    question: "",
    options: ["", ""],
    allow_multiple: false,
    show_results_immediately: true,
    start_datetime: "",
    end_datetime: "",
  });

  const filteredEvents = events.filter(e =>
    !search || e.title?.toLowerCase().includes(search.toLowerCase()) || e.city?.toLowerCase().includes(search.toLowerCase())
  );

  const [errors, setErrors] = useState({});
  const canCreate = form.question && form.options.filter(o => o.trim()).length >= 2 && form.start_datetime && form.end_datetime;

  const nowMin = () => { const d = new Date(); d.setSeconds(0, 0); return d.toISOString().slice(0, 16); };

  const validate = () => {
    const errs = {};
    const now = new Date();
    if (form.start_datetime && new Date(form.start_datetime) < now) {
      errs.start_datetime = "Start date and time cannot be in the past.";
    }
    if (form.start_datetime && form.end_datetime && new Date(form.end_datetime) <= new Date(form.start_datetime)) {
      errs.end_datetime = "End date/time must be after the start date/time.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const deriveStatus = (startStr) => {
    if (!startStr) return "upcoming";
    return new Date(startStr) <= new Date() ? "active" : "upcoming";
  };

  const addOption = () => setForm(f => ({ ...f, options: [...f.options, ""] }));
  const removeOption = (i) => setForm(f => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }));
  const updateOption = (i, val) => setForm(f => {
    const options = [...f.options];
    options[i] = val;
    return { ...f, options };
  });

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);
    const cleanOptions = form.options.filter(o => o.trim());
    const poll = await base44.entities.EventPoll.create({
      event_id: selectedEvent?.id || "",
      event_title: selectedEvent?.title || "",
      organizer_id: selectedEvent?.organizer_id || "",
      organizer_name: selectedEvent?.organizer_name || "Reizor",
      question: form.question,
      options: cleanOptions,
      vote_counts: cleanOptions.map(() => 0),
      option_a: cleanOptions[0] || "",
      option_b: cleanOptions[1] || "",
      votes_a: 0,
      votes_b: 0,
      allow_multiple: form.allow_multiple,
      show_results_immediately: form.show_results_immediately,
      start_datetime: new Date(form.start_datetime).toISOString(),
      end_datetime: new Date(form.end_datetime).toISOString(),
      status: deriveStatus(form.start_datetime),
      total_votes: 0,
      created_by_admin: true,
      is_standalone: !selectedEvent,
    });
    toast.success("Poll created successfully!");
    onCreated(poll);
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl w-full">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display font-black text-2xl">CREATE POLL</h1>
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
          <div className="p-3 rounded-lg border border-accent/40 bg-accent/5">
            <p className="font-medium text-sm">{selectedEvent.title}</p>
            <p className="text-xs text-muted-foreground">{selectedEvent.city}{selectedEvent.organizer_name ? ` · ${selectedEvent.organizer_name}` : ""}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-mono">No event selected — this will be a standalone poll</p>
            <Input placeholder="🔍 Search events to link..." value={search} onChange={e => setSearch(e.target.value)} className="bg-secondary border-border/50" />
            {search && (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {filteredEvents.length === 0 && <p className="text-muted-foreground text-sm text-center py-2">No events found</p>}
                {filteredEvents.map(ev => (
                  <button key={ev.id} onClick={() => { setSelectedEvent(ev); setSearch(""); }}
                    className="w-full text-left p-3 rounded-lg border border-border/50 bg-secondary hover:border-accent/40 transition-all">
                    <p className="font-medium text-sm">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">{ev.city}{ev.organizer_name ? ` · ${ev.organizer_name}` : ""} {ev.date ? `· ${format(new Date(ev.date), "MMM d, yyyy")}` : ""}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Poll Details */}
      <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
        <h2 className="font-display font-bold text-lg">Poll Details</h2>
        <div>
          <Label className="text-xs font-mono text-muted-foreground mb-1 block">Poll Question *</Label>
          <Input value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
            placeholder="Which song should be the encore?" className="bg-secondary border-border/50" />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground mb-2 block">Options * (min 2)</Label>
          <div className="space-y-2">
            {form.options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">Option {i + 1}</span>
                <Input value={opt} onChange={e => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}...`} className="bg-secondary border-border/50 flex-1" />
                {form.options.length > 2 && (
                  <button onClick={() => removeOption(i)} className="p-1.5 rounded text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {form.options.length < 8 && (
            <button onClick={addOption} className="mt-2 flex items-center gap-1.5 text-xs font-mono text-accent hover:text-accent/80 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Option
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-mono text-muted-foreground mb-2 block">Allow Multiple Selections</Label>
            <div className="flex gap-4">
              {[["true", "Yes"], ["false", "No"]].map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={String(form.allow_multiple) === val}
                    onChange={() => setForm(f => ({ ...f, allow_multiple: val === "true" }))} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground mb-2 block">Show Results Immediately</Label>
            <div className="flex gap-4">
              {[["true", "Yes"], ["false", "No"]].map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={String(form.show_results_immediately) === val}
                    onChange={() => setForm(f => ({ ...f, show_results_immediately: val === "true" }))} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-mono text-muted-foreground mb-1 block">Start Date & Time *</Label>
            <Input type="datetime-local" value={form.start_datetime}
              min={nowMin()}
              onChange={e => { setForm(f => ({ ...f, start_datetime: e.target.value })); setErrors(er => ({ ...er, start_datetime: null })); }}
              className={`bg-secondary border-border/50 ${errors.start_datetime ? "border-destructive" : ""}`} />
            {errors.start_datetime && <p className="text-xs text-destructive mt-1">{errors.start_datetime}</p>}
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground mb-1 block">End Date & Time *</Label>
            <Input type="datetime-local" value={form.end_datetime}
              min={form.start_datetime || nowMin()}
              onChange={e => { setForm(f => ({ ...f, end_datetime: e.target.value })); setErrors(er => ({ ...er, end_datetime: null })); }}
              className={`bg-secondary border-border/50 ${errors.end_datetime ? "border-destructive" : ""}`} />
            {errors.end_datetime && <p className="text-xs text-destructive mt-1">{errors.end_datetime}</p>}
          </div>
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onClose} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !canCreate} className="gap-2 font-display font-bold bg-accent hover:bg-accent/90">
            {saving ? "Creating..." : <><Check className="w-4 h-4" /> Create Poll</>}
          </Button>
        </div>
      </div>
    </div>
  );
}