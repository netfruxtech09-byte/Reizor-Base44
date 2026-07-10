import { useState, useEffect } from "react";
import { Globe, Users, DollarSign, TrendingUp, Music, ShoppingBag, Gift, Video, Download, CalendarCheck, UserPlus, ArrowLeft, X, Send, AlertTriangle, Lock, LayoutDashboard, Settings, LogOut, ChevronDown, Building2, Code2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "sonner";
import SubWhiteLabelManager from "../components/whitelabel/SubWhiteLabelManager";
import WLFeeManager from "../components/whitelabel/WLFeeManager";
import StorageUsageSummary from "../components/storage/StorageUsageSummary";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StatCard from "../components/shared/StatCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const FEATURE_META = {
  tickets:          { label: "Ticket Sales",       icon: CalendarCheck, color: "text-accent" },
  merch:            { label: "Merch Shop",          icon: ShoppingBag,   color: "text-yellow-400" },
  donations:        { label: "Donations",           icon: DollarSign,    color: "text-green-400" },
  shoutouts:        { label: "Shoutouts",           icon: Video,         color: "text-pink-400" },
  fan_tiers:        { label: "Fan Subscriptions",   icon: Users,         color: "text-purple-400" },
  digital_products: { label: "Digital Downloads",   icon: Download,      color: "text-blue-400" },
  bookings:         { label: "Bookings",            icon: CalendarCheck, color: "text-orange-400" },
};

