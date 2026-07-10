import { useState, useEffect } from "react";
import { Ticket, Plus, Eye, Trash2, Trophy, Copy, Check, Link2, Shuffle, Edit2 } from "lucide-react";
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
  drawn: "text-accent bg-accent/10 border-accent/30",
  cancelled: "text-destructive bg-destructive/10 border-destructive/30",
};

function TypeBadge({ raffle }) {
  if (raffle.event_id && raffle.event_title) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-accent/30 bg-accent/10 text-accent">
        <Link2 className="w-2.5 h-2.5" /> {raffle.event_title}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
      <Ticket className="w-2.5 h-2.5" /> Standalone
    </span>
  );
}

function RaffleForm({ events, initial, onSave, onCancel, saving }) {
  const [selectedEvent, setSelectedEvent] = useState(initial?.event_id ? events.find(e => e.id === initial.event_id) || null : null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: initial?.name || "",
    description: initial?.description || "",
    prize_description: initial?.prize_description || "",
    entry_fee_type: initial?.entry_fee_type || "free",
    entry_fee_amount: initial?.entry_fee_amount || "",
    max_entries_per_user: initial?.max_entries_per_user || 1,
    start_datetime: initial?.start_datetime ? format(new Date(initial.start_datetime), "yyyy-MM-dd'T'HH:mm") : "",
    end_datetime: initial?.end_datetime ? format(new Date(initial.end_datetime), "yyyy-MM-dd'T'HH:mm") : "",
    num_winners: initial?.num_winners || 1,
    winner_selection: initial?.winner_selection || "random",
  });

  const filteredEvents = events.filter(e =>
    !search || e.title?.toLowerCase().includes(search.toLowerCase())
  );
  const canSave = form.name && form.start_datetime && form.end_datetime;

  return (
    <div className="space-y-4">
      {/* Optional event link */}
      <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1.5"><Link2 className="w-3 h-3" /> Link to Event (optional)</Label>
          {selectedEvent && (
            <button onClick={() => setSelectedEvent(null)} className="text-xs text-destructive hover:underline">Remove</button>
          )}
        </div>
        {selectedEvent ? (
          <div className="p-2 rounded-lg border border-primary/30 bg-primary/5 text-sm font-medium">{selectedEvent.title}</div>
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

      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label className="text-xs font-mono text-muted-foreground mb-1 block">Raffle Name *</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Win VIP Access" className="bg-card border-border/50" />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground mb-1 block">Description</Label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2} placeholder="Describe the raffle..." className="w-full rounded-md border border-border/50 bg-card px-3 py-2 text-sm resize-none" />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground mb-1 block">Prize Description</Label>
          <Input value={form.prize_description} onChange={e => setForm(f => ({ ...f, prize_description: e.target.value }))} placeholder="VIP Meet & Greet" className="bg-card border-border/50" />
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-mono text-muted-foreground mb-1 block">Winners</Label>
            <Input type="number" min={1} value={form.num_winners} onChange={e => setForm(f => ({ ...f, num_winners: e.target.value }))} className="bg-card border-border/50" />
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground mb-1 block">Max Entries/User</Label>
            <Input type="number" min={1} value={form.max_entries_per_user} onChange={e => setForm(f => ({ ...f, max_entries_per_user: e.target.value }))} className="bg-card border-border/50" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form, selectedEvent)} disabled={saving || !canSave} className="gap-1.5">
          {saving ? "Saving..." : <><Check className="w-4 h-4" /> Save</>}
        </Button>
      </div>
    </div>
  );
}

