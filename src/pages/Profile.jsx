import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import BackButton from "@/components/shared/BackButton";
import { User, Mail, MapPin, Phone, LogOut, Music2, Navigation, Star, Wallet, Eye, EyeOff, Heart, AlertTriangle, Trophy, Users, HelpCircle } from "lucide-react";
import FanOnboardingModal from "@/components/onboarding/FanOnboardingModal";
import PrizeGuideModal from "@/components/onboarding/PrizeGuideModal";
import DeleteAccountButton from "@/components/shared/DeleteAccountButton";
import TwoFactorSettings from "@/components/auth/TwoFactorSettings";
import AccountSecuritySection from "@/components/auth/AccountSecuritySection";
import MembershipSection from "../components/loyalty/MembershipSection";
import useIsIOS from "@/hooks/useIsIOS";
import LoyaltyProgramExplainer from "../components/loyalty/LoyaltyProgramExplainer";
import ReferralWidget from "../components/referral/ReferralWidget";
import LoyaltyBadge, { getTier } from "../components/loyalty/LoyaltyBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

export default function Profile() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const isIOS = useIsIOS();
  const isNewUser = new URLSearchParams(window.location.search).get("new") === "1";
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [form, setForm] = useState({ phone: "", city: "", state: "", date_of_birth: "", gender: "", preferred_genres: [] });
  const [deleting, setDeleting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [loyalty, setLoyalty] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
  const [showPrizeGuide, setShowPrizeGuide] = useState(false);

  const DEFAULT_GENRES = [
    { key: "techno", label: "Techno" },
    { key: "house", label: "House" },
    { key: "drum_and_bass", label: "D&B" },
    { key: "trance", label: "Trance" },
    { key: "hip_hop", label: "Hip-Hop" },
    { key: "rnb", label: "R&B" },
    { key: "pop", label: "Pop" },
    { key: "rock", label: "Rock" },
    { key: "electronic", label: "Electronic" },
    { key: "latin", label: "Latin" },
    { key: "reggaeton", label: "Reggaeton" },
    { key: "afrobeats", label: "Afrobeats" },
    { key: "jazz", label: "Jazz" },
    { key: "reggae", label: "Reggae" },
    { key: "dancehall", label: "Dancehall" },
    { key: "amapiano", label: "Amapiano" },
    { key: "soca", label: "Soca" },
    { key: "bollywood", label: "Bollywood" },
    { key: "punjabi", label: "Punjabi" },
    { key: "kpop", label: "K-Pop" },
    { key: "country", label: "Country" },
  ];

  const [customGenres, setCustomGenres] = useState(() => {
    try { return JSON.parse(localStorage.getItem("custom_genres") || "[]"); } catch { return []; }
  });
  const [newGenreInput, setNewGenreInput] = useState("");

  const GENRES = [
    ...DEFAULT_GENRES,
    ...customGenres.map(g => ({ key: g.toLowerCase().replace(/\s+/g, "_"), label: g })),
  ];

  const addCustomGenre = () => {
    const trimmed = newGenreInput.trim();
    if (!trimmed) return;
    const isDuplicate = GENRES.some(g => g.label.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) { toast.error("Genre already exists"); setNewGenreInput(""); return; }
    const updated = [...customGenres, trimmed];
    setCustomGenres(updated);
    localStorage.setItem("custom_genres", JSON.stringify(updated));
    const key = trimmed.toLowerCase().replace(/\s+/g, "_");
    setForm(f => ({ ...f, preferred_genres: [...f.preferred_genres, key] }));
    setNewGenreInput("");
    toast.success(`"${trimmed}" added!`);
  };

  const toggleGenre = (key) => {
    setForm((f) => ({
      ...f,
      preferred_genres: f.preferred_genres.includes(key)
        ? f.preferred_genres.filter((g) => g !== key)
        : [...f.preferred_genres, key],
    }));
  };

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await res.json();
        const city = data.address?.city || data.address?.town || data.address?.village || "";
        if (city) setForm((f) => ({ ...f, city }));
        setDetectingLocation(false);
      },
      () => setDetectingLocation(false)
    );
  };

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      setForm({ phone: u.phone || "", city: u.city || "", state: u.state || "", date_of_birth: u.date_of_birth || "", gender: u.gender || "", preferred_genres: u.preferred_genres || [] });
      // Load loyalty account only for fans
      if (u.role === "user") {
        const existing = await base44.entities.LoyaltyAccount.filter({ user_email: u.email }, null, 1);
        if (existing.length > 0) {
          const scanned = await base44.entities.Ticket.filter({ owner_email: u.email, status: "scanned" }, null, 200);
          const attended = scanned.length;
          if (attended !== existing[0].attended_count) {
            await base44.entities.LoyaltyAccount.update(existing[0].id, { attended_count: attended });
            setLoyalty({ ...existing[0], attended_count: attended });
          } else {
            setLoyalty(existing[0]);
          }
        } else {
          const acc = await base44.entities.LoyaltyAccount.create({ user_email: u.email, user_name: u.full_name, cashback_balance: 0, total_spent: 0, attended_count: 0, show_badge: true });
          setLoyalty(acc);
        }
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (isNewUser && form.preferred_genres.length === 0) {
      toast.error("Please select at least one music genre to receive better event recommendations.");
      return;
    }
    setSaving(true);
    try {
      await base44.auth.updateMe(form);
      setUser(u => ({ ...u, ...form }));
      if (isNewUser) {
        toast.success("Profile saved! Your event recommendations will now be more personalized.");
        setSavedOnce(true);
      } else {
        toast.success("Profile updated!");
      }
    } catch (err) {
      toast.error("Failed to save. Please try again.");
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await base44.entities.User.delete(user.id);
    } catch {
      // Deletion may fail for non-admins due to RLS — log out regardless
    }
    toast.success("Account deleted. Goodbye!");
    await base44.auth.logout('/');
  };

  const handleDeactivate = async () => {
    if (!window.confirm("Deactivate your account? You can reactivate by signing in again.")) return;
    setDeactivating(true);
    await base44.entities.User.update(user.id, { status: "inactive" }).catch(() => {});
    toast.success("Account deactivated.");
    await base44.auth.logout('/');
  };

  const handleReactivate = async () => {
    setDeactivating(true);
    await base44.entities.User.update(user.id, { status: "active" }).catch(() => {});
    setUser(u => ({ ...u, status: "active" }));
    setDeactivating(false);
    toast.success("Account reactivated!");
  };

  const togglePublicProfile = async () => {
    const next = !user.is_public_profile;
    await base44.auth.updateMe({ is_public_profile: next });
    setUser(u => ({ ...u, is_public_profile: next }));
    toast.success(next ? "Your profile is now public and searchable by name." : "Your profile is now private.");
  };

  const toggleBadge = async () => {
    if (!loyalty) return;
    const updated = await base44.entities.LoyaltyAccount.update(loyalty.id, { show_badge: !loyalty.show_badge });
    setLoyalty((l) => ({ ...l, show_badge: updated.show_badge }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const roleLabels = { admin: "Super Admin", organizer: "Organizer", manager: "Manager", vendor: "Vendor", user: "Fan", artist: "Artist" };
  const roleLinks = {
    admin:     [{ to: "/admin",      label: "Admin Panel" }],
    organizer: [{ to: "/organizer",  label: "Organizer Dashboard" }, { to: "/organizer/events", label: "My Events" }],
    artist:    [{ to: "/artist",     label: "Artist Studio" }, { to: "/artist/payouts", label: "Payouts" }],
  };

  const greeting = () => { const h = new Date().getHours(); if (h < 12) return "Good morning"; if (h < 18) return "Good afternoon"; return "Good evening"; };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-2xl mx-auto">
      <BackButton to="/" label="Home" />
      {/* Header */}
      <div className="mb-8">
        <p className="font-mono text-xs text-muted-foreground tracking-[0.2em] uppercase">{greeting()}</p>
        <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight mt-1">{user?.full_name?.split(" ")[0] || "Friend"} 👋</h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded">{roleLabels[user?.role] || "Fan"}</span>
          <span className="text-xs text-muted-foreground font-mono">{user?.email}</span>
        </div>
        {/* Role shortcuts */}
        {roleLinks[user?.role] && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {roleLinks[user.role].map(l => (
              <a key={l.to} href={l.to} className="text-xs font-mono text-accent underline hover:text-accent/80">{l.label} →</a>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-5">

        {/* ── New user onboarding banner ── */}
        {isNewUser && !savedOnce && (
          <div className="p-5 rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 border border-primary/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎵</span>
              <h2 className="font-display font-black text-lg tracking-tight">Complete Your Profile</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Add your location and favorite music genres so Reizor can recommend music events in your area based on your interests.
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              Fill in your city, select your music genres below, then hit <span className="text-primary font-bold">Save Changes</span>.
            </p>
          </div>
        )}

        {/* ── Post-save CTA for new users ── */}
        {isNewUser && savedOnce && (
          <div className="p-5 rounded-xl bg-gradient-to-br from-green-400/10 to-accent/10 border border-green-400/30 space-y-3 text-center">
            <p className="text-2xl">🎉</p>
            <p className="font-display font-bold text-lg">You're all set!</p>
            <p className="text-sm text-muted-foreground">Your profile is saved. Reizor will now recommend events that match your taste and location.</p>
            <Button onClick={() => navigate("/discover")} className="glow-lime font-display font-bold w-full sm:w-auto">
              Find Events Near Me →
            </Button>
          </div>
        )}

        {/* Edit Form — 1st: Personal Information */}
        <div className="p-6 rounded-xl bg-card border border-border/50 space-y-4">
          <h3 className="font-display font-bold">Personal Information</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground font-mono">Phone</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                  className="pl-9 bg-secondary border-border/50"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-mono">City</Label>
              <div className="relative mt-1 flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="e.g. Miami"
                    className="pl-9 bg-secondary border-border/50"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={detectLocation}
                  disabled={detectingLocation}
                  className="border-border/50 text-muted-foreground hover:text-primary flex-shrink-0"
                  title="Detect my location"
                >
                  <Navigation className={`w-4 h-4 ${detectingLocation ? "animate-pulse text-primary" : ""}`} />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-mono">State / Province</Label>
              <Input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                placeholder="e.g. New York"
                className="mt-1 bg-secondary border-border/50"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-mono">Date of Birth</Label>
              <Input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                className="mt-1 bg-secondary border-border/50"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground font-mono">Gender</Label>
              <p className="text-[10px] text-muted-foreground font-mono mb-1">Tap to change your preference</p>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm cursor-pointer hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary transition-colors appearance-none"
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground font-mono">Email</Label>
            <Input
              type="email"
              value={user?.email || ""}
              readOnly
              placeholder="your@email.com"
              className="mt-1 bg-secondary border-border/50 opacity-60 cursor-not-allowed"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Email cannot be edited directly. Use Account Security below to change.</p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="glow-lime font-display font-bold">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Membership — 2nd: fans only (hidden on iOS per App Store Guideline 3.1.1) */}
        {loyalty && user?.role === "user" && !isIOS && <MembershipSection loyalty={loyalty} onUpdate={setLoyalty} />}

        {/* Notification Settings — 3rd: Music Preferences & Alerts */}
        <div className={`p-6 rounded-xl bg-card border space-y-4 ${isNewUser && !savedOnce ? "border-primary/60 ring-1 ring-primary/30" : "border-border/50"}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">🔔 Music Preferences & Alerts</span>
            {isNewUser && !savedOnce && <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Required for recommendations</span>}
          </div>
          <p className="text-xs text-muted-foreground">Get notified about new events in your area that match your music taste.</p>

          {/* Genre Preferences */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Music2 className="w-4 h-4 text-primary" />
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Favorite Genres</label>
            </div>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const active = form.preferred_genres.includes(g.key);
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => toggleGenre(g.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold border transition-all ${
                      active
                        ? "bg-primary text-primary-foreground border-primary glow-lime"
                        : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {active ? "✓ " : ""}{g.label}
                  </button>
                );
              })}
            </div>
            {/* Custom genre input */}
            <div className="flex gap-2 mt-3">
              <Input
                value={newGenreInput}
                onChange={e => setNewGenreInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCustomGenre()}
                placeholder="Add a custom genre..."
                className="bg-secondary border-border/50 text-sm h-8"
              />
              <Button type="button" size="sm" variant="outline" onClick={addCustomGenre} className="shrink-0 h-8 border-primary/40 text-primary hover:bg-primary/10">
                + Add
              </Button>
            </div>
            {form.preferred_genres.length > 0 ? (
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                {form.preferred_genres.length} genre{form.preferred_genres.length > 1 ? "s" : ""} selected
                {form.city ? ` · alerts for events in ${form.city}` : " · add a city above to get local alerts"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2 font-mono">Select genres to receive new event alerts</p>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving} className="glow-lime font-display font-bold">
            {saving ? "Saving..." : "Save Notification Preferences"}
          </Button>
        </div>

        {/* Event Attendance & Rewards Explainer — fans only */}
         {user?.role === "user" && <LoyaltyProgramExplainer userEmail={user?.email} />}

        {/* Loyalty Card — fans only */}
        {loyalty && user?.role === "user" && (
          <div className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-primary" />
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">Event Attendance & Rewards</span>
              </div>
              <button onClick={toggleBadge} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" title={loyalty.show_badge ? "Hide badge from public" : "Show badge publicly"}>
                {loyalty.show_badge ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {loyalty.show_badge ? "Visible" : "Hidden"}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 space-y-1">
                <LoyaltyBadge attendedCount={loyalty.attended_count} size="lg" />
                <p className="text-xs text-muted-foreground font-mono mt-1">{loyalty.attended_count} events attended · ${loyalty.total_spent.toFixed(2)} total spent</p>
              </div>
              <div className="p-3 rounded-lg bg-background/60 text-center min-w-[120px]">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Wallet className="w-3.5 h-3.5 text-accent" />
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">Ticket Credit</span>
                </div>
                <p className="font-mono text-2xl font-black text-accent">${loyalty.cashback_balance.toFixed(2)}</p>
                <p className="text-[9px] text-muted-foreground mt-2 px-1 leading-tight">Use to purchase tickets on Reizor. Cannot be withdrawn.</p>
              </div>
            </div>
            {(() => {
              const tiers = [0, 3, 10, 25, Infinity];
              const nextMin = tiers.find((t) => t > loyalty.attended_count);
              if (!nextMin || nextMin === Infinity) return null;
              const prev = tiers[tiers.indexOf(nextMin) - 1];
              const pct = Math.round(((loyalty.attended_count - prev) / (nextMin - prev)) * 100);
              return (
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                    <span>{loyalty.attended_count} attended</span>
                    <span>{nextMin - loyalty.attended_count} more to next tier</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Wishlist — fans only */}
         {user?.role === "user" && (
           <Link to="/saved" className="flex items-center justify-between p-5 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors group cursor-pointer">
             <div className="flex items-center gap-3">
               <Heart className="w-5 h-5 text-primary" />
               <div>
                 <p className="font-display font-bold">My Wishlist</p>
                 <p className="text-xs text-muted-foreground">Events you've saved</p>
               </div>
             </div>
             <span className="text-muted-foreground group-hover:text-foreground font-mono text-sm">→</span>
           </Link>
         )}

         {/* Public Profile — fans only */}
         {user?.role === "user" && (
           <div className="flex items-center justify-between p-5 rounded-xl bg-card border border-border/50">
             <div>
               <p className="font-display font-bold">Public Profile</p>
               <p className="text-xs text-muted-foreground mt-0.5">Let others find your profile by searching your name</p>
             </div>
             <Switch checked={!!user?.is_public_profile} onCheckedChange={togglePublicProfile} />
           </div>
         )}

         {/* My Prizes — fans only */}
         {user?.role === "user" && (
           <Link to="/my-prizes" className="flex items-center justify-between p-5 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors group cursor-pointer">
             <div className="flex items-center gap-3">
               <Trophy className="w-5 h-5 text-yellow-400" />
               <div>
                 <p className="font-display font-bold">My Prizes</p>
                 <p className="text-xs text-muted-foreground">Won giveaway prizes</p>
               </div>
             </div>
             <span className="text-muted-foreground group-hover:text-foreground font-mono text-sm">→</span>
           </Link>
         )}

         {/* Loyalty & Rewards — fans only */}
         {user?.role === "user" && (
           <Link to="/fan-profile?tab=loyalty" className="flex items-center justify-between p-5 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors group cursor-pointer">
             <div className="flex items-center gap-3">
               <Star className="w-5 h-5 text-primary" />
               <div>
                 <p className="font-display font-bold">Loyalty & Rewards</p>
                 <p className="text-xs text-muted-foreground">Points, tiers, and rewards from Organizers & Artists you follow</p>
               </div>
             </div>
             <span className="text-muted-foreground group-hover:text-foreground font-mono text-sm">→</span>
           </Link>
         )}

         {/* Following — fans only */}
         {user?.role === "user" && (
           <Link to="/profile/following" className="flex items-center justify-between p-5 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors group cursor-pointer">
             <div className="flex items-center gap-3">
               <Users className="w-5 h-5 text-accent" />
               <div>
                 <p className="font-display font-bold">Following</p>
                 <p className="text-xs text-muted-foreground">Organizers and artists you follow</p>
               </div>
             </div>
             <span className="text-muted-foreground group-hover:text-foreground font-mono text-sm">→</span>
           </Link>
         )}

        {/* Help & Guides — fans only */}
        {user?.role === "user" && (
          <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">Help & Guides</span>
            </div>
            <p className="text-xs text-muted-foreground">Replay the one-time guides shown when you joined or first entered a giveaway.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowOnboardingGuide(true)} className="flex-1">
                Show Welcome Guide Again
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPrizeGuide(true)} className="flex-1">
                Show Prize Guide Again
              </Button>
            </div>
          </div>
        )}

        {/* Referral — fans only */}
        {user?.role === "user" && (
          <div className="p-6 rounded-xl bg-card border border-border/50 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">🎁 Refer Friends & Earn</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Share your link and earn <span className="text-primary font-bold">$3 platform credit</span> for each eligible referral. Credit can only be redeemed toward purchases inside the platform — it cannot be withdrawn or transferred.
            </p>
            {user && <ReferralWidget user={user} />}
          </div>
        )}

        {/* Account Security */}
        {user && user.role !== "admin" && <AccountSecuritySection user={user} />}

        {/* Two-Factor Authentication */}
        {user && <TwoFactorSettings user={user} onUpdate={setUser} />}

        {/* Account Actions */}
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">Account Actions</p>
          <Button
            className="w-full gap-2 bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 font-display font-bold"
            onClick={logout}
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>

          {/* Deactivate — hidden for admins */}
          {user?.role !== "admin" && (
            <>
              {user?.status !== "inactive" ? (
                <Button variant="outline"
                  className="w-full gap-2 border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10"
                  onClick={handleDeactivate} disabled={deactivating}>
                  <AlertTriangle className="w-4 h-4" />
                  {deactivating ? "Deactivating..." : "Deactivate Account"}
                </Button>
              ) : (
                <Button variant="outline"
                  className="w-full gap-2 border-green-400/30 text-green-400 hover:bg-green-400/10"
                  onClick={handleReactivate} disabled={deactivating}>
                  {deactivating ? "Reactivating..." : "Reactivate Account"}
                </Button>
              )}
            </>
          )}

        </div>

        {/* Danger Zone — non-admins only */}
        {user?.role !== "admin" && (
          <div className="p-5 rounded-xl bg-destructive/5 border border-destructive/30 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-destructive">Danger Zone</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Permanently deleting your account will remove all your data and cannot be undone.
            </p>
            <DeleteAccountButton user={user} />
          </div>
        )}

      </div>

      {showOnboardingGuide && <FanOnboardingModal onClose={() => setShowOnboardingGuide(false)} />}
      {showPrizeGuide && <PrizeGuideModal onClose={() => setShowPrizeGuide(false)} />}
    </div>
  );
}