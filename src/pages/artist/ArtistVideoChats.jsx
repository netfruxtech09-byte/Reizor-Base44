import { useState, useEffect } from "react";
import { Video, Plus, Trash2, Radio, Clock, Users, Copy, Check, PlayCircle, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import VideoChatRoom from "../../components/artist/VideoChatRoom";

const STATUS = {
  scheduled: { label: "Scheduled", color: "text-yellow-400 bg-yellow-400/10" },
  live:      { label: "LIVE",      color: "text-green-400 bg-green-400/10 animate-pulse" },
  ended:     { label: "Ended",     color: "text-muted-foreground bg-muted" },
};

export default function ArtistVideoChats() {
  const [artist, setArtist] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeRoom, setActiveRoom] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", scheduled_at: "", allowed_tier_ids: [] });
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      const a = artists[0];
      setArtist(a);
      const [t, c] = await Promise.all([
        base44.entities.FanTier.filter({ artist_id: a.id, is_active: true }, "sort_order", 20),
        base44.entities.VideoChat.filter({ artist_id: a.id }, "-created_date", 50),
      ]);
      setTiers(t);
      setChats(c);
      setLoading(false);
    });
  }, []);

  const toggleTier = (id) => {
    setForm(f => ({
      ...f,
      allowed_tier_ids: f.allowed_tier_ids.includes(id)
        ? f.allowed_tier_ids.filter(t => t !== id)
        : [...f.allowed_tier_ids, id],
    }));
  };

  const handleCreate = async () => {
    if (!form.title) { toast.error("Title is required"); return; }
    setSaving(true);
    const roomId = `reizor-${artist.id.slice(-8)}-${Date.now().toString(36)}`;
    const allowedNames = tiers.filter(t => form.allowed_tier_ids.includes(t.id)).map(t => t.name);
    const chat = await base44.entities.VideoChat.create({
      artist_id: artist.id,
      artist_name: artist.display_name,
      artist_email: artist.user_email,
      title: form.title,
      description: form.description,
      allowed_tier_ids: form.allowed_tier_ids,
      allowed_tier_names: allowedNames,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      room_id: roomId,
      status: "scheduled",
    });
    setChats(prev => [chat, ...prev]);
    setForm({ title: "", description: "", scheduled_at: "", allowed_tier_ids: [] });
    setShowForm(false);
    toast.success("Video chat created!");
    setSaving(false);
  };

  const setStatus = async (chat, status) => {
    await base44.entities.VideoChat.update(chat.id, { status });
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, status } : c));
    if (status === "live") toast.success("You're now live!");
    if (status === "ended") { toast.success("Session ended"); if (activeRoom?.id === chat.id) setActiveRoom(null); }
  };

  const handleDelete = async (id) => {
    await base44.entities.VideoChat.delete(id);
    setChats(prev => prev.filter(c => c.id !== id));
    toast.success("Deleted");
  };

  const copyLink = (chat) => {
    const url = `${window.location.origin}/artists/${artist.id}`;
    navigator.clipboard.writeText(url);
    setCopied(chat.id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!artist) return <div className="text-center py-20 text-muted-foreground">No artist profile found.</div>;

  if (activeRoom) return (
    <VideoChatRoom
      room={activeRoom}
      displayName={artist.display_name}
      onLeave={() => setActiveRoom(null)}
    />
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight">VIDEO CHATS</h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">Host live sessions for your tier subscribers</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="glow-lime font-display font-bold gap-2">
            <Plus className="w-4 h-4" /> New Session
          </Button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
          <h3 className="font-display font-bold">New Video Chat Session</h3>
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Session Title *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. VIP Q&A, Backstage Hangout" className="mt-1 bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Description</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="What will you talk about?" className="mt-1 bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Scheduled Date & Time</Label>
            <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
              className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm" />
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground mb-2 block">Who can join?</Label>
            {tiers.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No tiers yet — create Fan Tiers first to restrict access.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tiers.map(tier => (
                  <button key={tier.id} onClick={() => toggleTier(tier.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                      form.allowed_tier_ids.includes(tier.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
                    }`}>
                    {tier.name} — ${tier.price}/mo
                  </button>
                ))}
              </div>
            )}
            {form.allowed_tier_ids.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-2 font-mono">⚠ No tiers selected — all fans with any subscription can join.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={saving} className="glow-lime font-display font-bold">{saving ? "Creating..." : "Create Session"}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Chat list */}
      {chats.length === 0 && !showForm ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border/50">
          <Video className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No video sessions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chats.map(chat => {
            const cfg = STATUS[chat.status] || STATUS.scheduled;
            return (
              <div key={chat.id} className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Video className="w-4 h-4 text-primary" />
                      <p className="font-display font-bold">{chat.title}</p>
                      <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    {chat.description && <p className="text-sm text-muted-foreground mt-0.5">{chat.description}</p>}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {chat.scheduled_at && (
                        <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                          <Clock className="w-3 h-3" /> {format(new Date(chat.scheduled_at), "MMM dd, yyyy · h:mm a")}
                        </span>
                      )}
                      {chat.allowed_tier_names?.length > 0 ? (
                        <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                          <Users className="w-3 h-3" /> {chat.allowed_tier_names.join(", ")}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground">All subscribers</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(chat.id)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {chat.status === "scheduled" && (
                    <Button size="sm" onClick={() => setStatus(chat, "live")} className="gap-1.5 font-display font-bold glow-lime">
                      <Radio className="w-3.5 h-3.5" /> Go Live
                    </Button>
                  )}
                  {chat.status === "live" && (
                    <>
                      <Button size="sm" onClick={() => setActiveRoom(chat)} className="gap-1.5 font-display font-bold bg-green-500 hover:bg-green-400 text-black">
                        <PlayCircle className="w-3.5 h-3.5" /> Join Room
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus(chat, "ended")} className="gap-1.5 font-display font-bold">
                        <StopCircle className="w-3.5 h-3.5" /> End Session
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => copyLink(chat)} className="gap-1.5 font-mono text-xs">
                    {copied === chat.id ? <><Check className="w-3.5 h-3.5 text-green-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Share Artist Page</>}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}