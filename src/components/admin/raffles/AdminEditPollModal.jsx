import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { computeStatus } from "@/utils/statusUtils";

export default function AdminEditPollModal({ poll, events, onClose, onSaved }) {
  const status = computeStatus(poll);
  const hasVotes = (poll.total_votes || 0) > 0;
  const isLocked = status === "ended";

  const [form, setForm] = useState({
    question: poll.question || "",
    options: poll.options?.length ? [...poll.options] : ["", ""],
    start_datetime: poll.start_datetime ? poll.start_datetime.slice(0, 16) : "",
    end_datetime: poll.end_datetime ? poll.end_datetime.slice(0, 16) : "",
    event_id: poll.event_id || "",
    status: poll.status || "upcoming",
    show_results_immediately: poll.show_results_immediately !== false,
    allow_multiple: poll.allow_multiple || false,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const nowMin = () => { const d = new Date(); d.setSeconds(0, 0); return d.toISOString().slice(0, 16); };

  const deriveStatus = (startStr, endStr) => {
    if (isLocked) return form.status;
    const now = new Date();
    const start = startStr ? new Date(startStr) : null;
    const end = endStr ? new Date(endStr) : null;
    if (end && end < now) return "ended";
    if (start && start <= now) return "active";
    if (start && start > now) return "upcoming";
    return form.status;
  };

  const validate = () => {
    const errs = {};
    const now = new Date();
    const canEditStart = !hasVotes;
    if (canEditStart && form.start_datetime && new Date(form.start_datetime) < now) {
      errs.start_datetime = "Start date and time cannot be in the past.";
    }
    if (form.end_datetime && form.start_datetime && new Date(form.end_datetime) <= new Date(form.start_datetime)) {
      errs.end_datetime = "End date/time must be after the start date/time.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const setOption = (i, v) => {
    const opts = [...form.options];
    opts[i] = v;
    set("options", opts);
  };

  const addOption = () => set("options", [...form.options, ""]);
  const removeOption = (i) => {
    if (form.options.length <= 2) return;
    set("options", form.options.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    const cleanOptions = form.options.map(o => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      toast.error("At least 2 options are required.");
      return;
    }
    if (!validate()) return;
    setSaving(true);

    const payload = {
      question: form.question,
      status: deriveStatus(form.start_datetime, form.end_datetime),
      show_results_immediately: form.show_results_immediately,
      allow_multiple: form.allow_multiple,
      end_datetime: form.end_datetime || null,
    };

    // Options: only allow adding new ones if votes exist; full edit if no votes
    if (!hasVotes) {
      payload.options = cleanOptions;
      // Sync vote_counts array length
      payload.vote_counts = cleanOptions.map((_, i) => poll.vote_counts?.[i] || 0);
      payload.start_datetime = form.start_datetime || null;
      payload.event_id = form.event_id || null;
    } else {
      // With votes: can add options but not remove/reorder existing ones
      const existingCount = poll.options?.length || 0;
      const merged = [
        ...(poll.options || []),
        ...cleanOptions.slice(existingCount),
      ];
      payload.options = merged;
      payload.vote_counts = merged.map((_, i) => poll.vote_counts?.[i] || 0);
    }

    await base44.entities.EventPoll.update(poll.id, payload);
    toast.success("Poll updated successfully.");
    setSaving(false);
    onSaved();
  };

  const field = (label, children, note) => (
    <div className="space-y-1">
      <Label className="text-xs font-mono text-muted-foreground">{label}</Label>
      {children}
      {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-black">Edit Poll</DialogTitle>
        </DialogHeader>

        {hasVotes && !isLocked && (
          <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-xs text-yellow-400 font-mono">
            ⚠ This poll has votes. Existing options cannot be removed or reordered. You may add new options.
          </div>
        )}

        <div className="space-y-4">
          {field("Poll Question *",
            <textarea value={form.question} onChange={e => set("question", e.target.value)} disabled={isLocked}
              rows={2} className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm resize-none" />
          )}

          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground">Options</Label>
            {form.options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={opt}
                  onChange={e => setOption(i, e.target.value)}
                  disabled={isLocked || (hasVotes && i < (poll.options?.length || 0))}
                  placeholder={`Option ${i + 1}`}
                  className="bg-secondary border-border/50"
                />
                {!isLocked && !(hasVotes && i < (poll.options?.length || 0)) && form.options.length > 2 && (
                  <button onClick={() => removeOption(i)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {!isLocked && (
              <Button type="button" variant="outline" size="sm" onClick={addOption} className="gap-1.5 text-xs">
                <Plus className="w-3 h-3" /> Add Option
              </Button>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-mono text-muted-foreground">Start Date/Time</Label>
            <Input type="datetime-local" value={form.start_datetime}
              min={isLocked || hasVotes ? undefined : nowMin()}
              onChange={e => { set("start_datetime", e.target.value); setErrors(er => ({ ...er, start_datetime: null })); }}
              disabled={isLocked || hasVotes} className={`bg-secondary border-border/50 ${errors.start_datetime ? "border-destructive" : ""}`} />
            {hasVotes && !isLocked && <p className="text-[10px] text-muted-foreground">Locked — poll has votes</p>}
            {errors.start_datetime && <p className="text-xs text-destructive">{errors.start_datetime}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-mono text-muted-foreground">End Date/Time</Label>
            <Input type="datetime-local" value={form.end_datetime}
              min={form.start_datetime || nowMin()}
              onChange={e => { set("end_datetime", e.target.value); setErrors(er => ({ ...er, end_datetime: null })); }}
              disabled={isLocked} className={`bg-secondary border-border/50 ${errors.end_datetime ? "border-destructive" : ""}`} />
            {errors.end_datetime && <p className="text-xs text-destructive">{errors.end_datetime}</p>}
          </div>

          {field("Event Association",
            <select value={form.event_id} onChange={e => set("event_id", e.target.value)}
              disabled={isLocked || hasVotes} className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm">
              <option value="">Standalone (no event)</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>,
            hasVotes && !isLocked ? "Locked — poll has votes" : null
          )}

          {field("Status",
            <select value={form.status} onChange={e => set("status", e.target.value)} disabled={isLocked}
              className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm">
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="ended">Ended</option>
            </select>
          )}

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.show_results_immediately}
                onChange={e => set("show_results_immediately", e.target.checked)} disabled={isLocked} />
              Show results immediately
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.allow_multiple}
                onChange={e => set("allow_multiple", e.target.checked)} disabled={isLocked || hasVotes} />
              Allow multiple choices
            </label>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.question.trim()}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}