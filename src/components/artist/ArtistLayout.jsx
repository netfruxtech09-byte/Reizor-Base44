import { useState, useRef, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Music, DollarSign, Gift, ArrowLeft, BarChart3,
  CalendarCheck, MessageSquare, Star, Video, ShoppingBag, Images,
  Download, Briefcase, Globe, ClipboardList, Share2, Send, MapPin,
  Receipt, ChevronDown, LogOut, User, Sparkles, Scan
} from "lucide-react";

const NAV = [
  { to: "/artist",           label: "Dashboard",       icon: LayoutDashboard, exact: true },
  { to: "/artist/analytics", label: "Analytics",       icon: BarChart3 },
  { to: "/artist/agency",    label: "Booking Agency",  icon: Briefcase },
  { to: "/artist/bookings",  label: "Bookings",        icon: CalendarCheck },
  { to: "/artist/donations", label: "Donations",       icon: DollarSign },
  { to: "/artist/downloads", label: "Downloads",       icon: Download },
  { to: "/artist/tiers",     label: "Fan Tiers",       icon: Star },
  { to: "/artist/gallery",   label: "Gallery",         icon: Images },
  { to: "/artist/giveaways", label: "Giveaways",       icon: Gift },
  { to: "/artist/inbox",     label: "Inbox",           icon: MessageSquare },
  { to: "/artist/loyalty",   label: "Loyalty & Rewards", icon: Star },
  { to: "/artist/merch",     label: "Merch Shop",      icon: ShoppingBag },
  { to: "/artist/my-profile", label: "My Profile",      icon: User },
  { to: "/artist/posts",     label: "My Posts",        icon: Music },
  { to: "/artist/pl",        label: "P&L Report",      icon: Receipt },
  { to: "/artist/payouts",   label: "Payouts",         icon: DollarSign },
  { to: "/artist/prize-scanner", label: "Prize Redemption", icon: Scan },
  { to: "/artist/raffles",   label: "Raffles",         icon: Gift },
  { to: "/artist/referral",  label: "Referral Program",icon: Share2 },
  { to: "/booking-calendar", label: "Shared Calendar", icon: Globe, state: { from: "/artist" } },
  { to: "/artist/shoutouts", label: "Shoutouts",       icon: MessageSquare },
  { to: "/artist/rider",     label: "Technical Rider", icon: ClipboardList },
  { to: "/artist/tour",      label: "Tour Schedule",   icon: MapPin },
  { to: "/user-blast",       label: "User Blast",      icon: Send },
  { to: "/artist/video",     label: "Video Chats",     icon: Video },
];

export default function ArtistLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);
  const [backLink, setBackLink] = useState({ to: "/", label: "Back to site" });
  const [approvalStatus, setApprovalStatus] = useState(null);

  const isActive = (item) => item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
  const activeItem = NAV.find(isActive);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      if (!u) return;
      if (u.role === "admin") {
        setBackLink({ to: "/admin", label: "Admin Panel" });
        setApprovalStatus("approved");
        return;
      }
      if (u.role === "organizer") setBackLink({ to: "/organizer", label: "Organizer Dashboard" });
      else if (u.role === "manager") setBackLink({ to: "/organizer", label: "Manager Dashboard" });
      else setBackLink({ to: "/", label: "Back to site" });

      const artists = await base44.entities.Artist.filter({ user_email: u.email }, null, 1).catch(() => []);
      if (artists[0]) {
        setApprovalStatus(artists[0].approval_status || "approved");
      } else {
        setApprovalStatus("approved");
      }
    }).catch(() => { setApprovalStatus("approved"); });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMobileOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleBack = () => {
    if (location.pathname === "/artist") navigate(backLink.to);
    else if (window.history.length > 2) navigate(-1);
    else navigate("/artist");
  };

  if (approvalStatus === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (approvalStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center mx-auto">
            <span className="text-4xl">⏳</span>
          </div>
          <h1 className="font-display font-black text-3xl tracking-tight">Application Under Review</h1>
          <p className="text-muted-foreground">Your artist profile is pending admin approval. You'll receive an email within 24 hours once approved.</p>
          <Link to="/" className="inline-block px-6 py-3 rounded-lg border border-border/50 text-sm font-mono font-bold hover:border-primary/40 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (approvalStatus === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto">
            <span className="text-4xl">❌</span>
          </div>
          <h1 className="font-display font-black text-3xl tracking-tight">Application Not Approved</h1>
          <p className="text-muted-foreground">Your artist application was not approved at this time. You can update your profile and reapply.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/artist/signup" className="inline-block px-6 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-display font-bold hover:opacity-90 transition-opacity">
              Reapply Now
            </Link>
            <Link to="/" className="inline-block px-6 py-3 rounded-lg border border-border/50 text-sm font-mono font-bold hover:border-primary/40 transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── Mobile top bar ── */}
      <header className="md:hidden sticky top-0 z-40 bg-card border-b border-border/50 px-4 flex items-center justify-between gap-3" style={{ paddingTop: "12px", paddingBottom: "12px" }} data-safe-top>
        <button onClick={handleBack} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0 flex justify-center">
          <span className="font-display font-black text-sm tracking-tight truncate">ARTIST STUDIO</span>
        </div>
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setMobileOpen(o => !o)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
              mobileOpen ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-secondary text-foreground"
            }`}
          >
            {activeItem
              ? <><activeItem.icon className="w-4 h-4" /><span className="truncate max-w-[100px]">{activeItem.label}</span></>
              : <><LayoutDashboard className="w-4 h-4" /><span>Menu</span></>
            }
            <ChevronDown className={`w-4 h-4 transition-transform ${mobileOpen ? "rotate-180" : ""}`} />
          </button>

          {mobileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-card border border-border/80 shadow-xl z-50 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb:hover]:bg-primary/70 [&::-webkit-scrollbar-thumb]:rounded-full">
              {NAV.map(item => (
                <Link key={item.to} to={item.to} state={item.state}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive(item) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}>
                  <item.icon className="w-4 h-4 shrink-0" /> {item.label}
                </Link>
              ))}
              <div className="h-px bg-border/50 my-1" />
              <button onClick={() => base44.auth.logout("/")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                <LogOut className="w-4 h-4 shrink-0" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-card border-r border-border/50 md:min-h-screen sticky top-0 self-start max-h-screen overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb:hover]:bg-primary/70 [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="p-6 shrink-0">
          <button onClick={handleBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{backLink.label}</span>
          </button>
          <h2 className="font-display font-black text-lg tracking-tight mb-0.5">ARTIST</h2>
          <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Studio</p>
        </div>
        <nav className="px-4 pb-6 flex flex-col gap-1 flex-1">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} state={item.state}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive(item) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}
          <div className="h-px bg-border/50 my-2 mt-auto" />
          <button onClick={() => base44.auth.logout("/")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors w-full">
            <LogOut className="w-4 h-4 shrink-0" /> Sign Out
          </button>
        </nav>
      </aside>

      {/* ── Page content ── */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}