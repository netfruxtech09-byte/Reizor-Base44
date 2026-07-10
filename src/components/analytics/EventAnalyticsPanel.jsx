import { useMemo, useState } from "react";
import {
  Ticket, Users, DollarSign, ScanLine, Table2,
  CheckCircle2, XCircle, BarChart3, HelpCircle, X, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { getRelativeTime } from "@/utils/getRelativeTime";
import { normalizeCity } from "@/utils/normalizeLocation";

// ── Reusable bar row ─────────────────────────────────────────────────────────
function BarRow({ label, count, total, color = "bg-primary", extra }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium truncate max-w-[60%]">{label}</span>
        <span className="font-mono text-muted-foreground ml-2 shrink-0">
          {count} <span className="text-muted-foreground/60">({pct}%)</span>
          {extra && <span className="ml-1 text-muted-foreground/60">{extra}</span>}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Summary stat box ─────────────────────────────────────────────────────────
function StatBox({ label, value, icon: Icon, color = "text-primary", bg = "bg-primary/10", onClick }) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl bg-card border border-border/50 text-center transition-all ${clickable ? "cursor-pointer hover:border-primary/50 hover:bg-secondary/30 active:scale-95" : ""}`}
    >
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mx-auto mb-2`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`font-mono font-bold text-xl ${color}`}>{value}</p>
      <p className="font-mono text-[10px] text-muted-foreground uppercase mt-0.5">{label}</p>
      {clickable && <p className="text-[9px] font-mono text-muted-foreground/50 mt-1">tap to view details</p>}
    </div>
  );
}

