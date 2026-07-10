import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { computeStatus, deriveStatusFromDates } from "@/utils/statusUtils";

export default function AdminEditRaffleModal({ raffle, events, onClose, onSaved }) {
  const status = computeStatus(raffle);
  const hasEntries = (raffle.total_entries || 0) > 0;
  const isLocked = ["drawn", "cancelled"].includes(status); // most fields locked

  const [form, setForm] = useState({
    name: raffle.name || "",
    description: raffle.description || "",
    prize_description: raffle.prize_description || "",
    credit_amount: raffle.credit_amount ?? 0,
    num_winners: raffle.num_winners ?? 1,
    winner_selection: raffle.winner_selection || "random",
    start_datetime: raffle.start_datetime ? raffle.start_datetime.slice(0, 16) : "",
    end_datetime: raffle.end_datetime ? raffle.end_datetime.slice(0, 16) : "",
    event_id: raffle.event_id || "",
    status: raffle.status || "upcoming",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const nowMin = () => { const d = new Date(); d.setSeconds(0, 0); return d.toISOString().slice(0, 16); };

  // Editing Start/End auto-recalculates & shows the correct status immediately.
  const handleDateChange = (key, value) => {
    setForm(f => {
      const next = { ...f, [key]: value };
      next.status = deriveStatusFromDates(next.start_datetime, next.end_datetime, f.status);
      return next;
    });
    setErrors(er => ({ ...er, [key]: null, status: null }));
  };

  const validate = () => {
    const errs = {};
    // Floor "now" to the minute so selecting the current minute is never
    // flagged as "in the past" just because seconds/ms make it slightly earlier.
    const nowFloored = new Date();
    nowFloored.setSeconds(0, 0);
    const canEditStart = !locked && (!hasEntries || status === "upcoming");
    if (canEditStart && form.start_datetime && new Date(form.start_datetime) < nowFloored) {
      errs.start_datetime = "Start date and time cannot be in the past.";
    }
    if (form.end_datetime && form.start_datetime && new Date(form.end_datetime) <= new Date(form.start_datetime)) {
      errs.end_datetime = "End date/time must be after the start date/time.";
    }
    if (form.status === "active" && form.end_datetime && new Date(form.end_datetime) <= new Date()) {
      errs.status = "Cannot be Active — the end date/time has already passed.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    // Respect the admin's explicit status selection as-is — never silently
    // re-derive it from dates, or a manual change (e.g. Active → Upcoming)
    // would get overwritten before it's even saved.
    const payload = {
      name: form.name,
      description: form.description,
      prize_description: form.prize_description,
      credit_amount: Number(form.credit_amount) || 0,
      num_winners: Number(form.num_winners) || 1,
      winner_selection: form.winner_selection,
      status: form.status,
    };
    if (!hasEntries || status === "upcoming") {
      payload.start_datetime = form.start_datetime || null;
      payload.end_datetime = form.end_datetime || null;
      payload.event_id = form.event_id || null;
    } else {
      payload.end_datetime = form.end_datetime || null;
    }

    try {
      await base44.entities.EventRaffle.update(raffle.id, payload);
      toast.success("Raffle updated successfully.");
      onSaved();
    } catch (err) {
      toast.error("Failed to update raffle. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const field = (label, children, note) => (
    <div className="space-y-1">
      <Label className="text-xs font-mono text-muted-foreground">{label}</Label>
      {children}
      {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
    </div>
  );

  const locked = isLocked;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-black">Edit Raffle</DialogTitle>
        </DialogHeader>

        {hasEntries && !isLocked && (
          <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-xs text-yellow-400 font-mono">
            ⚠ This raffle has entries. Start date and event association cannot be changed. End date can be extended.
          </div>
        )}

        <div className="space-y-4">
          {field("Raffle Name *",
            <Input value={form.name} onChange={e => set("name", e.target.value)} disabled={locked} className="bg-secondary border-border/50" />
          )}

          {field("Description",
            <textarea value={form.description} onChange={e => set("description", e.target.value)} disabled={locked}
              rows={3} className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm resize-none" />
          )}

          {field("Prize Description",
            <textarea value={form.prize_description} onChange={e => set("prize_description", e.target.value)} disabled={locked}
              rows={2} className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm resize-none" />
          )}

          <div className="grid grid-cols-2 gap-3">
            {field("Credit Amount ($)",
              <Input type="number" min="0" value={form.credit_amount} onChange={e => set("credit_amount", e.target.value)} disabled={locked} className="bg-secondary border-border/50" />
            )}
            {field("Number of Winners",
              <Input type="number" min="1" value={form.num_winners} onChange={e => set("num_winners", e.target.value)} disabled={locked} className="bg-secondary border-border/50" />
            )}
          </div>

          {field("Winner Selection",
            <select value={form.winner_selection} onChange={e => set("winner_selection", e.target.value)} disabled={locked}
              className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm">
              <option value="random">Random Draw</option>
              <option value="manual">Manual Selection</option>
            </select>
          )}

          <div className="space-y-1">
            <Label className="text-xs font-mono text-muted-foreground">Start Date/Time</Label>
            <Input type="datetime-local" value={form.start_datetime}
              min={locked || hasEntries ? undefined : nowMin()}
              onChange={e => handleDateChange("start_datetime", e.target.value)}
              disabled={locked || hasEntries} className={`bg-secondary border-border/50 ${errors.start_datetime ? "border-destructive" : ""}`} />
            {hasEntries && !locked && <p className="text-[10px] text-muted-foreground">Locked — raffle has entries</p>}
            {errors.start_datetime && <p className="text-xs text-destructive">{errors.start_datetime}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-mono text-muted-foreground">End Date/Time</Label>
            <Input type="datetime-local" value={form.end_datetime}
              min={form.start_datetime || nowMin()}
              onChange={e => handleDateChange("end_datetime", e.target.value)}
              disabled={locked} className={`bg-secondary border-border/50 ${errors.end_datetime ? "border-destructive" : ""}`} />
            {errors.end_datetime && <p className="text-xs text-destructive">{errors.end_datetime}</p>}
          </div>

          {field("Event Association",
            <select value={form.event_id} onChange={e => set("event_id", e.target.value)}
              disabled={locked || hasEntries} className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm">
              <option value="">Standalone (no event)</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>,
            hasEntries && !locked ? "Locked — raffle has entries" : null
          )}

          {field("Status",
            <select value={form.status} onChange={e => { set("status", e.target.value); setErrors(er => ({ ...er, status: null })); }} disabled={isLocked}
              className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm">
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="ended">Ended</option>
              <option value="cancelled">Cancelled</option>
            </select>,
            "Auto-calculated from Start/End — change dates above or override here manually."
          )}
          {errors.status && <p className="text-xs text-destructive -mt-2">{errors.status}</p>}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}