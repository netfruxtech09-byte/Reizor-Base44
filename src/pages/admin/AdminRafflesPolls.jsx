import { useState, useEffect } from "react";
import { Ticket, BarChart3, Trophy, Vote, Star, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import AdminRafflesList from "@/components/admin/raffles/AdminRafflesList";
import AdminPollsList from "@/components/admin/raffles/AdminPollsList";
import AdminCreateRaffle from "@/components/admin/raffles/AdminCreateRaffle";
import AdminCreatePoll from "@/components/admin/raffles/AdminCreatePoll";
import { toast } from "sonner";
import { computeStatus } from "@/utils/statusUtils";

const STATUS_BADGE = {
  upcoming: "text-yellow-400 bg-yellow-400/10",
  active: "text-green-400 bg-green-400/10",
  ended: "text-muted-foreground bg-muted",
  drawn: "text-accent bg-accent/10",
  cancelled: "text-destructive bg-destructive/10",
};

export default function AdminRafflesPolls() {
  const [tab, setTab] = useState("overview"); // overview | raffles | polls | referrals
  const [raffleFilter, setRaffleFilter] = useState("all");
  const [pollFilter, setPollFilter] = useState("all");
  const [raffles, setRaffles] = useState([]);
  const [polls, setPolls] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRaffle, setShowCreateRaffle] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);

  const navigateToRaffles = (filter = "all") => {
    setRaffleFilter(filter);
    setTab("raffles");
  };

  const navigateToPolls = (filter = "all") => {
    setPollFilter(filter);
    setTab("polls");
  };

  const load = async () => {
    setLoading(true);
    // Sync DB statuses first so displayed data is accurate
    await base44.functions.invoke("syncRafflePollStatuses", {}).catch(() => {});
    const [r, p, e] = await Promise.all([
      base44.entities.EventRaffle.list("-created_date", 500).catch(() => []),
      base44.entities.EventPoll.list("-created_date", 500).catch(() => []),
      base44.entities.Event.list("-date", 200).catch(() => []),
    ]);
    setRaffles(r);
    setPolls(p);
    setEvents(e);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activeRaffles = raffles.filter(r => computeStatus(r) === "active");
  const endedRaffles = raffles.filter(r => ["ended", "drawn"].includes(computeStatus(r)));
  const activePolls = polls.filter(p => computeStatus(p) === "active");
  const endedPolls = polls.filter(p => computeStatus(p) === "ended");

  const recentRaffles = raffles.slice(0, 5);
  const recentPolls = polls.slice(0, 5);

  if (showCreateRaffle) return (
    <AdminCreateRaffle
      events={events}
      onClose={() => { setShowCreateRaffle(false); setTab("raffles"); }}
      onCreated={(r) => { setRaffles(prev => [r, ...prev]); setShowCreateRaffle(false); setTab("raffles"); }}
    />
  );

  if (showCreatePoll) return (
    <AdminCreatePoll
      events={events}
      onClose={() => { setShowCreatePoll(false); setTab("polls"); }}
      onCreated={(p) => { setPolls(prev => [p, ...prev]); setShowCreatePoll(false); setTab("polls"); }}
    />
  );

  return (
    <div className="space-y-6 max-w-7xl w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight flex items-center gap-2">
            <Ticket className="w-7 h-7 text-primary" /> RAFFLES & POLLS
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Admin-managed raffles and polls for any event</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateRaffle(true)} className="gap-2 font-display font-bold">
            <Ticket className="w-4 h-4" /> New Raffle
          </Button>
          <Button onClick={() => setShowCreatePoll(true)} variant="outline" className="gap-2 font-display font-bold border-accent text-accent hover:bg-accent/10">
            <BarChart3 className="w-4 h-4" /> New Poll
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit flex-wrap">
        {[["overview", "Overview"], ["raffles", "All Raffles"], ["polls", "All Polls"], ["referrals", "Referrals"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === key ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : tab === "overview" ? (
        <OverviewTab
          raffles={raffles} polls={polls}
          activeRaffles={activeRaffles} endedRaffles={endedRaffles}
          activePolls={activePolls} endedPolls={endedPolls}
          recentRaffles={recentRaffles} recentPolls={recentPolls}
          events={events}
          onCreateRaffle={() => setShowCreateRaffle(true)}
          onCreatePoll={() => setShowCreatePoll(true)}
          onNavigateToRaffles={navigateToRaffles}
          onNavigateToPolls={navigateToPolls}
          STATUS_BADGE={STATUS_BADGE}
        />
      ) : tab === "raffles" ? (
        <AdminRafflesList
          raffles={raffles} events={events}
          onRefresh={load}
          onCreateRaffle={() => setShowCreateRaffle(true)}
          STATUS_BADGE={STATUS_BADGE}
          initialStatusFilter={raffleFilter}
        />
      ) : tab === "polls" ? (
        <AdminPollsList
          polls={polls} events={events}
          onRefresh={load}
          onCreatePoll={() => setShowCreatePoll(true)}
          STATUS_BADGE={STATUS_BADGE}
          initialStatusFilter={pollFilter}
        />
      ) : (
        <ReferralsTab />
      )}
    </div>
  );
}

function ReferralsTab() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filter, setFilter] = useState({ type: "", status: "", email: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Referral.filter({}, "-created_date", 500)
      .then(setReferrals)
      .finally(() => setLoading(false));
  }, []);

  const filtered = referrals.filter((r) => {
    if (filter.type && r.referral_type !== filter.type) return false;
    if (filter.status && r.status !== filter.status) return false;
    if (filter.email && !r.referrer_email?.toLowerCase().includes(filter.email.toLowerCase()) && !r.referred_email?.toLowerCase().includes(filter.email.toLowerCase())) return false;
    return true;
  });

  const handleEdit = (ref) => {
    setEditingId(ref.id);
    setEditForm({ credit_earned: ref.credit_earned, status: ref.status, comp_tier_committed: ref.comp_tier_committed });
  };

  const handleSave = async (refId) => {
    setSaving(true);
    const updated = await base44.entities.Referral.update(refId, editForm);
    setReferrals((prev) => prev.map((r) => (r.id === refId ? updated : r)));
    setEditingId(null);
    setSaving(false);
    toast.success("Referral updated");
  };

  const handleDelete = async (refId) => {
    if (!window.confirm("Permanently delete this referral?")) return;
    await base44.entities.Referral.delete(refId);
    setReferrals((prev) => prev.filter((r) => r.id !== refId));
    toast.success("Referral deleted");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="font-display font-black text-2xl tracking-tight flex items-center gap-2">
          <Star className="w-6 h-6 text-primary" /> REFERRAL MANAGEMENT
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Edit, terminate, or modify referral programs globally</p>
      </div>

      <div className="p-4 rounded-xl bg-card border border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Type</Label>
          <select value={filter.type} onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
            className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm">
            <option value="">All types</option>
            <option value="ticket">Ticket</option>
            <option value="fan_membership">Fan Membership</option>
            <option value="pro_signup">Pro Signup</option>
          </select>
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Status</Label>
          <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
            className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="locked">Locked</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Email Search</Label>
          <Input value={filter.email} onChange={(e) => setFilter((f) => ({ ...f, email: e.target.value }))}
            placeholder="Referrer or referred email..." className="mt-1 bg-secondary border-border/50" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-sm">
          <thead className="bg-card border-b border-border/30">
            <tr>
              <th className="px-4 py-3 text-left font-bold">Referrer</th>
              <th className="px-4 py-3 text-left font-bold">Referred</th>
              <th className="px-4 py-3 text-left font-bold">Type</th>
              <th className="px-4 py-3 text-left font-bold">Status</th>
              <th className="px-4 py-3 text-left font-bold">$ Credit</th>
              <th className="px-4 py-3 text-left font-bold">Unlock Date</th>
              <th className="px-4 py-3 text-left font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No referrals found</td></tr>
            ) : filtered.map((ref) => (
              <tr key={ref.id} className={editingId === ref.id ? "bg-primary/10" : "hover:bg-muted/40"}>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs font-bold">{ref.referrer_name}</p>
                  <p className="text-xs text-muted-foreground">{ref.referrer_email}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs font-bold">{ref.referred_name}</p>
                  <p className="text-xs text-muted-foreground">{ref.referred_email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {ref.referral_type?.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {editingId === ref.id ? (
                    <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                      className="px-2 py-1 rounded-md bg-secondary border border-border/50 text-xs">
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="locked">Locked</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  ) : (
                    <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      ref.status === "completed" ? "text-green-400 bg-green-400/10" :
                      ref.status === "locked" ? "text-yellow-400 bg-yellow-400/10" :
                      ref.status === "withdrawn" ? "text-muted-foreground bg-muted" :
                      "text-accent bg-accent/10"
                    }`}>{ref.status}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === ref.id ? (
                    <Input type="number" value={editForm.credit_earned}
                      onChange={(e) => setEditForm((f) => ({ ...f, credit_earned: parseFloat(e.target.value) || 0 }))}
                      className="w-20 bg-secondary border-border/50 text-xs px-2 py-1 h-7" />
                  ) : (
                    <span className="font-mono font-bold text-primary">${ref.credit_earned?.toFixed(2) || "0.00"}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {ref.unlock_date ? format(new Date(ref.unlock_date), "MMM dd, yyyy") : "—"}
                </td>
                <td className="px-4 py-3">
                  {editingId === ref.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => handleSave(ref.id)} disabled={saving} className="h-7 px-2 font-display font-bold text-xs">
                        {saving ? "..." : "Save"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-7 px-2">Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(ref)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(ref.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Total: {filtered.length} referral(s) · ${filtered.reduce((s, r) => s + (r.credit_earned || 0), 0).toFixed(2)} in credits</p>
    </div>
  );
}

function OverviewTab({ raffles, polls, activeRaffles, endedRaffles, activePolls, endedPolls, recentRaffles, recentPolls, events, onCreateRaffle, onCreatePoll, onNavigateToRaffles, onNavigateToPolls, STATUS_BADGE }) {
  const eventMap = Object.fromEntries(events.map(e => [e.id, e.title]));

  const stats = [
    { label: "Total Raffles", value: raffles.length, icon: Ticket, color: "text-primary", borderColor: "hover:border-primary/60", onClick: () => onNavigateToRaffles("all") },
    { label: "Active Raffles", value: activeRaffles.length, icon: Trophy, color: "text-green-400", borderColor: "hover:border-green-400/60", onClick: () => onNavigateToRaffles("active") },
    { label: "Ended Raffles", value: endedRaffles.length, icon: Ticket, color: "text-muted-foreground", borderColor: "hover:border-border", onClick: () => onNavigateToRaffles("ended") },
    { label: "Total Polls", value: polls.length, icon: BarChart3, color: "text-accent", borderColor: "hover:border-accent/60", onClick: () => onNavigateToPolls("all") },
    { label: "Active Polls", value: activePolls.length, icon: Vote, color: "text-green-400", borderColor: "hover:border-green-400/60", onClick: () => onNavigateToPolls("active") },
    { label: "Ended Polls", value: endedPolls.length, icon: BarChart3, color: "text-muted-foreground", borderColor: "hover:border-border", onClick: () => onNavigateToPolls("ended") },
  ];

  return (
    <div className="space-y-6">
      {/* Stats — clickable cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(({ label, value, icon: StatIcon, color, borderColor, onClick }) => (
          <button key={label} onClick={onClick}
            className={`p-4 rounded-xl bg-card border border-border/50 space-y-2 text-left transition-all duration-150 cursor-pointer ${borderColor} hover:bg-card/80 hover:scale-[1.03] active:scale-[0.98]`}>
            <StatIcon className={`w-4 h-4 ${color}`} />
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</p>
            <p className={`font-display font-black text-2xl ${color}`}>{value}</p>
          </button>
        ))}
      </div>

      {/* Recent Raffles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">RECENT RAFFLES</h2>
          <button onClick={() => onNavigateToRaffles("all")} className="text-xs font-mono text-primary hover:underline">View all →</button>
        </div>
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          {recentRaffles.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No raffles yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {["Event", "Raffle Name", "Status", "Entries", "Winners"].map(h => (
                    <th key={h} className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider hidden sm:table-cell first:table-cell">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRaffles.map(r => (
                  <tr key={r.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                    <td className="p-3 text-xs truncate max-w-[120px]">{r.event_title || eventMap[r.event_id] || "—"}</td>
                    <td className="p-3 font-medium text-xs hidden sm:table-cell">{r.name || "—"}</td>
                    <td className="p-3 hidden sm:table-cell">
                     {(() => { const s = computeStatus(r); return <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${STATUS_BADGE[s] || STATUS_BADGE.upcoming}`}>{s}</span>; })()}
                    </td>
                    <td className="p-3 font-mono text-xs hidden sm:table-cell">{r.total_entries || 0}</td>
                    <td className="p-3 font-mono text-xs hidden sm:table-cell">{r.winner_names?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent Polls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">RECENT POLLS</h2>
          <button onClick={() => onNavigateToPolls("all")} className="text-xs font-mono text-accent hover:underline">View all →</button>
        </div>
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          {recentPolls.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No polls yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {["Event", "Question", "Votes", "Status"].map(h => (
                    <th key={h} className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider hidden sm:table-cell first:table-cell">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentPolls.map(p => (
                  <tr key={p.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                    <td className="p-3 text-xs truncate max-w-[120px]">{p.event_title || eventMap[p.event_id] || "—"}</td>
                    <td className="p-3 text-xs hidden sm:table-cell truncate max-w-[200px]">{p.question}</td>
                    <td className="p-3 font-mono text-xs hidden sm:table-cell">{p.total_votes || 0}</td>
                    <td className="p-3 hidden sm:table-cell">
                      {(() => { const s = computeStatus(p); return <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${STATUS_BADGE[s] || STATUS_BADGE.upcoming}`}>{s}</span>; })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}