// ── Drill-down modal ──────────────────────────────────────────────────────────
function DrilldownModal({ title, records, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-xl bg-card border border-border/60 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "88dvh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
          <h2 className="font-display font-bold text-base">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No records found.</p>
          ) : (
            <div className="space-y-2">
              {records.map((r, i) => (
                <div key={r.id || i} className="p-3 rounded-xl bg-background border border-border/40 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.primaryLabel || "—"}</p>
                      {r.secondaryLabel && <p className="text-xs text-muted-foreground font-mono truncate">{r.secondaryLabel}</p>}
                    </div>
                    {r.badge && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${r.badgeClass || "bg-muted text-muted-foreground"}`}>
                        {r.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.tags?.map((tag, ti) => (
                      <span key={ti} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${tag.class || "bg-muted text-muted-foreground"}`}>{tag.label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 px-4 py-3 border-t border-border/30 flex justify-between items-center">
          <p className="text-xs font-mono text-muted-foreground">{records.length} record{records.length !== 1 ? "s" : ""}</p>
          <button onClick={onClose} className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Age group calculation ─────────────────────────────────────────────────────
const AGE_GROUPS = [
  { label: "Under 18", min: 0, max: 17 },
  { label: "18–24", min: 18, max: 24 },
  { label: "25–34", min: 25, max: 34 },
  { label: "35–44", min: 35, max: 44 },
  { label: "45–54", min: 45, max: 54 },
  { label: "55+", min: 55, max: 999 },
];

function getAgeGroup(dob) {
  if (!dob) return "Unknown";
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  if (isNaN(age) || age < 0) return "Unknown";
  const group = AGE_GROUPS.find(g => age >= g.min && age <= g.max);
  return group ? group.label : "Unknown";
}

const GENDER_GROUPS = ["Male", "Female", "Non-binary / Other", "Prefer not to say", "Unknown"];
const GENDER_COLORS = {
  "Male":               "bg-blue-500",
  "Female":             "bg-pink-500",
  "Non-binary / Other": "bg-purple-500",
  "Prefer not to say":  "bg-yellow-500",
  "Unknown":            "bg-muted-foreground",
};
const AGE_COLORS = [
  "bg-primary", "bg-accent", "bg-purple-500",
  "bg-cyan-500", "bg-yellow-500", "bg-green-500", "bg-muted-foreground"
];

/**
 * Props:
 *   tickets      — all tickets for the filtered scope (active + scanned counts)
 *   ticketTypes  — all TicketType records for the organizer's events
 *   tables       — all Table records
 *   tableReservations — TableReservation records
 *   events       — filtered events
 *   orders       — completed orders
 *   users        — User records (for age/gender demographics; optional)
 *   filterEventId — "all" or specific event id
 */
export default function EventAnalyticsPanel({
  tickets = [],
  ticketTypes = [],
  tables = [],
  tableReservations = [],
  events = [],
  orders = [],
  users = [],
  filterEventId = "all",
}) {
  const [drilldown, setDrilldown] = useState(null); // { title, records }
  // ── Filter to scope ────────────────────────────────────────────────────────
  const scopeTickets = useMemo(() =>
    filterEventId === "all" ? tickets : tickets.filter(t => t.event_id === filterEventId),
    [tickets, filterEventId]
  );
  const scopeOrders = useMemo(() =>
    filterEventId === "all" ? orders : orders.filter(o => o.event_id === filterEventId),
    [orders, filterEventId]
  );
  const scopeTicketTypes = useMemo(() =>
    filterEventId === "all" ? ticketTypes : ticketTypes.filter(tt => tt.event_id === filterEventId),
    [ticketTypes, filterEventId]
  );
  const scopeTables = useMemo(() =>
    filterEventId === "all" ? tables : tables.filter(t => t.event_id === filterEventId),
    [tables, filterEventId]
  );
  const scopeReservations = useMemo(() =>
    filterEventId === "all" ? tableReservations : tableReservations.filter(r => r.event_id === filterEventId),
    [tableReservations, filterEventId]
  );

  // ── Ticket type breakdown ──────────────────────────────────────────────────
  const ticketTypeRows = useMemo(() => {
    return scopeTicketTypes.map(tt => {
      const sold = scopeTickets.filter(t => t.ticket_type_id === tt.id && ["active", "scanned"].includes(t.status));
      const checkedIn = sold.filter(t => t.status === "scanned").length;
      const refunded = scopeTickets.filter(t => t.ticket_type_id === tt.id && ["refunded", "cancelled"].includes(t.status)).length;
      const soldCount = sold.length;
      const remaining = Math.max((tt.quantity_total || 0) - soldCount, 0);
      const revenue = soldCount * (tt.price || 0);
      // Discount from orders
      const orderDiscount = scopeOrders
        .filter(o => (o.items || []).some(i => i.ticket_type_id === tt.id))
        .reduce((s, o) => s + (o.discount_amount || 0), 0);
      return {
        id: tt.id,
        name: tt.name,
        tier: tt.tier,
        price: tt.price || 0,
        total: tt.quantity_total || 0,
        sold: soldCount,
        remaining,
        checkedIn,
        notCheckedIn: soldCount - checkedIn,
        refunded,
        revenue,
        discount: orderDiscount,
        netRevenue: revenue - orderDiscount,
      };
    }).filter(r => r.total > 0 || r.sold > 0);
  }, [scopeTicketTypes, scopeTickets, scopeOrders]);

  // ── Table breakdown ────────────────────────────────────────────────────────
  const tableRows = useMemo(() => {
    return scopeTables.map(tbl => {
      const reservations = scopeReservations.filter(r => r.table_id === tbl.id);
      const sold = reservations.filter(r => ["confirmed", "reserved", "checked_in"].includes(r.status)).length;
      const checkedIn = reservations.filter(r => r.status === "checked_in").length;
      const remaining = Math.max((tbl.quantity || 1) - sold, 0);
      const revenue = sold * (tbl.price || 0);
      return {
        id: tbl.id,
        name: tbl.name,
        price: tbl.price || 0,
        capacity: tbl.capacity || 0,
        total: tbl.quantity || 1,
        sold,
        remaining,
        checkedIn,
        notCheckedIn: sold - checkedIn,
        totalSeats: sold * (tbl.capacity || 0),
        revenue,
      };
    });
  }, [scopeTables, scopeReservations]);

  // ── Combined summary ───────────────────────────────────────────────────────
  // Use scopeTickets directly for checked-in counts to avoid missing tickets with no ticket_type_id match
  const totalTicketsSold  = scopeTickets.filter(t => ["active", "scanned"].includes(t.status)).length;
  const totalTablesSold   = tableRows.reduce((s, r) => s + r.sold, 0);
  const totalSeatsSold    = tableRows.reduce((s, r) => s + r.totalSeats, 0);
  const totalRevenue      = ticketTypeRows.reduce((s, r) => s + r.revenue, 0) + tableRows.reduce((s, r) => s + r.revenue, 0);
  const totalCheckedIn    = scopeTickets.filter(t => t.status === "scanned").length;
  const totalNotCheckedIn = scopeTickets.filter(t => t.status === "active").length;
  const totalRefunded     = scopeTickets.filter(t => ["refunded", "cancelled"].includes(t.status)).length;

  // ── Demographics: build email lookup from tickets ──────────────────────────
  const buyerEmails = useMemo(() => [...new Set(scopeTickets.map(t => t.owner_email).filter(Boolean))], [scopeTickets]);
  const userMap = useMemo(() => {
    const m = {};
    users.forEach(u => { if (u.email) m[u.email] = u; });
    return m;
  }, [users]);

  // ── Age groups ────────────────────────────────────────────────────────────
  const ageCounts = useMemo(() => {
    const counts = {};
    [...AGE_GROUPS.map(g => g.label), "Unknown"].forEach(l => { counts[l] = 0; });
    buyerEmails.forEach(email => {
      const u = userMap[email];
      const grp = getAgeGroup(u?.date_of_birth || u?.dob);
      counts[grp] = (counts[grp] || 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count }));
  }, [buyerEmails, userMap]);
  const totalAge = ageCounts.reduce((s, r) => s + r.count, 0) || 1;

  // ── Gender groups ─────────────────────────────────────────────────────────
  const genderCounts = useMemo(() => {
    const counts = {};
    GENDER_GROUPS.forEach(g => { counts[g] = 0; });
    buyerEmails.forEach(email => {
      const u = userMap[email];
      const rawGender = u?.gender || "";
      let grp = "Unknown";
      if (/^m(ale)?$/i.test(rawGender)) grp = "Male";
      else if (/^f(emale)?$/i.test(rawGender)) grp = "Female";
      else if (/non.?binary|other/i.test(rawGender)) grp = "Non-binary / Other";
      else if (/prefer|not say/i.test(rawGender)) grp = "Prefer not to say";
      else if (rawGender) grp = "Unknown";
      counts[grp] = (counts[grp] || 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count }));
  }, [buyerEmails, userMap]);
  const totalGender = genderCounts.reduce((s, r) => s + r.count, 0) || 1;

  // ── Location breakdown (keep existing) ────────────────────────────────────
  const locationMap = useMemo(() => {
    const m = {};
    scopeTickets.forEach(t => {
      const city = (userMap[t.owner_email]?.city) || t.owner_city;
      if (city) { const k = normalizeCity(city); m[k] = (m[k] || 0) + 1; }
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, count]) => ({ label, count }));
  }, [scopeTickets, userMap]);

  const fmt = (n) => n.toLocaleString();
  const fmtMoney = (n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-8">

      {/* ── Combined Summary Cards ──────────────────────────────────────────── */}
      <div>
        <h3 className="font-display font-bold text-sm px-3 py-1.5 bg-primary/10 text-primary rounded-md inline-block mb-4">
          Combined Sales Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatBox label="Tickets Sold" value={fmt(totalTicketsSold)} icon={Ticket} color="text-primary" bg="bg-primary/10"
            onClick={() => setDrilldown({ title: "Tickets Sold", records: scopeTickets.filter(t => ["active","scanned"].includes(t.status)).map(t => ({
              id: t.id,
              primaryLabel: t.attendee_name || t.owner_email || "—",
              secondaryLabel: t.attendee_email || t.owner_email,
              badge: t.status === "scanned" ? "Checked In" : "Active",
              badgeClass: t.status === "scanned" ? "bg-green-400/15 text-green-400" : "bg-primary/15 text-primary",
              tags: [
                t.ticket_type_name && { label: t.ticket_type_name, class: "bg-muted text-muted-foreground" },
                t.event_id && { label: `Event: ${events.find(e=>e.id===t.event_id)?.title || t.event_id?.slice(-6)}`, class: "bg-secondary text-muted-foreground" },
                t.created_date && { label: getRelativeTime(t.created_date), class: "bg-muted text-muted-foreground" },
              ].filter(Boolean),
            }))
          })} />
          <StatBox label="Tables Sold" value={fmt(totalTablesSold)} icon={Table2} color="text-accent" bg="bg-accent/10"
            onClick={() => setDrilldown({ title: "Tables Sold", records: scopeReservations.filter(r => ["confirmed","reserved","checked_in"].includes(r.status)).map(r => ({
              id: r.id,
              primaryLabel: r.customer_name || r.guest_name || "—",
              secondaryLabel: r.customer_email || r.guest_email,
              badge: r.status,
              badgeClass: r.status === "checked_in" ? "bg-green-400/15 text-green-400" : "bg-accent/15 text-accent",
              tags: [
                r.table_name && { label: r.table_name, class: "bg-muted text-muted-foreground" },
                r.num_guests && { label: `${r.num_guests} guests`, class: "bg-muted text-muted-foreground" },
                { label: fmtMoney(r.total_amount || r.amount || 0), class: "bg-green-400/10 text-green-400" },
                r.created_date && { label: getRelativeTime(r.created_date), class: "bg-muted text-muted-foreground" },
              ].filter(Boolean),
            }))
          })} />
          <StatBox label="Seats Sold" value={fmt(totalSeatsSold)} icon={Users} color="text-purple-400" bg="bg-purple-400/10"
            onClick={() => setDrilldown({ title: "Seats (Table Reservations)", records: scopeReservations.filter(r => ["confirmed","reserved","checked_in"].includes(r.status)).map(r => ({
              id: r.id,
              primaryLabel: r.customer_name || r.guest_name || "—",
              secondaryLabel: r.customer_email || r.guest_email,
              badge: `${r.num_guests || "?"} seats`,
              badgeClass: "bg-purple-400/15 text-purple-400",
              tags: [
                r.table_name && { label: r.table_name, class: "bg-muted text-muted-foreground" },
                { label: r.status, class: "bg-muted text-muted-foreground" },
              ].filter(Boolean),
            }))
          })} />
          <StatBox label="Total Revenue" value={fmtMoney(totalRevenue)} icon={DollarSign} color="text-green-400" bg="bg-green-400/10"
            onClick={() => setDrilldown({ title: "Revenue Breakdown", records: [
              ...scopeOrders.map(o => ({
                id: o.id,
                primaryLabel: o.customer_name || o.customer_email || "—",
                secondaryLabel: `Order #${o.order_number || o.id?.slice(-8)}`,
                badge: fmtMoney(o.total || 0),
                badgeClass: "bg-green-400/15 text-green-400",
                tags: [
                  o.event_title && { label: o.event_title, class: "bg-muted text-muted-foreground" },
                  { label: "ticket sale", class: "bg-primary/10 text-primary" },
                  o.created_date && { label: getRelativeTime(o.created_date), class: "bg-muted text-muted-foreground" },
                ].filter(Boolean),
              })),
              ...scopeReservations.filter(r => ["confirmed","reserved","checked_in"].includes(r.status)).map(r => ({
                id: r.id + "_tbl",
                primaryLabel: r.customer_name || r.guest_name || "—",
                secondaryLabel: r.customer_email || r.guest_email,
                badge: fmtMoney(r.total_amount || r.amount || 0),
                badgeClass: "bg-green-400/15 text-green-400",
                tags: [
                  r.table_name && { label: r.table_name, class: "bg-muted text-muted-foreground" },
                  { label: "table sale", class: "bg-accent/10 text-accent" },
                ].filter(Boolean),
              })),
            ]
          })} />
          <StatBox label="Checked In" value={fmt(totalCheckedIn)} icon={CheckCircle2} color="text-green-400" bg="bg-green-400/10"
            onClick={() => setDrilldown({ title: "Checked In Attendees", records: scopeTickets.filter(t => t.status === "scanned").map(t => ({
              id: t.id,
              primaryLabel: t.attendee_name || t.owner_email || "—",
              secondaryLabel: t.attendee_email || t.owner_email,
              badge: "Checked In",
              badgeClass: "bg-green-400/15 text-green-400",
              tags: [
                t.ticket_type_name && { label: t.ticket_type_name, class: "bg-muted text-muted-foreground" },
                t.created_date && { label: getRelativeTime(t.created_date), class: "bg-muted text-muted-foreground" },
              ].filter(Boolean),
            }))
          })} />
          <StatBox label="Not Checked In" value={fmt(totalNotCheckedIn)} icon={ScanLine} color="text-yellow-400" bg="bg-yellow-400/10"
            onClick={() => setDrilldown({ title: "Not Yet Checked In", records: scopeTickets.filter(t => t.status === "active").map(t => ({
              id: t.id,
              primaryLabel: t.attendee_name || t.owner_email || "—",
              secondaryLabel: t.attendee_email || t.owner_email,
              badge: "Pending",
              badgeClass: "bg-yellow-400/15 text-yellow-400",
              tags: [
                t.ticket_type_name && { label: t.ticket_type_name, class: "bg-muted text-muted-foreground" },
                t.created_date && { label: getRelativeTime(t.created_date), class: "bg-muted text-muted-foreground" },
              ].filter(Boolean),
            }))
          })} />
          <StatBox label="Refunded" value={fmt(totalRefunded)} icon={XCircle} color="text-destructive" bg="bg-destructive/10"
            onClick={() => setDrilldown({ title: "Refunded Tickets", records: scopeTickets.filter(t => ["refunded","cancelled"].includes(t.status)).map(t => ({
              id: t.id,
              primaryLabel: t.attendee_name || t.owner_email || "—",
              secondaryLabel: t.attendee_email || t.owner_email,
              badge: t.status,
              badgeClass: "bg-destructive/15 text-destructive",
              tags: [
                t.ticket_type_name && { label: t.ticket_type_name, class: "bg-muted text-muted-foreground" },
                t.created_date && { label: getRelativeTime(t.created_date), class: "bg-muted text-muted-foreground" },
              ].filter(Boolean),
            }))
          })} />
          <StatBox label="Unique Buyers" value={fmt(buyerEmails.length)} icon={Users} color="text-cyan-400" bg="bg-cyan-400/10"
            onClick={() => {
              const records = buyerEmails.map(email => {
                const u = userMap[email];
                return {
                  id: email,
                  primaryLabel: u?.full_name || email,
                  secondaryLabel: email,
                  tags: [
                    u?.city ? { label: u.city, class: "bg-muted text-muted-foreground" } : null,
                    { label: `${scopeTickets.filter(t => t.owner_email === email).length} ticket(s)`, class: "bg-cyan-400/10 text-cyan-400" },
                  ].filter(Boolean),
                };
              });
              setDrilldown({ title: "Unique Ticket Buyers", records });
            }} />
        </div>
      </div>

      {/* Drill-down modal */}
      {drilldown && (
        <DrilldownModal
          title={drilldown.title}
          records={drilldown.records}
          onClose={() => setDrilldown(null)}
        />
      )}

      {/* ── Ticket Type Breakdown ───────────────────────────────────────────── */}
      <div>
        <h3 className="font-display font-bold text-sm px-3 py-1.5 bg-primary/10 text-primary rounded-md inline-block mb-4">
          Ticket Type Breakdown
        </h3>
        {ticketTypeRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center bg-card rounded-xl border border-border/50">
            No ticket types found for this selection.
          </p>
        ) : (
          <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
            <p className="text-[10px] font-mono text-muted-foreground px-4 pt-3 flex items-center gap-1">← Swipe or scroll horizontally to view all columns →</p>
            <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(330,100%,55%) hsl(228,35%,16%)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/40">
                    {["Ticket Type", "Tier", "Price", "Total", "Sold", "Remaining", "Checked In", "Not In", "Refunded", "Revenue"].map(h => (
                      <th key={h} className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ticketTypeRows.map(row => (
                    <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-medium whitespace-nowrap">{row.name}</td>
                      <td className="p-3">
                        <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{row.tier || "—"}</span>
                      </td>
                      <td className="p-3 font-mono text-xs">{fmtMoney(row.price)}</td>
                      <td className="p-3 font-mono text-xs">{fmt(row.total)}</td>
                      <td className="p-3 font-mono text-xs font-bold text-primary">{fmt(row.sold)}</td>
                      <td className="p-3 font-mono text-xs">{fmt(row.remaining)}</td>
                      <td className="p-3 font-mono text-xs text-green-400">{fmt(row.checkedIn)}</td>
                      <td className="p-3 font-mono text-xs text-yellow-400">{fmt(row.notCheckedIn)}</td>
                      <td className="p-3 font-mono text-xs text-destructive">{fmt(row.refunded)}</td>
                      <td className="p-3 font-mono text-xs font-bold text-green-400">{fmtMoney(row.revenue)}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="border-t border-border/50 bg-secondary/30 font-bold">
                    <td className="p-3 font-display font-bold text-xs" colSpan={4}>Totals</td>
                    <td className="p-3 font-mono text-xs text-primary">{fmt(totalTicketsSold)}</td>
                    <td className="p-3 font-mono text-xs">{fmt(ticketTypeRows.reduce((s, r) => s + r.remaining, 0))}</td>
                    <td className="p-3 font-mono text-xs text-green-400">{fmt(totalCheckedIn)}</td>
                    <td className="p-3 font-mono text-xs text-yellow-400">{fmt(totalNotCheckedIn)}</td>
                    <td className="p-3 font-mono text-xs text-destructive">{fmt(totalRefunded)}</td>
                    <td className="p-3 font-mono text-xs text-green-400">{fmtMoney(ticketTypeRows.reduce((s, r) => s + r.revenue, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Visual bars */}
            <div className="p-4 border-t border-border/30 space-y-2">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Sold vs Available</p>
              {ticketTypeRows.map(row => (
                <BarRow
                  key={row.id}
                  label={row.name}
                  count={row.sold}
                  total={row.total || row.sold}
                  color="bg-primary"
                  extra={`of ${fmt(row.total)}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Table Breakdown ─────────────────────────────────────────────────── */}
      {(scopeTables.length > 0 || tableRows.length > 0) && (
        <div>
          <h3 className="font-display font-bold text-sm px-3 py-1.5 bg-accent/10 text-accent rounded-md inline-block mb-4">
            Table / VIP Package Breakdown
          </h3>
          {tableRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center bg-card rounded-xl border border-border/50">
              No table data for this selection.
            </p>
          ) : (
            <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
              <p className="text-[10px] font-mono text-muted-foreground px-4 pt-3 flex items-center gap-1">← Swipe or scroll horizontally to view all columns →</p>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(220,100%,55%) hsl(228,35%,16%)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/40">
                      {["Table Type", "Price", "Seats/Table", "Total", "Sold", "Remaining", "Checked In", "Total Seats", "Revenue"].map(h => (
                        <th key={h} className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(row => (
                      <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium whitespace-nowrap">{row.name}</td>
                        <td className="p-3 font-mono text-xs">{fmtMoney(row.price)}</td>
                        <td className="p-3 font-mono text-xs">{row.capacity || "—"}</td>
                        <td className="p-3 font-mono text-xs">{fmt(row.total)}</td>
                        <td className="p-3 font-mono text-xs font-bold text-accent">{fmt(row.sold)}</td>
                        <td className="p-3 font-mono text-xs">{fmt(row.remaining)}</td>
                        <td className="p-3 font-mono text-xs text-green-400">{fmt(row.checkedIn)}</td>
                        <td className="p-3 font-mono text-xs text-purple-400">{fmt(row.totalSeats)}</td>
                        <td className="p-3 font-mono text-xs font-bold text-green-400">{fmtMoney(row.revenue)}</td>
                      </tr>
                    ))}
                    {/* Totals */}
                    <tr className="border-t border-border/50 bg-secondary/30 font-bold">
                      <td className="p-3 font-display font-bold text-xs" colSpan={4}>Totals</td>
                      <td className="p-3 font-mono text-xs text-accent">{fmt(totalTablesSold)}</td>
                      <td className="p-3 font-mono text-xs">{fmt(tableRows.reduce((s, r) => s + r.remaining, 0))}</td>
                      <td className="p-3 font-mono text-xs text-green-400">{fmt(tableRows.reduce((s, r) => s + r.checkedIn, 0))}</td>
                      <td className="p-3 font-mono text-xs text-purple-400">{fmt(totalSeatsSold)}</td>
                      <td className="p-3 font-mono text-xs text-green-400">{fmtMoney(tableRows.reduce((s, r) => s + r.revenue, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Age Demographics ────────────────────────────────────────────────── */}
      <div>
        <h3 className="font-display font-bold text-sm px-3 py-1.5 bg-purple-400/10 text-purple-400 rounded-md inline-block mb-4">
          Age Demographics
        </h3>
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
          {buyerEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No buyer data for this selection.</p>
          ) : (
            ageCounts.map((row, i) => (
              row.count > 0 && (
                <BarRow
                  key={row.label}
                  label={row.label}
                  count={row.count}
                  total={totalAge}
                  color={AGE_COLORS[i % AGE_COLORS.length]}
                />
              )
            ))
          )}
          {buyerEmails.length > 0 && ageCounts.every(r => r.label === "Unknown" ? true : r.count === 0) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <HelpCircle className="w-4 h-4 shrink-0" />
              Age profile data is not available. Users can add their date of birth in their profile to populate this chart.
            </div>
          )}
          {/* Table view */}
          {buyerEmails.length > 0 && (
            <div className="pt-3 border-t border-border/30">
              <div className="grid grid-cols-3 gap-2">
                {ageCounts.filter(r => r.count > 0).map(row => (
                  <div key={row.label} className="text-center p-2 rounded-lg bg-secondary/50">
                    <p className="font-mono font-bold text-sm">{row.count}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{row.label}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{Math.round((row.count / totalAge) * 100)}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Gender Demographics ─────────────────────────────────────────────── */}
      <div>
        <h3 className="font-display font-bold text-sm px-3 py-1.5 bg-cyan-400/10 text-cyan-400 rounded-md inline-block mb-4">
          Gender Demographics
        </h3>
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
          {buyerEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No buyer data for this selection.</p>
          ) : (
            genderCounts.map(row => (
              row.count > 0 && (
                <BarRow
                  key={row.label}
                  label={row.label}
                  count={row.count}
                  total={totalGender}
                  color={GENDER_COLORS[row.label] || "bg-muted-foreground"}
                />
              )
            ))
          )}
          {buyerEmails.length > 0 && (
            <div className="pt-3 border-t border-border/30">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {genderCounts.filter(r => r.count > 0).map(row => (
                  <div key={row.label} className="text-center p-2 rounded-lg bg-secondary/50">
                    <p className="font-mono font-bold text-sm">{row.count}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{row.label}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{Math.round((row.count / totalGender) * 100)}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {buyerEmails.length > 0 && genderCounts.every(r => r.label === "Unknown" ? true : r.count === 0) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <HelpCircle className="w-4 h-4 shrink-0" />
              Gender profile data is not available. Users can add their gender in their profile to populate this chart.
            </div>
          )}
        </div>
      </div>

      {/* ── Location (kept from existing) ──────────────────────────────────── */}
      {locationMap.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-sm px-3 py-1.5 bg-yellow-400/10 text-yellow-400 rounded-md inline-block mb-4">
            Attendees by City
          </h3>
          <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
            {locationMap.map((row, i) => (
              <BarRow key={row.label} label={row.label} count={row.count} total={locationMap[0].count} color="bg-yellow-500" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}