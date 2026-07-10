import { useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, ShoppingCart, Shield, BarChart3, ArrowLeft, UserCog, ImageIcon, Percent, Star, Crown, Zap, CreditCard, Globe, Sparkles, MousePointer, DollarSign, TrendingUp, ChevronDown, LogOut, User, Music, Send, Tag, Ticket, AlertTriangle, HardDrive, Video, Bell, Code2, Gift, Newspaper } from "lucide-react";

import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import StatCard from "../../components/shared/StatCard";
import WhiteLabelQuickAccess from "../../components/admin/WhiteLabelQuickAccess";
import AdminNotificationBell from "../../components/admin/AdminNotificationBell";

const NAV = [
  { to: "/admin/expenses", icon: DollarSign, label: "Admin Expenses" },
  { to: "/admin/affiliate", icon: DollarSign, label: "Affiliate Earnings" },
  { to: "/admin/analytics", icon: TrendingUp, label: "Analytics" },
  { to: "/admin/artists", icon: Music, label: "Artists" },
  { to: "/admin/artist-posts", icon: Newspaper, label: "Artist Posts" },
  { to: "/admin/crash-logs", icon: AlertTriangle, label: "Crash Logs" },
  { to: "/admin/embed", icon: Code2, label: "Embed Widgets" },
  { to: "/admin/discovery", icon: Sparkles, label: "Event Discovery" },
  { to: "/admin/events", icon: Calendar, label: "Events" },
  { to: "/admin/giveaways", icon: Gift, label: "Giveaways" },
  { to: "/admin/loyalty-points", icon: Star, label: "Loyalty Points" },
  { to: "/admin/media", icon: ImageIcon, label: "Media Library" },
  { to: "/admin/moderation", icon: Shield, label: "Media Moderation" },
  { to: "/admin/orders", icon: ShoppingCart, label: "Orders" },
  { to: "/admin/fees", icon: Percent, label: "Organizer Fees" },
  { to: "/admin/organizers", icon: Users, label: "Organizers" },
  { to: "/admin/pl", icon: BarChart3, label: "P&L Report" },
  { to: "/admin/payouts", icon: DollarSign, label: "Payout Requests" },
  { to: "/admin/raffles-polls", icon: Ticket, label: "Raffles & Polls" },
  { to: "/admin/resell", icon: Tag, label: "Resell Listings" },
  { to: "/admin/storage", icon: HardDrive, label: "Storage Usage" },
  { to: "/admin/sub-wl", icon: Globe, label: "Sub-WL Proposals" },
  { to: "/admin/team", icon: UserCog, label: "Team & Permissions" },
  { to: "/user-blast", icon: Send, label: "User Blast" },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/video-budgets", icon: Video, label: "Video Budgets" },
  { to: "/admin/white-labels", icon: Globe, label: "White Labels" },
];

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user: authUser, isLoadingAuth } = useAuth();
  const isRoot = location.pathname === "/admin";
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Guard: only Reizor Main Admins can access this panel
  // WL/Sub-WL users (role=white_label) must never reach this dashboard
  useEffect(() => {
    if (!isLoadingAuth && authUser && authUser.role !== 'admin') {
      // Redirect WL users to their own dashboard, others to home
      if (authUser.role === 'white_label' || authUser.role === 'sub_white_label') {
        navigate('/agent-dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [authUser, isLoadingAuth, navigate]);

  useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    if (!isRoot) { setLoading(false); return; }
    setLoading(true);
    base44.functions.invoke('adminStats', {})
      .then(res => {
        setStats(res.data);
        setLoading(false);
      })
      .catch(() => {
        setStats(null);
        setLoading(false);
      });
  }, [isRoot]);

  const activeNav = NAV.find(item => location.pathname.startsWith(item.to));

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-card border-b border-border/50 px-4 sm:px-6 flex items-center justify-between gap-4" style={{ paddingTop: "12px", paddingBottom: "12px" }} data-safe-top>
        <div className="flex items-center gap-3">
          {isRoot ? (
            <Link to="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to site</span>
            </Link>
          ) : (
            <Link to="/admin" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </Link>
          )}
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-display font-black tracking-tight">ADMIN</span>
            <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Control Panel</span>
          </div>
        </div>

        {/* Notification Bell */}
        {authUser && <AdminNotificationBell userEmail={authUser.email} />}

        {/* Dropdown menu */}
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 bg-secondary text-foreground hover:border-primary/40 text-sm font-medium transition-all">
            {activeNav ? <><activeNav.icon className="w-4 h-4" /><span>{activeNav.label}</span></> : <><LayoutDashboard className="w-4 h-4" /><span>Overview</span></>}
            <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>

          {menuOpen && (
            <>
              {/* Fixed backdrop — blocks background scroll on mobile */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
                onTouchMove={(e) => e.preventDefault()}
              />
            </>
          )}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-card border border-border/80 shadow-xl overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
              <Link to="/admin"
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isRoot ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}>
                <LayoutDashboard className="w-4 h-4" /> Overview
              </Link>
              <div className="h-px bg-border/50 my-1" />
              {NAV.map(item => (
                <Link key={item.to} to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    location.pathname.startsWith(item.to) ? "text-primary bg-primary/10" : "text-foreground hover:bg-muted"
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

      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden">
        {isRoot ? (
          loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6 max-w-5xl">
              <h1 className="font-display font-black text-base tracking-tight"><span className="section-title">PLATFORM OVERVIEW</span></h1>

              {/* Pending Payout Requests Alert */}
              {stats?.pendingPayouts > 0 && (
                <Link to="/admin/payouts" className="block">
                  <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-yellow-400/10 border border-yellow-400/40 hover:border-yellow-400/70 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-yellow-400/20 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div>
                        <p className="font-bold text-yellow-400 text-sm">
                          {stats.pendingPayouts === 1
                            ? "1 payout request waiting for approval"
                            : `${stats.pendingPayouts} payout requests waiting for approval`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {stats.pendingPayoutDetails?.map(r => r.organizer_name).filter(Boolean).slice(0, 3).join(", ")}
                          {stats.pendingPayouts > 3 ? ` +${stats.pendingPayouts - 3} more` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-yellow-400 shrink-0">View Payout Requests →</span>
                  </div>
                </Link>
              )}

              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {[
                  { label: "Total GMV", value: `$${stats?.gmv?.toLocaleString() || 0}`, icon: BarChart3, accent: true, to: "/admin/analytics" },
                  { label: "Users", value: stats?.users || 0, icon: Users, to: "/admin/users" },
                  { label: "Organizers", value: stats?.organizers || 0, icon: Users, to: "/admin/organizers" },
                  { label: "Published Events", value: stats?.publishedEvents || 0, icon: Calendar, to: "/admin/events" },
                  { label: "Orders", value: stats?.orders || 0, icon: ShoppingCart, to: "/admin/orders" },
                  { label: "Tickets Issued", value: stats?.tickets || 0, icon: Shield, to: "/admin/orders" },
                  { label: "White Labels", value: stats?.whiteLabels || 0, icon: Globe, to: "/admin/white-labels" },
                  { label: "Sub-WL Proposals", value: stats?.subLabels || 0, icon: Globe, to: "/admin/sub-wl" },
                  { label: "Pending Sub-WL", value: stats?.subLabelsPending || 0, icon: Globe, to: "/admin/sub-wl" },
                  { label: "Pending Payouts", value: stats?.pendingPayouts || 0, icon: DollarSign, accent: stats?.pendingPayouts > 0, to: "/admin/payouts" },
                  ].map(({ label, value, icon, accent, to }) => (
                  <StatCard key={label} label={label} value={value} icon={icon} accent={accent} to={to} />
                  ))}
              </div>

              {/* Role Breakdown */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-accent" />
                  <h2 className="font-display font-bold text-base section-title">ROLE BREAKDOWN</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { label: "Fans", value: stats?.fans || 0, icon: Users, to: "/admin/users", role: "user", color: "text-accent" },
                    { label: "Organizers", value: stats?.organizers || 0, icon: Calendar, to: "/admin/organizers", color: "text-yellow-400" },
                    { label: "Artists", value: stats?.artists || 0, icon: Music, to: "/admin/artists", color: "text-primary" },
                    { label: "Managers", value: stats?.managers || 0, icon: UserCog, to: "/admin/users", role: "manager", color: "text-blue-400" },
                    { label: "Admins", value: stats?.admins || 0, icon: Shield, to: "/admin/users", role: "admin", color: "text-destructive" },
                  ].map(({ label, value, icon: RoleIcon, to, role, color }) => (
                  <Link key={label} to={role ? `${to}?role=${role}` : to} className="block">
                    <div className="p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:scale-[1.02] active:scale-[0.99] transition-all duration-150 cursor-pointer">
                       <RoleIcon className={`w-4 h-4 mb-2 ${color}`} />
                      <p className="font-mono text-xs text-muted-foreground">{label}</p>
                      <p className={`font-display font-black text-2xl mt-0.5 ${color}`}>{value}</p>
                    </div>
                  </Link>
                ))}
                </div>
              </div>

              {/* White Label Quick Access */}
              {stats?.whiteLabels > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary" />
                      <h2 className="font-display font-bold text-base section-title">WHITE LABELS</h2>
                    </div>
                    <Link to="/admin/white-labels" className="text-xs font-mono text-accent hover:underline">Manage all →</Link>
                  </div>
                  <WhiteLabelQuickAccess />
                </div>
              )}

              {/* Affiliate Earnings */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <h2 className="font-display font-bold text-base section-title">AFFILIATE EARNINGS</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <StatCard label="Partner Events" value={stats?.affiliateEvents || 0} icon={MousePointer} to="/admin/affiliate" />
                  <StatCard label="Total Clicks" value={stats?.affiliateClicks || 0} icon={MousePointer} to="/admin/affiliate" />
                  <StatCard label="Confirmed Earnings" value={`$${(stats?.affiliateConfirmed || 0).toFixed(2)}`} icon={DollarSign} accent to="/admin/affiliate" />
                </div>
              </div>



              {/* Membership Analytics */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-primary" />
                  <h2 className="font-display font-bold text-base section-title">MEMBERSHIP & CASHBACK</h2>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                  {[
                     { label: "Active Members", value: stats?.activeMembers || 0, icon: Users, to: "/admin/analytics" },
                     { label: "Standard (5%)", value: stats?.standardMembers || 0, icon: Star, to: "/admin/analytics" },
                     { label: "Premium (10%)", value: stats?.premiumMembers || 0, icon: Crown, to: "/admin/analytics" },
                     { label: "Membership Revenue", value: `$${(stats?.membershipRevenue || 0).toFixed(2)}`, icon: CreditCard, accent: true, to: "/admin/analytics" },
                     { label: "Cashback Pending", value: `$${(stats?.totalCashbackIssued || 0).toFixed(2)}`, icon: Zap, to: "/admin/analytics" },
                   ].map(({ label, value, icon, accent, to }) => (
                     <Link key={label} to={to} className="block">
                       <StatCard label={label} value={value} icon={icon} accent={accent} />
                     </Link>
                   ))}
                </div>
              </div>
            </div>
          )
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}