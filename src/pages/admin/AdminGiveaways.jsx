import { useState, useEffect } from "react";
import { Gift, Plus, Search, Edit2, Pause, Play, Trash2, Users, CheckCircle2, Clock, Trophy, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import GiveawayFormModal from "@/components/giveaways/GiveawayFormModal";
import GiveawayEntriesModal from "@/components/giveaways/GiveawayEntriesModal";

const STATUS_COLORS = {
  draft: "text-muted-foreground bg-muted",
  active: "text-green-400 bg-green-400/10",
  paused: "text-yellow-400 bg-yellow-400/10",
  ended: "text-blue-400 bg-blue-400/10",
  archived: "text-muted-foreground bg-muted",
};

export default function AdminGiveaways() {
  const [user, setUser] = useState(null);
  const [giveaways, setGiveaways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editGiveaway, setEditGiveaway] = useState(null);
  const [entriesGiveaway, setEntriesGiveaway] = useState(null);

  const load = async () => {
    const u = await base44.auth.me();
    setUser(u);
    const all = await base44.entities.Giveaway.list("-created_date", 200).catch(() => []);
    setGiveaways(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = giveaways.filter(g => {
    const matchTab = tab === "all" || g.status === tab || (tab === "ended" && (g.status === "ended" || g.status === "archived"));
    const matchSearch = !search || g.title.toLowerCase().includes(search.toLowerCase()) || (g.owner_name || "").toLowerCase().includes(search.toLowerCase());
    const matchOwner = ownerFilter === "all" || g.owner_type === ownerFilter;
    return matchTab && matchSearch && matchOwner;
  });

  const handleStatusToggle = async (g) => {
    const newStatus = g.status === "active" ? "paused" : "active";
    await base44.entities.Giveaway.update(g.id, { status: newStatus });
    toast.success(`Giveaway ${newStatus}`);
    // Trigger announcement if becoming active and not yet announced
    if (newStatus === "active" && !g.announcement_sent_at) {
      base44.functions.invoke("notifyGiveawayAnnouncement", { giveaway_id: g.id }).catch(() => {});
    }
    load();
  };

  const handleDelete = async (g) => {
    if (!window.confirm("Delete this giveaway permanently?")) return;
    await base44.entities.Giveaway.delete(g.id);
    toast.success("Deleted");
    load();
  };

  const TABS = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "draft", label: "Draft" },
    { key: "ended", label: "Ended" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" /> ALL GIVEAWAYS
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all platform giveaways across organizers, artists, and admin</p>
        </div>
        <Button onClick={() => { setEditGiveaway(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Giveaway
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: giveaways.length, icon: Gift },
          { label: "Active", value: giveaways.filter(g => g.status === "active").length, icon: Play, color: "text-green-400" },
          { label: "Total Entries", value: giveaways.reduce((s, g) => s + (g.total_entries || 0), 0), icon: Users },
          { label: "Winners Drawn", value: giveaways.filter(g => g.winners_selected).length, icon: Trophy, color: "text-yellow-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-4 rounded-xl bg-card border border-border/50 text-center">
            <Icon className={`w-4 h-4 mx-auto mb-1 ${color || "text-primary"}`} />
            <p className="font-mono text-xl font-black">{value}</p>
            <p className="font-mono text-[10px] text-muted-foreground uppercase">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 p-1 bg-card border border-border/50 rounded-lg flex-wrap">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-colors ${tab === t.key ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm text-foreground">
          <option value="all">All Owners</option>
          <option value="organizer">Organizers</option>
          <option value="artist">Artists</option>
          <option value="admin">Admin</option>
          <option value="white_label">White Label</option>
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title or owner..." className="pl-9" />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Gift className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-mono text-sm">No giveaways found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(g => (
            <div key={g.id} className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
              <div className="flex items-start gap-3">
                {g.cover_image && <img src={g.cover_image} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold truncate">{g.title}</h3>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${STATUS_COLORS[g.status]}`}>{g.status}</span>
                    <span className="text-[10px] font-mono text-accent px-2 py-0.5 rounded bg-accent/10 uppercase">{g.owner_type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{g.owner_name || g.owner_email}</p>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground font-mono flex items-center gap-1"><Users className="w-3 h-3" /> {g.total_entries || 0} entries</span>
                    {g.pending_proof_reviews > 0 && <span className="text-xs text-yellow-400 font-mono flex items-center gap-1"><Clock className="w-3 h-3" /> {g.pending_proof_reviews} pending</span>}
                    {g.end_date && <span className="text-xs text-muted-foreground font-mono">Ends {format(new Date(g.end_date), "MMM d, yyyy")}</span>}
                    {g.winners_selected && <span className="text-xs text-green-400 font-mono flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Winners drawn</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/30">
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={() => setEntriesGiveaway(g)}>
                  <Users className="w-3 h-3" /> Entries
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={() => { setEditGiveaway(g); setShowForm(true); }}>
                  <Edit2 className="w-3 h-3" /> Edit
                </Button>
                {(g.status === "active" || g.status === "paused") && (
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={() => handleStatusToggle(g)}>
                    {g.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {g.status === "active" ? "Pause" : "Resume"}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7 text-destructive ml-auto" onClick={() => handleDelete(g)} title="Delete">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <GiveawayFormModal
          user={user}
          ownerType="admin"
          editGiveaway={editGiveaway}
          onClose={() => { setShowForm(false); setEditGiveaway(null); }}
          onSaved={() => { setShowForm(false); setEditGiveaway(null); load(); }}
        />
      )}
      {entriesGiveaway && (
        <GiveawayEntriesModal
          giveaway={entriesGiveaway}
          onClose={() => setEntriesGiveaway(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}