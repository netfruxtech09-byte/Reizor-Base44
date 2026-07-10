import { useState, useRef, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import { LayoutDashboard, CalendarPlus, BarChart3, Tag, Ticket, ArrowLeft, Activity, Wallet, ScanLine, Zap, Users, QrCode, Receipt, CalendarCheck, Share2, Send, User, Image, Images, ChevronDown, Menu, X, LogOut, Star, UserCheck, Trophy, HardDrive, Code2, Link2, Music, ShieldAlert, Gift, Scan, Wallet2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const NAV_ITEMS = [
  { to: "/organizer", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/organizer/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/organizer/bookings", icon: CalendarCheck, label: "Book Artists" },
  { to: "/organizer/create", icon: CalendarPlus, label: "Create Event" },
  { to: "/organizer/email", icon: Send, label: "Email Marketing" },
  { to: "/organizer/embed", icon: Code2, label: "Embed Code" },
  { to: "/organizer/general-expenses", icon: Wallet2, label: "General Expenses" },
  { to: "/organizer/giveaways", icon: Gift, label: "Giveaways" },
  { to: "/organizer/live", icon: Zap, label: "Live Check-in" },
  { to: "/organizer/loyalty", icon: Star, label: "Loyalty Program" },
  { to: "/organizer/media", icon: Image, label: "Media Library" },
  { to: "/organizer/events", icon: Ticket, label: "My Events" },
  { to: "/organizer/pl", icon: Receipt, label: "P&L Report" },
  { to: "/organizer/payouts", icon: Wallet, label: "Payouts" },
  { to: "/organizer/performance", icon: Activity, label: "Performance" },
  { to: "/organizer/polls", icon: BarChart3, label: "Polls" },
  { to: "/organizer/promos", icon: Tag, label: "Promo Codes" },
  { to: "/organizer/quick-links", icon: Link2, label: "Quick Links" },
  { to: "/organizer/raffles", icon: Trophy, label: "Raffles" },
  { to: "/organizer/referral", icon: Share2, label: "Referral Program" },
  { to: "/organizer/storage", icon: HardDrive, label: "Storage Usage" },
  { to: "/organizer/team", icon: Users, label: "Team & Permissions" },
  { to: "/organizer/scan", icon: QrCode, label: "Ticket Scanner" },
  { to: "/organizer/prize-scanner", icon: Scan, label: "Prize Redemption" },
  { to: "/organizer/sellers", icon: UserCheck, label: "Ticket Sellers" },
  { to: "/organizer/blast", icon: Send, label: "User Blast" },
];

export default function OrganizerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const menuRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const isOrganizer = user?.role === "organizer" || user?.role === "admin" || user?.role === "manager";

  const handleBack = () => {
    const isRoot = location.pathname === "/organizer";
    if (isRoot) {
      // On the dashboard root — always go Home
      navigate("/");
    } else if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/organizer");
    }
  };

  const isActive = (item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  const activeItem = NAV_ITEMS.find(isActive);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMobileOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Role gate: non-organizers get the conversion prompt instead of the full dashboard
  if (!isOrganizer) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-card border border-border/50 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-black text-xl">Organizer Access Only</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              This section is for event organizers. You need an Organizer account to create events, manage ticket sales, and access analytics.
            </p>
          </div>
          <button
            onClick={() => navigate("/organizer/signup")}
            className="w-full py-3 rounded-xl bg-primary text-white font-display font-bold text-base hover:bg-primary/90 transition-colors glow-lime"
          >
            Create Organizer Account
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
          >
            ← Back to Home
          </button>
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
        <div ref={menuRef} className="relative flex-1 flex justify-end">
          <button
            onClick={() => setMobileOpen(o => !o)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
              mobileOpen ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-secondary text-foreground"
            }`}
          >
            {activeItem ? <><activeItem.icon className="w-4 h-4" /><span className="truncate max-w-[140px]">{activeItem.label}</span></> : <><LayoutDashboard className="w-4 h-4" /><span>Dashboard</span></>}
            <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${mobileOpen ? "rotate-180" : ""}`} />
          </button>

          {mobileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-card border border-border/80 shadow-xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb:hover]:bg-primary/70 [&::-webkit-scrollbar-thumb]:rounded-full">
              {NAV_ITEMS.map(item => (
                <Link key={item.to} to={item.to}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive(item) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}>
                  <item.icon className="w-4 h-4 shrink-0" /> {item.label}
                </Link>
              ))}
              <div className="h-px bg-border/50 my-1" />
              <Link to="/organizer/profile"
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  location.pathname === "/organizer/profile" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}>
                <User className="w-4 h-4 shrink-0" /> My Profile
              </Link>
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
            <span className="text-sm">Back</span>
          </button>
          <h2 className="font-display font-black text-lg tracking-tight mb-1">ORGANIZER</h2>
          <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Dashboard</p>
        </div>
        <nav className="px-4 pb-6 flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive(item) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}
          <div className="h-px bg-border/50 my-2 mt-auto" />
          <Link to="/organizer/profile"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              location.pathname === "/organizer/profile" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}>
            <User className="w-4 h-4 shrink-0" /> My Profile
          </Link>
          <button onClick={() => base44.auth.logout("/")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors w-full">
            <LogOut className="w-4 h-4 shrink-0" /> Sign Out
          </button>
        </nav>
      </aside>

      {/* ── Page content ── */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
        <RouteErrorBoundary routeKey={location.pathname}>
          <Outlet />
        </RouteErrorBoundary>
      </div>
    </div>
  );
}