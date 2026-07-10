import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Users, Shield, Edit2, Trash2, ExternalLink,
  Music, Calendar, ArrowLeft, ChevronRight,
  UserCog, Check, ArrowRight, RefreshCw, Search, X
} from "lucide-react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import BulkActionBar from "@/components/shared/BulkActionBar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatCard from "../../components/shared/StatCard";
import InviteLinkGenerator from "../../components/shared/InviteLinkGenerator";
import { base44 } from "@/api/base44Client";
import { compactNumber, fullNumber } from "@/utils/formatNumber";
import { toast } from "sonner";

const ROLES = ["admin", "organizer", "artist", "manager", "user"];

const ROLE_META = {
  admin: {
    label: "Admin",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    icon: Shield,
    description: "Full platform access. Can manage all users, events, orders, settings, and configurations.",
    permissions: [
      "Manage all users & roles",
      "Access all events & orders",
      "Configure platform fees",
      "View all analytics & P&L",
      "Manage white labels & sub-labels",
      "Send user blasts & emails",
      "Manage media library",
      "Access admin control panel",
    ],
    dashboardLink: "/admin",
    dashboardLabel: "Admin Panel",
  },
  organizer: {
    label: "Organizer",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
    icon: Calendar,
    description: "Can create and manage events, sell tickets, run promotions, and access organizer analytics.",
    permissions: [
      "Create & manage events",
      "Sell tickets & set pricing",
      "Run promo codes & discounts",
      "View event analytics",
      "Manage team members",
      "Access P&L reports",
      "Email marketing to attendees",
      "Scanner & check-in tools",
    ],
    dashboardLink: "/organizer",
    dashboardLabel: "Organizer Dashboard",
  },
  artist: {
    label: "Artist",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    icon: Music,
    description: "Can create an artist profile, post content, sell merch, manage bookings, and monetize their fanbase.",
    permissions: [
      "Artist profile & posts",
      "Fan tiers & subscriptions",
      "Merch & digital downloads",
      "Booking management",
      "Donation collection",
      "Video chat sessions",
      "Raffle management",
      "Payout tracking",
    ],
    dashboardLink: "/artist",
    dashboardLabel: "Artist Studio",
  },
  manager: {
    label: "Manager",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/30",
    icon: UserCog,
    description: "Can upload and manage media, and assist with platform operations under admin supervision.",
    permissions: [
      "Upload & manage media",
      "View events",
      "Assist organizers",
      "No financial access",
      "No user management",
    ],
    dashboardLink: "/organizer",
    dashboardLabel: "Manager View",
  },

  user: {
    label: "Fan / User",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/30",
    icon: Users,
    description: "Standard registered user. Can browse events, buy tickets, follow artists, and participate in the community.",
    permissions: [
      "Browse & discover events",
      "Purchase tickets",
      "Follow artists",
      "Join community feed",
      "Loyalty & cashback",
      "Resale marketplace",
      "Save events",
    ],
    dashboardLink: "/profile",
    dashboardLabel: "Fan Profile",
  },
};