function ArtistCard({ a, agent, onRemove }) {
  const [showDetail, setShowDetail] = useState(false);

  const removeArtist = async () => {
    if (!window.confirm(`Remove ${a.display_name} from your managed artists?`)) return;
    const newIds = (agent.managed_artist_ids || []).filter(id => id !== a.id);
    await base44.entities.WhiteLabel.update(agent.id, { managed_artist_ids: newIds });
    onRemove(a.id);
    setShowDetail(false);
    toast.success("Artist removed from managed list");
  };

  return (
    <div key={a.id}>
      <div onClick={() => setShowDetail(true)}
        className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
        {a.profile_image ? (
          <img src={a.profile_image} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold shrink-0">{a.display_name[0]}</div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{a.display_name}</p>
          <p className="text-xs font-mono text-muted-foreground truncate">{a.genre?.replace(/_/g, " ")}</p>
        </div>
      </div>
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-black">Artist Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              {a.profile_image ? (
                <img src={a.profile_image} className="w-16 h-16 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"><Music className="w-7 h-7 text-primary" /></div>
              )}
              <div>
                <p className="font-bold text-lg">{a.display_name}</p>
                <p className="text-xs font-mono text-muted-foreground">{a.genre?.replace(/_/g, " ") || "—"}</p>
                <p className="text-xs font-mono text-muted-foreground">{(a.follower_count || 0).toLocaleString()} followers</p>
              </div>
            </div>
            {a.bio && <p className="text-sm text-muted-foreground">{a.bio}</p>}
            <div className="flex gap-2 pt-2">
              <Link to={`/artists/${a.id}`} target="_blank" className="flex-1">
                <button className="w-full px-4 py-2 rounded-lg bg-secondary border border-border/50 text-sm font-medium hover:border-primary/40 transition-colors">View Profile</button>
              </Link>
              <button onClick={removeArtist} className="px-4 py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 text-sm font-medium transition-colors">
                Remove
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── White Label Onboarding/Setup Form ──
function WhiteLabelSetup({ wlId, inviteEmail, onComplete }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: "",
    brand_name: "",
    contact_name: "",
    logo_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [invalidToken, setInvalidToken] = useState(false);
  const [wlRecord, setWlRecord] = useState(null);

  useEffect(() => {
    if (!wlId) { setInvalidToken(true); return; }
    base44.entities.WhiteLabel.filter({ id: wlId }, null, 1).then((results) => {
      if (!results[0]) {
        setInvalidToken(true);
      } else {
        setWlRecord(results[0]);
        setForm(f => ({ ...f, contact_name: results[0].name || "" }));
      }
    }).catch(() => setInvalidToken(true));
  }, [wlId]);

  const validateStep1 = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = "Full name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!form.brand_name.trim()) e.brand_name = "Brand name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleStep1Next = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  const handleSave = async () => {
    if (!validateStep2()) return;
    setSaving(true);
    setErrors({});
    const currentUser = await base44.auth.me().catch(() => null);

    // CRITICAL: always use the invite email as the canonical email.
    // Never use the logged-in admin's email — this prevents identity bleed
    // where a Reizor admin testing the invite flow saves their own email
    // onto the WL record instead of the invited partner's email.
    const canonicalEmail = (inviteEmail || wlRecord?.email || currentUser?.email || "").trim().toLowerCase();

    if (form.full_name.trim()) {
      await base44.auth.updateMe({ full_name: form.full_name.trim() }).catch(() => {});
    }

    await base44.entities.WhiteLabel.update(wlId, {
      brand_name: form.brand_name.trim(),
      name: form.contact_name.trim() || form.full_name.trim(),
      logo_url: form.logo_url.trim() || "",
      email: canonicalEmail,
      user_id: currentUser?.id || "",
      is_active: true,
      signup_status: "completed",
    });

    // Assign the correct White Label role to this account (service role — users can't self-assign roles)
    await base44.functions.invoke('completeWLSetup', { wl_id: wlId }).catch(() => {});

    // Store WL id for convenience — NOT for auth decisions
    localStorage.setItem("wl_id", wlId);
    toast.success("Setup complete! Welcome to your White Label dashboard.");
    // Clean URL so setup params don't persist and re-trigger the setup form on refresh
    window.history.replaceState({}, '', '/agent-dashboard');
    onComplete();
    setSaving(false);
  };

  if (invalidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-display font-black text-2xl">Invalid or Expired Invite</h1>
          <p className="text-muted-foreground text-sm">
            This invite link is invalid or has already been used. Please contact your administrator for a new invite.
          </p>
          <Link to="/" className="inline-block px-6 py-3 rounded-lg border border-border/50 text-sm font-mono font-bold hover:border-primary/40 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Globe className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display font-black text-3xl tracking-tight">White Label Partner Setup</h1>
          <p className="text-muted-foreground text-sm">
            {step === 1 ? "Confirm your name for this account." : "Tell us about your brand."}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all ${
                s < step ? "bg-green-500 text-white" :
                s === step ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {s < step ? "✓" : s}
              </div>
              <span className={`text-xs font-mono ${s === step ? "text-foreground" : "text-muted-foreground"}`}>
                {s === 1 ? "Your Name" : "Brand Profile"}
              </span>
              {s < 2 && <div className="w-8 h-px bg-border mx-1" />}
            </div>
          ))}
        </div>

        <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
          {step === 1 && (
            <>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Full Name *</Label>
                <Input
                  value={form.full_name}
                  onChange={e => { setForm(f => ({ ...f, full_name: e.target.value })); setErrors(p => ({ ...p, full_name: "" })); }}
                  placeholder="Your full name"
                  className="mt-1 bg-secondary border-border/50"
                />
                {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
              </div>

              <div>
                <Label className="text-xs font-mono text-muted-foreground">Account Email</Label>
                <Input
                  value={inviteEmail || ""}
                  disabled
                  className="mt-1 bg-secondary border-border/50 opacity-60 cursor-not-allowed"
                />
                <p className="text-[10px] font-mono text-muted-foreground mt-1">Your account email — set during signup</p>
              </div>

              <Button onClick={handleStep1Next} className="w-full glow-lime font-display font-bold gap-2 h-11">
                Continue to Brand Profile →
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mb-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              <div>
                <Label className="text-xs font-mono text-muted-foreground">Brand Name *</Label>
                <Input
                  value={form.brand_name}
                  onChange={e => { setForm(f => ({ ...f, brand_name: e.target.value })); setErrors(p => ({ ...p, brand_name: "" })); }}
                  placeholder="Your Agency / Brand Name"
                  className="mt-1 bg-secondary border-border/50"
                />
                {errors.brand_name && <p className="text-xs text-destructive mt-1">{errors.brand_name}</p>}
              </div>

              <div>
                <Label className="text-xs font-mono text-muted-foreground">Contact Name</Label>
                <Input
                  value={form.contact_name}
                  onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                  placeholder="Your full name (or leave blank to use above)"
                  className="mt-1 bg-secondary border-border/50"
                />
              </div>

              <div>
                <Label className="text-xs font-mono text-muted-foreground">Logo URL (optional)</Label>
                <Input
                  value={form.logo_url}
                  onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
                  placeholder="https://..."
                  className="mt-1 bg-secondary border-border/50"
                />
                {form.logo_url && (
                  <img src={form.logo_url} alt="Logo preview" className="mt-2 w-12 h-12 rounded-full object-cover border border-border/50" onError={e => { e.target.style.display = 'none'; }} />
                )}
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full glow-lime font-display font-bold gap-2 h-11">
                {saving ? "Setting up your account..." : "Complete Setup & Go to Dashboard →"}
              </Button>
            </>
          )}
        </div>

        {/* Powered by Reizor */}
        <p className="text-center text-xs font-mono text-muted-foreground/50">
          Powered by <span className="text-primary font-bold">Reizor</span>
        </p>
      </div>
    </div>
  );
}

export default function WhiteLabelDashboard() {
  const [agent, setAgent] = useState(null);
  const [artists, setArtists] = useState([]);
  const [earnings, setEarnings] = useState({});
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const params = new URLSearchParams(window.location.search);
  const isSetup = params.get("setup") === "1";
  const wlId = params.get("wl_id");
  const inviteEmail = params.get("email");

  useEffect(() => {
    const agentId = params.get("id");

    base44.auth.me().catch(() => null).then(async (u) => {
      if (!u) {
        base44.auth.redirectToLogin(window.location.pathname + window.location.search);
        return;
      }

      setUser(u);
      let agentRecord;

      if (agentId) {
        // ?id= param: ONLY Reizor Main Admin can view any WL by id
        if (u.role !== "admin") {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
        const found = await base44.entities.WhiteLabel.filter({ id: agentId }, null, 1);
        agentRecord = found[0];
      } else if (wlId && isSetup) {
        const found = await base44.entities.WhiteLabel.filter({ id: wlId }, null, 1);
        agentRecord = found[0];
        if (agentRecord && agentRecord.signup_status !== "completed") {
          setLoading(false);
          return;
        }
      } else if (u.role === "admin") {
        // Admin visiting /agent-dashboard directly with no ?id= — never auto-load a WL
        // record just because it happens to share the admin's email (stray test data).
        agentRecord = null;
      } else {
        // Normal WL login: find ONLY by the logged-in user's email or user_id
        if (u.email) {
          const byEmail = await base44.entities.WhiteLabel.filter({ email: u.email }, null, 1).catch(() => []);
          agentRecord = byEmail[0];

          if (!agentRecord && u.id) {
            const byUserId = await base44.entities.WhiteLabel.filter({ user_id: u.id }, null, 1).catch(() => []);
            agentRecord = byUserId[0];
          }

          if (agentRecord) {
            localStorage.setItem("wl_id", agentRecord.id);
          } else {
            localStorage.removeItem("wl_id");
          }
        }
      }

      if (!agentRecord) { setLoading(false); return; }

      // Ownership validation — WL users may only see their own record
      if (u.role !== "admin") {
        const ownsRecord =
          agentRecord.email?.toLowerCase() === u.email?.toLowerCase() ||
          agentRecord.user_id === u.id;
        if (!ownsRecord) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
      }

      setAgent(agentRecord);

      const artistIds = agentRecord.managed_artist_ids || [];
      if (artistIds.length === 0) { setLoading(false); return; }

      const allArtists = await base44.entities.Artist.list("-created_date", 200);
      const managedArtists = allArtists.filter(a => artistIds.includes(a.id));
      setArtists(managedArtists);

      const rates = agentRecord.revenue_rates || {};
      const features = agentRecord.permitted_features || [];
      const earningsMap = {};
      let total = 0;

      await Promise.all(features.map(async (feature) => {
        const rate = (rates[feature] || 0) / 100;
        if (rate === 0) return;

        let featureRevenue = 0;
        const artistEmails = managedArtists.map(a => a.user_email);

        if (feature === "merch") {
          const orders = await base44.entities.MerchOrder.list("-created_date", 500);
          const relevant = orders.filter(o => artistEmails.includes(o.artist_email) && o.status !== "cancelled");
          featureRevenue = relevant.reduce((s, o) => s + (o.artist_payout || 0), 0) * rate;
        } else if (feature === "donations") {
          const items = await base44.entities.ArtistDonation.list("-created_date", 500);
          const relevant = items.filter(o => artistEmails.includes(o.artist_email) && o.status === "completed");
          featureRevenue = relevant.reduce((s, o) => s + (o.net_amount || 0), 0) * rate;
        } else if (feature === "shoutouts") {
          const items = await base44.entities.ShoutoutRequest.list("-created_date", 500);
          const relevant = items.filter(o => artistEmails.includes(o.artist_email) && o.status === "completed");
          featureRevenue = relevant.reduce((s, o) => s + (o.net_amount || 0), 0) * rate;
        } else if (feature === "fan_tiers") {
          const items = await base44.entities.FanSubscription.list("-created_date", 500);
          const relevant = items.filter(o => artistEmails.includes(o.artist_email) && o.status === "active");
          featureRevenue = relevant.reduce((s, o) => s + (o.amount || 0), 0) * rate;
        } else if (feature === "digital_products") {
          const items = await base44.entities.DigitalPurchase.list("-created_date", 500);
          const relevant = items.filter(o => artistEmails.includes(o.artist_email));
          featureRevenue = relevant.reduce((s, o) => s + (o.net_amount || 0), 0) * rate;
        } else if (feature === "bookings") {
          const items = await base44.entities.ArtistBooking.list("-created_date", 500);
          const relevant = items.filter(o => artistEmails.includes(o.artist_email) && o.status === "accepted");
          featureRevenue = relevant.reduce((s, o) => s + (o.budget || 0), 0) * rate;
        }

        earningsMap[feature] = featureRevenue;
        total += featureRevenue;
      }));

      setEarnings(earningsMap);
      setTotalEarned(total);
      setLoading(false);
    });
  }, [setupComplete]);

  const handleLogout = () => {
    localStorage.removeItem("wl_id");
    base44.auth.logout('/');
  };

  // Show setup form
  if (wlId && isSetup && !setupComplete && !loading) {
    const currentAgent = agent;
    if (!currentAgent || currentAgent.signup_status !== "completed") {
      return (
        <WhiteLabelSetup
          wlId={wlId}
          inviteEmail={inviteEmail}
          onComplete={() => setSetupComplete(true)}
        />
      );
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (accessDenied) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="font-display font-black text-2xl">Access Denied</h1>
        <p className="text-muted-foreground text-sm">You don't have permission to view this White Label dashboard.</p>
        <Link to="/" className="inline-block px-6 py-3 rounded-lg border border-border/50 text-sm font-mono font-bold hover:border-primary/40 transition-colors">← Back to Home</Link>
      </div>
    </div>
  );

  if (!agent) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <Globe className="w-12 h-12 text-muted-foreground/30 mx-auto" />
        <p className="text-muted-foreground">No White Label profile found for your account.</p>
        <Link to="/" className="text-sm text-accent hover:underline">Back to home</Link>
      </div>
    </div>
  );

  const enabledFeatures = (agent.permitted_features || []).filter(f => FEATURE_META[f]);
  const isAdminViewing = user?.role === "admin";
  const brandName = agent.brand_name || agent.name || "White Label";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header / Top Bar ── */}
      <header className="sticky top-0 z-40 bg-card border-b border-border/50 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {agent.logo_url ? (
            <img src={agent.logo_url} alt={brandName} className="w-8 h-8 rounded-full object-cover border border-border shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-sm shrink-0">
              {brandName[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display font-black text-sm truncate">{brandName}</p>
            <p className="text-[10px] font-mono text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAdminViewing && (
            <Link to="/admin/white-labels"
              className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground border border-border/50 px-3 py-1.5 rounded-lg transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Admin Panel
            </Link>
          )}

          {/* User menu */}
          <div className="relative">
            <button onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-secondary text-sm font-medium transition-colors hover:border-primary/40">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-card border border-border/80 shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-border/50">
                    <p className="text-xs font-mono text-muted-foreground">Signed in as</p>
                    <p className="text-xs font-bold truncate">{user?.email}</p>
                    <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded mt-1 inline-block">
                      {agent.parent_wl_id ? "Sub White Label" : "White Label"}
                    </span>
                  </div>
                  <Link to="/profile" onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Settings className="w-4 h-4" /> Settings
                  </Link>
                  <button onClick={() => { setMenuOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Dashboard Content ── */}
      <div className="flex-1 py-8 px-4 max-w-5xl mx-auto w-full space-y-8">

        {/* Header Card */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border/50">
          {agent.logo_url ? (
            <img src={agent.logo_url} alt={brandName} className="w-16 h-16 rounded-full object-cover border-2 border-border" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-black text-primary">
              {brandName[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-black text-2xl tracking-tight truncate">{brandName}</h1>
            <p className="text-sm text-muted-foreground font-mono">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${agent.is_active ? "text-green-400 bg-green-400/10" : "text-destructive bg-destructive/10"}`}>
                {agent.is_active ? "Active" : "Inactive"}
              </span>
              {agent.parent_wl_id && (
                <span className="text-[10px] font-mono text-accent bg-accent/10 px-2 py-0.5 rounded">Sub White Label</span>
              )}
              {agent.domain && (
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{agent.domain}</span>
              )}
            </div>
          </div>
        </div>

        {/* Overview stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="Total Revenue Share" value={`$${totalEarned.toFixed(2)}`} icon={TrendingUp} accent />
          <StatCard label="Managed Artists" value={artists.length} icon={Music} />
          <StatCard label="Enabled Features" value={enabledFeatures.length} icon={Globe} />
        </div>

        {/* Revenue breakdown */}
        {enabledFeatures.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-lg mb-3">REVENUE SHARE BREAKDOWN</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {enabledFeatures.map(feature => {
                const meta = FEATURE_META[feature];
                const Icon = meta.icon;
                const rate = agent.revenue_rates?.[feature] || 0;
                const earned = earnings[feature] || 0;
                return (
                  <div key={feature} className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                      <p className="font-display font-bold text-sm">{meta.label}</p>
                      <span className="ml-auto text-xs font-mono text-muted-foreground">{rate}% rate</span>
                    </div>
                    <p className={`font-mono text-2xl font-black ${meta.color}`}>${earned.toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Storage Usage */}
        {user && agent && <StorageUsageSummary userEmail={user.email} userType="white_label" />}

        {/* Permissions summary */}
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider">Your Permissions</h2>
          <div className="flex flex-wrap gap-2">
            {agent.can_add_artists ? (
              <span className="flex items-center gap-1.5 text-xs font-mono text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full">
                <UserPlus className="w-3 h-3" /> Can Add Artists
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                <Lock className="w-3 h-3" /> Add Artists (not permitted)
              </span>
            )}
            {agent.can_add_organizers ? (
              <span className="flex items-center gap-1.5 text-xs font-mono text-accent bg-accent/10 px-2.5 py-1 rounded-full">
                <UserPlus className="w-3 h-3" /> Can Add Organizers
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                <Lock className="w-3 h-3" /> Add Organizers (not permitted)
              </span>
            )}
            {enabledFeatures.map(f => (
              <span key={f} className="text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                {FEATURE_META[f]?.label} ({agent.revenue_rates?.[f] || 0}%)
              </span>
            ))}
          </div>
        </div>

        {/* ── Website Widgets / Embed Code ── */}
        <div className="p-4 rounded-xl bg-card border border-border/50 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Code2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-sm uppercase tracking-wider">Website Widgets / Embed Code</h2>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">Embed your branded Reizor widget on your own website — includes your assigned events and artists.</p>
            </div>
          </div>
          <Link to="/white-label/embed" target="_blank" className="shrink-0">
            <Button className="glow-lime font-display font-bold gap-2 w-full sm:w-auto">
              <Code2 className="w-4 h-4" /> Get Embed Code
            </Button>
          </Link>
        </div>

        {/* ── Manage Artists ── */}
        <PermissionSection
          title="MANAGE ARTISTS"
          icon={Music}
          allowed={!!agent.can_add_artists}
          lockedMessage="You do not have permission to add or manage artists. Contact your administrator."
        >
          <WLInvitePanel
            label="Artist"
            agent={agent}
            roleToInvite="artist"
            placeholder="artist@example.com"
            hint="Invite an artist by email. They'll receive a signup link to join your roster."
          />
          {artists.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              {artists.map(a => (
                <ArtistCard
                  key={a.id}
                  a={a}
                  agent={agent}
                  onRemove={(id) => setArtists(prev => prev.filter(ar => ar.id !== id))}
                />
              ))}
            </div>
          )}
          {artists.length === 0 && (
            <p className="text-sm text-muted-foreground font-mono mt-3">No artists in your roster yet.</p>
          )}
        </PermissionSection>

        {/* ── Manage Organizers ── */}
        <PermissionSection
          title="MANAGE ORGANIZERS"
          icon={Users}
          allowed={!!agent.can_add_organizers}
          lockedMessage="You do not have permission to add or manage organizers. Contact your administrator."
        >
          <WLInvitePanel
            label="Organizer"
            agent={agent}
            roleToInvite="organizer"
            placeholder="organizer@example.com"
            hint="Invite an organizer by email. They'll receive a signup link to create and manage events."
          />
        </PermissionSection>

        {/* ── Fee Management ── */}
        <div className="p-4 rounded-xl bg-card border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold text-sm uppercase tracking-wider">Platform Fee Management</h2>
          </div>
          <WLFeeManager agent={agent} currentUser={user} />
        </div>

        {/* Sub-white-labels */}
        <div className="p-4 rounded-xl bg-card border border-border/50">
          <SubWhiteLabelManager agent={agent} currentUser={user} />
        </div>

        {/* ── Powered by Reizor ── */}
        <div className="flex items-center justify-center py-6 border-t border-border/20">
          <p className="text-xs font-mono text-muted-foreground/40">
            Powered by <span className="text-primary/60 font-bold">Reizor</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Permission-gated section wrapper ──
function PermissionSection({ title, icon: Icon, allowed, lockedMessage, children }) {
  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
        <Icon className={`w-4 h-4 ${allowed ? "text-primary" : "text-muted-foreground"}`} />
        <h2 className="font-display font-bold text-sm uppercase tracking-wider flex-1">{title}</h2>
        {allowed ? (
          <span className="text-[10px] font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Permitted</span>
        ) : (
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> Locked
          </span>
        )}
      </div>
      <div className="p-4">
        {allowed ? children : (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/30">
            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">{lockedMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Invite panel used by both Artist & Organizer sections ──
function WLInvitePanel({ label, agent, roleToInvite, placeholder, hint }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleInvite = async () => {
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      const signupLink = `${window.location.origin}/artist/signup?wl_id=${agent.id}&email=${encodeURIComponent(normalizedEmail)}&role=${roleToInvite}`;
      const inviterName = agent.brand_name || agent.name || "Your White Label Partner";
      const { base44: b44 } = await import("@/api/base44Client");
      await b44.functions.invoke('sendWLInvite', {
        to: normalizedEmail,
        name: name.trim(),
        link: signupLink,
        senderName: inviterName,
        role: roleToInvite,
        _source: `WhiteLabelDashboard/invite_${roleToInvite}`,
      });
      setSent(true);
      setEmail("");
      setName("");
    } catch (err) {
      setError("Could not send invite email. Please try again.");
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="p-3 rounded-lg bg-green-400/10 border border-green-400/20 flex items-center justify-between gap-3">
        <p className="text-xs font-mono text-green-400">✅ Invite sent successfully.</p>
        <button onClick={() => setSent(false)} className="text-xs font-mono text-muted-foreground hover:text-foreground">Invite another</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-mono">{hint}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={`${label} name (optional)`}
          className="bg-secondary border-border/50 sm:w-40"
        />
        <Input
          value={email}
          onChange={e => { setEmail(e.target.value); setError(""); }}
          placeholder={placeholder}
          className={`bg-secondary flex-1 ${error ? "border-destructive" : "border-border/50"}`}
        />
        <Button onClick={handleInvite} disabled={sending} className="glow-lime font-display font-bold gap-2 shrink-0">
          <Send className="w-3.5 h-3.5" /> {sending ? "Sending..." : `Invite ${label}`}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive font-mono">{error}</p>}
    </div>
  );
}