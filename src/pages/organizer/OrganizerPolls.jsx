import { useState, useEffect } from "react";
import { BarChart3, Plus, Trash2, Check, Copy, Link2, Edit2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_BADGE = {
  upcoming: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  active: "text-green-400 bg-green-400/10 border-green-400/30",
  ended: "text-muted-foreground bg-muted border-border",
};

function TypeBadge({ poll }) {
  if (poll.event_id && poll.event_title) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-accent/30 bg-accent/10 text-accent">
        <Link2 className="w-2.5 h-2.5" /> {poll.event_title}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
      <BarChart3 className="w-2.5 h-2.5" /> Standalone
    </span>
  );
}

function PollForm({ events, initial, onSave, onCancel, saving }) {
  const [selectedEvent, setSelectedEvent] = useState(initial?.event_id ? events.find(e => e.id === initial.event_id) || null : null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    question: initial?.question || "",
    options: initial?.options?.length >= 2 ? initial.options : ["", ""],
    allow_multiple: initial?.allow_multiple || false,
    show_results_immediately: initial?.show_results_immediately !== false,
    start_datetime: initial?.start_datetime ? format(new Date(initial.start_datetime), "yyyy-MM-dd'T'HH:mm") : "",
    end_datetime: initial?.end_datetime ? format(new Date(initial.end_datetime), "yyyy-MM-dd'T'HH:mm") : "",
  });

  const filteredEvents = events.filter(e => !search || e.title?.toLowerCase().includes(search.toLowerCase()));
  const canSave = form.question && form.options.filter(o => o.trim()).length >= 2 && form.start_datetime && form.end_datetime;

  const addOption = () => setForm(f => ({ ...f, options: [...f.options, ""] }));
  const removeOption = (i) => setForm(f => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }));
  const updateOption = (i, val) => setForm(f => { const opts = [...f.options]; opts[i] = val; return { ...f, options: opts }; });

  return (
    <div className="space-y-4">
      {/* Optional event link */}
      <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1.5"><Link2 className="w-3 h-3" /> Link to Event (optional)</Label>
          {selectedEvent && <button onClick={() => setSelectedEvent(null)} className="text-xs text-destructive hover:underline">Remove</button>}
        </div>
        {selectedEvent ? (
          <div className="p-2 rounded-lg border border-accent/30 bg-accent/5 text-sm font-medium">{selectedEvent.title}</div>
        ) : (
          <div className="space-y-1.5">
            <Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="bg-card border-border/50 h-8 text-sm" />
            {search && (
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-border/50 bg-card p-1">
                {filteredEvents.slice(0, 8).map(ev => (
                  <button key={ev.id} onClick={() => { setSelectedEvent(ev); setSearch(""); }}
                    className="w-full text-left px-3 py-1.5 rounded text-sm hover:bg-muted transition-colors">
                    {ev.title} <span className="text-xs text-muted-foreground">{ev.city}</span>
                  </button>
                ))}
                {filteredEvents.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No events found</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <div>
          <Label className="text-xs font-mono text-muted-foreground mb-1 block">Question *</Label>
          <Input value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} placeholder="What should we play?" className="bg-card border-border/50" />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground mb-2 block">Options * (min 2)</Label>
          <div className="space-y-2">
            {form.options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                <Input value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`} className="bg-card border-border/50 flex-1" />
                {form.options.length > 2 && (
                  <button onClick={() => removeOption(i)} className="p-1 rounded text-destructive hover:bg-destructive/10"><X className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
          </div>
          {form.options.length < 8 && (
            <button onClick={addOption} className="mt-2 flex items-center gap-1.5 text-xs font-mono text-accent hover:text-accent/80">
              <Plus className="w-3 h-3" /> Add option
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-mono text-muted-foreground mb-1 block">Start *</Label>
            <Input type="datetime-local" value={form.start_datetime} onChange={e => setForm(f => ({ ...f, start_datetime: e.target.value }))} className="bg-card border-border/50 w-full" />
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground mb-1 block">End *</Label>
            <Input type="datetime-local" value={form.end_datetime} onChange={e => setForm(f => ({ ...f, end_datetime: e.target.value }))} className="bg-card border-border/50 w-full" />
          </div>
        </div>
        <div className="flex gap-6">
          <div>
            <Label className="text-xs font-mono text-muted-foreground mb-1 block">Show results immediately</Label>
            <div className="flex gap-3">
              {[["true", "Yes"], ["false", "After end"]].map(([v, l]) => (
                <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input type="radio" checked={String(form.show_results_immediately) === v} onChange={() => setForm(f => ({ ...f, show_results_immediately: v === "true" }))} />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form, selectedEvent)} disabled={saving || !canSave} className="gap-1.5 bg-accent hover:bg-accent/90">
          {saving ? "Saving..." : <><Check className="w-4 h-4" /> Save</>}
        </Button>
      </div>
    </div>
  );
}

export default function OrganizerPolls() {
  const [polls, setPolls] = useState([]);
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editPoll, setEditPoll] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const load = async () => {
    const me = await base44.auth.me().catch(() => null);
    setUser(me);
    if (!me) { setLoading(false); return; }
    const [p, e] = await Promise.all([
      base44.entities.EventPoll.filter({ organizer_id: me.id }, "-created_date", 200).catch(() => []),
      base44.entities.Event.filter({ organizer_id: me.id }, "-date", 200).catch(() => []),
    ]);
    const allPolls = await base44.entities.EventPoll.list("-created_date", 200).catch(() => []);
    const myPolls = [...new Map([...p, ...allPolls.filter(x => x.created_by_id === me.id)].map(x => [x.id, x])).values()];
    setPolls(myPolls);
    setEvents(e);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (form, selectedEvent) => {
    setSaving(true);
    const cleanOptions = form.options.filter(o => o.trim());
    await base44.entities.EventPoll.create({
      event_id: selectedEvent?.id || "",
      event_title: selectedEvent?.title || "",
      organizer_id: user?.id || "",
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
      status: "upcoming",
      total_votes: 0,
      is_standalone: !selectedEvent,
    });
    toast.success("Poll created!");
    setSaving(false);
    setShowCreate(false);
    load();
  };

  const handleEdit = async (form, selectedEvent) => {
    setSaving(true);
    const cleanOptions = form.options.filter(o => o.trim());
    await base44.entities.EventPoll.update(editPoll.id, {
      event_id: selectedEvent?.id || "",
      event_title: selectedEvent?.title || "",
      question: form.question,
      options: cleanOptions,
      option_a: cleanOptions[0] || "",
      option_b: cleanOptions[1] || "",
      allow_multiple: form.allow_multiple,
      show_results_immediately: form.show_results_immediately,
      start_datetime: new Date(form.start_datetime).toISOString(),
      end_datetime: new Date(form.end_datetime).toISOString(),
      is_standalone: !selectedEvent,
    });
    toast.success("Poll updated!");
    setSaving(false);
    setEditPoll(null);
    load();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.EventPoll.delete(confirmDelete.id);
    toast.success("Poll deleted");
    setConfirmDelete(null);
    setDeleting(false);
    load();
  };

  const handleStatus = async (poll, status) => {
    await base44.entities.EventPoll.update(poll.id, { status });
    toast.success(`Poll marked as ${status}`);
    load();
  };

  const copyLink = (poll) => {
    const url = `${window.location.origin}/poll/${poll.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(poll.id);
    toast.success("Link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-accent" /> MY POLLS
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage standalone or event-linked polls</p>
        </div>
        {polls.length > 0 && (
          <Button onClick={() => setShowCreate(true)} className="gap-2 font-display font-bold bg-accent hover:bg-accent/90">
            <Plus className="w-4 h-4" /> Create Poll
          </Button>
        )}
      </div>

      {showCreate && (
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <h2 className="font-display font-bold text-lg mb-4">New Poll</h2>
          <PollForm events={events} onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} />
        </div>
      )}

      {editPoll && (
        <div className="bg-card border border-accent/30 rounded-xl p-6">
          <h2 className="font-display font-bold text-lg mb-4">Edit Poll</h2>
          <PollForm events={events} initial={editPoll} onSave={handleEdit} onCancel={() => setEditPoll(null)} saving={saving} />
        </div>
      )}

      {polls.length === 0 && !showCreate ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border/50">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-display font-bold text-lg">No polls yet</p>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Create your first standalone or event-linked poll</p>
          <Button onClick={() => setShowCreate(true)} className="gap-2 bg-accent hover:bg-accent/90"><Plus className="w-4 h-4" /> Create Poll</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {polls.map(poll => (
            <div key={poll.id} className="bg-card border border-border/50 rounded-xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${STATUS_BADGE[poll.status] || STATUS_BADGE.upcoming}`}>
                      {poll.status === "upcoming" && poll.start_datetime && new Date(poll.start_datetime) <= new Date() && new Date(poll.end_datetime) >= new Date()
                        ? "⚡ running (not activated)"
                        : poll.status}
                    </span>
                    <TypeBadge poll={poll} />
                  </div>
                  <h3 className="font-display font-bold text-base">{poll.question}</h3>
                  {poll.options?.length > 0 && (
                    <p className="text-xs text-muted-foreground">{poll.options.slice(0, 3).join(" · ")}{poll.options.length > 3 ? "…" : ""}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground flex-wrap">
                    <span>{poll.total_votes || 0} votes</span>
                    {poll.end_datetime && <span>Ends {format(new Date(poll.end_datetime), "MMM d, yyyy")}</span>}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap shrink-0">
                  <button onClick={() => copyLink(poll)} title="Copy share link"
                    className="p-2 rounded-lg bg-secondary hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    {copiedId === poll.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setEditPoll(poll)} title="Edit"
                    className="p-2 rounded-lg bg-secondary hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {poll.status !== "ended" && (
                    <button onClick={() => handleStatus(poll, poll.status === "active" ? "ended" : "active")}
                      title={poll.status === "active" ? "End poll" : "Activate poll"}
                      className="p-2 rounded-lg bg-secondary hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <BarChart3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => setConfirmDelete(poll)} title="Delete"
                    className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-black">Delete Poll?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this poll.</p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}