// ─── Role Overview Page ───────────────────────────────────────────────────────
function RoleOverview({ role, users, roleCounts, onSelectUser, onBack }) {
  const meta = ROLE_META[role];
  const Icon = meta.icon;

  const roleUsers = users.filter(u => {
    if (role === "artist") return u.role === "artist" || u.is_artist;
    return (u.role || "user") === role;
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + header */}
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> All Roles
        </button>
        <div className={`flex items-center gap-4 p-5 rounded-2xl border ${meta.bg} ${meta.border}`}>
          <div className={`w-14 h-14 rounded-xl ${meta.bg} border ${meta.border} flex items-center justify-center shrink-0`}>
            <Icon className={`w-7 h-7 ${meta.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className={`font-display font-black text-2xl tracking-tight ${meta.color}`}>{meta.label.toUpperCase()}</h2>
              <span className={`font-mono text-sm font-bold px-2.5 py-1 rounded-full ${meta.bg} ${meta.color}`}>
                {roleUsers.length} user{roleUsers.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{meta.description}</p>
          </div>
          <Link
            to={meta.dashboardLink}
            className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono font-bold border transition-colors ${meta.bg} ${meta.border} ${meta.color} hover:opacity-80`}
          >
            {meta.dashboardLabel} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div>
        {/* Users in this role */}
        <div className="space-y-2">
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground">
            Users ({roleUsers.length})
          </h3>
          {roleUsers.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No users with this role yet</p>
          )}
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {roleUsers.map(u => (
              <button
                key={u.id}
                onClick={() => onSelectUser(u)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{u.full_name || "—"}</p>
                  <p className="text-xs font-mono text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {u.is_artist && role !== "artist" && (
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[9px] font-bold uppercase">+artist</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── User Detail Panel ────────────────────────────────────────────────────────
function UserDetail({ user, onBack, onUpdate, onDelete }) {
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(user.full_name || "");
  const [editRole, setEditRole] = useState(user.role || "user");
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { type, label, description }
  const [artistId, setArtistId] = useState(null);
  const actionsRef = useRef(null);

  useEffect(() => {
    setEditName(user.full_name || "");
    setEditRole(user.role || "user");
    setEditMode(false);
    setArtistId(null);
    if (user.is_artist || user.role === "artist") {
      base44.entities.Artist.filter({ user_email: user.email }, null, 1)
        .then(res => { if (res[0]) setArtistId(res[0].id); })
        .catch(() => {});
    }
  }, [user.id]);

  useEffect(() => {
    // cleanup - no dropdown to manage anymore
  }, []);

  const saveUser = async () => {
    setSaving(true);
    await base44.functions.invoke('adminActions', { action: 'updateUser', user_id: user.id, data: { full_name: editName, role: editRole } });
    onUpdate({ ...user, full_name: editName, role: editRole });
    setSaving(false);
    setEditMode(false);
    const roleChanged = editRole !== (user.role || "user");
    if (roleChanged) {
      toast.success(`User updated. Role changed to "${editRole}" — they must re-login for new permissions to take effect.`, { duration: 6000 });
    } else {
      toast.success("User updated");
    }
  };

  const doAction = async (action) => {
    setConfirmAction(null);
    if (action === "activate") {
      await base44.functions.invoke('adminActions', { action: 'updateUser', user_id: user.id, data: { status: "active" } });
      onUpdate({ ...user, status: "active" });
      toast.success("User activated");
    } else if (action === "deactivate") {
      await base44.functions.invoke('adminActions', { action: 'updateUser', user_id: user.id, data: { role: "user", status: "inactive" } });
      onUpdate({ ...user, status: "inactive" });
      toast.success("User deactivated");
    } else if (action === "block") {
      await base44.functions.invoke('adminActions', { action: 'updateUser', user_id: user.id, data: { status: "blocked" } });
      onUpdate({ ...user, status: "blocked" });
      toast.success("User blocked");
    } else if (action === "delete") {
      if (user.role === "admin") { toast.error("Admin accounts cannot be deleted."); return; }
      await base44.functions.invoke('adminActions', { action: 'deleteUser', user_id: user.id });
      onDelete(user.id);
      toast.success("User deleted");
    }
  };

  const meta = ROLE_META[user.role || "user"];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to role
        </button>

        {/* User header */}
        <div className="p-5 rounded-2xl bg-card border border-border/50 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-xl font-black text-primary shrink-0">
            {(user.full_name || user.email || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-black text-xl tracking-tight break-words">{user.full_name || "—"}</h2>
            <p className="font-mono text-xs text-muted-foreground break-all mt-0.5">{user.email}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${meta?.bg} ${meta?.color}`}>
                {user.role || "user"}
              </span>
              {user.is_artist && (
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px] font-bold uppercase">+ artist</span>
              )}
              {user.status && user.status !== "active" && (
                <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                  user.status === "blocked" ? "bg-destructive/10 text-destructive" : "bg-yellow-400/10 text-yellow-400"
                }`}>{user.status}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View as Admin quick links */}
      <div className="p-4 rounded-xl bg-secondary/60 border border-border/40 space-y-2">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">View / Access as Admin</p>
        <div className="flex flex-wrap gap-2">
          {(user.is_artist || user.role === "artist") && artistId && (
            <Link to={`/artists/${artistId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-mono font-bold hover:bg-primary/20 transition-colors">
              <Music className="w-3.5 h-3.5" /> Artist Profile
            </Link>
          )}
          {(user.is_artist || user.role === "artist") && (
            <Link to="/artist"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-mono font-bold hover:bg-primary/20 transition-colors">
              <Music className="w-3.5 h-3.5" /> Artist Studio
            </Link>
          )}
          {(user.role === "organizer" || user.role === "admin" || user.role === "manager") && (
            <Link to="/organizer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-xs font-mono font-bold hover:bg-yellow-400/20 transition-colors">
              <Calendar className="w-3.5 h-3.5" /> Organizer Dashboard
            </Link>
          )}
          {user.role === "admin" && (
            <Link to="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-mono font-bold hover:bg-destructive/20 transition-colors">
              <Shield className="w-3.5 h-3.5" /> Admin Panel
            </Link>
          )}

          <Link to="/profile"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border/50 text-muted-foreground text-xs font-mono font-bold hover:text-foreground hover:border-primary/40 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Fan Profile
          </Link>
        </div>
      </div>

      {/* Details */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground">Account Details</h3>
          {!editMode && (
            <Button onClick={() => setEditMode(true)} variant="outline" size="sm" className="gap-1.5 h-8">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Full Name</Label>
            {editMode ? (
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1 bg-secondary border-border/50" />
            ) : (
              <p className="mt-1 text-sm font-medium">{user.full_name || "—"}</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-mono text-muted-foreground">Email</Label>
            <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{user.email}</p>
          </div>

          <div>
            <Label className="text-xs font-mono text-muted-foreground">Role</Label>
            {editMode ? (
              <div className="flex gap-2 mt-1 flex-wrap">
                {ROLES.map(r => (
                  <button key={r} onClick={() => setEditRole(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${editRole === r ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/50 text-muted-foreground hover:border-primary/40"}`}>
                    {r}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1 font-mono text-sm font-bold capitalize">{user.role || "user"}</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-mono text-muted-foreground">Login Method</Label>
            <p className="mt-1 text-sm">{user.auth_provider === 'google' ? '🔵 Google' : user.auth_provider === 'apple' ? '⚫ Apple' : '✉️ Email'}</p>
          </div>

          <div>
            <Label className="text-xs font-mono text-muted-foreground">Referred By</Label>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {user.referred_by_name ? (
                <>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    user.referred_by_role === 'admin' ? 'bg-primary/10 text-primary' :
                    user.referred_by_role === 'organizer' ? 'bg-yellow-400/10 text-yellow-400' :
                    'bg-accent/10 text-accent'
                  }`}>{user.referred_by_role}</span>
                  <span className="text-sm">{user.referred_by_name}</span>
                </>
              ) : <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </div>

          <div>
            <Label className="text-xs font-mono text-muted-foreground">Joined</Label>
            <p className="mt-1 text-sm">{user.created_date ? new Date(user.created_date).toLocaleDateString() : "—"}</p>
          </div>
        </div>

        {editMode ? (
          <div className="flex gap-2 pt-2">
            <Button onClick={saveUser} disabled={saving} className="flex-1 gap-2">
              <Edit2 className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-2">
            {user.status === "inactive" || user.status === "blocked" ? (
              <Button variant="outline" size="sm" onClick={() => setConfirmAction({ type: "activate", label: "Activate Account", description: "Restore access for this user?" })}
                className="border-green-400/30 text-green-400 hover:bg-green-400/10 gap-1.5">
                Activate
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirmAction({ type: "deactivate", label: "Deactivate Account", description: "Deactivate this user's account and remove their role?" })}
                className="border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 gap-1.5">
                Deactivate
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setConfirmAction({ type: "block", label: "Block Account", description: "Block this user from accessing the platform?" })}
              className="border-orange-400/30 text-orange-400 hover:bg-orange-400/10 gap-1.5">
              Block
            </Button>
            {user.role !== "admin" && (
              <Button variant="outline" size="sm" onClick={() => setConfirmAction({ type: "delete", label: "Delete User", description: "Are you sure you want to delete this user? This action cannot be undone." })}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(o) => { if (!o) setConfirmAction(null); }}
        title={confirmAction?.label || "Confirm"}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.label || "Confirm"}
        confirmVariant={confirmAction?.type === "delete" ? "destructive" : "default"}
        onConfirm={() => doAction(confirmAction?.type)}
      />
    </div>
  );
}

// ─── Main AdminUsers Component ───────────────────────────────────────────────
export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setAdminUser).catch(() => {}); }, []);

  // Navigation state: null = overview, string = role page, object = user detail
  // Read URL params for pre-filtering (e.g. ?role=organizer, ?membership=active)
  const urlParams = new URLSearchParams(window.location.search);
  const urlRole = urlParams.get("role");
  const urlMembership = urlParams.get("membership");

  const [activeRole, setActiveRole] = useState(null);   // e.g. "organizer"
  const [activeUser, setActiveUser] = useState(null);   // user object
  const [quickSearch, setQuickSearch] = useState("");
  const [cardFilter, setCardFilter] = useState(urlRole || null);   // null | "organizer" | "artist" | "admin" — pre-populated from URL
  const [membershipFilter, setMembershipFilter] = useState(urlMembership || null); // "standard" | "premium" | "active"
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const loadUsers = () => {
    setLoading(true);
    setError(null);
    // Use backend function (service role) to bypass RLS token-staleness issues
    // when a user is upgraded to admin mid-session
    base44.functions.invoke('adminListUsers', {})
      .then(res => { setUsers(res.data?.users || []); setLoading(false); })
      .catch(() => { setError("Unable to load users. Check your permissions or try again."); setLoading(false); });
  };

  useEffect(() => { loadUsers(); }, []);

  const updateRole = async (userId, role) => {
    await base44.entities.User.update(userId, { role });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    toast.success("Role updated");
  };

  const handleUpdateUser = (updated) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    setActiveUser(updated);
  };

  const handleDeleteUser = (userId) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    setActiveUser(null);
    setActiveRole(null);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    const ids = [...selectedIds].filter(id => {
      const u = users.find(x => x.id === id);
      return u && u.role !== "admin";
    });
    await Promise.all(ids.map(id => base44.functions.invoke('adminActions', { action: 'deleteUser', user_id: id }).catch(() => {})));
    setUsers(prev => prev.filter(u => !ids.includes(u.id)));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    toast.success(`${ids.length} user${ids.length !== 1 ? "s" : ""} deleted`);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground font-mono">Loading users…</p>
    </div>
  );
  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 max-w-sm mx-auto text-center">
      <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
        <Shield className="w-6 h-6 text-destructive" />
      </div>
      <div>
        <p className="font-display font-bold text-base">Could not load users</p>
        <p className="text-sm text-muted-foreground mt-1 font-mono">{error}</p>
      </div>
      <Button onClick={loadUsers} variant="outline" className="gap-2">
        <RefreshCw className="w-4 h-4" /> Retry
      </Button>
    </div>
  );

  const roleCounts = ROLES.reduce((acc, r) => {
    if (r === "artist") {
      acc[r] = users.filter(u => u.role === "artist" || u.is_artist).length;
    } else {
      acc[r] = users.filter(u => (u.role || "user") === r).length;
    }
    return acc;
  }, {});

  // ── User Detail view ──
  if (activeUser) {
    return (
      <UserDetail
        user={activeUser}
        onBack={() => setActiveUser(null)}
        onUpdate={handleUpdateUser}
        onDelete={handleDeleteUser}
      />
    );
  }

  // ── Role Overview view ──
  if (activeRole) {
    return (
      <RoleOverview
        role={activeRole}
        users={users}
        roleCounts={roleCounts}
        onSelectUser={u => setActiveUser(u)}
        onBack={() => setActiveRole(null)}
      />
    );
  }

  // ── Main Overview ──
  const PAGE_SIZE = 15;

  // Base pool: apply card filter first
  const cardFilteredUsers = cardFilter === null
    ? users
    : cardFilter === "artist"
      ? users.filter(u => u.role === "artist" || u.is_artist)
      : users.filter(u => (u.role || "user") === cardFilter);

  // Then apply search on top
  const searchFiltered = quickSearch.trim().length > 0
    ? cardFilteredUsers.filter(u =>
        (u.full_name || "").toLowerCase().includes(quickSearch.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(quickSearch.toLowerCase())
      )
    : cardFilteredUsers;

  // Sort by most recent
  const sortedUsers = [...searchFiltered].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const pagedUsers = sortedUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCardFilter = (filter) => {
    setCardFilter(prev => prev === filter ? null : filter);
    setPage(1);
    setQuickSearch("");
  };

  const STAT_CARDS = [
    { key: null,         label: "Total Users",  value: users.length,                 icon: Users,    accent: true },
    { key: "organizer",  label: "Organizers",   value: roleCounts.organizer || 0,    icon: Calendar, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/40" },
    { key: "artist",     label: "Artists",      value: roleCounts.artist || 0,       icon: Music,    color: "text-primary",    bg: "bg-primary/10",    border: "border-primary/40" },
    { key: "admin",      label: "Admins",       value: roleCounts.admin || 0,        icon: Shield,   color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/40" },
  ];

  // Show membership filter chip if ?membership= param was passed
  const membershipLabel = membershipFilter === "standard" ? "Standard (5%)" : membershipFilter === "premium" ? "Premium (10%)" : membershipFilter === "active" ? "Active Members" : null;

  const activeCardMeta = cardFilter ? ROLE_META[cardFilter] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight leading-none">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-bold text-foreground">{users.length}</span> registered users — click a card to filter
          </p>
        </div>
        <Button onClick={loadUsers} variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto shrink-0">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Clickable stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS.map(card => {
          const Icon = card.icon;
          const isActive = cardFilter === card.key;
          const isAll = card.key === null;
          const activeAll = cardFilter === null;

          return (
            <button
              key={String(card.key)}
              onClick={() => handleCardFilter(card.key)}
              className={`group relative p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer select-none min-h-[88px]
                ${isAll
                  ? activeAll
                    ? "bg-primary/20 border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/10"
                    : "bg-primary/10 border-primary/30 hover:bg-primary/15 hover:border-primary/50"
                  : isActive
                    ? `${card.bg} ${card.border} ring-2 ring-offset-0 shadow-md`
                    : `bg-card border-border/50 hover:${card.bg} hover:${card.border}`
                }
              `}
              style={isActive && !isAll ? { boxShadow: undefined } : undefined}
            >
              <div className="flex items-center justify-between mb-2 gap-1">
                <span className={`font-mono text-xs uppercase tracking-widest leading-tight truncate
                  ${isAll ? (activeAll ? "text-primary font-bold" : "text-muted-foreground") : isActive ? `${card.color} font-bold` : "text-muted-foreground"}`}>
                  {card.label}
                </span>
                <Icon className={`w-4 h-4 shrink-0 transition-colors
                  ${isAll ? (activeAll ? "text-primary" : "text-muted-foreground") : isActive ? card.color : "text-muted-foreground group-hover:" + card.color}`} />
              </div>
              <p title={fullNumber(card.value)} className={`font-display font-black text-2xl leading-none tabular-nums transition-colors mt-1
                ${isAll ? (activeAll ? "text-primary" : "text-foreground") : isActive ? card.color : "text-foreground"}`}>
                {compactNumber(card.value)}
              </p>
              {isActive && (
                <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isAll ? "bg-primary" : card.color.replace("text-", "bg-")} opacity-80`} />
              )}
              {isActive && !isAll && (
                <p className={`text-[10px] font-mono mt-1 font-bold ${card.color}`}>● Active filter</p>
              )}
              {isAll && activeAll && (
                <p className="text-[10px] font-mono mt-1 font-bold text-primary">● Showing all</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick user search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={quickSearch}
          onChange={e => { setQuickSearch(e.target.value); setPage(1); }}
          placeholder={cardFilter ? `Search within ${ROLE_META[cardFilter]?.label || cardFilter}s…` : "Search by name or email…"}
          className="pl-9 bg-card border-border/50 h-10"
        />
        {quickSearch && (
          <button onClick={() => { setQuickSearch(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Active filter chip */}
      {(cardFilter !== null || membershipFilter !== null) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-mono">Filtering by:</span>
          {cardFilter !== null && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border ${activeCardMeta?.bg} ${activeCardMeta?.color} ${activeCardMeta?.border}`}>
              {activeCardMeta?.label}
              <button onClick={() => { setCardFilter(null); setPage(1); }} className="ml-1 hover:opacity-70 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {membershipFilter !== null && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border bg-primary/10 text-primary border-primary/30">
              {membershipLabel} Membership
              <button onClick={() => { setMembershipFilter(null); setPage(1); }} className="ml-1 hover:opacity-70 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <span className="text-xs text-muted-foreground font-mono">{searchFiltered.length} user{searchFiltered.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={(o) => { if (!o) setConfirmBulkDelete(false); }}
        title={`Delete ${selectedIds.size} User${selectedIds.size !== 1 ? "s" : ""}?`}
        description="Are you sure you want to delete the selected users? Admin accounts will be skipped. This action cannot be undone."
        confirmLabel="Delete Selected"
        confirmVariant="destructive"
        onConfirm={bulkDelete}
      />

      {/* Invite Links */}
      {adminUser && (
        <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/50">
          <InviteLinkGenerator currentUser={adminUser} />
        </div>
      )}

      {/* Users list — filtered by card + search */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* By Role list (shown when no card filter active) */}
        {cardFilter === null && quickSearch.trim().length === 0 && (
          <div>
            <h2 className="font-display font-bold text-sm uppercase tracking-wider mb-3 text-muted-foreground">By Role</h2>
            <div className="space-y-2">
              {ROLES.map(role => {
                const meta = ROLE_META[role];
                const Icon = meta.icon;
                const count = roleCounts[role] || 0;
                return (
                  <button
                    key={role}
                    onClick={() => setActiveRole(role)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                  >
                    <div className={`w-9 h-9 rounded-xl ${meta.bg} border ${meta.border} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm">{meta.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">{meta.description.split(".")[0]}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span title={fullNumber(count)} className={`font-display font-black text-xl leading-none tabular-nums ${count > 0 ? meta.color : "text-muted-foreground"}`}>{compactNumber(count)}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filtered / searched users list */}
        <div className={cardFilter === null && quickSearch.trim().length === 0 ? "" : "lg:col-span-2"}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground">
              {cardFilter
                ? `${ROLE_META[cardFilter]?.label} Users`
                : quickSearch.trim().length > 0
                  ? "Search Results"
                  : "Recently Joined"}
            </h2>
            <span className="text-xs font-mono text-muted-foreground">
              {sortedUsers.length} user{sortedUsers.length !== 1 ? "s" : ""}
            </span>
          </div>

          <BulkActionBar
            selectedCount={selectedIds.size}
            totalCount={sortedUsers.length}
            onSelectAll={() => setSelectedIds(new Set(sortedUsers.map(u => u.id)))}
            onClearSelection={() => setSelectedIds(new Set())}
            onDeleteSelected={() => setConfirmBulkDelete(true)}
            deleteLabel={`Delete ${selectedIds.size} User${selectedIds.size !== 1 ? "s" : ""}`}
          />

          {pagedUsers.length === 0 ? (
            <div className="py-10 text-center rounded-xl border border-border/40 bg-card">
              <p className="text-sm text-muted-foreground">
                {quickSearch ? `No results for "${quickSearch}"` : "No users in this category"}
              </p>
              {(cardFilter || quickSearch) && (
                <button onClick={() => { setCardFilter(null); setQuickSearch(""); setPage(1); }}
                  className="mt-3 text-xs font-mono text-primary hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {pagedUsers.map(u => {
                  const meta = ROLE_META[u.role || "user"];
                  const isSelected = selectedIds.has(u.id);
                  return (
                    <div key={u.id} className={`flex items-center gap-2 rounded-xl border transition-all ${isSelected ? "border-primary/50 bg-primary/5" : u.role === "admin" ? "border-border/50 bg-card opacity-50" : "border-border/50 bg-card hover:border-primary/30 hover:bg-primary/5"}`}>
                      {u.role === "admin" ? (
                        <span className="shrink-0 ml-3 w-5 h-5 rounded border-2 flex items-center justify-center border-border/30 cursor-not-allowed opacity-30"
                          aria-label="Admin accounts cannot be selected"
                          title="Admin accounts cannot be deleted">
                          <Shield className="w-3 h-3 text-muted-foreground" />
                        </span>
                      ) : (
                        <button
                          onClick={() => toggleSelect(u.id)}
                          className={`shrink-0 ml-3 w-5 h-5 rounded-[3px] border-2 flex items-center justify-center transition-all ${isSelected ? "bg-primary border-primary" : "border-pink-500 bg-pink-500/10 hover:bg-pink-500/20"}`}
                          aria-label="Select user"
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </button>
                      )}
                      <button onClick={() => setActiveUser(u)}
                        className="flex-1 flex items-center gap-3 p-3 text-left group min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary shrink-0">
                          {(u.full_name || u.email || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{u.full_name || "—"}</p>
                          <p className="text-[11px] font-mono text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${meta?.bg} ${meta?.color}`}>
                            {u.role || "user"}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-border/50 bg-card hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs font-mono text-muted-foreground">
                    Page {page} of {totalPages} · {sortedUsers.length} total
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-border/50 bg-card hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}