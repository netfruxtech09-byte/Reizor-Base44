import { useState, useMemo } from "react";
import { format, subDays, eachDayOfInterval, eachWeekOfInterval, parseISO, startOfWeek } from "date-fns";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

const TOOLTIP_STYLE = {
  background: "hsl(228,45%,10%)",
  border: "1px solid hsl(228,30%,18%)",
  borderRadius: 8,
  fontSize: 12,
};

const RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "All", days: null },
];

export default function SalesOverTime({ orders, events }) {
  const [range, setRange] = useState(30);
  const [selectedEvent, setSelectedEvent] = useState("all");

  const eventsWithOrders = events.filter((e) =>
    orders.some((o) => o.event_id === e.id)
  );

  const filteredOrders = useMemo(() => {
    let o = orders;
    if (selectedEvent !== "all") o = o.filter((x) => x.event_id === selectedEvent);
    if (range) {
      const cutoff = subDays(new Date(), range);
      o = o.filter((x) => new Date(x.created_date) >= cutoff);
    }
    return o;
  }, [orders, selectedEvent, range]);

  const chartData = useMemo(() => {
    const end = new Date();
    const start = range ? subDays(end, range) : (
      filteredOrders.length > 0
        ? new Date(Math.min(...filteredOrders.map((o) => new Date(o.created_date))))
        : subDays(end, 30)
    );

    const days = eachDayOfInterval({ start, end });
    return days.map((day) => {
      const key = format(day, "MMM d");
      const dayOrders = filteredOrders.filter(
        (o) => format(new Date(o.created_date), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
      );
      return {
        date: key,
        revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0),
        orders: dayOrders.length,
        tickets: dayOrders.reduce((s, o) => s + (o.items?.reduce((si, i) => si + (i.quantity || 0), 0) || 0), 0),
      };
    });
  }, [filteredOrders, range]);

  const totalRevenue = filteredOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalOrders = filteredOrders.length;
  const avgOrder = totalOrders ? (totalRevenue / totalOrders).toFixed(0) : 0;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">EVENT:</span>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Events</option>
            {eventsWithOrders.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.days)}
              className={`px-3 py-1 text-xs font-mono font-bold rounded-md transition-colors ${
                range === r.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Revenue", value: `$${totalRevenue.toLocaleString()}` },
          { label: "Orders", value: totalOrders },
          { label: "Avg Order", value: `$${avgOrder}` },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-card border border-border/50">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{s.label}</p>
            <p className="font-mono text-2xl font-bold text-primary mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Area Chart */}
      <div className="p-6 rounded-xl bg-card border border-border/50">
        <div className="flex items-center justify-between gap-3 mb-4 flex-nowrap overflow-x-auto">
          <h3 className="font-display font-bold text-sm tracking-wide uppercase whitespace-nowrap">Revenue Over Time</h3>
          <button className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md border border-primary text-primary text-xs font-mono font-bold hover:bg-primary/10 transition-colors shrink-0 whitespace-nowrap">
            ↓
          </button>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(330,100%,55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(330,100%,55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(228,30%,15%)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "hsl(220,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "hsl(220,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`$${v.toLocaleString()}`, "Revenue"]} />
            <Area type="monotone" dataKey="revenue" stroke="hsl(330,100%,55%)" strokeWidth={2} fill="url(#revenueGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Orders Line Chart */}
      <div className="p-6 rounded-xl bg-card border border-border/50">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase mb-4 whitespace-nowrap overflow-x-auto">Orders & Tickets Sold</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(228,30%,15%)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "hsl(220,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "hsl(220,20%,55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="orders" stroke="hsl(220,100%,55%)" strokeWidth={2} dot={false} name="Orders" />
            <Line type="monotone" dataKey="tickets" stroke="hsl(280,80%,60%)" strokeWidth={2} dot={false} name="Tickets" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}