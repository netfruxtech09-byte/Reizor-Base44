import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import CashbackTermsModal from "../../components/cashback/CashbackTermsModal";
import { DollarSign, Users, Gift, Music, TrendingUp, Plus, ExternalLink, Share2, Copy, Check, CalendarCheck, Mic2, Image, ShoppingBag, Download, Zap, ArrowRight, ImagePlus, Mail, Upload, LogOut, MapPin, Code2, HardDrive, Play } from "lucide-react";
import DeleteAccountButton from "@/components/shared/DeleteAccountButton";
import StorageUsageSummary from "../../components/storage/StorageUsageSummary";
import StreamingUsageSummary from "../../components/streaming/StreamingUsageSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { uploadToSpaces } from "@/utils/spacesStorage";
import StatCard from "../../components/shared/StatCard";
import { toast } from "sonner";

const QUICK_ACTIONS = [
  { to: "/artist/posts",    icon: Plus,        label: "New Post",       color: "text-primary",    bg: "bg-primary/10"   },
  { to: "/artist/bookings", icon: CalendarCheck,label: "Bookings",      color: "text-accent",     bg: "bg-accent/10"    },
  { to: "/artist/tiers",    icon: Zap,         label: "Fan Tiers",      color: "text-yellow-400", bg: "bg-yellow-400/10"},
  { to: "/artist/merch",    icon: ShoppingBag, label: "Merch",          color: "text-orange-400", bg: "bg-orange-400/10"},
  { to: "/artist/gallery",  icon: Image,       label: "Gallery",        color: "text-purple-400", bg: "bg-purple-400/10"},
  { to: "/artist/downloads",icon: Download,    label: "Downloads",      color: "text-blue-400",   bg: "bg-blue-400/10"  },
  { to: "/artist/pl",       icon: TrendingUp,  label: "P&L Report",      color: "text-red-400",    bg: "bg-red-400/10"   },
  { to: "/artist/payouts",  icon: DollarSign,  label: "Payouts",        color: "text-green-400",  bg: "bg-green-400/10" },
  { to: "/artist/analytics",icon: TrendingUp,  label: "Analytics",      color: "text-pink-400",   bg: "bg-pink-400/10"  },
  { to: "/artist/embed",    icon: Code2,       label: "Website Widgets",color: "text-cyan-400",   bg: "bg-cyan-400/10"  },
];

