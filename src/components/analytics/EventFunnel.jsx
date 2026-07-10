import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Eye, Ticket, ShoppingCart, CheckCircle, TrendingDown } from "lucide-react";

const STAGES = [
  { key: "view", label: "Event Views", icon: Eye, color: "bg-accent" },
  { key: "ticket_select", label: "Selected Tickets", icon: Ticket, color: "bg-primary" },
  { key: "checkout_attempt", label: "Started Checkout", icon: ShoppingCart, color: "bg-yellow-500" },
  { key: "checkout_complete", label: "Completed Purchase", icon: CheckCircle, color: "bg-green-500" },
];

export default function EventFunnel({ events }) {
  const [views, setViews] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const eventIds = new Set(events.map((e) => e.id));
      const allViews = await base44.entities.EventView.list("-created_date", 5000);
      setViews(allViews.filter((v) => eventIds.has(v.event_id)));
      setLoading(false);
    })();
  }, [events]);

  const filtered = selectedEvent === "all" ? views : views.filter((v) => v.event_id === selectedEvent);

  const countStage = (stage) => {
    const unique = new Set(filtered.filter((v) => v.stage === stage).map((v) => v.session_id || v.id));
    return unique.size;
  };

  const stageCounts = STAGES.map((s) => ({ ...s, count: countStage(s.key) }));
  const maxCount = stageCounts[0]?.count || 1;

  // Per-event breakdown
  const perEvent = events.map((e) => {
    const evViews = views.filter((v) => v.event_id === e.id);
    const count = (stage) => new Set(evViews.filter((v) => v.stage === stage).map((v) => v.session_id || v.id)).size;
    return {
      id: e.id,
      title: e.title,
      views: count("view"),
      selects: count("ticket_select"),
      attempts: count("checkout_attempt"),
      completes: count("checkout_complete"),
      convRate: count("view") > 0 ? ((count("checkout_complete") / count("view")) * 100).toFixed(1) : "0.0",
    };
  }).filter((e) => e.views > 0).sort((a, b) => b.views - a.views);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Event filter */}
      <div className="flex items-center gap-3">
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Filter by event:</label>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="bg-card border border-border/50 rounded-md px-3 py-1.5 text-sm font-mono"
        >
          <option value="all">All Events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>

      {/* Funnel */}
      <div className="p-6 rounded-xl bg-card border border-border/50">
        <h3 className="font-display font-bold text-sm uppercase tracking-wide mb-6">Conversion Funnel</h3>
        <div className="space-y-4">
          {stageCounts.map((s, i) => {
            const pct = maxCount > 0 ? Math.round((s.count / maxCount) * 100) : 0;
            const dropOff = i > 0 ? stageCounts[i - 1].count - s.count : 0;
            const dropPct = i > 0 && stageCounts[i - 1].count > 0
              ? Math.round((dropOff / stageCounts[i - 1].count) * 100)
              : 0;
            return (
              <div key={s.key}>
                {i > 0 && dropOff > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-2 ml-2">
                    <TrendingDown className="w-3 h-3 text-destructive" />
                    <span>{dropOff} dropped ({dropPct}%)</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-44 shrink-0">
                    <s.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground truncate">{s.label}</span>
                  </div>
                  <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${s.color} rounded-lg transition-all duration-500 flex items-center px-3`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    >
                      {pct > 15 && <span className="text-xs font-mono font-bold text-white">{s.count}</span>}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-sm w-12 text-right">{s.count}</span>
                </div>
              </div>
            );
          })}
        </div>
        {stageCounts[0].count > 0 && (
          <p className="text-xs text-muted-foreground font-mono mt-4">
            Overall conversion rate:{" "}
            <span className="text-green-400 font-bold">
              {((stageCounts[3].count / stageCounts[0].count) * 100).toFixed(1)}%
            </span>{" "}
            (views → purchases)
          </p>
        )}
      </div>

      {/* Per-event table */}
      {perEvent.length > 0 && (
        <div className="p-6 rounded-xl bg-card border border-border/50">
          <h3 className="font-display font-bold text-sm uppercase tracking-wide mb-4">Per-Event Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left font-mono text-xs text-muted-foreground pb-2 pr-4">Event</th>
                  <th className="text-right font-mono text-xs text-muted-foreground pb-2 px-3">Views</th>
                  <th className="text-right font-mono text-xs text-muted-foreground pb-2 px-3">Selected</th>
                  <th className="text-right font-mono text-xs text-muted-foreground pb-2 px-3">Attempted</th>
                  <th className="text-right font-mono text-xs text-muted-foreground pb-2 px-3">Purchased</th>
                  <th className="text-right font-mono text-xs text-muted-foreground pb-2 pl-3">Conv. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {perEvent.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-4 font-medium truncate max-w-[180px]">{e.title}</td>
                    <td className="py-2 px-3 text-right font-mono">{e.views}</td>
                    <td className="py-2 px-3 text-right font-mono">{e.selects}</td>
                    <td className="py-2 px-3 text-right font-mono">{e.attempts}</td>
                    <td className="py-2 px-3 text-right font-mono text-green-400 font-bold">{e.completes}</td>
                    <td className="py-2 pl-3 text-right font-mono text-primary font-bold">{e.convRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {views.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8 font-mono">No view data yet. Data will appear once users visit your event pages.</p>
      )}
    </div>
  );
}