export default function OrganizerRaffles() {
  const [raffles, setRaffles] = useState([]);
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editRaffle, setEditRaffle] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const load = async () => {
    const me = await base44.auth.me().catch(() => null);
    setUser(me);
    if (!me) { setLoading(false); return; }
    const [r, e] = await Promise.all([
      base44.entities.EventRaffle.filter({ organizer_id: me.id }, "-created_date", 200).catch(() => []),
      base44.entities.Event.filter({ organizer_id: me.id }, "-date", 200).catch(() => []),
    ]);
    // Also fetch raffles created_by this user (standalone with no organizer_id)
    const byUser = await base44.entities.EventRaffle.list("-created_date", 200).catch(() => []);
    const myRaffles = [...new Map([...r, ...byUser.filter(x => x.created_by_id === me.id)].map(x => [x.id, x])).values()];
    setRaffles(myRaffles);
    setEvents(e);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (form, selectedEvent) => {
    setSaving(true);
    await base44.entities.EventRaffle.create({
      event_id: selectedEvent?.id || "",
      event_title: selectedEvent?.title || "",
      organizer_id: user?.id || "",
      organizer_name: user?.full_name || "",
      name: form.name,
      description: form.description,
      prize_description: form.prize_description,
      entry_fee_type: form.entry_fee_type || "free",
      entry_fee_amount: 0,
      max_entries_per_user: Number(form.max_entries_per_user),
      start_datetime: new Date(form.start_datetime).toISOString(),
      end_datetime: new Date(form.end_datetime).toISOString(),
      num_winners: Number(form.num_winners),
      winner_selection: form.winner_selection || "random",
      status: "upcoming",
      total_entries: 0,
      is_standalone: !selectedEvent,
    });
    toast.success("Raffle created!");
    setSaving(false);
    setShowCreate(false);
    load();
  };

  const handleEdit = async (form, selectedEvent) => {
    setSaving(true);
    await base44.entities.EventRaffle.update(editRaffle.id, {
      event_id: selectedEvent?.id || "",
      event_title: selectedEvent?.title || "",
      name: form.name,
      description: form.description,
      prize_description: form.prize_description,
      max_entries_per_user: Number(form.max_entries_per_user),
      start_datetime: new Date(form.start_datetime).toISOString(),
      end_datetime: new Date(form.end_datetime).toISOString(),
      num_winners: Number(form.num_winners),
      is_standalone: !selectedEvent,
    });
    toast.success("Raffle updated!");
    setSaving(false);
    setEditRaffle(null);
    load();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.EventRaffle.delete(confirmDelete.id);
    toast.success("Raffle deleted");
    setConfirmDelete(null);
    setDeleting(false);
    load();
  };

  const handleStatus = async (raffle, status) => {
    await base44.entities.EventRaffle.update(raffle.id, { status });
    toast.success(`Raffle ${status}`);
    load();
  };

  const copyLink = (raffle) => {
    const url = `${window.location.origin}/raffle/${raffle.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(raffle.id);
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
            <Trophy className="w-7 h-7 text-yellow-400" /> MY RAFFLES
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage standalone or event-linked raffles</p>
        </div>
        {raffles.length > 0 && (
          <Button onClick={() => setShowCreate(true)} className="gap-2 font-display font-bold">
            <Plus className="w-4 h-4" /> Create Raffle
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <h2 className="font-display font-bold text-lg mb-4">New Raffle</h2>
          <RaffleForm events={events} onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} />
        </div>
      )}

      {/* Edit form */}
      {editRaffle && (
        <div className="bg-card border border-primary/30 rounded-xl p-6">
          <h2 className="font-display font-bold text-lg mb-4">Edit Raffle — {editRaffle.name}</h2>
          <RaffleForm events={events} initial={editRaffle} onSave={handleEdit} onCancel={() => setEditRaffle(null)} saving={saving} />
        </div>
      )}

      {/* List */}
      {raffles.length === 0 && !showCreate ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border/50">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-display font-bold text-lg">No raffles yet</p>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Create your first standalone or event-linked raffle</p>
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="w-4 h-4" /> Create Raffle</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {raffles.map(raffle => (
            <div key={raffle.id} className="bg-card border border-border/50 rounded-xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${STATUS_BADGE[raffle.status] || STATUS_BADGE.upcoming}`}>
                      {raffle.status === "upcoming" && raffle.start_datetime && new Date(raffle.start_datetime) <= new Date() && new Date(raffle.end_datetime) >= new Date()
                        ? "⚡ running (not activated)"
                        : raffle.status}
                    </span>
                    <TypeBadge raffle={raffle} />
                  </div>
                  <h3 className="font-display font-bold text-base">{raffle.name}</h3>
                  {raffle.prize_description && (
                    <p className="text-sm text-muted-foreground">🏆 {raffle.prize_description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground flex-wrap">
                    <span>{raffle.total_entries || 0} entries</span>
                    <span>{raffle.num_winners || 1} winner{raffle.num_winners > 1 ? "s" : ""}</span>
                    {raffle.end_datetime && <span>Ends {format(new Date(raffle.end_datetime), "MMM d, yyyy")}</span>}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap shrink-0">
                  <button onClick={() => copyLink(raffle)} title="Copy share link"
                    className="p-2 rounded-lg bg-secondary hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    {copiedId === raffle.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setEditRaffle(raffle)} title="Edit"
                    className="p-2 rounded-lg bg-secondary hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {raffle.status !== "cancelled" && raffle.status !== "drawn" && (
                    <button onClick={() => handleStatus(raffle, raffle.status === "active" ? "ended" : "active")}
                      title={raffle.status === "active" ? "End" : "Activate"}
                      className="p-2 rounded-lg bg-secondary hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Shuffle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => setConfirmDelete(raffle)} title="Delete"
                    className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-black">Delete Raffle?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete <strong>{confirmDelete?.name}</strong>.</p>
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