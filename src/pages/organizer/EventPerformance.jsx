import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DollarSign, Ticket, CheckCircle2, Clock, ChevronDown, Users, Star, CreditCard } from "lucide-react";
import StatCard from "../../components/shared/StatCard";

export default function EventPerformance() {
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [tickets, setTickets] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await base44.auth.me();
      const evs = await base44.entities.Event.filter(
        { organizer_id: user.id },
        "-created_date",
        100
      );
      setEvents(evs);
      if (evs.length > 0) setSelectedId(evs[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setTicketsLoading(true);
    Promise.all([
      base44.entities.Ticket.filter({ event_id: selectedId }, "-created_date", 500),
      base44.entities.Order.filter({ event_id: selectedId, status: "completed" }, "-created_date", 500),
    ]).then(([tix, ords]) => {
      setTickets(tix);
      setOrders(ords);
      setTicketsLoading(false);
    });
  }, [selectedId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-20">
        <Ticket className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="font-display font-bold text-xl text-muted-foreground">No events yet</p>
      </div>
    );
  }

  const event = events.find((e) => e.id === selectedId);
  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const scanned = tickets.filter((t) => t.status === "scanned").length;
  const active = tickets.filter((t) => t.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ PERFORMANCE</span>
        <h1 className="font-display font-black text-3xl tracking-tight mt-1">EVENT PERFORMANCE</h1>
      </div>

      {/* Event Selector */}
      <div className="relative max-w-sm">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none pr-10"
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.title}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>

      {ticketsLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Revenue" value={`$${revenue.toLocaleString()}`} icon={DollarSign} accent />
            <StatCard label="Tickets Sold" value={tickets.length} icon={Ticket} />
            <StatCard label="Checked In" value={scanned} icon={CheckCircle2} />
            <StatCard label="Not Scanned" value={active} icon={Clock} />
          </div>

          {/* Occupancy Bar */}
          {event?.total_capacity > 0 && (
            <div className="p-5 rounded-xl bg-card border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Capacity</span>
                <span className="font-mono text-sm font-bold text-primary">
                  {tickets.length} / {event.total_capacity}
                </span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
                  style={{ width: `${Math.min((tickets.length / event.total_capacity) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground">
                  {event.total_capacity > 0 ? Math.round((tickets.length / event.total_capacity) * 100) : 0}% sold
                </span>
                <span className="text-xs text-muted-foreground">
                  {Math.max(event.total_capacity - tickets.length, 0)} remaining
                </span>
              </div>
            </div>
          )}

          {/* Attendee List */}
          <div className="p-6 rounded-xl bg-card border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-display font-bold text-sm tracking-wide uppercase">Attendees</h3>
              <span className="font-mono text-xs text-muted-foreground ml-auto">{tickets.length} total</span>
            </div>

            {tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No tickets sold yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left font-mono text-[10px] text-muted-foreground uppercase tracking-widest pb-3 pr-4">Name</th>
                      <th className="text-left font-mono text-[10px] text-muted-foreground uppercase tracking-widest pb-3 pr-4">Ticket</th>
                      <th className="text-left font-mono text-[10px] text-muted-foreground uppercase tracking-widest pb-3 pr-4">Code</th>
                      <th className="text-left font-mono text-[10px] text-muted-foreground uppercase tracking-widest pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {tickets.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 pr-4">
                          <p className="font-medium">{t.owner_name || "—"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{t.owner_email}</p>
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">{t.ticket_type_name || "—"}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{t.ticket_code}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {t.status === "scanned" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3" /> Scanned
                              </span>
                            ) : t.status === "active" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">
                                <Clock className="w-3 h-3" /> Not scanned
                              </span>
                            ) : (
                              <span className="text-xs font-mono text-muted-foreground capitalize">{t.status}</span>
                            )}
                            {t.purchased_with_loyalty && (
                              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                                <Star className="w-3 h-3" /> Loyalty
                              </span>
                            )}
                            {t.paid_with_credit && (
                              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">
                                <CreditCard className="w-3 h-3" /> Credit
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}