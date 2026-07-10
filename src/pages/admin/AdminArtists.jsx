import { useState, useEffect, useRef } from "react";
import { Plus, Mail, Music, X, ExternalLink, LayoutDashboard, Users, Edit2, Trash2, Clock, CheckCircle, XCircle, Check } from "lucide-react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import BulkActionBar from "@/components/shared/BulkActionBar";
import ArtistBookingLink from "@/components/artist/ArtistBookingLink";
import ArtistInviteLink from "@/components/shared/ArtistInviteLink";
import { fetchBatchFollowerCounts } from "@/hooks/useArtistFollowerCount";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import StatCard from "../../components/shared/StatCard";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import LocationSelector from "@/components/shared/LocationSelector";
import ArtistProfileEditReview from "@/components/admin/ArtistProfileEditReview";
import { FileEdit } from "lucide-react";

const SECTIONS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "pending", label: "Pending Approval", icon: Clock },
  { key: "profile_edits", label: "Profile Edits", icon: FileEdit },
  { key: "list", label: "All Artists", icon: Users },
  { key: "invite", label: "Invite Artist", icon: Mail },
];

export default function AdminArtists() {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("section");
    if (s && SECTIONS.some((sec) => sec.key === s)) return s;
    if (params.get("edit")) return "profile_edits";
    return "overview";
  });
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const menuRef = useRef(null);

  const load = async () => {
    const data = await base44.entities.Artist.list("-created_date", 500);
    // Fetch real follower counts from ArtistFollow records (source of truth)
    const countMap = await fetchBatchFollowerCounts(data.map(a => a.id));
    const withRealCounts = data.map(a => {
      const real = countMap.get(a.id) ?? a.follower_count ?? 0;
      if (real !== (a.follower_count ?? 0)) {
        base44.entities.Artist.update(a.id, { follower_count: real }).catch(() => {});
      }
      return { ...a, follower_count: real };
    });
    setArtists(withRealCounts);
    const edits = await base44.entities.ArtistProfileEdit.filter({ status: "pending_review" }, "-created_date", 200).catch(() => []);
    setPendingEdits(edits || []);
    const pending = withRealCounts.filter(a => a.approval_status === "pending");
    if (pending.length > 0) {
      toast(`⏳ ${pending.length} artist${pending.length > 1 ? "s" : ""} pending approval`, {
        action: { label: "Review", onClick: () => setSection("pending") },
      });
    }
    setLoading(false);
  };

  // Subscribe to new artists in real-time to alert admin
  useEffect(() => {
    const unsub = base44.entities.Artist.subscribe((event) => {
      if (event.type === "create" && event.data?.approval_status === "pending") {
        toast(`🆕 New artist application: ${event.data.display_name}`, {
          action: { label: "Review", onClick: () => setSection("pending") },
        });
        setArtists(prev => [event.data, ...prev]);
      } else if (event.type === "update") {
        setArtists(prev => prev.map(a => a.id === event.id ? event.data : a));
      }
    });
    return unsub;
  }, []);

  useEffect(() => { load(); }, []);

  const invite = async () => {
    if (!email) return toast.error("Enter an email address");
    setInviting(true);
    // inviteUser only accepts "user" or "admin" — artist is an additive capability (is_artist flag)
    await base44.users.inviteUser(email, "user");
    toast.success(`Invite sent to ${email} — they can sign up as an artist at /artist/signup`);
    setEmail("");
    setInviting(false);
    setSection("list");
    load();
  };

  const openArtist = (a) => {
    setSelected(a);
    setEditForm({
      display_name: a.display_name || "",
      bio: a.bio || "",
      genre: a.genre || "",
      city: a.city || "",
      state: a.state || "",
      country: a.country || "",
      instagram: a.instagram || "",
      spotify: a.spotify || "",
      soundcloud: a.soundcloud || "",
      twitter: a.twitter || "",
      youtube: a.youtube || "",
      website: a.website || "",
      status: a.status || "active",
    });
  };

  const saveArtist = async () => {
    setSaving(true);
    const location = [editForm.city, editForm.state, editForm.country].filter(Boolean).join(", ");
    const data = { ...editForm, location };
    await base44.entities.Artist.update(selected.id, data);
    setArtists(prev => prev.map(a => a.id === selected.id ? { ...a, ...data } : a));
    setSelected(s => ({ ...s, ...data }));
    setSaving(false);
    toast.success("Artist updated");
  };

  const toggleArtistStatus = async (a) => {
    const newStatus = a.status === "active" ? "suspended" : "active";
    await base44.entities.Artist.update(a.id, { status: newStatus });
    setArtists(prev => prev.map(x => x.id === a.id ? { ...x, status: newStatus } : x));
    if (selected?.id === a.id) setSelected(s => ({ ...s, status: newStatus }));
    toast.success(newStatus === "active" ? "Artist activated" : "Artist deactivated");
  };

  const deleteArtist = async (artistId) => {
    const id = artistId || selected?.id;
    if (!id) return;
    await base44.functions.invoke('adminActions', { action: 'deleteArtist', artist_id: id });
    setArtists(prev => prev.filter(a => a.id !== id));
    if (selected?.id === id) setSelected(null);
    setConfirmDeleteId(null);
    toast.success("Artist deleted");
  };

  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingId, setRejectingId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [pendingEdits, setPendingEdits] = useState([]);

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const bulkDeleteArtists = async () => {
    const ids = [...selectedIds];
    await Promise.all(ids.map(id => base44.functions.invoke('adminActions', { action: 'deleteArtist', artist_id: id }).catch(() => {})));
    setArtists(prev => prev.filter(a => !ids.includes(a.id)));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    toast.success(`${ids.length} artist${ids.length !== 1 ? "s" : ""} deleted`);
  };

  const handleApprove = async (artist) => {
    if (actionLoading) return; // duplicate-click protection
    setActionLoading(artist.id);
    try {
      const res = await base44.functions.invoke("approveArtist", { artist_id: artist.id, action: "approve" });
      if (res.data?.success) {
        setArtists(prev => prev.map(a => a.id === artist.id ? { ...a, approval_status: "approved", status: "active" } : a));
        toast.success(`${artist.display_name} approved! They've been notified by email.`);
      } else {
        toast.error(res.data?.error || "Could not approve this artist. Please try again.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Could not approve this artist. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (artist) => {
    if (actionLoading) return; // duplicate-click protection
    setActionLoading(artist.id);
    try {
      const res = await base44.functions.invoke("approveArtist", { artist_id: artist.id, action: "reject", rejection_reason: rejectionReason });
      if (res.data?.success) {
        setArtists(prev => prev.map(a => a.id === artist.id ? { ...a, approval_status: "rejected", status: "suspended" } : a));
        toast.success(`${artist.display_name}'s application rejected.`);
        setRejectingId(null);
        setRejectionReason("");
      } else {
        toast.error(res.data?.error || "Could not reject this artist. Please try again.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Could not reject this artist. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };



  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const pendingArtists = artists.filter(a => a.approval_status === "pending");

  // Genre breakdown
  const genreCounts = artists.reduce((acc, a) => {
    const g = a.genre || "other";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});
  const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalFollowers = artists.reduce((s, a) => s + (a.follower_count || 0), 0);
  const activeArtists = artists.filter(a => a.status === "active" || !a.status).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">ARTISTS</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {artists.length} artist{artists.length !== 1 ? "s" : ""} on the platform
            {pendingArtists.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 font-mono text-[10px] font-bold">
                {pendingArtists.length} PENDING
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setSection("invite")} className="glow-lime font-display font-bold gap-2 shrink-0">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Artist</span><span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Direct visible section tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              section === s.key ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-secondary text-muted-foreground hover:text-foreground hover:border-primary/40"
            }`}>
            <s.icon className="w-4 h-4" />
            <span>{s.label}</span>
            {s.key === "pending" && pendingArtists.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 font-mono text-[9px] font-bold">{pendingArtists.length}</span>
            )}
            {s.key === "profile_edits" && pendingEdits.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 font-mono text-[9px] font-bold">{pendingEdits.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {section === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div onClick={() => setSection("list")} className="cursor-pointer hover:opacity-80 transition-opacity hover:ring-2 hover:ring-primary/30 rounded-xl">
              <StatCard label="Total Artists" value={artists.length} icon={Music} accent />
            </div>
            <div onClick={() => setSection("list")} className="cursor-pointer hover:opacity-80 transition-opacity hover:ring-2 hover:ring-primary/30 rounded-xl">
              <StatCard label="Active Artists" value={activeArtists} icon={Users} />
            </div>
            <div onClick={() => setSection("pending")} className="cursor-pointer hover:opacity-80 transition-opacity hover:ring-2 hover:ring-yellow-400/40 rounded-xl">
              <StatCard label="Pending Approval" value={pendingArtists.length} icon={Clock} />
            </div>
            <div className="cursor-default">
              <StatCard label="Total Followers" value={totalFollowers.toLocaleString()} icon={Users} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h2 className="font-display font-bold text-base uppercase tracking-wider mb-3 text-muted-foreground">Top Genres</h2>
              <div className="space-y-2">
                {topGenres.map(([genre, count]) => (
                  <div key={genre} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50">
                    <span className="font-mono text-sm capitalize">{genre.replace(/_/g, " ")}</span>
                    <span className="font-mono font-bold text-primary">{count}</span>
                  </div>
                ))}
                {topGenres.length === 0 && <p className="text-muted-foreground text-sm">No data yet</p>}
              </div>
            </div>
            <div>
              <h2 className="font-display font-bold text-base uppercase tracking-wider mb-3 text-muted-foreground">Top by Followers</h2>
              <div className="space-y-2">
                {[...artists].sort((a, b) => (b.follower_count || 0) - (a.follower_count || 0)).slice(0, 5).map(a => (
                  <div key={a.id} onClick={() => openArtist(a)} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 cursor-pointer hover:border-primary/30 transition-colors">
                    {a.profile_image ? (
                      <img src={a.profile_image} className="w-7 h-7 rounded-full object-cover shrink-0" alt="" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Music className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                    <span className="font-bold text-sm flex-1 truncate">{a.display_name}</span>
                    <span className="font-mono text-xs text-primary font-bold">{(a.follower_count || 0).toLocaleString()} <span className="text-muted-foreground font-normal">{a.follower_count === 1 ? "follower" : "followers"}</span></span>
                  </div>
                ))}
                {artists.length === 0 && <p className="text-muted-foreground text-sm">No artists yet</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Approval */}
      {section === "pending" && (
        <div className="space-y-4">
          {pendingArtists.length === 0 ? (
            <div className="py-20 text-center">
              <CheckCircle className="w-10 h-10 text-green-400/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-mono text-sm">No pending applications 🎉</p>
            </div>
          ) : (
            pendingArtists.map(a => (
              <div key={a.id} className="p-4 rounded-xl bg-card border border-yellow-400/20 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    {a.profile_image ? (
                      <img src={a.profile_image} alt={a.display_name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Music className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="font-display font-bold">{a.display_name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{a.user_email}</p>
                      <p className="text-xs font-mono text-muted-foreground capitalize">{a.genre?.replace(/_/g, " ")} · {a.location || "—"}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-yellow-400/10 text-yellow-400 font-mono text-[10px] font-bold uppercase">
                    Pending
                  </span>
                </div>

                {/* Social links */}
                <div className="flex flex-wrap gap-2">
                  {a.instagram && (() => {
                    // Ensure proper URL — handle raw usernames like "@djname" or "djname"
                    const raw = a.instagram.trim();
                    const igUrl = raw.startsWith("http") ? raw : `https://instagram.com/${raw.replace(/^@/, "")}`;
                    return <a href={igUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-accent hover:underline">Instagram ↗</a>;
                  })()}
                  {a.spotify && <a href={a.spotify} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-green-400 hover:underline">Spotify ↗</a>}
                  {a.soundcloud && <a href={a.soundcloud} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-orange-400 hover:underline">SoundCloud ↗</a>}
                  {a.twitter && <a href={a.twitter} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-muted-foreground hover:underline">X ↗</a>}
                  {a.website && <a href={a.website} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-muted-foreground hover:underline">Website ↗</a>}
                </div>

                {a.bio && <p className="text-sm text-muted-foreground line-clamp-2">{a.bio}</p>}

                <p className="text-xs font-mono text-muted-foreground">
                  Applied {a.created_date ? format(new Date(a.created_date), "MMM dd, yyyy 'at' h:mm a") : "—"}
                </p>

                {/* Actions */}
                {rejectingId === a.id ? (
                  <div className="space-y-2">
                    <Input
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder="Reason for rejection (optional)"
                      className="bg-secondary border-border/50 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => handleReject(a)} disabled={actionLoading === a.id} size="sm"
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2">
                        <XCircle className="w-3.5 h-3.5" /> {actionLoading === a.id ? "Rejecting..." : "Confirm Reject"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setRejectingId(null); setRejectionReason(""); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={() => handleApprove(a)} disabled={actionLoading === a.id} size="sm"
                      className="glow-lime gap-2 font-bold">
                      <CheckCircle className="w-3.5 h-3.5" /> {actionLoading === a.id ? "Approving..." : "Approve"}
                    </Button>
                    <Button onClick={() => setRejectingId(a.id)} variant="outline" size="sm"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-2">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Profile Edits (re-approval) */}
      {section === "profile_edits" && (
        <ArtistProfileEditReview
          pendingEdits={pendingEdits}
          onRefresh={load}
        />
      )}

      {/* List */}
      {section === "list" && (
        <div className="space-y-3">
          <BulkActionBar
            selectedCount={selectedIds.size}
            totalCount={artists.length}
            onSelectAll={() => setSelectedIds(new Set(artists.map(a => a.id)))}
            onClearSelection={() => setSelectedIds(new Set())}
            onDeleteSelected={() => setConfirmBulkDelete(true)}
            deleteLabel={`Delete ${selectedIds.size} Artist${selectedIds.size !== 1 ? "s" : ""}`}
          />
          {artists.length === 0 ? (
            <div className="py-16 text-center bg-card rounded-xl border border-border/50">
              <Music className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No artists yet</p>
            </div>
          ) : (
            artists.map(a => {
              const isSelected = selectedIds.has(a.id);
              return (
              <div key={a.id} className={`rounded-xl border overflow-hidden transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : "bg-card border-border/50 hover:border-border"}`}>
                <div className="p-4 space-y-3">

                  {/* Row 1: Checkbox + Avatar + Name + Status badges */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleSelect(a.id)}
                      className={`shrink-0 w-5 h-5 rounded-[3px] border-2 flex items-center justify-center transition-all ${isSelected ? "bg-primary border-primary" : "border-pink-500 bg-pink-500/10 hover:bg-pink-500/20"}`}
                      aria-label="Select artist"
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="shrink-0">
                      {a.profile_image ? (
                        <img src={a.profile_image} alt={a.display_name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Music className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-display font-bold text-sm leading-tight truncate max-w-[150px] sm:max-w-none">
                          {a.display_name}
                        </p>
                        <span className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          a.approval_status === "approved" ? "bg-green-400/10 text-green-400 border-green-400/20" :
                          a.approval_status === "pending"  ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/20" :
                          "bg-destructive/10 text-destructive border-destructive/20"
                        }`}>{a.approval_status || "unknown"}</span>
                        {(a.status === "suspended") && (
                          <span className="shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-red-400/10 text-red-400 border-red-400/20">
                            suspended
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Email */}
                  {a.user_email && (
                    <p className="text-xs text-muted-foreground font-mono break-all leading-relaxed pl-[52px]">
                      {a.user_email}
                    </p>
                  )}

                  {/* Row 3: Genre + Followers + Joined */}
                  <div className="flex items-center gap-3 flex-wrap pl-[52px]">
                    {a.genre && (
                      <span className="text-[11px] font-mono text-muted-foreground capitalize bg-muted/50 px-2 py-0.5 rounded border border-border/40">
                        {a.genre.replace(/_/g, " ")}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-primary font-bold">
                      {(a.follower_count || 0).toLocaleString()} {a.follower_count === 1 ? "follower" : "followers"}
                    </span>
                    {a.created_date && (
                      <span className="text-[11px] font-mono text-muted-foreground/70">
                        Joined {format(new Date(a.created_date), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>

                  {/* Row 4: Location if available */}
                  {a.location && (
                    <p className="text-[11px] font-mono text-muted-foreground/70 pl-[52px]">📍 {a.location}</p>
                  )}

                  {/* Row 5: Action buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pl-[52px] pt-1 border-t border-border/20">
                    <Link to={`/artists/${a.id}`} target="_blank"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> View
                    </Link>
                    <button onClick={() => openArtist(a)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => toggleArtistStatus(a)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        a.status === "active" || !a.status
                          ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400 hover:bg-yellow-400/20"
                          : "bg-green-400/10 border-green-400/20 text-green-400 hover:bg-green-400/20"
                      }`}>
                      {a.status === "active" || !a.status ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => setConfirmDeleteId(a.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>
      )}

      {/* Invite */}
      {section === "invite" && (
        <div className="space-y-4 max-w-md">
          <ArtistInviteLink />
          <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
            <h2 className="font-display font-bold text-base">Or Invite by Email</h2>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Email Address</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="artist@example.com" className="mt-1 bg-secondary border-border/50" />
            </div>
            <p className="text-xs text-muted-foreground">An invitation email will be sent. Once they sign up, they can create their artist profile at <strong>/artist/signup</strong>.</p>
            <div className="flex gap-3">
              <Button onClick={invite} disabled={inviting} className="gap-2">
                <Mail className="w-4 h-4" /> {inviting ? "Sending..." : "Send Invite"}
              </Button>
              <Button variant="outline" onClick={() => setSection("overview")}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}
        title="Delete Artist?"
        description="Are you sure you want to delete this artist? This action cannot be undone."
        confirmLabel="Delete Artist"
        confirmVariant="destructive"
        onConfirm={() => deleteArtist(confirmDeleteId)}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={(o) => { if (!o) setConfirmBulkDelete(false); }}
        title={`Delete ${selectedIds.size} Artist${selectedIds.size !== 1 ? "s" : ""}?`}
        description="Are you sure you want to delete the selected artists? This action cannot be undone."
        confirmLabel="Delete Selected"
        confirmVariant="destructive"
        onConfirm={bulkDeleteArtists}
      />

      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="bg-card border-border max-w-lg w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col p-0 gap-0">
            {/* Fixed header */}
            <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30 shrink-0">
              <DialogTitle className="font-display font-black">Artist Details</DialogTitle>
            </DialogHeader>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
              {/* Avatar + info */}
              <div className="flex items-center gap-3">
                {selected.profile_image ? (
                  <img src={selected.profile_image} className="w-14 h-14 rounded-full object-cover shrink-0" alt="" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Music className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold truncate">{selected.display_name}</p>
                  <p className="text-xs font-mono text-muted-foreground truncate">{selected.user_email}</p>
                  <p className="text-xs font-mono text-muted-foreground">{(selected.follower_count || 0).toLocaleString()} {selected.follower_count === 1 ? "follower" : "followers"}</p>
                </div>
              </div>

              {/* Edit fields */}
              <div className="space-y-3">
                {[
                  { key: "display_name", label: "Display Name" },
                  { key: "genre", label: "Genre" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label className="text-xs font-mono text-muted-foreground">{label}</Label>
                    <Input value={editForm[key] || ""} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      className="mt-1 bg-secondary border-border/50 text-sm" />
                  </div>
                ))}
                <LocationSelector
                  value={{ country: editForm.country, state: editForm.state, city: editForm.city }}
                  onChange={({ country, state, city }) => setEditForm(f => ({ ...f, country, state, city }))}
                  required={false}
                />
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Bio</Label>
                  <textarea value={editForm.bio || ""} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} rows={3}
                    placeholder="No bio provided"
                    className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                {[
                  { key: "instagram", label: "Instagram (URL or @handle)" },
                  { key: "spotify", label: "Spotify URL" },
                  { key: "soundcloud", label: "SoundCloud URL" },
                  { key: "twitter", label: "X / Twitter URL" },
                  { key: "tiktok", label: "TikTok URL" },
                  { key: "youtube", label: "YouTube URL" },
                  { key: "website", label: "Website URL" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label className="text-xs font-mono text-muted-foreground">{label}</Label>
                    <Input value={editForm[key] || ""} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      className="mt-1 bg-secondary border-border/50 text-sm" />
                  </div>
                ))}

                {/* Booking link */}
                <div className="pt-1">
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Shareable Booking Link</p>
                  <ArtistBookingLink artist={selected} variant="inline" />
                </div>
              </div>
            </div>

            {/* Fixed footer actions */}
            <div className="px-5 py-4 border-t border-border/30 shrink-0 flex flex-wrap gap-2">
              <Button onClick={saveArtist} disabled={saving} className="flex-1 gap-1.5 min-w-[100px]">
                <Edit2 className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => toggleArtistStatus(selected)}
                className={selected?.status === "active"
                  ? "border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 gap-1.5"
                  : "border-green-400/40 text-green-400 hover:bg-green-400/10 gap-1.5"}>
                {selected?.status === "active" ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="outline" onClick={() => setConfirmDeleteId(selected?.id)} className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}