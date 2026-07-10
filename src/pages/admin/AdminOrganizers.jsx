import { useState, useEffect, useRef } from "react";
import { Plus, Mail, User, LayoutDashboard, Users, Calendar, Trash2, Edit2, ExternalLink, Search, X, DollarSign, Check, Shield, RefreshCw } from "lucide-react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import BulkActionBar from "@/components/shared/BulkActionBar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatCard from "../../components/shared/StatCard";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link } from "react-router-dom";

const SECTIONS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "list",     label: "All Organizers", icon: Users },
  { key: "invite",   label: "Invite Organizer", icon: Mail },
];

export default function AdminOrganizers() {
  const [organizers, setOrganizers] = useState([]);
  const [events, setEvents] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [section, setSection] = useState("overview");
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editName, setEditName] = useState("");
  const [editBusinessName, setEditBusinessName] = useState("");
  const [businessNameError, setBusinessNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [inviteMethod, setInviteMethod] = useState("email"); // "email" | "link" toggle in Invite section
  const inviteAbortRef = useRef(false);

  const cancelInvite = () => {
    inviteAbortRef.current = true;
    setInviting(false);
    setEmail("");
    setSection("overview");
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const bulkRemoveOrganizers = async () => {
    const ids = [...selectedIds];
    await Promise.all(ids.map(id => base44.functions.invoke("adminActions", { action: "updateUser", user_id: id, data: { role: "user" } }).catch(() => {})));
    setOrganizers(prev => prev.filter(o => !ids.includes(o.id)));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    toast.success(`${ids.length} organizer${ids.length !== 1 ? "s" : ""} removed`);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, evs, profiles] = await Promise.all([
        base44.functions.invoke("adminListUsers", {}),
        base44.entities.Event.list("-created_date", 500).catch(() => []),
        base44.entities.OrganizerProfile.list(null, 500).catch(() => []),
      ]);
      const users = res?.data?.users || [];
      // Only users with role="organizer" are actual organizers.
      // Profiles are supplementary data — they do NOT make a user an organizer.
      const organizerUsers = users.filter(u => u.role === "organizer");
      const byId = {};
      profiles.forEach(p => { byId[p.organizer_id] = p; });
      setProfilesById(byId);
      setOrganizers(organizerUsers);
      setEvents(evs);
    } catch (err) {
      setError(err?.message || "Unable to load organizers. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Deep link from admin email: /admin/organizers?edit=<user_id> opens the edit dialog directly
  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (!editId) return;
    const target = organizers.find(o => o.id === editId);
    if (target) {
      setSection("list");
      openUser(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, organizers]);

  const invite = async () => {
    if (!email) return toast.error("Enter an email address");
    inviteAbortRef.current = false;
    setInviting(true);
    await base44.functions.invoke("inviteWithCustomEmail", { email, role: "organizer" });
    if (inviteAbortRef.current) return;
    toast.success(`Invite sent to ${email} — they will join as an Organizer`);
    setEmail("");
    setInviting(false);
    setSection("list");
    const [res, profiles] = await Promise.all([
      base44.functions.invoke("adminListUsers", {}),
      base44.entities.OrganizerProfile.list(null, 500).catch(() => []),
    ]);
    if (inviteAbortRef.current) return;
    const users = res?.data?.users || [];
    const organizerUsers = users.filter(u => u.role === "organizer");
    const byId = {};
    profiles.forEach(p => { byId[p.organizer_id] = p; });
    setProfilesById(byId);
    setOrganizers(organizerUsers);
  };

  const openUser = (o) => {
    setSelected(o);
    setEditName(o.full_name || "");
    setEditBusinessName(profilesById[o.id]?.business_name || "");
    setBusinessNameError("");
  };

  const saveUser = async () => {
    const trimmedBusinessName = editBusinessName.trim();
    if (!trimmedBusinessName) {
      setBusinessNameError("Organizer Name is required.");
      return;
    }
    if (trimmedBusinessName.length < 3) {
      setBusinessNameError("Name must be at least 3 characters long.");
      return;
    }
    setBusinessNameError("");
    if (saving) return; // prevent duplicate submissions

    // Detect no changes — compare current edits against the originally-loaded values
    const originalBusinessName = profilesById[selected.id]?.business_name || "";
    const originalName = selected.full_name || "";
    const noChanges = trimmedBusinessName === originalBusinessName && editName.trim() === originalName;
    if (noChanges) {
      toast.info("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      const doSave = async () => {
        await base44.functions.invoke("adminActions", { action: "updateUser", user_id: selected.id, data: { full_name: editName } });
        const profile = profilesById[selected.id];
        const updateData = {
          business_name: trimmedBusinessName,
          needs_name_review: false,
        };
        if (profile) {
          await base44.entities.OrganizerProfile.update(profile.id, updateData);
          setProfilesById(prev => ({ ...prev, [selected.id]: { ...profile, ...updateData } }));
        } else {
          const created = await base44.entities.OrganizerProfile.create({
            ...updateData,
            organizer_id: selected.id,
            organizer_email: selected.email,
            full_name: editName,
          });
          setProfilesById(prev => ({ ...prev, [selected.id]: created }));
        }
        // Sync the updated Organizer Name across all this organizer's events immediately
        base44.entities.Event.updateMany({ organizer_id: selected.id }, { $set: { organizer_name: trimmedBusinessName } }).catch(() => {});
        setOrganizers(prev => prev.map(o => o.id === selected.id ? { ...o, full_name: editName } : o));
        setSelected(s => ({ ...s, full_name: editName }));
      };
      // Timeout wrapper — prevents the button from getting stuck on "Saving..." indefinitely
      const timeoutMs = 20000;
      await Promise.race([
        doSave(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Save timed out. Please try again.")), timeoutMs)),
      ]);
      toast.success("Organizer details saved successfully.");
    } catch (err) {
      toast.error("Unable to save organizer details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const removeOrganizer = async (id) => {
    const targetId = id || selected?.id;
    if (!targetId) return;
    await base44.functions.invoke("adminActions", { action: "updateUser", user_id: targetId, data: { role: "user" } });
    setOrganizers(prev => prev.filter(o => o.id !== targetId));
    if (selected?.id === targetId) setSelected(null);
    setConfirmDeleteId(null);
    toast.success("Organizer removed");
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 max-w-sm mx-auto text-center">
      <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
        <Shield className="w-6 h-6 text-destructive" />
      </div>
      <div>
        <p className="font-display font-bold text-base">Could not load organizers</p>
        <p className="text-sm text-muted-foreground mt-1 font-mono">{error}</p>
      </div>
      <Button onClick={() => loadData()} variant="outline" className="gap-2">
        <RefreshCw className="w-4 h-4" /> Retry
      </Button>
    </div>
  );

  const publishedEvents = events.filter(e => e.status === "published");
  const organizer_event_counts = organizers.map(o => ({
    ...o,
    eventCount: events.filter(e => e.organizer_id === o.id).length,
  })).sort((a, b) => b.eventCount - a.eventCount);

  const filteredOrganizers = organizer_event_counts.filter(o => {
    const q = search.toLowerCase();
    return !q || (o.full_name || "").toLowerCase().includes(q) || (o.email || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">ORGANIZERS</h1>
          <p className="text-sm text-muted-foreground mt-1">{organizers.length} organizer{organizers.length !== 1 ? "s" : ""} on the platform</p>
        </div>
        <Button onClick={() => { inviteAbortRef.current = false; setSection("invite"); setEmail(""); setInviting(false); }} className="glow-lime font-display font-bold gap-2 shrink-0">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Organizer</span><span className="sm:hidden">Add</span>
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
          </button>
        ))}
      </div>

      {/* Overview */}
      {section === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="block w-full text-left" onClick={() => setSection("list")}>
              <StatCard label="Total Organizers" value={organizers.length} icon={Users} accent />
            </button>
            <StatCard label="Total Events" value={events.length} icon={Calendar} to="/admin/events" />
            <StatCard label="Published Events" value={publishedEvents.length} icon={Calendar} to="/admin/events" />
            <StatCard label="Avg Events/Organizer" value={organizers.length ? (events.length / organizers.length).toFixed(1) : 0} icon={LayoutDashboard} />
          </div>
          <div>
            <h2 className="font-display font-bold text-base uppercase tracking-wider mb-3 text-muted-foreground">Top Organizers by Events</h2>
            <div className="space-y-2">
              {organizer_event_counts.slice(0, 10).map(o => {
                const profile = profilesById[o.id];
                return (
                <div key={o.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors">
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openUser(o)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm truncate">{profile?.business_name || "Incomplete Profile"}</p>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground truncate">{o.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-sm font-bold text-primary">{o.eventCount} event{o.eventCount !== 1 ? "s" : ""}</span>
                    <button onClick={() => openUser(o)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <Link to={`/admin/fees`} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-accent transition-colors" title="Fee Settings">
                      <DollarSign className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
                );
              })}
              {organizers.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No organizers yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {section === "list" && (
        <div className="space-y-3">
          <BulkActionBar
            selectedCount={selectedIds.size}
            totalCount={filteredOrganizers.length}
            onSelectAll={() => setSelectedIds(new Set(filteredOrganizers.map(o => o.id)))}
            onClearSelection={() => setSelectedIds(new Set())}
            onDeleteSelected={() => setConfirmBulkDelete(true)}
            deleteLabel={`Remove ${selectedIds.size} Organizer${selectedIds.size !== 1 ? "s" : ""}`}
          />
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-9 bg-card border-border/50" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
          </div>

          <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
            {filteredOrganizers.length === 0 ? (
              <div className="py-16 text-center">
                <User className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No organizers found</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredOrganizers.map(o => {
                  const isSelected = selectedIds.has(o.id);
                  const profile = profilesById[o.id];
                  return (
                  <div key={o.id} className={`p-3 sm:p-4 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/20"}`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleSelect(o.id)}
                        className={`shrink-0 w-5 h-5 rounded-[3px] border-2 flex items-center justify-center mt-0.5 transition-all ${isSelected ? "bg-primary border-primary" : "border-pink-500 bg-pink-500/10 hover:bg-pink-500/20"}`}
                        aria-label="Select organizer"
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="font-medium text-sm truncate">{profile?.business_name || "Incomplete Profile"}</p>
                          <span className="font-mono text-xs font-bold text-primary shrink-0">{o.eventCount} ev</span>
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground truncate">{o.email}</p>
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{o.created_date ? format(new Date(o.created_date), "MMM d, yyyy") : "—"}</p>
                      </div>
                    </div>
                    {/* Action buttons — full width on mobile, natural on desktop */}
                    <div className="flex items-center gap-1.5 mt-2 sm:ml-8">
                      <button onClick={() => openUser(o)}
                        className="flex-1 sm:flex-none sm:px-3 flex items-center justify-center gap-1.5 px-2 py-2 rounded text-[11px] font-bold border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-primary/40 active:bg-primary/10 transition-colors cursor-pointer">
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <Link to={`/organizers/${o.id}`} className="flex-1 sm:flex-none">
                        <button className="w-full sm:w-auto sm:px-3 flex items-center justify-center gap-1.5 px-2 py-2 rounded text-[11px] font-bold border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 active:bg-primary/30 transition-colors cursor-pointer">
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </button>
                      </Link>
                      <Link to={`/admin/fees`} className="flex-1 sm:flex-none">
                        <button className="w-full sm:w-auto sm:px-3 flex items-center justify-center gap-1.5 px-2 py-2 rounded text-[11px] font-bold border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-accent/40 active:bg-accent/10 transition-colors cursor-pointer">
                          <DollarSign className="w-3.5 h-3.5" /> Fees
                        </button>
                      </Link>
                      <button onClick={() => setConfirmDeleteId(o.id)}
                        className="flex-1 sm:flex-none sm:px-3 flex items-center justify-center gap-1.5 px-2 py-2 rounded text-[11px] font-bold border border-destructive/40 bg-destructive/10 text-red-400 hover:bg-destructive/20 hover:text-red-300 active:bg-destructive/30 transition-colors cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite */}
      {section === "invite" && (
        <div className="space-y-4 max-w-md">
          {/* Toggle: Email Invite / Link Invite */}
          <div className="flex gap-2 p-1 rounded-xl bg-card border border-border/50">
            <button
              onClick={() => setInviteMethod("email")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-display font-bold transition-all touch-manipulation ${
                inviteMethod === "email" ? "bg-primary text-primary-foreground glow-lime" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Mail className="w-4 h-4" /> Email Invite
            </button>
            <button
              onClick={() => setInviteMethod("link")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-display font-bold transition-all touch-manipulation ${
                inviteMethod === "link" ? "bg-primary text-primary-foreground glow-lime" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <ExternalLink className="w-4 h-4" /> Link Invite
            </button>
          </div>

          {/* Email invite mode */}
          {inviteMethod === "email" && (
            <div className="p-5 rounded-xl bg-card border border-primary/30 space-y-4">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Email Address</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="organizer@example.com" className="mt-1 bg-secondary border-border/50" />
              </div>
              <p className="text-xs text-muted-foreground">An invitation email will be sent. The user will be assigned the <strong>organizer</strong> role.</p>
              <div className="flex gap-3">
                <Button onClick={invite} disabled={inviting} className="gap-2">
                  <Mail className="w-4 h-4" /> {inviting ? "Sending..." : "Send Invite"}
                </Button>
                <Button variant="outline" onClick={cancelInvite}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Link invite mode */}
          {inviteMethod === "link" && (
            <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
              <p className="text-xs text-muted-foreground">Share this link with organizers to sign up or log in on Reizor.</p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary border border-border/50">
                <span className="font-mono text-xs text-muted-foreground truncate flex-1 select-all">https://reizor.com</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText("https://reizor.com");
                    toast.success("Invite link copied!");
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2"/><path strokeWidth="2" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copy Link
                </Button>
                {typeof navigator.share === "function" && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => navigator.share({ title: "Join Reizor as an Organizer", url: "https://reizor.com" }).catch(() => {})}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" strokeWidth="2"/><circle cx="6" cy="12" r="3" strokeWidth="2"/><circle cx="18" cy="19" r="3" strokeWidth="2"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" strokeWidth="2"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" strokeWidth="2"/></svg>
                    Share Link
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}
        title="Remove Organizer?"
        description="This will change the user's role to 'user' and remove their organizer access. This action cannot be undone."
        confirmLabel="Remove Organizer"
        confirmVariant="destructive"
        onConfirm={() => removeOrganizer(confirmDeleteId)}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={(o) => { if (!o) setConfirmBulkDelete(false); }}
        title={`Remove ${selectedIds.size} Organizer${selectedIds.size !== 1 ? "s" : ""}?`}
        description="This will downgrade the selected organizers to regular users. This action cannot be undone."
        confirmLabel="Remove Selected"
        confirmVariant="destructive"
        onConfirm={bulkRemoveOrganizers}
      />

      {/* Edit dialog */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="bg-card border-border max-w-md w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle className="font-display font-black">Organizer Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Organizer Name *</Label>
                  <Input
                    value={editBusinessName}
                    onChange={e => { setEditBusinessName(e.target.value); if (businessNameError) setBusinessNameError(""); }}
                    placeholder="Enter Organizer Name"
                    className={`mt-1 bg-secondary ${businessNameError ? "border-destructive ring-1 ring-destructive/40" : "border-border/50"}`}
                  />
                  {businessNameError ? (
                    <p className="text-xs text-destructive mt-1">{businessNameError}</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-1">The public name shown on the organizer profile, events, search, and follower lists.</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Personal Name</Label>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1 bg-secondary border-border/50" />
                  <p className="text-[10px] text-muted-foreground mt-1">Internal use only — not shown publicly.</p>
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Email</Label>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">{selected.email}</p>
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Joined</Label>
                  <p className="mt-1 text-sm">{selected.created_date ? format(new Date(selected.created_date), "MMM dd, yyyy") : "—"}</p>
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Events</Label>
                  <p className="mt-1 text-sm font-bold text-primary">{events.filter(e => e.organizer_id === selected.id).length} events</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button onClick={saveUser} disabled={saving} className="flex-1 gap-2">
                  <Edit2 className="w-4 h-4" /> {saving ? "Saving..." : "Save Name"}
                </Button>
                <Button variant="outline" onClick={() => setConfirmDeleteId(selected.id)} className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-2">
                  <Trash2 className="w-4 h-4" /> Remove Organizer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}