import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, DollarSign, Ticket, Users, ShoppingBag, CheckCircle2, Clock, Calendar, LayoutGrid } from 'lucide-react';
import { format } from 'date-fns';

const DRILLDOWN_CONFIG = {
  gross_sales:  { title: 'Gross Sales by Event', icon: DollarSign },
  tickets:      { title: 'Tickets Sold by Event', icon: Ticket },
  orders:       { title: 'Checkout Orders by Event', icon: ShoppingBag },
  attendees:    { title: 'Event Attendees by Event', icon: Users },
  table_sales:  { title: 'Table Sales by Event', icon: LayoutGrid },
};

export default function AnalyticsDrilldown({ type, events, orders, tickets, tableReservations = [], onClose }) {
  const [selectedEvent, setSelectedEvent] = useState(null);

  const eventStats = events.map(event => {
    const eventOrders  = orders.filter(o => o.event_id === event.id);
    const eventTickets = tickets.filter(t => t.event_id === event.id && t.status !== 'refunded' && t.status !== 'cancelled');
    const revenue      = eventOrders.reduce((s, o) => s + (o.total || 0), 0);
    const attendees    = new Set(eventOrders.map(o => o.customer_email).filter(Boolean));
    const checkedIn    = eventTickets.filter(t => t.status === 'scanned').length;
    const eventTables  = tableReservations.filter(r =>
      r.event_id === event.id &&
      (r.payment_status === 'paid' || r.status === 'confirmed' || r.status === 'completed')
    );
    const tableSales   = eventTables.reduce((s, r) => s + (r.total_amount || r.amount || 0), 0);
    return { ...event, eventOrders, eventTickets, revenue, attendeeCount: attendees.size, checkedIn, eventTables, tableSales };
  })
  .filter(e => {
    if (type === 'gross_sales')  return e.revenue > 0;
    if (type === 'tickets')      return e.eventTickets.length > 0;
    if (type === 'orders')       return e.eventOrders.length > 0;
    if (type === 'attendees')    return e.attendeeCount > 0;
    if (type === 'table_sales')  return e.tableSales > 0;
    return true;
  })
  .sort((a, b) => {
    if (type === 'gross_sales')  return b.revenue - a.revenue;
    if (type === 'tickets')      return b.eventTickets.length - a.eventTickets.length;
    if (type === 'orders')       return b.eventOrders.length - a.eventOrders.length;
    if (type === 'attendees')    return b.attendeeCount - a.attendeeCount;
    if (type === 'table_sales')  return b.tableSales - a.tableSales;
    return 0;
  });

  const config = DRILLDOWN_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl bg-card border border-border/60 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
          {selectedEvent ? (
            <button
              onClick={() => setSelectedEvent(null)}
              className="flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to events</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              <h2 className="font-display font-bold text-base">{config.title}</h2>
            </div>
          )}
          {selectedEvent && (
            <p className="text-sm font-medium text-foreground truncate max-w-[160px]">{selectedEvent.title}</p>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {selectedEvent
            ? <EventDetail type={type} event={selectedEvent} />
            : <EventList type={type} eventStats={eventStats} onSelect={setSelectedEvent} />
          }
        </div>
      </div>
    </div>
  );
}

function EventList({ type, eventStats, onSelect }) {
  if (eventStats.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {eventStats.map(event => {
        const dateStr = event.date || event.start_datetime;
        return (
          <button
            key={event.id}
            onClick={() => onSelect(event)}
            className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{event.title}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {dateStr ? format(new Date(dateStr), 'MMM dd, yyyy') : 'No date set'}
              </p>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {type === 'gross_sales' && (
                  <span className="text-xs font-mono font-bold text-primary">${event.revenue.toFixed(2)}</span>
                )}
                {type === 'tickets' && (
                  <span className="text-xs font-mono font-bold text-primary">{event.eventTickets.length} tickets</span>
                )}
                {type === 'orders' && (
                  <span className="text-xs font-mono font-bold text-primary">{event.eventOrders.length} orders</span>
                )}
                {type === 'attendees' && (
                  <span className="text-xs font-mono font-bold text-primary">{event.attendeeCount} attendees</span>
                )}
                {type === 'table_sales' && (
                  <span className="text-xs font-mono font-bold text-primary">${event.tableSales.toFixed(2)} · {event.eventTables.length} table{event.eventTables.length !== 1 ? 's' : ''}</span>
                )}
                <span className="text-xs font-mono text-muted-foreground">
                  {event.eventTickets.length} tickets · {event.checkedIn} checked in
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

function EventDetail({ type, event }) {
  if (type === 'gross_sales' || type === 'orders') {
    return <OrdersDetail orders={event.eventOrders} />;
  }
  if (type === 'table_sales') {
    return <TableSalesDetail tables={event.eventTables} />;
  }
  return <AttendeeDetail tickets={event.eventTickets} orders={event.eventOrders} />;
}

function TableSalesDetail({ tables }) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-mono text-muted-foreground">{tables.length} table reservation{tables.length !== 1 ? 's' : ''}</p>
      {tables.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No table sales</p>
      ) : (
        <div className="space-y-2">
          {tables.map(r => (
            <div key={r.id} className="p-3 rounded-xl bg-background border border-border/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.customer_name || r.guest_name || '—'}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{r.customer_email || r.guest_email || '—'}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {r.table_name && (
                      <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{r.table_name}</span>
                    )}
                    {r.num_guests && (
                      <span className="text-[10px] font-mono text-muted-foreground">{r.num_guests} guests</span>
                    )}
                    {r.created_date && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {format(new Date(r.created_date), 'MMM dd, yyyy')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-bold text-primary">${(r.total_amount || r.amount || 0).toFixed(2)}</p>
                  <span className="text-[10px] font-mono bg-green-400/15 text-green-400 px-1.5 py-0.5 rounded-full">
                    {r.payment_status || r.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersDetail({ orders }) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-mono text-muted-foreground">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No orders</p>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <div key={o.id} className="p-3 rounded-xl bg-background border border-border/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{o.customer_name || '—'}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{o.customer_email || '—'}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      #{o.order_number || o.id?.slice(-8)}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {o.quantity || 1} ticket{(o.quantity || 1) !== 1 ? 's' : ''}
                    </span>
                    {o.created_date && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {format(new Date(o.created_date), 'MMM dd, yyyy')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-bold text-primary">${(o.total || 0).toFixed(2)}</p>
                  <span className="text-[10px] font-mono bg-green-400/15 text-green-400 px-1.5 py-0.5 rounded-full">
                    {o.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttendeeDetail({ tickets, orders }) {
  const orderMap = {};
  orders.forEach(o => { orderMap[o.id] = o; });

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-mono text-muted-foreground">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No attendees</p>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const order = orderMap[t.order_id];
            const isCheckedIn = t.status === 'scanned';
            const name  = t.attendee_name  || order?.customer_name  || '—';
            const email = t.attendee_email || order?.customer_email || '—';
            return (
              <div key={t.id} className="p-3 rounded-xl bg-background border border-border/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{email}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {t.ticket_type_name && (
                        <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                          {t.ticket_type_name}
                        </span>
                      )}
                      {t.order_id && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          #{t.order_id?.slice(-8)}
                        </span>
                      )}
                      {t.created_date && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {format(new Date(t.created_date), 'MMM dd, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isCheckedIn ? (
                      <span className="flex items-center gap-1 text-[10px] font-mono bg-green-400/15 text-green-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3" /> Checked In
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}