import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { DollarSign, Ticket, Users, TrendingUp, CalendarPlus, QrCode, BarChart3, Calendar, Zap, Mail, Activity, Home, Gift, BarChart2, Code2, ExternalLink, Link2 } from "lucide-react";
import { isActivePublishedEvent, isEventPast } from "@/utils/eventUtils";
import OrganizerStorageWidget from "../../components/organizer/OrganizerStorageWidget";
import StorageUsageSummary from "../../components/storage/StorageUsageSummary";
import StreamingUsageSummary from "../../components/streaming/StreamingUsageSummary";
import TablesSummaryWidget from "../../components/organizer/TablesSummaryWidget";
import PayoutSetupModal from "../../components/organizer/PayoutSetupModal";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import StatCard from "../../components/shared/StatCard";

import { format } from "date-fns";

const QUICK_ACTIONS = [
  { to: "/organizer/scan",     icon: QrCode,       label: "Scanner",         desc: "Check in attendees",        color: "text-accent",    bg: "bg-accent/10"   },
  { to: "/organizer/team",     icon: Users,        label: "Team",            desc: "Manage staff & roles",      color: "text-purple-400",bg: "bg-purple-400/10"},
  { to: "/organizer/analytics",icon: BarChart3,    label: "Analytics",       desc: "Revenue & ticket stats",    color: "text-green-400", bg: "bg-green-400/10"},
  { to: "/organizer/bookings", icon: Calendar,     label: "Bookings",        desc: "Artist booking requests",   color: "text-pink-400",  bg: "bg-pink-400/10" },
  { to: "/organizer/performance", icon: Activity,   label: "Performance",     desc: "Track event performance",   color: "text-primary",   bg: "bg-primary/10"  },
  { to: "/organizer/email",    icon: Mail,         label: "Email Marketing", desc: "Automated campaigns",       color: "text-cyan-400",  bg: "bg-cyan-400/10"  },
  { to: "/organizer/payouts",  icon: DollarSign,   label: "Payouts",         desc: "View your earnings",        color: "text-yellow-400",bg: "bg-yellow-400/10"},
  { to: "/organizer/pl",       icon: TrendingUp,   label: "P&L Report",      desc: "Profit & loss analysis",    color: "text-orange-400",bg: "bg-orange-400/10"},
  { to: "/organizer/embed",    icon: Code2,        label: "Website Widgets", desc: "Embed on your website",     color: "text-cyan-400",  bg: "bg-cyan-400/10"  },
  { to: "/organizer/quick-links", icon: Link2,     label: "Quick Links",     desc: "Invite links & share page", color: "text-primary",   bg: "bg-primary/10"   },
];

