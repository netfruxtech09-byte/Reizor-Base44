import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Zap, TrendingUp, AlertCircle, Activity } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, startOfHour, isWithinInterval, addHours, subHours } from "date-fns";
import StatCard from "../../components/shared/StatCard";

export default function OrganizerLiveAnalytics() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [scans, setScans] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time updates
  useEffect(() => {
    (async () => {
      const user = await base44.auth.me();
      const evs = await base44.entities.Event.filter({ organizer_id: user.id }, "-date", 100);
      const active = evs.filter(e => e.status !== "cancelled");
      setEvents(active);
      if (active.length > 0) setSelectedEventId(active[0].id);
      setLoading(false);
    })();
  }, []);

  // Reload data when event changes
  useEffect(() => {
    if (!selectedEventId) return;

    const loadData = async () => {
      const [evs, tix, scs, tts] = await Promise.all([
        base44.entities.Event.filter({ id: selectedEventId }, null, 1),
        base44.entities.Ticket.filter({ event_id: selectedEventId }, null, 1000),
        base44.entities.Scan.filter({ event_id: selectedEventId }, "created_date", 1000),
        base44.entities.TicketType.filter({ event_id: selectedEventId }, "sort_order", 100),
      ]);
      setEvent(evs[0]);
      setTickets(tix);
      setScans(scs);
      setTicketTypes(tts);
    };

    loadData();
    const interval = setInterval(loadData, 15000); // Real-time refresh every 15s
    return () => clearInterval(interval);
  }, [selectedEventId]);

  // Metrics
  const totalTickets = tickets.length;
  const scannedCount = tickets.filter(t => t.status === "scanned").length;
  const activeCount = tickets.filter(t => t.status === "active").length;
  const remainingPercent = totalTickets > 0 ? Math.round((scannedCount / totalTickets) * 100) : 0;

  // Breakdown by ticket tier
  const tierBreakdown = useMemo(() => {
    return ticketTypes.map(tt => {
      const tierTickets = tickets.filter(t => t.ticket_type_id === tt.id);
      const tierScanned = tierTickets.filter(t => t.status === "scanned").length;
      return {
        name: tt.name,
        total: tierTickets.length,
        scanned: tierScanned,
        remaining: tierTickets.length - tierScanned,
        percentage: tierTickets.length > 0 ? Math.round((tierScanned / tierTickets.length) * 100) : 0,
      };
    }).filter(t => t.total > 0);
  }, [tickets, ticketTypes]);

  // Hourly inflow data (last 12 hours)
  const hourlyData = useMemo(() => {
    const now = new Date();
    const hours = [];
    for (let i = 11; i >= 0; i--) {
      const hourStart = startOfHour(subHours(now, i));
      const hourEnd = addHours(hourStart, 1);
      const scansInHour = scans.filter(s => 
        isWithinInterval(new Date(s.created_date), { start: hourStart, end: hourEnd }) &&
        s.result === "valid"
      ).length;
      hours.push({
        time: format(hourStart, "h:mm a"),
        scans: scansInHour,
        hourStart,
      });
    }
    return hours;
  }, [scans]);

  // Velocity (scans per minute in last hour)
  const velocityMetrics = useMemo(() => {
    const lastHour = subHours(new Date(), 1);
    const recentScans = scans
      .filter(s => new Date(s.created_date) > lastHour && s.result === "valid")
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    // Scan rate: count / 60 minutes, displayed to 2 decimal places, never rounded to 0
    const scanRate = recentScans.length > 0
      ? parseFloat((recentScans.length / 60).toFixed(2))
      : 0;
    const scansPerMin = scanRate > 0 ? (scanRate < 0.01 ? "< 0.01" : String(scanRate)) : "0";

    // Avg time between consecutive successful scans
    let avgTimePerScan = null; // null = N/A
    if (recentScans.length >= 2) {
      const gaps = [];
      for (let i = 1; i < recentScans.length; i++) {
        const diff = (new Date(recentScans[i].created_date) - new Date(recentScans[i - 1].created_date)) / 1000;
        if (diff > 0) gaps.push(diff);
      }
      if (gaps.length > 0) {
        avgTimePerScan = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
      }
    }

    const peakHour = hourlyData.reduce((max, h) => h.scans > max.scans ? h : max, hourlyData[0] || {});
    const queueDensity = event?.total_capacity ? Math.round((activeCount / event.total_capacity) * 100) : 0;
    return { scansPerMin, avgTimePerScan, peakHour: peakHour.time, queueDensity };
  }, [scans, hourlyData, event, activeCount]);

  const COLORS = ["hsl(330,100%,55%)", "hsl(220,100%,55%)", "hsl(280,80%,60%)", "hsl(30,80%,55%)", "hsl(160,70%,45%)"];
  const TOOLTIP_STYLE = { background: "hsl(228,45%,10%)", border: "1px solid hsl(228,30%,18%)", borderRadius: 8, fontSize: 12 };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight">LIVE CHECK-IN</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">Real-time attendee analytics</p>
        </div>
      </div>

      {/* Event selector */}
      <div className="max-w-xs">
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Select Event</label>
        <select
          value={selectedEventId}
          onChange={e => setSelectedEventId(e.target.value)}
          className="mt-1 w-full rounded-md bg-card border border-border/50 px-3 py-2 text-sm"
        >
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.title} {ev.date ? `— ${format(new Date(ev.date), "MMM dd")}` : ""}
            </option>
          ))}
        </select>
      </div>

      {event && (
        <div className="space-y-6">
          {/* Top metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Expected" value={totalTickets.toLocaleString()} icon={Users} />
            <StatCard label="Checked In" value={scannedCount.toLocaleString()} icon={Zap} accent />
            <StatCard label="Still Coming" value={activeCount.toLocaleString()} icon={TrendingUp} />
            <div className="p-4 rounded-lg bg-card border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <p className="font-mono text-xs text-muted-foreground mb-1">Check-in Progress</p>
              <p className="font-mono text-3xl font-black text-primary">{remainingPercent}%</p>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${remainingPercent}%` }} />
              </div>
            </div>
          </div>

          {/* Queue density warning */}
          {velocityMetrics.queueDensity > 70 && (
            <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-bold text-sm">High Queue Density</p>
                <p className="text-xs text-muted-foreground mt-0.5">{velocityMetrics.queueDensity}% of capacity still waiting. Consider opening additional entry points.</p>
              </div>
            </div>
          )}

          {/* Velocity metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-card border border-border/50">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Scan Rate (1h avg)</p>
              <p className="font-mono text-2xl font-black text-accent">{velocityMetrics.scansPerMin}</p>
              <p className="text-[10px] text-muted-foreground mt-1">scans per minute</p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border/50">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Avg Time / Scan</p>
              <p className="font-mono text-2xl font-black text-primary">
                {velocityMetrics.avgTimePerScan === null
                  ? "N/A"
                  : velocityMetrics.avgTimePerScan >= 60
                    ? `${Math.floor(velocityMetrics.avgTimePerScan / 60)}m ${velocityMetrics.avgTimePerScan % 60}s`
                    : `${velocityMetrics.avgTimePerScan}s`
                }
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {velocityMetrics.avgTimePerScan === null ? "need 2+ scans" : "between scans"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border/50">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Queue Density</p>
              <p className="font-mono text-2xl font-black text-yellow-400">{velocityMetrics.queueDensity}%</p>
              <p className="text-[10px] text-muted-foreground mt-1">of capacity</p>
            </div>
          </div>

          {/* Hourly inflow chart */}
          <div className="p-6 rounded-xl bg-card border border-border/50">
            <h3 className="font-display font-bold text-sm tracking-wide uppercase mb-4">Inflow (Last 12h)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={hourlyData} margin={{ left: 25, right: 20, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(228,30%,15%)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "hsl(220,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(220,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} width={25} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, "Valid Scans"]} />
                <Line type="monotone" dataKey="scans" stroke="hsl(220,100%,55%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Ticket tier breakdown */}
          {tierBreakdown.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Breakdown table */}
              <div className="p-6 rounded-xl bg-card border border-border/50">
                <h3 className="font-display font-bold text-sm tracking-wide uppercase mb-4">By Ticket Tier</h3>
                <div className="space-y-2">
                  {tierBreakdown.map((tier, i) => (
                    <div key={i} className="p-3 rounded-lg bg-background/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="font-display font-bold text-sm">{tier.name}</span>
                        </div>
                        <span className="font-mono text-xs font-bold text-accent">{tier.percentage}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${tier.percentage}%` }} />
                        </div>
                        <span className="font-mono text-muted-foreground text-right min-w-[60px]">{tier.scanned}/{tier.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tier pie chart */}
              <div className="p-6 rounded-xl bg-card border border-border/50">
                <h3 className="font-display font-bold text-sm tracking-wide uppercase mb-4">Attendee Mix</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={tierBreakdown} dataKey="scanned" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={40}>
                      {tierBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-3 justify-center">
                  {tierBreakdown.map((tier, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span>{tier.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Status indicator */}
          <div className="p-4 rounded-lg bg-card border border-border/50">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Last Updated</p>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-mono text-xs text-muted-foreground">{format(new Date(), "h:mm:ss a")}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}