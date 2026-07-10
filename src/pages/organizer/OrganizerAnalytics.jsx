import { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart3, ScanLine, Calendar, TrendingUp, Users, Filter, X, ChevronDown, Search } from "lucide-react";
import EventAnalyticsPanel from "../../components/analytics/EventAnalyticsPanel";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import SalesOverTime from "../../components/analytics/SalesOverTime";
import EventDeepDive from "../../components/analytics/EventDeepDive";
import AttendanceTracker from "../../components/analytics/AttendanceTracker";
import EventFunnel from "../../components/analytics/EventFunnel";
import OrganizerAnalyticsDashboard from "../../components/analytics/OrganizerAnalyticsDashboard";
import AudienceInsights from "../../components/analytics/AudienceInsights";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "sales", label: "Sales Over Time", icon: TrendingUp },
  { id: "events", label: "Event Revenue", icon: Calendar },
  { id: "attendance", label: "Attendance", icon: ScanLine },
  { id: "funnel", label: "Page Funnel", icon: Users },
  { id: "demographics", label: "Event Analytics", icon: BarChart3 },
  { id: "audience", label: "Audience Insights", icon: Users },
];

export default function OrganizerAnalytics() {
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [scans, setScans] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [tables, setTables] = useState([]);
  const [tableReservations, setTableReservations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [filterEventId, setFilterEventId] = useState("all");
  // Draft date state (not applied until Search is clicked)
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  // Applied date state (used in filtering)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateError, setDateError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = () => {
    setDateError("");
    if (draftFrom && isNaN(new Date(draftFrom).getTime())) {
      setDateError("Please select a valid start date.");
      return;
    }
    if (draftTo && isNaN(new Date(draftTo).getTime())) {
      setDateError("Please select a valid end date.");
      return;
    }
    if (draftFrom && draftTo && new Date(draftTo) < new Date(draftFrom)) {
      setDateError("End date cannot be before start date.");
      return;
    }
    setDateFrom(draftFrom);
    setDateTo(draftTo);
  };

  const [activeQuickFilter, setActiveQuickFilter] = useState(null);

  const applyQuickFilter = (key) => {
    setDateError("");
    const today = new Date();
    const pad = (d) => d.toISOString().slice(0, 10);
    let from = "", to = pad(today);
    if (key === "today") {
      from = pad(today);
    } else if (key === "7d") {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      from = pad(d);
    } else if (key === "30d") {
      const d = new Date(today); d.setDate(d.getDate() - 29);
      from = pad(d);
    } else if (key === "ytd") {
      from = `${today.getFullYear()}-01-01`;
    }
    setDraftFrom(from);
    setDraftTo(to);
    setDateFrom(from);
    setDateTo(to);
    setActiveQuickFilter(key);
  };

  const handleClear = () => {
    setFilterEventId("all");
    setDraftFrom("");
    setDraftTo("");
    setDateFrom("");
    setDateTo("");
    setDateError("");
    setActiveQuickFilter(null);
  };

  // Clear active quick filter when user manually edits dates
  const handleDraftFromChange = (v) => { setDraftFrom(v); setDateError(""); setActiveQuickFilter(null); };
  const handleDraftToChange = (v) => { setDraftTo(v); setDateError(""); setActiveQuickFilter(null); };

  useEffect(() => {
    (async () => {
      const user = await base44.auth.me();
      const evs = await base44.entities.Event.filter({ organizer_id: user.id }, "-created_date", 100);
      const eventIds = new Set(evs.map((e) => e.id));

      const [ords, scs, tix, tts, tbls, tblRes] = await Promise.all([
        base44.entities.Order.filter({ organizer_id: user.id, status: "completed" }, "-created_date", 1000),
        base44.entities.Scan.list("-created_date", 500),
        base44.entities.Ticket.list("-created_date", 1000),
        base44.entities.TicketType.list(null, 500),
        base44.entities.Table.list(null, 200).catch(() => []),
        base44.entities.TableReservation.list("-created_date", 500).catch(() => []),
      ]);

      setEvents(evs);
      setOrders(ords);
      setScans(scs.filter((s) => eventIds.has(s.event_id)));
      setTickets(tix.filter((t) => eventIds.has(t.event_id)));
      setTicketTypes(tts.filter((tt) => eventIds.has(tt.event_id)));
      setTables(tbls.filter((t) => eventIds.has(t.event_id)));
      setTableReservations(tblRes.filter((r) => eventIds.has(r.event_id)));
      // Fetch users who bought tickets to this organizer's events
      const allUsers = await base44.entities.User.list(null, 1000).catch(() => []);
      // Filter to only users who have purchased tickets for this organizer's events
      const buyerEmails = new Set(ords.map(o => o.buyer_email).filter(Boolean));
      const audienceUsers = allUsers.filter(u => buyerEmails.has(u.email));
      setUsers(audienceUsers);
      setLoading(false);
    })();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterEventId !== "all" && o.event_id !== filterEventId) return false;
      if (dateFrom && new Date(o.created_date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(o.created_date) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [orders, filterEventId, dateFrom, dateTo]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (filterEventId !== "all" && t.event_id !== filterEventId) return false;
      if (dateFrom && new Date(t.created_date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(t.created_date) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [tickets, filterEventId, dateFrom, dateTo]);

  const filteredScans = useMemo(() => {
    return scans.filter((s) => {
      if (filterEventId !== "all" && s.event_id !== filterEventId) return false;
      if (dateFrom && new Date(s.created_date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(s.created_date) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [scans, filterEventId, dateFrom, dateTo]);

  const filteredTableReservations = useMemo(() => {
    return tableReservations.filter((r) => {
      if (filterEventId !== "all" && r.event_id !== filterEventId) return false;
      if (dateFrom && new Date(r.created_date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(r.created_date) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [tableReservations, filterEventId, dateFrom, dateTo]);

  const filteredEvents = filterEventId === "all" ? events : events.filter((e) => e.id === filterEventId);
  const hasFilters = filterEventId !== "all" || dateFrom || dateTo;
  const activeTabLabel = TABS.find(t => t.id === activeTab)?.label || "View";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mobile-bottom-nav-spacing">
      {/* Header */}
      <div>
        <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">ANALYTICS</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">{filteredEvents.length} events · {filteredOrders.length} orders{hasFilters ? " (filtered)" : ""}</p>
      </div>

      {/* ── Prominent Event Selector ── */}
      {events.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center p-3 rounded-xl bg-card border border-primary/20">
          <label className="font-mono text-[10px] text-primary font-bold uppercase tracking-wider shrink-0 self-center sm:self-auto">Event</label>
          <select
            value={filterEventId}
            onChange={(e) => setFilterEventId(e.target.value)}
            className="flex-1 bg-background border border-border/50 rounded-md px-3 py-2 text-sm font-mono"
          >
            <option value="all">All Events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.title}{e.date ? ` — ${new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</option>
            ))}
          </select>
          {filterEventId !== "all" && (
            <button
              onClick={() => setFilterEventId("all")}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-mono text-muted-foreground hover:text-foreground border border-border/50 transition-colors shrink-0"
            >
              <X className="w-3 h-3" /> All
            </button>
          )}
        </div>
      )}

      {/* Compact Filter Bar */}
       <div className="p-2 sm:p-3 rounded-xl bg-card border border-border/50 space-y-2">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-end">
          {/* Start Date */}
          <div className="flex flex-col gap-1">
           <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Start Date</label>
           <input
             type="date"
             value={draftFrom}
             onChange={(e) => handleDraftFromChange(e.target.value)}
              className="bg-background border border-border/50 rounded-md px-2.5 py-1.5 text-sm font-mono h-9 w-full sm:w-auto"
           />
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-1">
           <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">End Date</label>
           <input
             type="date"
             value={draftTo}
             onChange={(e) => handleDraftToChange(e.target.value)}
              className="bg-background border border-border/50 rounded-md px-2.5 py-1.5 text-sm font-mono h-9 w-full sm:w-auto"
           />
          </div>

          {/* Search button */}
           <button
           onClick={handleSearch}
           className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-mono font-bold glow-lime hover:opacity-90 transition-opacity w-full sm:w-auto"
          >
           <Search className="w-3.5 h-3.5" /> <span className="sm:inline">Search</span>
          </button>

          {/* Quick date filter buttons */}
          <div className="flex gap-1.5 w-full sm:w-auto">
            {[
              { key: "today", label: "Today" },
              { key: "7d",    label: "7 Days" },
              { key: "30d",   label: "30 Days" },
              { key: "ytd",   label: "YTD" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => applyQuickFilter(key)}
                className={`flex-1 sm:flex-none h-9 px-3 rounded-md text-xs font-mono font-bold transition-colors whitespace-nowrap ${
                  activeQuickFilter === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Analytics Filters dropdown */}
          <div className="relative w-full sm:w-auto" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(v => !v)}
              className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-1.5 h-9 px-3 rounded-md border border-border/50 bg-secondary text-sm font-mono text-foreground hover:border-primary/50 transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Analytics Filters</span>
              <span className="sm:hidden">Filters</span>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 sm:left-auto right-0 sm:right-auto top-full mt-1 z-50 w-full sm:w-64 rounded-xl bg-card border border-border/60 shadow-2xl p-3 space-y-3">
                 {/* View / Tab selector */}
                <div className="space-y-1">
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">View</label>
                  <div className="space-y-0.5">
                    {TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setDropdownOpen(false); }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-mono transition-colors text-left ${
                          activeTab === tab.id
                            ? "bg-primary/15 text-primary font-bold"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <tab.icon className="w-3.5 h-3.5 shrink-0" />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear filters */}
                {hasFilters && (
                  <button
                    onClick={() => { handleClear(); setDropdownOpen(false); }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-destructive border border-border/50 rounded-md px-3 py-1.5 transition-colors"
                  >
                    <X className="w-3 h-3" /> Clear All Filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Active view badge */}
          <div className="self-end h-9 flex items-center px-3 rounded-md bg-primary/10 border border-primary/20">
            <span className="text-xs font-mono text-primary font-bold">{activeTabLabel}</span>
          </div>

          {/* Clear shortcut */}
          {hasFilters && (
            <button onClick={handleClear} className="self-end h-9 flex items-center gap-1 px-2.5 rounded-md text-xs font-mono text-muted-foreground hover:text-foreground border border-border/50 transition-colors">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Validation error */}
        {dateError && (
          <p className="text-xs text-destructive font-mono flex items-center gap-1.5 pt-0.5">
            <X className="w-3 h-3 shrink-0" /> {dateError}
          </p>
        )}

        {/* Applied filter pills */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {filterEventId !== "all" && (
              <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                {events.find(e => e.id === filterEventId)?.title || "Event"}
              </span>
            )}
            {dateFrom && (
              <span className="text-[10px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full border border-accent/20">
                From: {dateFrom}
              </span>
            )}
            {dateTo && (
              <span className="text-[10px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full border border-accent/20">
                To: {dateTo}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Active tab label (replaces tab bar) */}
      <div className="border-b border-border/50 pb-2">
        <h2 className="font-display font-bold text-base flex items-center gap-2">
          {(() => { const t = TABS.find(x => x.id === activeTab); return t ? <><t.icon className="w-4 h-4 text-primary" />{t.label}</> : null; })()}
        </h2>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OrganizerAnalyticsDashboard events={filteredEvents} orders={filteredOrders} tickets={filteredTickets} tableReservations={filteredTableReservations} isFiltered={hasFilters} />
      )}
      {activeTab === "sales" && (
        <SalesOverTime orders={filteredOrders} events={filteredEvents} />
      )}
      {activeTab === "events" && (
        <EventDeepDive events={filteredEvents} orders={filteredOrders} tickets={filteredTickets} />
      )}
      {activeTab === "attendance" && (
        <AttendanceTracker events={filteredEvents} scans={filteredScans} tickets={filteredTickets} />
      )}
      {activeTab === "funnel" && (
        <EventFunnel events={filteredEvents} />
      )}
      {activeTab === "audience" && (
        <AudienceInsights users={users} />
      )}
      {activeTab === "demographics" && (
        <EventAnalyticsPanel
          tickets={filteredTickets}
          ticketTypes={ticketTypes.filter(tt => filterEventId === "all" || tt.event_id === filterEventId)}
          tables={tables.filter(t => filterEventId === "all" || t.event_id === filterEventId)}
          tableReservations={tableReservations.filter(r => filterEventId === "all" || r.event_id === filterEventId)}
          events={filteredEvents}
          orders={filteredOrders}
          users={users}
          filterEventId={filterEventId}
        />
      )}
    </div>
  );
}

function OverviewTabLegacy({ events, orders, scans, tickets }) {
  const COLORS = ["hsl(330,100%,55%)", "hsl(220,100%,55%)", "hsl(280,80%,60%)", "hsl(30,80%,55%)", "hsl(160,70%,45%)"];

  // Revenue by event (top 6)
  const revenueByEvent = events
    .map((e) => ({
      name: e.title.length > 14 ? e.title.slice(0, 14) + "…" : e.title,
      revenue: orders.filter((o) => o.event_id === e.id).reduce((s, o) => s + (o.total || 0), 0),
      sold: e.tickets_sold || 0,
      capacity: e.total_capacity || 0,
    }))
    .filter((d) => d.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // Genre pie
  const genreMap = events.reduce((acc, e) => {
    const g = (e.genre || "other").replace(/_/g, " ");
    acc[g] = (acc[g] || 0) + (e.tickets_sold || 0);
    return acc;
  }, {});
  const pieData = Object.entries(genreMap).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  const TOOLTIP_STYLE = { background: "hsl(228,45%,10%)", border: "1px solid hsl(228,30%,18%)", borderRadius: 8, fontSize: 12 };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="p-6 rounded-xl bg-card border border-border/50">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase mb-4">Revenue by Event</h3>
        {revenueByEvent.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenueByEvent} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(228,30%,15%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "hsl(220,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(220,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`$${v.toLocaleString()}`, "Revenue"]} />
              <Bar dataKey="revenue" fill="hsl(330,100%,55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">No revenue data yet</p>
        )}
      </div>

      <div className="p-6 rounded-xl bg-card border border-border/50">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase mb-4">Tickets by Genre</h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={40}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">No genre data yet</p>
        )}
        <div className="flex flex-wrap gap-2 mt-2 justify-center">
          {pieData.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="capitalize">{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}