export default function OrganizerDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me();
      setUser(u);
      // Sequential to avoid rate limits
      const evs = await base44.entities.Event.filter({ organizer_id: u.id }, "-created_date", 50).catch(() => []);
      const bankInfos = await base44.entities.OrganizerBankInfo.filter({ organizer_id: u.id }, null, 1).catch(() => []);
      setEvents(evs);
      // Fetch orders filtered by organizer to avoid loading all orders
      const ords = await base44.entities.Order.filter({ organizer_id: u.id, status: "completed" }, "-created_date", 100).catch(() => []);
      setOrders(ords);
      // Show payout setup modal if no bank info on file
      if (bankInfos.length === 0) setShowPayoutModal(true);
      setLoading(false);
    };
    load();
  }, []);

  // Live events: published, not deactivated, and not yet ended — uses shared utility for consistency
  const liveEvents = events.filter(isActivePublishedEvent);
  const liveEventIds = new Set(liveEvents.map(e => e.id));
  // Tickets Sold: only from completed orders for currently live events
  const liveTickets = orders.filter(o => liveEventIds.has(o.event_id)).reduce((s, o) => s + (o.quantity || 0), 0);
  // Upcoming events for raffle/poll cards: published, not deactivated, not past
  const upcomingEvents = liveEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6 sm:space-y-8 mobile-bottom-nav-spacing">
      {showPayoutModal && user && (
        <PayoutSetupModal
          user={user}
          onClose={() => setShowPayoutModal(false)}
          onSaved={() => setShowPayoutModal(false)}
        />
      )}
      {/* Welcome + Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
       <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">{greeting()}</p>
          <h1 className="font-display font-black text-2xl sm:text-4xl tracking-tight break-words">
           {user?.full_name?.split(" ")[0] || "Organizer"} 👋
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
           {liveEvents.length} live event{liveEvents.length !== 1 ? "s" : ""} · {events.length} total
          </p>
       </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => navigate("/")} className="gap-1.5 h-11 order-2 sm:order-1 border-primary/60 hover:border-primary hover:bg-primary/10">
            <Home className="w-4 h-4" /> Home
          </Button>
          <Link to={`/organizers/${user?.id || ''}`} className="order-3 sm:order-3">
            <Button variant="outline" className="gap-1.5 h-11 w-full border-primary/60 hover:border-primary hover:bg-primary/10">
              <ExternalLink className="w-4 h-4" /> My Page
            </Button>
          </Link>
          <Link to="/organizer/create" className="order-1 sm:order-2">
            <Button className="glow-lime font-display font-bold gap-2 h-11 w-full">
              <CalendarPlus className="w-4 h-4" /> Create Event
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats — live activity only */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <StatCard label="Live Events" value={liveEvents.length} icon={TrendingUp} to="/organizer/events" accent />
        <StatCard label="Tickets Sold" value={liveTickets} icon={Ticket} to="/organizer/events" />
      </div>

      {/* Quick Actions Grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-base section-title">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc, color, bg }) => (
            <Link key={to} to={to} state={{ from: location.pathname }}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/40 transition-all group">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-xs truncate group-hover:text-primary transition-colors">{label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>



      {/* Fan Engagement */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-base section-title">Fan Engagement</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Raffle Card */}
          <div className="p-5 rounded-xl bg-card border border-primary/30 hover:border-primary/60 transition-all space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-sm">Raffle</p>
                <p className="text-[11px] text-muted-foreground font-mono">Create raffle campaigns for fan engagement and prizes.</p>
              </div>
            </div>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Select an event to manage raffles:</p>
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {upcomingEvents.slice(0, 5).map(ev => (
                    <Link
                      key={ev.id}
                      to={`/organizer/events/${ev.id}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/60 hover:bg-primary/10 border border-border/40 hover:border-primary/40 transition-all group"
                    >
                      <span className="text-xs font-medium truncate group-hover:text-primary transition-colors">{ev.title}</span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">🎁 Raffle →</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground font-mono">Create a raffle attached to an event, or use the dropdown menu to create a standalone raffle.</p>
            )}
            <Link to="/organizer/raffles">
              <button className="w-full mt-1 px-4 py-2 rounded-lg bg-primary text-white border border-primary text-sm font-display font-bold hover:bg-primary/90 transition-colors">
                + Create Raffle
              </button>
            </Link>
          </div>

          {/* Poll Card */}
          <div className="p-5 rounded-xl bg-card border border-accent/30 hover:border-accent/60 transition-all space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <BarChart2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-display font-bold text-sm">Poll</p>
                <p className="text-[11px] text-muted-foreground font-mono">Create polls to collect fan opinions and event feedback.</p>
              </div>
            </div>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Select an event to manage polls:</p>
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {upcomingEvents.slice(0, 5).map(ev => (
                    <Link
                      key={ev.id}
                      to={`/organizer/events/${ev.id}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/60 hover:bg-accent/10 border border-border/40 hover:border-accent/40 transition-all group"
                    >
                      <span className="text-xs font-medium truncate group-hover:text-accent transition-colors">{ev.title}</span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">📊 Poll →</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground font-mono">Create a poll attached to an event, or use the dropdown menu to create a standalone poll.</p>
            )}
            <Link to="/organizer/polls">
              <button className="w-full mt-1 px-4 py-2 rounded-lg bg-accent text-white border border-accent text-sm font-display font-bold hover:bg-accent/90 transition-colors">
                + Create Poll
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Storage Usage */}
       {user && <StorageUsageSummary userEmail={user.email} userType="organizer" isAdmin={user.role === "admin"} />}

      {/* Tables Summary */}
      <TablesSummaryWidget eventIds={events.map((e) => e.id)} />

      {/* Streaming Usage — bottom of dashboard */}
       {user && <StreamingUsageSummary isAdmin={user.role === "admin"} />}

    </div>
  );
}