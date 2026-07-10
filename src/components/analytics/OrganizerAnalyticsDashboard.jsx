import { useState, useMemo } from 'react';
import { Download, BarChart3, Users, DollarSign, MapPin, Calendar, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/shared/StatCard';
import { exportToCSV, formatOrdersForExport, formatRevenueForExport, formatAttendeesForExport } from '@/utils/analyticsExport';
import { toast } from 'sonner';
import { format } from 'date-fns';
import AnalyticsDrilldown from './AnalyticsDrilldown';

const COLORS = ['#ff1b8d', '#1e64ff', '#8c3aff', '#1ed8b1', '#ffb800'];

export default function OrganizerAnalyticsDashboard({ events = [], orders = [], tickets = [], tableReservations = [], isFiltered = false }) {
  const [exporting, setExporting] = useState(null);
  const [drilldown, setDrilldown] = useState(null); // 'gross_sales' | 'tickets' | 'attendees' | 'table_sales'

  // All data is already filtered by the parent (OrganizerAnalytics) via date range + event filter.
  // Orders passed in are already status=completed and scoped to this organizer.
  // We just compute metrics directly from the props.

  // Key metrics — Gross Sales = sum of order totals (buyer-paid amount, includes service fees)
  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  // Tickets Sold: use actual Ticket records count (active/scanned), not order.ticket_count (unreliable field)
  const totalTickets = tickets.filter(t => t.status !== 'refunded' && t.status !== 'cancelled').length;
  const avgOrderValue = orders.length ? totalRevenue / orders.length : 0;
  // Platform fees = service_fee field on orders (reliable), fallback to total - subtotal
  const totalFees = orders.reduce((s, o) => s + (o.service_fee || Math.max(0, (o.total || 0) - (o.subtotal || 0))), 0);
  // Unique attendees by customer_email
  const totalAttendees = new Set(orders.map(o => o.customer_email).filter(Boolean)).size;
  // Table Sales: completed/paid table reservations only
  const totalTableSales = tableReservations
    .filter(r => r.payment_status === 'paid' || r.status === 'confirmed' || r.status === 'completed')
    .reduce((s, r) => s + (r.total_amount || r.amount || 0), 0);

  // Revenue by event
  const revenueByEvent = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      if (!map[o.event_id]) {
        map[o.event_id] = { name: o.event_title || 'Unknown', revenue: 0, tickets: 0 };
      }
      map[o.event_id].revenue += o.total || 0;
      map[o.event_id].tickets += (o.quantity || 1);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [orders]);

  // Revenue over time (daily)
  const revenueOverTime = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const day = format(new Date(o.created_date), 'MMM dd');
      if (!map[day]) map[day] = 0;
      map[day] += o.total || 0;
    });
    return Object.entries(map)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([day, revenue]) => ({ day, revenue: parseFloat(revenue.toFixed(2)) }));
  }, [orders]);

  // Income sources breakdown
  const incomeSources = useMemo(() => {
    // Ticket sales from orders (direct / seller)
    const directTickets = orders.filter(o => !o.seller_link_id).reduce((s, o) => s + (o.total || 0), 0);
    const sellerTickets = orders.filter(o => !!o.seller_link_id).reduce((s, o) => s + (o.total || 0), 0);
    // Table/VIP reservations (paid only)
    const tableSales = tableReservations
      .filter(r => r.payment_status === 'paid' || r.status === 'confirmed' || r.status === 'completed')
      .reduce((s, r) => s + (r.total_amount || r.amount || 0), 0);

    return [
      { name: 'Ticket Sales', value: parseFloat(directTickets.toFixed(2)) },
      { name: 'Ticket Seller Sales', value: parseFloat(sellerTickets.toFixed(2)) },
      { name: 'Table / VIP Sales', value: parseFloat(tableSales.toFixed(2)) },
    ].filter(s => s.value > 0);
  }, [orders, tableReservations]);

  // City & country distribution from events
  const cityDistribution = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const city = e.city?.trim();
      const country = e.country?.trim();
      let label;
      if (city && country) label = `${city}, ${country}`;
      else if (city) label = `${city}, Country not available`;
      else if (country) label = country;
      else return;
      if (!map[label]) map[label] = 0;
      map[label] += orders.filter(o => o.event_id === e.id).length;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [events, orders]);

  // Export functions — exportToCSV is now async and handles mobile share sheet
  const handleExport = async (type) => {
    setExporting(type);
    try {
      if (type === 'orders') {
        const data = formatOrdersForExport(orders);
        const result = await exportToCSV(data, `orders-${format(new Date(), 'MMM-dd-yyyy')}.csv`);
        if (result?.method === 'anchor') toast.success('Orders exported!');
      } else if (type === 'revenue') {
        const data = formatRevenueForExport(events, orders);
        const result = await exportToCSV(data, `revenue-${format(new Date(), 'MMM-dd-yyyy')}.csv`);
        if (result?.method === 'anchor') toast.success('Revenue exported!');
      } else if (type === 'attendees') {
        const data = formatAttendeesForExport(orders);
        const result = await exportToCSV(data, `attendees-${format(new Date(), 'MMM-dd-yyyy')}.csv`);
        if (result?.method === 'anchor') toast.success('Attendees exported!');
      }
    } catch {
      toast.error('Export failed');
    }
    setExporting(null);
  };

  return (
    <div className="space-y-6">
      {/* Summary label */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-mono text-muted-foreground">
          {totalTickets} tickets sold
        </p>
        {isFiltered && (
          <span className="text-[10px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full border border-accent/20">
            filtered view
          </span>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="cursor-pointer" onClick={() => setDrilldown('gross_sales')}>
          <StatCard label={isFiltered ? "Gross Sales (filtered)" : "Gross Sales"} value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} accent />
        </div>
        <div className="cursor-pointer" onClick={() => setDrilldown('tickets')}>
          <StatCard label="Tickets Sold" value={totalTickets} icon={Calendar} />
        </div>
        <div className="cursor-pointer" onClick={() => setDrilldown('attendees')}>
          <StatCard label="Event Attendees" value={totalAttendees} icon={Users} />
        </div>
        <div className="cursor-pointer" onClick={() => setDrilldown('table_sales')}>
          <StatCard label="Table Sales" value={`$${totalTableSales.toFixed(2)}`} icon={LayoutGrid} />
        </div>
      </div>

      {/* Drilldown Modal */}
      {drilldown && (
        <AnalyticsDrilldown
          type={drilldown}
          events={events}
          orders={orders}
          tickets={tickets}
          tableReservations={tableReservations}
          onClose={() => setDrilldown(null)}
        />
      )}

      {/* Revenue Over Time */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">REVENUE OVER TIME</h3>
          <Button size="sm" variant="outline" onClick={() => handleExport('revenue')} disabled={exporting === 'revenue'}>
            <Download className="w-3.5 h-3.5" /> {exporting === 'revenue' ? 'Exporting...' : 'Export'}
          </Button>
        </div>
        {revenueOverTime.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(228,30%,18%)" />
              <XAxis dataKey="day" stroke="hsl(220,20%,60%)" tick={{ fill: 'hsl(220,20%,70%)', fontSize: 11 }} />
              <YAxis stroke="hsl(220,20%,60%)" tick={{ fill: 'hsl(220,20%,70%)', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(228,45%,10%)', border: '1px solid hsl(228,30%,22%)', borderRadius: 8, color: '#f4f4f5' }} labelStyle={{ color: '#f4f4f5', fontWeight: 600 }} itemStyle={{ color: '#f4f4f5' }} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(330,100%,55%)" strokeWidth={2} dot={{ fill: 'hsl(330,100%,55%)' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
        )}
      </div>

      {/* Revenue by Event & Attendee Source */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top Events */}
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg">TOP EVENTS</h3>
            <Button size="sm" variant="outline" onClick={() => handleExport('revenue')} disabled={exporting === 'revenue'}>
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
          {revenueByEvent.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueByEvent}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(228,30%,18%)" />
                <XAxis dataKey="name" stroke="hsl(220,20%,60%)" tick={{ fill: 'hsl(220,20%,70%)', fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="hsl(220,20%,60%)" tick={{ fill: 'hsl(220,20%,70%)', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(228,45%,10%)', border: '1px solid hsl(228,30%,22%)', borderRadius: 8, color: '#f4f4f5' }} labelStyle={{ color: '#f4f4f5', fontWeight: 600 }} itemStyle={{ color: '#f4f4f5' }} />
                <Bar dataKey="revenue" fill="hsl(330,100%,55%)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No events in this period</p>
          )}
        </div>

        {/* Income Sources */}
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
          <h3 className="font-display font-bold text-lg">INCOME SOURCES</h3>
          {incomeSources.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={incomeSources}
                    cx="50%" cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {incomeSources.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`$${value.toFixed(2)}`, '']}
                    contentStyle={{ backgroundColor: 'hsl(228,45%,10%)', border: '1px solid hsl(228,30%,22%)', borderRadius: 8, color: '#f4f4f5' }}
                    labelStyle={{ color: '#f4f4f5', fontWeight: 600 }}
                    itemStyle={{ color: '#f4f4f5' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="space-y-1.5">
                {incomeSources.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                    <span className="font-mono font-bold text-foreground">${s.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No income sources yet.</p>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      {orders.length > 0 && (
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg">RECENT ORDERS</h3>
            <span className="font-mono text-xs text-muted-foreground">{orders.length} total</span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            ← Swipe or scroll horizontally to view all columns →
          </p>
          <div className="overflow-x-auto rounded-lg" style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(330,100%,55%) hsl(228,35%,16%)' }}>
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/40">
                  <th className="text-left font-mono text-[10px] text-muted-foreground uppercase tracking-widest p-3 whitespace-nowrap">Order #</th>
                  <th className="text-left font-mono text-[10px] text-muted-foreground uppercase tracking-widest p-3 whitespace-nowrap">Customer</th>
                  <th className="text-left font-mono text-[10px] text-muted-foreground uppercase tracking-widest p-3 whitespace-nowrap">Event</th>
                  <th className="text-left font-mono text-[10px] text-muted-foreground uppercase tracking-widest p-3 whitespace-nowrap">Date</th>
                  <th className="text-right font-mono text-[10px] text-muted-foreground uppercase tracking-widest p-3 whitespace-nowrap">Total</th>
                  <th className="text-left font-mono text-[10px] text-muted-foreground uppercase tracking-widest p-3 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {orders.slice(0, 20).map((o) => (
                  <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{o.order_number || o.id?.slice(-8)}</td>
                    <td className="p-3 whitespace-nowrap">
                      <p className="font-medium text-sm">{o.customer_name || '—'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{o.customer_email}</p>
                    </td>
                    <td className="p-3 text-sm whitespace-nowrap max-w-[180px] truncate">{o.event_title || '—'}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {o.created_date ? format(new Date(o.created_date), 'MMM dd, yyyy') : '—'}
                    </td>
                    <td className="p-3 font-mono text-sm font-bold text-primary text-right whitespace-nowrap">${(o.total || 0).toFixed(2)}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        o.status === 'completed' ? 'bg-green-400/15 text-green-400' :
                        o.status === 'refunded' ? 'bg-destructive/15 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* City Distribution & Quick Exports */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* City Distribution */}
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <MapPin className="w-4 h-4" /> CITY &amp; COUNTRY INFO
          </h3>
          <div className="space-y-2">
            {cityDistribution.length > 0 ? (
              cityDistribution.map((city, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 p-2 rounded hover:bg-muted/30">
                  <span className="text-sm font-medium leading-snug">{city.name}</span>
                  <span className="text-sm font-mono font-bold text-primary shrink-0">{city.value} attendees</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No location data</p>
            )}
          </div>
        </div>

        {/* Export Actions */}
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <Download className="w-4 h-4" /> EXPORT DATA
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => handleExport('orders')}
              disabled={exporting === 'orders'}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" /> {exporting === 'orders' ? 'Exporting...' : 'Export Orders'}
            </button>
            <button
              onClick={() => handleExport('attendees')}
              disabled={exporting === 'attendees'}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-colors text-sm font-medium"
            >
              <Users className="w-4 h-4" /> {exporting === 'attendees' ? 'Exporting...' : 'Export Attendees'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}