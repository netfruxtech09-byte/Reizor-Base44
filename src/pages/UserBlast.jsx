import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Users, Bell, Mail, Image, Type, CheckCircle2, Upload, Megaphone, AlertTriangle, X, Eye, Shield, ChevronDown, LayoutDashboard, LogOut, User, DollarSign, TrendingUp, Music, Calendar, ShoppingCart, Percent, BarChart3, Sparkles, ImageIcon, Tag, Ticket, Globe, UserCog, HardDrive, Video, Code2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AdminNotificationBell from "@/components/admin/AdminNotificationBell";
import { toast } from "sonner";

const ADMIN_NAV = [
  { to: "/admin/expenses", icon: DollarSign, label: "Admin Expenses" },
  { to: "/admin/affiliate", icon: DollarSign, label: "Affiliate Earnings" },
  { to: "/admin/analytics", icon: TrendingUp, label: "Analytics" },
  { to: "/admin/artists", icon: Music, label: "Artists" },
  { to: "/admin/discovery", icon: Sparkles, label: "Event Discovery" },
  { to: "/admin/events", icon: Calendar, label: "Events" },
  { to: "/admin/media", icon: ImageIcon, label: "Media Library" },
  { to: "/admin/moderation", icon: Shield, label: "Media Moderation" },
  { to: "/admin/orders", icon: ShoppingCart, label: "Orders" },
  { to: "/admin/organizers", icon: Users, label: "Organizers" },
  { to: "/admin/fees", icon: Percent, label: "Organizer Fees" },
  { to: "/admin/pl", icon: BarChart3, label: "P&L Report" },
  { to: "/admin/payouts", icon: DollarSign, label: "Payout Requests" },
  { to: "/admin/raffles-polls", icon: Ticket, label: "Raffles & Polls" },
  { to: "/admin/resell", icon: Tag, label: "Resell Listings" },
  { to: "/admin/sub-wl", icon: Globe, label: "Sub-WL Proposals" },
  { to: "/admin/team", icon: UserCog, label: "Team & Permissions" },
  { to: "/user-blast", icon: Send, label: "User Blast" },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/white-labels", icon: Globe, label: "White Labels" },
  { to: "/admin/crash-logs", icon: AlertTriangle, label: "Crash Logs" },
  { to: "/admin/embed", icon: Code2, label: "Embed Widgets" },
  { to: "/admin/storage", icon: HardDrive, label: "Storage Usage" },
  { to: "/admin/video-budgets", icon: Video, label: "Video Budgets" },
];

const AUDIENCE_FILTERS = [
  { key: "all", label: "All Users" },
  { key: "fans", label: "Fans" },
  { key: "organizers", label: "Organizers" },
  { key: "artists", label: "Artists" },
];

const backLink = {
  admin: "/admin",
  organizer: "/organizer",
  artist: "/artist",
  white_label: "/agent-dashboard",
};

