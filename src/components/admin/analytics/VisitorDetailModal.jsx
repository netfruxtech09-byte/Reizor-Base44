import { useState, useMemo } from "react";
import { X, Eye, Users, Monitor, Globe, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import ExitPageDrilldown from "./ExitPageDrilldown";

const DETAIL_RANGES = [
  { key: "1d", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All Time" },
];

function getStart(key) {
  const now = new Date();
  if (key === "1d") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === "7d") return new Date(now - 7 * 86400000);
  if (key === "30d") return new Date(now - 30 * 86400000);
  if (key === "ytd") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function parseDevice(ua) {
  if (!ua) return "Unknown";
  if (/iPhone|iPad|iPod|Android/.test(ua)) return "Mobile";
  if (/Tablet|iPad/.test(ua)) return "Tablet";
  return "Desktop";
}

export default function VisitorDetailModal({ onClose, eventViews, mode }) {
  // mode = "views" | "visitors"
  const [dRange, setDRange] = useState("all");
  const [exitDrilldown, setExitDrilldown] = useState(null); // exit page name

  const { totalViews, uniqueVisitors, topPages, byCountry, byDevice, exitPages, dailyChart } = useMemo(() => {
    const startDate = getStart(dRange);
    const filtered = (eventViews || []).filter(v => !startDate || new Date(v.created_date) >= startDate);

    const totalViews = filtered.length;
    const uniqueEmails = new Set(filtered.map(v => v.user_email).filter(Boolean));
    const uniqueVisitors = uniqueEmails.size;

    // Top pages — by event_id / page / route
    const pageMap = {};
    filtered.forEach(v => {
      const page = v.event_title || v.event_id || "Unknown Page";
      if (!pageMap[page]) pageMap[page] = { name: page, views: 0, uniqueUsers: new Set() };
      pageMap[page].views++;
      if (v.user_email) pageMap[page].uniqueUsers.add(v.user_email);
    });
    const topPages = Object.values(pageMap)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map(p => ({ ...p, uniqueUsers: p.uniqueUsers.size }));

    // By country
    const countryMap = {};
    filtered.forEach(v => {
      const c = v.country || "Unknown";
      countryMap[c] = (countryMap[c] || 0) + 1;
    });
    const byCountry = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

    // By device (from user_agent if available)
    const deviceMap = {};
    filtered.forEach(v => {
      const d = parseDevice(v.user_agent);
      deviceMap[d] = (deviceMap[d] || 0) + 1;
    });
    const byDevice = Object.entries(deviceMap).map(([name, value]) => ({ name, value }));
    const hasDeviceData = filtered.some(v => v.user_agent);

    // Exit pages — last view per user session (last event they viewed)
    const lastViews = {};
    [...filtered].sort((a, b) => new Date(a.created_date) - new Date(b.created_date)).forEach(v => {
      if (v.user_email) lastViews[v.user_email] = v.event_title || v.event_id || "Unknown Page";
    });
    const exitMap = {};
    Object.values(lastViews).forEach(page => { exitMap[page] = (exitMap[page] || 0) + 1; });
    const exitPages = Object.entries(exitMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

    // Daily chart
    const dayMap = {};
    filtered.forEach(v => {
      const key = new Date(v.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dayMap[key] = (dayMap[key] || 0) + 1;
    });
    const dailyChart = Object.entries(dayMap).slice(-30).map(([day, views]) => ({ day, views }));

    return { totalViews, uniqueVisitors, topPages, byCountry, byDevice: hasDeviceData ? byDevice : [], exitPages, dailyChart };
  }, [dRange, eventViews]);

  const hasData = (eventViews || []).length > 0;
  const title = mode === "visitors" ? "UNIQUE VISITORS" : "PAGE VIEWS";

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl bg-card border border-border/60 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col sm:max-h-[92dvh] max-h-[100dvh] overflow-y-auto sm:overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0 sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            {mode === "visitors" ? <Users className="w-5 h-5 text-primary" /> : <Eye className="w-5 h-5 text-primary" />}
            <div>
              <h2 className="font-display font-black text-base tracking-tight">{title} DETAIL</h2>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Based on EventView records</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Range Selector */}
        <div className="flex gap-1.5 px-4 pt-3 pb-1 shrink-0 flex-wrap sticky top-[65px] sm:top-0 bg-card z-10">
          {DETAIL_RANGES.map(r => (
            <button key={r.key} onClick={() => setDRange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-mono font-bold border transition-all ${
                dRange === r.key ? "bg-primary text-white border-primary" : "bg-background border-border/50 text-muted-foreground hover:border-primary/40"
              }`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Body — exit drilldown or main view */}
        {exitDrilldown ? (
          <div className="flex flex-col sm:flex-1 sm:overflow-y-auto sm:min-h-0">
            <ExitPageDrilldown
              exitPageName={exitDrilldown}
              allViews={(eventViews || []).filter(v => {
                const startDate = getStart(dRange);
                return !startDate || new Date(v.created_date) >= startDate;
              })}
              onBack={() => setExitDrilldown(null)}
            />
          </div>
        ) : null}
        <div className={`sm:overflow-y-auto sm:flex-1 p-4 pb-10 space-y-5 ${exitDrilldown ? "hidden" : ""}`}>
          {!hasData ? (
            <div className="text-center py-16">
              <Eye className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">Tracking data is not available yet.</p>
              <p className="text-muted-foreground text-xs mt-1 font-mono">Visitor data is recorded when users view event pages.</p>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
                  <p className="font-mono text-xs text-muted-foreground uppercase font-semibold">Total Views</p>
                  <p className="font-display font-black text-2xl text-primary mt-0.5">{totalViews.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
                  <p className="font-mono text-xs text-muted-foreground uppercase font-semibold">Unique Visitors</p>
                  <p className="font-display font-black text-2xl text-primary mt-0.5">{uniqueVisitors.toLocaleString()}</p>
                </div>
              </div>

              {/* Daily Views Chart */}
              {dailyChart.length > 1 && (
                <div className="p-4 rounded-xl bg-background border border-border/40">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">Views Over Time</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={dailyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                      <Tooltip formatter={v => [v, "views"]} />
                      <Bar dataKey="views" fill="hsl(var(--primary))" radius={[3,3,0,0]} name="Views" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Most Visited Pages */}
              {topPages.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Most Visited Event Pages</p>
                  </div>
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    {topPages.map((p, i) => (
                      <div key={i} className={`flex items-center justify-between px-3 py-2.5 ${i < topPages.length - 1 ? "border-b border-border/20" : ""} hover:bg-muted/10`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] text-muted-foreground/60 w-4 shrink-0">{i + 1}</span>
                          <span className="text-xs font-medium truncate">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-mono text-muted-foreground">{p.uniqueUsers} uniq</span>
                          <span className="text-sm font-mono font-bold text-primary">{p.views} views</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exit Pages */}
              {exitPages.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-3.5 h-3.5 text-destructive/70" />
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Exit Pages</p>
                    <span className="text-[10px] font-mono text-muted-foreground/50">(last page viewed per user · tap for details)</span>
                  </div>
                  <div className="space-y-1.5">
                    {exitPages.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setExitDrilldown(p.name)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-background border border-border/30 hover:border-destructive/40 hover:bg-destructive/5 active:scale-[0.99] transition-all"
                      >
                        <span className="text-xs font-medium truncate text-left">{p.name}</span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs font-mono text-destructive/80 font-bold">{p.value} exits</span>
                          <TrendingDown className="w-3 h-3 text-destructive/50" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* By Country */}
              {byCountry.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Visitors by Country</p>
                  </div>
                  <div className="space-y-1.5">
                    {byCountry.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex-1 bg-background border border-border/30 rounded-lg h-7 overflow-hidden relative">
                          <div className="h-full bg-primary/20 rounded-lg" style={{ width: `${(c.value / byCountry[0].value) * 100}%` }} />
                          <span className="absolute inset-0 flex items-center px-2.5 text-xs font-medium">{c.name}</span>
                        </div>
                        <span className="font-mono text-xs font-bold w-10 text-right shrink-0">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By Device */}
              {byDevice.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Device Breakdown</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {byDevice.map((d, i) => (
                      <div key={i} className="p-3 rounded-xl bg-background border border-border/40 text-center">
                        <p className="text-xs text-muted-foreground">{d.name}</p>
                        <p className="font-display font-black text-lg mt-0.5">{d.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-background border border-border/30">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-muted-foreground/50" />
                    <p className="text-xs text-muted-foreground font-mono">Device data not available — user_agent not tracked in EventView records.</p>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-muted/20 border border-border/20">
                <p className="text-[10px] font-mono text-muted-foreground/70">
                  ℹ️ Session duration is estimated from first→last page view timestamps. Platform/device and time-on-page tracking not yet available in historical data.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-border/30 flex justify-end pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <button onClick={onClose} className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}