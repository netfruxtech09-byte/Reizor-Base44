import { useState, useEffect } from "react";
import { ExternalLink, TrendingUp, MousePointerClick, DollarSign, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const SOURCE_COLORS = {
  ticketmaster: "text-blue-400",
  eventbrite: "text-orange-400",
  stubhub: "text-green-400",
  seatgeek: "text-purple-400",
  viagogo: "text-red-400",
  axs: "text-cyan-400",
};

export default function AffiliateEarningsWidget() {
  const [events, setEvents] = useState([]);
  const [clicks, setClicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.AffiliateEvent.list("-estimated_earnings", 200),
      base44.entities.AffiliateClick.list("-created_date", 500),
    ]).then(([ev, cl]) => {
      setEvents(ev);
      setClicks(cl);
      setLoading(false);
    });
  }, []);

  const totalClicks = events.reduce((s, e) => s + (e.click_count || 0), 0);
  const totalEstimatedEarnings = events.reduce((s, e) => s + (e.estimated_earnings || 0), 0);
  const activeEvents = events.filter(e => e.status === "active").length;

  const bySource = events.reduce((acc, e) => {
    if (!acc[e.source]) acc[e.source] = { clicks: 0, earnings: 0, count: 0 };
    acc[e.source].clicks += e.click_count || 0;
    acc[e.source].earnings += e.estimated_earnings || 0;
    acc[e.source].count++;
    return acc;
  }, {});

  const handleRefreshNow = async () => {
    setRefreshing(true);
    toast.info("Running affiliate event discovery...");
    await base44.functions.invoke("discoverAffiliateEvents", {});
    const ev = await base44.entities.AffiliateEvent.list("-estimated_earnings", 200);
    setEvents(ev);
    setRefreshing(false);
    toast.success("Affiliate events refreshed!");
  };

  if (loading) return <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-lg">AFFILIATE EVENTS & EARNINGS</h2>
        </div>
        <Button onClick={handleRefreshNow} disabled={refreshing} size="sm" variant="outline" className="gap-1.5 font-mono text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Searching..." : "Refresh Now"}
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-lg bg-card border border-border/50 text-center">
          <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="font-display font-black text-2xl">{activeEvents}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Active Events</p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border/50 text-center">
          <MousePointerClick className="w-4 h-4 text-accent mx-auto mb-1" />
          <p className="font-display font-black text-2xl">{totalClicks}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Total Clicks</p>
        </div>
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 text-center">
          <DollarSign className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="font-display font-black text-2xl text-primary">${totalEstimatedEarnings.toFixed(2)}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Est. Earnings</p>
        </div>
      </div>

      {/* By source breakdown */}
      <div className="rounded-lg bg-card border border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase">Platform</th>
              <th className="text-right p-3 font-mono text-[10px] text-muted-foreground uppercase">Events</th>
              <th className="text-right p-3 font-mono text-[10px] text-muted-foreground uppercase">Clicks</th>
              <th className="text-right p-3 font-mono text-[10px] text-muted-foreground uppercase">Est. Earnings</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(bySource).sort((a, b) => b[1].earnings - a[1].earnings).map(([src, data]) => (
              <tr key={src} className="border-b border-border/30 last:border-0">
                <td className="p-3">
                  <span className={`font-mono text-xs font-bold uppercase ${SOURCE_COLORS[src] || "text-muted-foreground"}`}>
                    {src}
                  </span>
                </td>
                <td className="p-3 text-right font-mono text-xs">{data.count}</td>
                <td className="p-3 text-right font-mono text-xs">{data.clicks}</td>
                <td className="p-3 text-right font-mono text-xs font-bold text-green-400">${data.earnings.toFixed(2)}</td>
              </tr>
            ))}
            {Object.keys(bySource).length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">No affiliate events yet — click Refresh Now</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Top earning events */}
      {events.filter(e => e.estimated_earnings > 0).length > 0 && (
        <div>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Top Earning Events</p>
          <div className="space-y-2">
            {events.filter(e => e.estimated_earnings > 0).slice(0, 5).map(ev => (
              <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{ev.event_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{ev.city} · {ev.click_count} clicks</p>
                </div>
                <span className="font-mono text-sm font-bold text-green-400 ml-3">${ev.estimated_earnings.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}