// ── Confirmation Modal ──────────────────────────────────────────────────────
function ConfirmModal({ onConfirm, onCancel, recipientCount, subject, methods }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-black text-lg">Confirm Blast</h3>
            <p className="text-sm text-muted-foreground mt-0.5">This will send to real users immediately.</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-secondary space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subject</span>
            <span className="font-medium text-right max-w-[180px] truncate">{subject}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recipients</span>
            <span className="font-bold text-primary">{recipientCount} users</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery</span>
            <span className="font-medium">{methods}</span>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1 glow-lime font-bold gap-2" onClick={onConfirm}>
            <Send className="w-4 h-4" /> Send Now
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Preview Panel ───────────────────────────────────────────────────────────
function PreviewPanel({ subject, message, imageUrl, includeText, includeImage }) {
  return (
    <div className="p-4 rounded-xl bg-secondary border border-border/50 space-y-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <Eye className="w-3 h-3" /> Message Preview
      </p>
      {includeImage && imageUrl && (
        <img src={imageUrl} alt="preview" className="w-full max-h-40 object-cover rounded-lg border border-border/50" />
      )}
      <div className="space-y-1">
        <p className="font-bold text-sm">{subject || <span className="text-muted-foreground italic">No subject yet</span>}</p>
        {includeText && (
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {message || <span className="italic">No message yet</span>}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function UserBlast() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user: authUser } = useAuth();
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const activeNav = ADMIN_NAV.find(item => location.pathname === item.to || location.pathname.startsWith(item.to + "/"));

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Lock body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const [user, setUser] = useState(null);
  const [myUsers, setMyUsers] = useState([]);
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sendNotif, setSendNotif] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [includeImage, setIncludeImage] = useState(false);
  const [includeText, setIncludeText] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const allUsers = await base44.entities.User.list("-created_date", 1000).catch(() => []);
      let filtered = [];
      if (u.role === "admin") {
        // Admins blast only supported roles: fans, organizers, artists
        filtered = allUsers.filter(user => {
          const role = user.role;
          // Include: no role (fan), organizer/manager, artist
          return !role || role === "user" || role === "organizer" || role === "manager" || role === "artist";
        });
      } else {
        // Non-admins can only blast their referred users (same role filter)
        filtered = allUsers.filter(x => x.referred_by_email === u.email && (
          !x.role || x.role === "user" || x.role === "organizer" || x.role === "manager" || x.role === "artist"
        ));
      }
      setMyUsers(filtered.filter(x => x.email !== u.email));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    setImageFile(file.name);
    setUploadingImage(false);
    toast.success("Image uploaded");
  };

  const isFan = (u) => !u.role || u.role === "user";
  const isOrganizer = (u) => u.role === "organizer" || u.role === "manager";
  const isArtist = (u) => u.role === "artist";

  const getCount = (key) => {
    if (key === "all") {
      // Total = Fans + Organizers + Artists only (exclude Others/unsupported)
      return myUsers.filter(u => isFan(u) || isOrganizer(u) || isArtist(u)).length;
    }
    if (key === "fans") return myUsers.filter(isFan).length;
    if (key === "organizers") return myUsers.filter(isOrganizer).length;
    if (key === "artists") return myUsers.filter(isArtist).length;
    return 0;
  };

  const filteredAudience = myUsers.filter(u => {
    // Only include supported roles: fans, organizers, artists
    const isSupported = isFan(u) || isOrganizer(u) || isArtist(u);
    if (!isSupported) return false;
    
    if (audienceFilter === "all") return true;
    if (audienceFilter === "fans") return isFan(u);
    if (audienceFilter === "organizers") return isOrganizer(u);
    if (audienceFilter === "artists") return isArtist(u);
    return true;
  });

  const deliveryLabel = sendNotif && sendEmail ? "Notification + Email" : sendNotif ? "In-App Notification" : "Email";

  const validateAndConfirm = () => {
    if (!subject.trim()) return toast.error("Please enter a subject/title");
    if (includeText && !message.trim()) return toast.error("Please enter a message body");
    if (includeImage && !imageUrl) return toast.error("Please upload an image first");
    if (!sendNotif && !sendEmail) return toast.error("Choose at least one delivery method");
    if (filteredAudience.length === 0) return toast.error("No users in selected audience");
    setShowConfirm(true);
  };

  const handleSend = async () => {
    setShowConfirm(false);
    setSending(true);
    const emailBody = [
      includeImage ? `<img src="${imageUrl}" style="max-width:100%;border-radius:8px;margin-bottom:16px;" />` : "",
      includeText ? `<p style="font-size:15px;line-height:1.6;">${message.replace(/\n/g, "<br/>")}</p>` : "",
    ].filter(Boolean).join("\n");

    await Promise.all(filteredAudience.map(async (u) => {
      if (sendNotif) {
        await base44.entities.Notification.create({
          user_email: u.email,
          title: subject,
          message: includeText ? message : "(image attached — check email)",
          type: "general",
          image_url: includeImage ? imageUrl : undefined,
        }).catch(() => {});
      }
      if (sendEmail && u.email) {
        await base44.functions.invoke('emailService', {
          to: u.email,
          subject,
          body: emailBody || message,
          _source: 'UserBlast',
        }).catch(() => {});
      }
    }));

    setSentCount(filteredAudience.length);
    setSending(false);
    setDone(true);
    toast.success(`Blast sent to ${filteredAudience.length} users!`);
  };

  const resetForm = () => {
    setDone(false);
    setSubject("");
    setMessage("");
    setImageUrl("");
    setImageFile(null);
    setIncludeImage(false);
    setIncludeText(true);
    setSendNotif(true);
    setSendEmail(false);
    setAudienceFilter("all");
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  const back = backLink[user?.role] || "/";

  // ── Success State ───────────────────────────────────────────────────────
  if (done) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm w-full">
        <div className="w-16 h-16 rounded-full bg-green-400/10 border border-green-400/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <div>
          <h2 className="font-display font-black text-2xl">Blast Sent!</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Your message was delivered to <span className="text-foreground font-bold">{sentCount}</span> user{sentCount !== 1 ? "s" : ""}.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border/50 text-left space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subject</span>
            <span className="font-medium truncate max-w-[180px]">{subject}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery</span>
            <span className="font-medium">{deliveryLabel}</span>
          </div>
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <Button onClick={resetForm} variant="outline" className="flex-1">Send Another</Button>
          <Link to={back} className="flex-1">
            <Button className="w-full glow-lime font-bold">Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );

  // ── Main Form ───────────────────────────────────────────────────────────
  return (
    <>
      {showConfirm && (
        <ConfirmModal
          onConfirm={handleSend}
          onCancel={() => setShowConfirm(false)}
          recipientCount={filteredAudience.length}
          subject={subject}
          methods={deliveryLabel}
        />
      )}

      {/* ── Header — adapts to user role ── */}
      {user?.role === "admin" ? (
        <header className="sticky top-0 z-40 bg-card border-b border-border/50 px-4 sm:px-6 flex items-center justify-between gap-4" style={{ paddingTop: "12px", paddingBottom: "12px" }} data-safe-top>
          <div className="flex items-center gap-3">
            <Link to="/admin" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </Link>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="font-display font-black tracking-tight">ADMIN</span>
              <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Control Panel</span>
            </div>
          </div>

          {authUser && <AdminNotificationBell userEmail={authUser.email} />}

          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 bg-secondary text-foreground hover:border-primary/40 text-sm font-medium transition-all">
              {activeNav ? <><activeNav.icon className="w-4 h-4" /><span>{activeNav.label}</span></> : <><Send className="w-4 h-4" /><span>User Blast</span></>}
              <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>

            {menuOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} onTouchMove={e => e.preventDefault()} />
            )}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-card border border-border/80 shadow-xl overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
                <Link to="/admin" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <LayoutDashboard className="w-4 h-4" /> Overview
                </Link>
                <div className="h-px bg-border/50 my-1" />
                {ADMIN_NAV.map(item => (
                  <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                      location.pathname === item.to ? "text-primary bg-primary/10" : "text-foreground hover:bg-muted"
                    }`}>
                    <item.icon className="w-4 h-4" /> {item.label}
                  </Link>
                ))}
                <div className="h-px bg-border/50 my-1" />
                <Link to="/profile" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <User className="w-4 h-4" /> My Profile
                </Link>
                <button onClick={() => { setMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-40 bg-card border-b border-border/50 px-4 sm:px-6 flex items-center gap-3" style={{ paddingTop: "12px", paddingBottom: "12px" }} data-safe-top>
          <Link to={back} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            <span className="font-display font-black tracking-tight">USER BLAST</span>
          </div>
        </header>
      )}

      <div className="py-6 px-4 sm:px-6 max-w-3xl mx-auto space-y-5">

        {/* Page Title */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight leading-none">User Blast</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Send a message to your <span className="text-foreground font-bold">{getCount("all")}</span> user{getCount("all") !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setShowPreview(v => !v)}
          >
            <Eye className="w-3.5 h-3.5" />
            {showPreview ? "Hide" : "Preview"}
          </Button>
        </div>

        {/* Preview (collapsible) */}
        {showPreview && (
          <PreviewPanel
            subject={subject}
            message={message}
            imageUrl={imageUrl}
            includeText={includeText}
            includeImage={includeImage}
          />
        )}

        {/* ── STEP 1: Audience ─────────────────────────────────────── */}
        <section className="p-5 rounded-2xl bg-card border border-border/50 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shrink-0">1</span>
            <div>
              <h2 className="font-display font-bold text-sm">Select Audience</h2>
              <p className="text-xs text-muted-foreground">Choose who receives this blast</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {AUDIENCE_FILTERS.map(f => {
              const count = getCount(f.key);
              const active = audienceFilter === f.key;
              return (
                <button key={f.key} onClick={() => setAudienceFilter(f.key)}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-xs font-mono font-bold transition-all ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}>
                  <span className={`text-xl font-black font-display ${active ? "text-primary" : "text-foreground"}`}>{count}</span>
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Audience chips */}
          {filteredAudience.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-mono">{filteredAudience.length} recipient{filteredAudience.length !== 1 ? "s" : ""} selected</p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-lg bg-secondary/50 border border-border/30">
                {filteredAudience.slice(0, 30).map(u => (
                  <span key={u.id} className="text-[10px] font-mono bg-background px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground">{u.full_name || u.email}</span>
                ))}
                {filteredAudience.length > 30 && (
                  <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5">+{filteredAudience.length - 30} more</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" /> No users in this segment.
            </div>
          )}
        </section>

        {/* ── STEP 2: Content ──────────────────────────────────────── */}
        <section className="p-5 rounded-2xl bg-card border border-border/50 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shrink-0">2</span>
            <div>
              <h2 className="font-display font-bold text-sm">Compose Message</h2>
              <p className="text-xs text-muted-foreground">Write your broadcast content</p>
            </div>
          </div>

          {/* Content type toggles */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setIncludeText(!includeText)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                includeText ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-secondary text-muted-foreground hover:border-primary/30"
              }`}>
              <Type className="w-4 h-4" /> Text
            </button>
            <button onClick={() => setIncludeImage(!includeImage)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                includeImage ? "border-accent bg-accent/10 text-accent" : "border-border/50 bg-secondary text-muted-foreground hover:border-accent/30"
              }`}>
              <Image className="w-4 h-4" /> Image
            </button>
          </div>

          {/* Subject */}
          <div>
            <Label className="text-xs text-muted-foreground font-mono">Subject / Title <span className="text-destructive">*</span></Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Upcoming Event This Weekend 🎉"
              className="mt-1 bg-secondary border-border/50" />
            <p className="text-[10px] text-muted-foreground font-mono mt-1">{subject.length}/100 characters</p>
          </div>

          {/* Message body */}
          {includeText && (
            <div>
              <Label className="text-xs text-muted-foreground font-mono">Message Body <span className="text-destructive">*</span></Label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                placeholder="Write your message here..."
                className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
              />
              <p className="text-[10px] text-muted-foreground font-mono mt-1">{message.length} characters</p>
            </div>
          )}

          {/* Image upload */}
          {includeImage && (
            <div>
              <Label className="text-xs text-muted-foreground font-mono">Image Attachment</Label>
              <label className={`mt-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                imageUrl ? "border-green-400/50 bg-green-400/5" : "border-border/50 hover:border-accent/40 bg-secondary"
              }`}>
                {uploadingImage ? (
                  <div className="w-4 h-4 border-2 border-muted border-t-accent rounded-full animate-spin" />
                ) : (
                  <Upload className={`w-4 h-4 shrink-0 ${imageUrl ? "text-green-400" : "text-muted-foreground"}`} />
                )}
                <span className="text-sm text-muted-foreground">
                  {uploadingImage ? "Uploading..." : imageFile ? imageFile : "Click to upload JPG/PNG"}
                </span>
                {imageUrl && (
                  <button type="button" onClick={e => { e.preventDefault(); setImageUrl(""); setImageFile(null); }}
                    className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
              {imageUrl && (
                <img src={imageUrl} alt="preview" className="mt-2 w-full max-h-48 object-cover rounded-xl border border-border/50" />
              )}
            </div>
          )}
        </section>

        {/* ── STEP 3: Delivery ─────────────────────────────────────── */}
        <section className="p-5 rounded-2xl bg-card border border-border/50 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shrink-0">3</span>
            <div>
              <h2 className="font-display font-bold text-sm">Delivery Method</h2>
              <p className="text-xs text-muted-foreground">How should this message be delivered?</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => { setSendNotif(true); setSendEmail(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                sendNotif && !sendEmail ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-secondary text-muted-foreground hover:border-primary/40"
              }`}>
              <Bell className="w-4 h-4 shrink-0" />
              <div>
                <p className="font-bold text-xs">Notification</p>
                <p className="text-[10px] font-mono opacity-70">In-app only</p>
              </div>
            </button>
            <button
              onClick={() => { setSendEmail(true); setSendNotif(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                sendEmail && !sendNotif ? "border-accent bg-accent/10 text-accent" : "border-border/50 bg-secondary text-muted-foreground hover:border-accent/40"
              }`}>
              <Mail className="w-4 h-4 shrink-0" />
              <div>
                <p className="font-bold text-xs">Email</p>
                <p className="text-[10px] font-mono opacity-70">Email only</p>
              </div>
            </button>
            <button
              onClick={() => { setSendNotif(true); setSendEmail(true); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                sendNotif && sendEmail ? "border-green-400 bg-green-400/10 text-green-400" : "border-border/50 bg-secondary text-muted-foreground hover:border-green-400/40"
              }`}>
              <div className="flex items-center gap-1 shrink-0">
                <Bell className="w-3.5 h-3.5" />
                <Mail className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-xs">Both</p>
                <p className="text-[10px] font-mono opacity-70">Notif + Email</p>
              </div>
            </button>
          </div>
        </section>

        {/* ── Send Button ─────────────────────────────────────────── */}
        <div className="space-y-3 pb-8">
          {filteredAudience.length === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" /> No users in the selected segment.
            </div>
          )}
          <Button
            onClick={validateAndConfirm}
            disabled={sending || filteredAudience.length === 0}
            className="w-full glow-lime font-display font-bold text-base h-13 gap-2"
            style={{ height: "3.25rem" }}
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Sending to {filteredAudience.length} users…
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send Blast to {filteredAudience.length} User{filteredAudience.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground font-mono">
            A confirmation dialog will appear before sending.
          </p>
        </div>

      </div> {/* end max-w-3xl content */}
    </>
  );
}