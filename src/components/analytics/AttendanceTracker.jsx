import { useState, useEffect } from "react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { ScanLine, CheckCircle2, XCircle, AlertCircle, RefreshCw, ChevronDown, Zap } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const TOOLTIP_STYLE = {
  background: "hsl(228,45%,10%)",
  border: "1px solid hsl(228,30%,18%)",
  borderRadius: 8,
  fontSize: 12,
};

const RESULT_CONFIG = {
  valid: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10", label: "Valid" },
  duplicate: { icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-400/10", label: "Duplicate" },
  invalid: { icon: XCircle, color: "text-red-400", bg: "bg-red-400/10", label: "Invalid" },
  expired: { icon: XCircle, color: "text-orange-400", bg: "bg-orange-400/10", label: "Expired" },
  cancelled: { icon: XCircle, color: "text-red-400", bg: "bg-red-400/10", label: "Cancelled" },
};

export default function AttendanceTracker({ events, scans, tickets }) {
  const [selectedId, setSelectedId] = useState(events[0]?.id || "");
  const [liveScans, setLiveScans] = useState(scans);

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.Scan.subscribe((event) => {
      if (event.type === "create" && event.data?.event_id === selectedId) {
        setLiveScans((prev) => [event.data, ...prev]);
      }
    });
    return unsub;
  }, [selectedId]);

  useEffect(() => {
    setLiveScans(scans);
  }, [scans]);

  const event = events.find((e) => e.id === selectedId);
  const eventScans = liveScans.filter((s) => s.event_id === selectedId);
  const eventTickets = tickets.filter((t) => t.event_id === selectedId);

  // Checked in = tickets with status "scanned" (authoritative source)
  // Fall back to counting unique valid-scan ticket codes if ticket statuses aren't updated
  const checkedInTickets = eventTickets.filter((t) => t.status === "scanned");
  const checkedInFromScans = new Set(eventScans.filter(s => s.result === "valid").map(s => s.ticket_code)).size;
  const checkedIn = checkedInTickets.length > 0 ? checkedInTickets.length : checkedInFromScans;

  const validScans = eventScans.filter((s) => s.result === "valid").length;
  const invalid = eventScans.filter((s) => s.result === "invalid").length;
  const duplicates = eventScans.filter((s) => s.result === "duplicate").length;
  // Total sold = active + scanned tickets (exclude refunded/cancelled)
  const soldTickets = eventTickets.filter(t => ["active", "scanned"].includes(t.status));
  const totalSold = soldTickets.length || event?.tickets_sold || 0;
  const checkInRate = totalSold > 0 ? Math.round((checkedIn / totalSold) * 100) : 0;
  const remaining = Math.max(totalSold - checkedIn, 0);

  // Scan activity by hour
  const hourMap = {};
  eventScans.forEach((s) => {
    const h = format(new Date(s.created_date), "HH:00");
    hourMap[h] = (hourMap[h] || 0) + (s.result === "valid" ? 1 : 0);
  });
  const hourData = Object.entries(hourMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hour, checkins]) => ({ hour, checkins }));

  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm py-10 text-center">No events found.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Event selector + live badge */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none pr-10"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-400/10 border border-green-400/20 rounded-full">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-green-400">LIVE</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Checked In", value: checkedIn, icon: CheckCircle2, color: "text-green-400" },
          { label: "Remaining", value: remaining, icon: ScanLine, color: "text-accent" },
          { label: "Check-in Rate", value: totalSold > 0 ? `${checkInRate}%` : "N/A", icon: Zap, color: "text-primary", accent: true },
          { label: "Rejected Scans", value: invalid + duplicates, icon: XCircle, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-card border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className={`font-mono text-2xl font-bold ${s.accent ? "text-primary" : "text-foreground"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Radial progress */}
      <div className="p-5 rounded-xl bg-card border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Check-in Progress</span>
          <span className="font-mono text-sm font-bold text-primary">{checkedIn} / {totalSold}</span>
        </div>
        <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-primary to-accent"
            style={{ width: `${Math.min(checkInRate, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">{totalSold > 0 ? `${checkInRate}% checked in` : "No tickets sold"}</span>
          <span className="text-xs text-muted-foreground">{remaining} still to arrive</span>
        </div>
      </div>

      {/* Scan result breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {["valid", "duplicate", "invalid"].map((result) => {
          const cfg = RESULT_CONFIG[result];
          const count = eventScans.filter((s) => s.result === result).length;
          const Icon = cfg.icon;
          const sublabel = result === "valid" ? "Valid Scans" : result === "duplicate" ? "Duplicate Scans" : "Invalid Scans";
          return (
            <div key={result} className={`p-4 rounded-xl border border-border/50 ${cfg.bg}`}>
              <Icon className={`w-5 h-5 ${cfg.color} mb-2`} />
              <p className={`font-mono text-2xl font-bold ${cfg.color}`}>{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
            </div>
          );
        })}
      </div>

      {/* Scan activity chart */}
      {hourData.length > 0 && (
        <div className="p-6 rounded-xl bg-card border border-border/50">
          <h3 className="font-display font-bold text-sm tracking-wide uppercase mb-4">Check-in Activity by Hour</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={hourData}>
              <defs>
                <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(220,100%,55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(220,100%,55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(228,30%,15%)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "hsl(220,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(220,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, "Check-ins"]} />
              <Area type="monotone" dataKey="checkins" stroke="hsl(220,100%,55%)" strokeWidth={2} fill="url(#scanGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Live scan feed */}
      <div className="p-6 rounded-xl bg-card border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-sm tracking-wide uppercase">Live Scan Feed</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <RefreshCw className="w-3 h-3" /> real-time
          </div>
        </div>
        {eventScans.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {eventScans.slice(0, 20).map((scan) => {
              const cfg = RESULT_CONFIG[scan.result] || RESULT_CONFIG.invalid;
              const Icon = cfg.icon;
              return (
                <div key={scan.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                  <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-foreground truncate">{scan.ticket_code}</span>
                      <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {scan.scanned_by_email && (
                      <p className="text-[10px] text-muted-foreground truncate">by {scan.scanned_by_email}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                    {scan.created_date
                      ? format(new Date(scan.created_date), "MMM d, HH:mm:ss")
                      : "Date not available"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <ScanLine className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No scans recorded yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Feed will update in real-time as guests check in</p>
          </div>
        )}
      </div>
    </div>
  );
}