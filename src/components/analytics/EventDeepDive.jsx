import { useState } from "react";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import { TrendingUp, Ticket, DollarSign, Users, ChevronDown } from "lucide-react";

const TOOLTIP_STYLE = {
  background: "hsl(228,45%,10%)",
  border: "1px solid hsl(228,30%,18%)",
  borderRadius: 8,
  fontSize: 12,
};

const STATUS_COLORS = {
  published: "text-green-400 bg-green-400/10",
  draft: "text-yellow-400 bg-yellow-400/10",
  cancelled: "text-red-400 bg-red-400/10",
  completed: "text-blue-400 bg-blue-400/10",
  sold_out: "text-primary bg-primary/10",
};

export default function EventDeepDive({ events, orders, tickets }) {
  const [selectedId, setSelectedId] = useState(events[0]?.id || "");

  const event = events.find((e) => e.id === selectedId);
  const eventOrders = orders.filter((o) => o.event_id === selectedId);
  const eventTickets = tickets.filter((t) => t.event_id === selectedId);

  const revenue = eventOrders.reduce((s, o) => s + (o.total || 0), 0);
  const sold = event?.tickets_sold || eventTickets.length;
  const capacity = event?.total_capacity || 0;
  const occupancy = capacity ? Math.round((sold / capacity) * 100) : 0;
  const scanned = eventTickets.filter((t) => t.status === "scanned").length;

  // Ticket breakdown by type
  const byType = eventTickets.reduce((acc, t) => {
    const name = t.ticket_type_name || "Unknown";
    if (!acc[name]) acc[name] = { name, count: 0, revenue: 0 };
    acc[name].count += 1;
    acc[name].revenue += t.price_paid || 0;
    return acc;
  }, {});
  const typeData = Object.values(byType);

  // Orders over time (by day)
  const dailyMap = {};
  eventOrders.forEach((o) => {
    const d = format(new Date(o.created_date), "MMM d");
    dailyMap[d] = (dailyMap[d] || 0) + (o.total || 0);
  });
  const dailyData = Object.entries(dailyMap)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .map(([date, revenue]) => ({ date, revenue }));

  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm py-10 text-center">No events found.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Event Selector */}
      <div className="relative">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none pr-10"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>

      {event && (
        <>
          {/* Event header */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {event.cover_image && (
              <img src={event.cover_image} alt={event.title} className="w-16 h-16 rounded-lg object-cover border border-border/50" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-black text-xl tracking-tight">{event.title}</h2>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${STATUS_COLORS[event.status] || ""}`}>
                  {event.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {event.venue_name} · {event.city} · {event.date ? format(new Date(event.date), "MMM d, yyyy") : "—"}
              </p>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Revenue", value: `$${revenue.toLocaleString()}`, icon: DollarSign, accent: true },
              { label: "Tickets Sold", value: `${sold}${capacity ? ` / ${capacity}` : ""}`, icon: Ticket },
              { label: "Occupancy", value: `${occupancy}%`, icon: TrendingUp },
              { label: "Checked In", value: `${scanned}${sold ? ` / ${sold}` : ""}`, icon: Users },
            ].map((s) => (
              <div key={s.label} className="p-4 rounded-xl bg-card border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{s.label}</span>
                  <s.icon className={`w-4 h-4 ${s.accent ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <p className={`font-mono text-2xl font-bold ${s.accent ? "text-primary" : "text-foreground"}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Occupancy bar */}
          <div className="p-5 rounded-xl bg-card border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Capacity Fill Rate</span>
              <span className="font-mono text-sm text-primary font-bold">{occupancy}%</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(occupancy, 100)}%`,
                  background: occupancy >= 90
                    ? "hsl(330,100%,55%)"
                    : occupancy >= 60
                    ? "hsl(220,100%,55%)"
                    : "hsl(160,70%,45%)",
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue over time */}
            <div className="p-6 rounded-xl bg-card border border-border/50">
              <h3 className="font-display font-bold text-sm tracking-wide uppercase mb-4">Revenue Timeline</h3>
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(228,30%,15%)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "hsl(220,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(220,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`$${v.toLocaleString()}`, "Revenue"]} />
                    <Bar dataKey="revenue" fill="hsl(330,100%,55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10">No orders yet</p>
              )}
            </div>

            {/* Ticket type breakdown */}
            <div className="p-6 rounded-xl bg-card border border-border/50">
              <h3 className="font-display font-bold text-sm tracking-wide uppercase mb-4">Ticket Type Breakdown</h3>
              {typeData.length > 0 ? (
                <div className="space-y-3">
                  {typeData.map((t, i) => {
                    const pct = sold ? Math.round((t.count / sold) * 100) : 0;
                    const colors = ["hsl(330,100%,55%)", "hsl(220,100%,55%)", "hsl(280,80%,60%)", "hsl(30,80%,55%)"];
                    return (
                      <div key={t.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium">{t.name}</span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{t.count} sold</span>
                            <span className="font-mono text-foreground">${t.revenue.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10">No ticket data yet</p>
              )}
            </div>
          </div>

          {/* Recent orders table */}
          <div className="p-6 rounded-xl bg-card border border-border/50">
            <h3 className="font-display font-bold text-sm tracking-wide uppercase mb-4">
              Recent Orders <span className="font-mono font-normal text-muted-foreground text-xs ml-2">({eventOrders.length} total)</span>
            </h3>
            {eventOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      {["Customer", "Order #", "Items", "Total", "Date"].map((h) => (
                        <th key={h} className="text-left py-2 px-3 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {eventOrders.slice(0, 10).map((o) => (
                      <tr key={o.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-medium">{o.customer_name || o.customer_email}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{o.order_number}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">
                          {o.items?.map((i) => `${i.quantity}x ${i.ticket_type_name}`).join(", ") || "—"}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-primary">${o.total?.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">{format(new Date(o.created_date), "MMM d, HH:mm")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No orders for this event yet</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}