export default function ArtistDashboard() {
  const [artist, setArtist] = useState(null);
  const [donations, setDonations] = useState([]);
  const [raffles, setRaffles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [follows, setFollows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedBooking, setCopiedBooking] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [followMeLoading, setFollowMeLoading] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const signatures = await base44.entities.CashbackTermsSignature.filter({ user_email: u.email, user_role: "artist" }, null, 1).catch(() => []);
      if (signatures.length === 0) setShowTermsModal(true);
      const artists = await base44.entities.Artist.filter({ user_email: u.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      const a = artists[0];
      setArtist(a);
      const [d, r, p, f] = await Promise.all([
        base44.entities.ArtistDonation.filter({ artist_id: a.id }, "-created_date", 100),
        base44.entities.ArtistRaffle.filter({ artist_id: a.id }, "-created_date", 20),
        base44.entities.ArtistPost.filter({ artist_id: a.id }, "-created_date", 50),
        base44.entities.ArtistFollow.filter({ artist_id: a.id }, null, 500),
      ]);
      setDonations(d);
      setRaffles(r);
      setPosts(p);
      setFollows(f);
      setContactEmail(a.contact_email || "");
      setLoading(false);
    });
  }, []);

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerUploading(true);
    try {
      const folder = artist?.id ? `artists/${artist.id}/media` : "artists/banners";
      const file_url = await uploadToSpaces(file, folder);
      await base44.entities.Artist.update(artist.id, { banner_image: file_url });
      setArtist(a => ({ ...a, banner_image: file_url }));
      toast.success("Banner updated!");
    } catch {
      toast.error("Banner upload failed. Please try again.");
    } finally {
      setBannerUploading(false);
    }
  };

  const handleFollowMe = async () => {
    setFollowMeLoading(true);
    // Try to get country from profile; if missing, try geolocation
    let country = artist.country || artist.location_country || "";
    if (!country) {
      try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 }));
        const { latitude, longitude } = pos.coords;
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const geoData = await geoRes.json();
        country = geoData?.address?.country || "";
      } catch { country = ""; }
    }
    if (!country) {
      toast.error("Could not determine your country. Please update your artist profile location.");
      setFollowMeLoading(false);
      return;
    }
    const res = await base44.functions.invoke("notifyOrganizersFollowMe", { artist_id: artist.id, country }).catch(e => ({ data: { error: e.message } }));
    if (res?.data?.success) {
      toast.success(`✅ Notified ${res.data.notified} organizer(s) in ${country}!`);
    } else {
      toast.error(res?.data?.error || "Could not send notifications. Try again.");
    }
    setFollowMeLoading(false);
  };

  const saveContactEmail = async () => {
    setSavingContact(true);
    await base44.entities.Artist.update(artist.id, { contact_email: contactEmail });
    setArtist(a => ({ ...a, contact_email: contactEmail }));
    setSavingContact(false);
    toast.success("Contact email saved!");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (showTermsModal) return <CashbackTermsModal userRole="artist" onAccept={() => setShowTermsModal(false)} />;
  if (!artist) return (
    <div className="text-center py-20">
      <Mic2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
      <p className="text-muted-foreground mb-4">You don't have an artist profile yet.</p>
      <Button asChild className="glow-lime font-display font-bold"><Link to="/artist/signup">Create Artist Profile</Link></Button>
    </div>
  );

  const profileUrl = `${window.location.origin}/artists/${artist.id}`;
  const bookingUrl = `${window.location.origin}/book/${artist.id}`;
  const totalDonations = donations.filter(d => d.status === "completed").reduce((s, d) => s + (d.net_amount || 0), 0);
  const activeRaffles = raffles.filter(r => r.status === "active").length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {artist.profile_image ? (
            <img src={artist.profile_image} alt={artist.display_name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-primary/30 shrink-0" />
          ) : (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Music className="w-7 h-7 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{greeting()}</p>
            <h1 className="font-display font-black text-2xl sm:text-4xl tracking-tight truncate">{artist.display_name} 🎵</h1>
            {artist.genre && <p className="text-sm text-muted-foreground font-mono mt-0.5">{artist.genre.replace(/_/g," ").toUpperCase()}</p>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to={`/artists/${artist.id}`}><ExternalLink className="w-3.5 h-3.5" /><span className="hidden sm:inline">View Profile</span><span className="sm:hidden">Profile</span></Link>
          </Button>
          <Button asChild size="sm" className="glow-lime font-display font-bold gap-1.5">
            <Link to="/artist/posts"><Plus className="w-3.5 h-3.5" /> New Post</Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Followers" value={follows.length} icon={Users} to="/artist/analytics" />
        <StatCard label="Total Posts" value={posts.length} icon={TrendingUp} to="/artist/posts" />
        <StatCard label="Active Raffles" value={activeRaffles} icon={Gift} to="/artist/raffles" />
        <StatCard label="Net Donations" value={`$${totalDonations.toFixed(2)}`} icon={DollarSign} accent to="/artist/donations" />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-display font-bold text-base uppercase tracking-wider mb-3 text-muted-foreground">Quick Actions</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {QUICK_ACTIONS.map(({ to, icon: Icon, label, color, bg }) => (
            <Link key={to} to={to}
              className="group flex flex-col items-center text-center gap-1.5 p-2 sm:p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${color}`} />
              </div>
              <p className="font-bold text-[9px] sm:text-[10px] leading-tight">{label}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Profile Settings */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Banner Upload */}
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2"><ImagePlus className="w-3.5 h-3.5" /> Banner Image</p>
          {artist.banner_image && (
            <img src={artist.banner_image} alt="Banner" className="w-full h-20 object-cover rounded-lg" />
          )}
          <label className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-border/50 text-xs font-mono text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-primary transition-colors ${bannerUploading ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="w-3.5 h-3.5" />
            {bannerUploading ? "Uploading..." : "Upload Banner"}
            <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} disabled={bannerUploading} />
          </label>
        </div>
        {/* Contact Email */}
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Public Contact Email</p>
          <p className="text-xs text-muted-foreground">Shown as a Contact button on your public profile.</p>
          <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="booking@example.com" className="bg-secondary border-border/50 text-sm" />
          <Button size="sm" onClick={saveContactEmail} disabled={savingContact} className="w-full">
            {savingContact ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Share Links */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 min-w-0">
          <Share2 className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Profile Link</p>
            <p className="text-xs font-mono truncate text-muted-foreground">{profileUrl}</p>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(profileUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-mono font-bold hover:bg-primary/20 transition-colors whitespace-nowrap">
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
        {artist.approval_status === "approved" ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 min-w-0">
            <CalendarCheck className="w-4 h-4 text-accent shrink-0" />
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Booking Link</p>
              <p className="text-xs font-mono truncate text-muted-foreground">{bookingUrl}</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(bookingUrl); setCopiedBooking(true); setTimeout(() => setCopiedBooking(false), 2000); }}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-mono font-bold hover:bg-accent/20 transition-colors whitespace-nowrap">
              {copiedBooking ? "✓ Copied" : "Copy"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-yellow-400/30 min-w-0">
            <CalendarCheck className="w-4 h-4 text-yellow-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Booking Link</p>
              <p className="text-xs font-mono text-yellow-400">Available once your profile is approved</p>
            </div>
          </div>
        )}
      </div>

      {/* Follow Me */}
      <div className="p-4 rounded-xl bg-card border border-primary/20 space-y-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <p className="font-display font-bold text-sm">Follow Me</p>
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded">New</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Let organizers in your country know you're available for bookings.
          {artist.country ? ` Your location: ${artist.country}.` : " (Update your profile country for best results)"}
        </p>
        <Button
          size="sm"
          onClick={handleFollowMe}
          disabled={followMeLoading}
          className="w-full glow-lime font-display font-bold gap-2"
        >
          <MapPin className="w-3.5 h-3.5" />
          {followMeLoading ? "Notifying organizers…" : "Activate Follow Me"}
        </Button>
      </div>

      {/* Recent Donations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-lg">RECENT DONATIONS</h2>
          <Link to="/artist/donations" className="flex items-center gap-1 text-xs font-mono text-primary hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {donations.length === 0 ? (
          <div className="p-8 rounded-xl bg-card border border-border/50 text-center">
            <DollarSign className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No donations yet — share your profile to get started!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {donations.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary text-sm">
                  {(d.donor_name || "A")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{d.donor_name || "Anonymous"}</p>
                  {d.message && <p className="text-xs text-muted-foreground italic truncate">"{d.message}"</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-bold text-green-400">${(d.net_amount || 0).toFixed(2)}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">net</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Raffles */}
      {activeRaffles > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg">ACTIVE RAFFLES</h2>
            <Link to="/artist/raffles" className="flex items-center gap-1 text-xs font-mono text-primary hover:underline">
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid gap-2">
            {raffles.filter(r => r.status === "active").map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border/50">
                <div className="min-w-0">
                  <p className="font-bold truncate">{r.prize_title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{r.entries?.length || 0} entries · {r.num_winners} winner{r.num_winners > 1 ? "s" : ""}</p>
                </div>
                <span className="font-mono text-[10px] font-bold uppercase text-green-400 bg-green-400/10 px-2 py-1 rounded shrink-0">Active</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streaming Usage */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Play className="w-4 h-4 text-accent" />
          <h2 className="font-display font-bold text-base section-title">Streaming Minutes Usage</h2>
        </div>
        {user && <StreamingUsageSummary isAdmin={user.role === "admin"} />}
      </div>

      {/* Storage Usage */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-base section-title">Media Storage Usage</h2>
        </div>
        {user && <StorageUsageSummary userEmail={user.email} userType="artist" />}
      </div>

      {/* Account Actions */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">Account Actions</p>
        <button
          onClick={() => base44.auth.logout("/")}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 font-display font-bold text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      {/* Danger Zone — non-admins only */}
      {user?.role !== "admin" && (
        <div className="p-5 rounded-xl bg-destructive/5 border border-destructive/30 space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-destructive">⚠ Danger Zone</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Permanently deleting your account will remove all your data and cannot be undone.
          </p>
          <DeleteAccountButton user={user} />
        </div>
      )}
    </div>
  );
}