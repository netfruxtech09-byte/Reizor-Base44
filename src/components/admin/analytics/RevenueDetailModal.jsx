import { useState, useEffect, useMemo } from "react";
import { X, DollarSign, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

const RANGES = [
  { key: "1d", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "all", label: "All Time" },
];

function getStart(key) {
  const now = new Date();
  if (key === "1d") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === "7d") return new Date(now - 7 * 86400000);
  if (key === "30d") return new Date(now - 30 * 86400000);
  if (key === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (key === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function fmt(v) {
  return `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeDate(d) {
  try { return format(new Date(d), "MMM d, yy"); } catch { return "—"; }
}

// ── Drill-down detail panel (table) ─────────────────────────────────────────
function DetailPanel({ title, records, columns, onBack }) {
  return (
    <>
      <div className="flex items-center gap-3 p-4 border-b border-border/50 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h3 className="font-display font-bold text-sm">{title}</h3>
          <p className="text-[10px] font-mono text-muted-foreground">{records.length} records</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {records.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-12">No records in this period</p>
        ) : (
          <>
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[400px]">
                  <thead>
                    <tr className="bg-background/60 border-b border-border/40">
                      {columns.map(c => (
                        <th key={c.key} className={`font-mono text-muted-foreground px-3 py-2 ${c.right ? "text-right" : "text-left"}`}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-muted/10">
                        {columns.map(c => (
                          <td key={c.key} className={`px-3 py-2 ${c.right ? "text-right font-mono" : ""} ${c.className || ""}`}>
                            {c.render ? c.render(r) : (r[c.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {records.length > 100 && (
              <p className="text-xs text-muted-foreground font-mono text-center mt-3">Showing 100 of {records.length}</p>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── Payout drill-down — card-based for full context ──────────────────────────
function PayoutDetailPanel({ title, records, total, payoutKind, onBack }) {
  const [expanded, setExpanded] = useState(null);

  const typeLabel = {
    organizer_event: "Organizer Event Payout",
    organizer_referral: "Organizer Referral Payout",
    artist: "Artist Payout",
    refund: "Order Refund",
  };

  const statusColor = (s) => {
    if (!s) return "text-muted-foreground";
    if (["completed", "approved"].includes(s)) return "text-green-400";
    if (s === "pending_review") return "text-yellow-400";
    if (s === "rejected") return "text-destructive";
    return "text-muted-foreground";
  };

  const getProcessedDate = (r) => r.completed_date || r.approved_date || r.reviewed_date || null;

  return (
    <>
      <div className="flex items-center gap-3 p-4 border-b border-border/50 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-sm truncate">{title}</h3>
          <p className="text-[10px] font-mono text-muted-foreground">{records.length} records · Total: <span className="text-destructive font-bold">{fmt(total)}</span></p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {records.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-center">
            <p className="text-muted-foreground text-sm">No payout records in this period.</p>
          </div>
        ) : (
          records.map((r, i) => {
            const isExpanded = expanded === i;
            const processedDate = getProcessedDate(r);
            const eventName = r.event_title || r.event_name || null;
            const hasNotes = r.admin_notes || r.rejected_reason;

            return (
              <div
                key={i}
                className="rounded-xl border border-border/40 bg-card/60 overflow-hidden cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : i)}
              >
                {/* Summary row */}
                <div className="p-3 space-y-2">
                  {/* Organizer/Artist name - prominent */}
                  <div>
                    <p className="font-display font-bold text-base">
                      {r.organizer_name || r.artist_name || "Unknown"}
                    </p>
                  </div>
                  
                  {/* Event info */}
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {eventName
                        ? `Event: ${eventName}`
                        : payoutKind === "refund" ? "Type: Order Refund"
                        : "Platform-level deduction"}
                    </p>
                  </div>
                  
                  {/* Type and Amount row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-muted/40 px-1.5 py-0.5 rounded">
                        {typeLabel[payoutKind] || payoutKind}
                      </span>
                      {r.status && (
                        <span className={`text-[10px] font-mono font-bold uppercase ${statusColor(r.status)}`}>
                          {r.status.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <p className="font-mono font-black text-destructive text-base">−{fmt(r.amount || r.total)}</p>
                  </div>
                  
                  {/* Email as secondary info */}
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {r.organizer_email || r.artist_email || "—"}
                  </p>
                  
                  {/* Date */}
                  <p className="text-[10px] text-muted-foreground">
                    {r.request_date || r.created_date ? `Created: ${safeDate(r.request_date || r.created_date)}` : "—"}
                  </p>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-border/30 bg-background/40 p-3 space-y-2 text-xs">
                    {eventName && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Event</span>
                        <span className="font-medium text-right max-w-[60%] break-words">{eventName}</span>
                      </div>
                    )}
                    {!eventName && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Context</span>
                        <span className="font-medium italic text-muted-foreground/70">No event — platform-level deduction</span>
                      </div>
                    )}
                    {(r.organizer_name || r.artist_name) && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{r.organizer_name ? "Organizer" : "Artist"}</span>
                        <span className="font-medium">{r.organizer_name || r.artist_name}</span>
                      </div>
                    )}
                    {(r.organizer_email || r.artist_email) && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-mono text-muted-foreground/80 text-right break-all">{r.organizer_email || r.artist_email}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{typeLabel[payoutKind] || payoutKind}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-mono font-bold text-destructive">{fmt(r.amount || r.total)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Status</span>
                      <span className={`font-mono font-bold uppercase ${statusColor(r.status)}`}>{r.status?.replace(/_/g, " ") || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Requested</span>
                      <span className="font-mono">{safeDate(r.request_date || r.created_date)}</span>
                    </div>
                    {processedDate && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Processed</span>
                        <span className="font-mono">{safeDate(processedDate)}</span>
                      </div>
                    )}
                    {r.reviewed_by && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Reviewed by</span>
                        <span className="font-mono text-muted-foreground/80 text-right break-all">{r.reviewed_by}</span>
                      </div>
                    )}
                    {r.id && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Reference</span>
                        <span className="font-mono text-muted-foreground/70 text-xs">{r.id.slice(-12)}</span>
                      </div>
                    )}
                    {hasNotes && (
                      <div className="pt-1 border-t border-border/30">
                        <p className="text-muted-foreground mb-0.5">Notes / Reason</p>
                        <p className="text-foreground/80 italic">{r.admin_notes || r.rejected_reason}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Total footer */}
        {records.length > 0 && (
          <div className="sticky bottom-0 bg-card border-t border-border/50 rounded-b-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Total ({records.length} records)</span>
            <span className="font-mono font-black text-destructive">−{fmt(total)}</span>
          </div>
        )}
      </div>
    </>
  );
}

// ── P&L Line Item ────────────────────────────────────────────────────────────
function PLRow({ label, value, count, color = "text-foreground", indent = false, onClick, sub }) {
  if (value === 0 && !sub) return null;
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between py-2 px-3 rounded-lg ${onClick ? "cursor-pointer hover:bg-muted/20 active:bg-muted/30 transition-colors" : ""} ${indent ? "ml-3 border-l border-border/30" : ""}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-sm truncate ${indent ? "text-muted-foreground pl-2" : "font-medium"}`}>{label}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full shrink-0">{count}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <span className={`font-mono text-sm font-bold ${color}`}>{fmt(value)}</span>
        {onClick && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
      </div>
    </div>
  );
}

// ── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, total, color, prefix = "" }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 bg-muted/20 rounded-lg border border-border/30 mt-1">
      <span className="font-display font-bold text-xs uppercase tracking-widest text-muted-foreground">{title}</span>
      <span className={`font-mono font-black text-base ${color}`}>{prefix}{fmt(total)}</span>
    </div>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────
export default function RevenueDetailModal({ onClose, orders, tableReservations, fanSubscriptions, affiliateEarnings, donations }) {
  const [range, setRange] = useState("all");
  const [extraData, setExtraData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drilldown, setDrilldown] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [payouts, artistPayouts, expenses, aiFlyerSessions, videoBudgets] = await Promise.all([
        base44.entities.OrganizerPayoutRequest.list("-created_date", 1000).catch(() => []),
        base44.entities.ArtistPayout.list("-created_date", 500).catch(() => []),
        base44.entities.AdminExpense.list("-created_date", 500).catch(() => []),
        base44.entities.AIFlyerSession.list("-created_date", 500).catch(() => []),
        base44.entities.VideoBudget.list("-created_date", 500).catch(() => []),
      ]);
      setExtraData({ payouts, artistPayouts, expenses, aiFlyerSessions, videoBudgets });
      setLoading(false);
    };
    load();
  }, []);

  const pl = useMemo(() => {
    if (!extraData) return null;
    const startDate = getStart(range);
    const inRange = (d) => !d || !startDate || new Date(d) >= startDate;

    // ── Gross Income ──────────────────────────────────────────────────────
    const ticketOrders = (orders || []).filter(o => o.status === "completed" && inRange(o.created_date));
    const ticketGross = ticketOrders.reduce((s, o) => s + (o.subtotal || o.total || 0), 0); // subtotal excludes cc_fee
    const ticketCCFees = ticketOrders.reduce((s, o) => s + (o.cc_fee_on_buyer ? (o.cc_fee_customer_paid || 0) : 0), 0);
    const ticketPlatFees = ticketOrders.reduce((s, o) => s + (o.service_fee || o.platform_fee || 0), 0);

    const tableRows = (tableReservations || []).filter(t =>
      ["confirmed", "completed", "paid"].includes(t.status) && inRange(t.created_date)
    );
    const tableGross = tableRows.reduce((s, t) => s + (t.subtotal || t.total_price || 0), 0); // subtotal excludes cc_fee
    const tableCCFees = tableRows.reduce((s, t) => s + (t.cc_fee_on_buyer ? (t.cc_fee_customer_paid || 0) : 0), 0);
    const tablePlatFees = tableRows.reduce((s, t) => s + (t.platform_fee || 0), 0);

    const subRows = (fanSubscriptions || []).filter(s => s.status === "active" && inRange(s.created_date));
    const subGross = subRows.reduce((s, f) => s + (f.amount || 0), 0);

    const donationRows = (donations || []).filter(d => d.status === "completed" && inRange(d.created_date));
    const donationGross = donationRows.reduce((s, d) => s + (d.amount || 0), 0);
    const donationPlatFees = donationRows.reduce((s, d) => s + (d.platform_fee || 0), 0);

    const affiliateRows = (affiliateEarnings || []).filter(a =>
      ["confirmed", "paid"].includes(a.status) && inRange(a.created_date)
    );
    const affiliateGross = affiliateRows.reduce((s, a) => s + (a.amount || 0), 0);

    const flyerPaidSessions = (extraData.aiFlyerSessions || []).filter(s => s.status === "paid" && inRange(s.created_date));
    const flyerIncome = flyerPaidSessions.reduce((s, x) => s + (x.paid_amount || 0), 0);

    const videoBudgetRows = (extraData.videoBudgets || []).filter(v => v.budget_amount > 0 && inRange(v.last_funded_at || v.created_date));
    const videoIncome = videoBudgetRows.reduce((s, v) => s + (v.budget_amount || 0), 0);

    const grossIncome = ticketGross + tableGross + ticketCCFees + tableCCFees + subGross + donationGross + affiliateGross + flyerIncome + videoIncome;

    // ── Payouts / Deductions ──────────────────────────────────────────────
    const allOrgPayouts = (extraData.payouts || []).filter(p =>
      ["approved", "completed"].includes(p.status) && inRange(p.request_date || p.created_date)
    );
    const orgPayoutsEvent = allOrgPayouts.filter(p => p.payout_type !== "referral");
    const orgPayoutsReferral = allOrgPayouts.filter(p => p.payout_type === "referral");
    const orgPayoutEventTotal = orgPayoutsEvent.reduce((s, p) => s + (p.amount || 0), 0);
    const orgPayoutReferralTotal = orgPayoutsReferral.reduce((s, p) => s + (p.amount || 0), 0);

    const artistPayoutRows = (extraData.artistPayouts || []).filter(p => p.status === "completed" && inRange(p.created_date));
    const artistPayoutTotal = artistPayoutRows.reduce((s, p) => s + (p.amount || 0), 0);

    const refundedOrders = (orders || []).filter(o => o.status === "refunded" && inRange(o.created_date));
    const refundsTotal = refundedOrders.reduce((s, o) => s + (o.subtotal || o.total || 0), 0);

    const totalPayouts = orgPayoutEventTotal + orgPayoutReferralTotal + artistPayoutTotal + refundsTotal;

    // ── Operating Expenses ────────────────────────────────────────────────
    const stripeableItems = [...ticketOrders, ...tableRows];
    const stripeFees = stripeableItems.reduce((s, r) => s + (((r.subtotal || r.total_price || r.total || 0) * 0.029 + 0.30)), 0);

    const flyerGenCount = flyerPaidSessions.reduce((s, x) => s + (x.paid_count || 0), 0);
    const flyerCost = flyerGenCount * 0.40;

    const allExpenses = (extraData.expenses || []).filter(e => inRange(e.created_date));
    const customExpenses = allExpenses.reduce((s, e) => s + (e.amount || 0), 0);

    const totalExpenses = stripeFees + flyerCost + customExpenses;

    // ── Net Profit ────────────────────────────────────────────────────────
    // Platform keeps: platform fees + customer-paid CC fees + sub/membership + flyer income + video income + affiliate income
    const platformRetained = ticketPlatFees + tablePlatFees + donationPlatFees + ticketCCFees + tableCCFees + subGross + flyerIncome + videoIncome + affiliateGross;
    const netProfit = platformRetained - totalPayouts - totalExpenses;

    return {
      ticketGross, ticketOrders, ticketPlatFees, ticketCCFees,
      tableGross, tableRows, tablePlatFees, tableCCFees,
      subGross, subRows,
      donationGross, donationRows, donationPlatFees,
      affiliateGross, affiliateRows,
      flyerIncome, flyerPaidSessions,
      videoIncome, videoBudgetRows,
      grossIncome,
      orgPayoutsEvent, orgPayoutsReferral,
      orgPayoutEventTotal, orgPayoutReferralTotal,
      artistPayoutRows, artistPayoutTotal,
      refundedOrders, refundsTotal,
      totalPayouts,
      stripeFees, stripeableItems,
      flyerCost,
      allExpenses, customExpenses,
      totalExpenses,
      platformRetained, netProfit,
    };
  }, [range, orders, tableReservations, fanSubscriptions, affiliateEarnings, donations, extraData]);

  // Column definitions for drill-downs
  const orderCols = [
    { key: "event_title", label: "Event", className: "font-medium max-w-[130px] truncate" },
    { key: "customer_name", label: "Customer", className: "text-muted-foreground max-w-[100px] truncate" },
    { key: "total", label: "Total", right: true, render: r => <span className="text-primary font-bold">{fmt(r.total)}</span> },
    { key: "created_date", label: "Date", right: true, render: r => safeDate(r.created_date) },
  ];
  const tableCols = [
    { key: "event_title", label: "Event", className: "font-medium max-w-[130px] truncate" },
    { key: "customer_name", label: "Customer", className: "text-muted-foreground max-w-[100px] truncate" },
    { key: "total_price", label: "Total", right: true, render: r => <span className="text-primary font-bold">{fmt(r.total_price)}</span> },
    { key: "created_date", label: "Date", right: true, render: r => safeDate(r.created_date) },
  ];
  const payoutCols = [
    { key: "organizer_email", label: "Organizer", className: "font-mono text-xs max-w-[150px] truncate" },
    { key: "organizer_name", label: "Name", className: "text-muted-foreground max-w-[100px] truncate" },
    { key: "amount", label: "Amount", right: true, render: r => <span className="text-destructive font-bold">{fmt(r.amount)}</span> },
    { key: "status", label: "Status", right: true, render: r => <span className="text-xs text-muted-foreground">{r.status}</span> },
  ];
  const expenseCols = [
    { key: "expense_name", label: "Expense", className: "font-medium max-w-[150px] truncate" },
    { key: "holder_name", label: "Account", className: "text-muted-foreground text-xs max-w-[100px] truncate" },
    { key: "amount", label: "Amount", right: true, render: r => <span className="text-destructive font-bold">{fmt(r.amount)}</span> },
    { key: "created_date", label: "Date", right: true, render: r => safeDate(r.created_date) },
  ];
  const stripeCols = [
    { key: "event_title", label: "Event", className: "font-medium max-w-[130px] truncate" },
    { key: "total", label: "Sale", right: true, render: r => fmt(r.total) },
    { key: "_fee", label: "Est. Fee", right: true, render: r => <span className="text-orange-400 font-bold">{fmt((r.total || 0) * 0.029 + 0.30)}</span> },
    { key: "created_date", label: "Date", right: true, render: r => safeDate(r.created_date) },
  ];
  const donationCols = [
    { key: "artist_name", label: "Artist", className: "font-medium max-w-[130px] truncate" },
    { key: "donor_email", label: "Donor", className: "text-muted-foreground max-w-[110px] truncate" },
    { key: "amount", label: "Amount", right: true, render: r => <span className="text-primary font-bold">{fmt(r.amount)}</span> },
    { key: "created_date", label: "Date", right: true, render: r => safeDate(r.created_date) },
  ];
  const flyerCols = [
    { key: "organizer_email", label: "Organizer", className: "text-muted-foreground max-w-[150px] truncate" },
    { key: "paid_count", label: "Gens", right: true },
    { key: "paid_amount", label: "Charged", right: true, render: r => <span className="text-primary font-bold">{fmt(r.paid_amount)}</span> },
    { key: "paid_at", label: "Date", right: true, render: r => r.paid_at ? safeDate(r.paid_at) : "—" },
  ];

  const open = (title, records, cols) => setDrilldown({ title, records, cols });
  const openPayouts = (title, records, total, payoutKind) => setDrilldown({ title, records, total, payoutKind, isPayouts: true });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl bg-card border border-border/60 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ height: "92dvh", maxHeight: "92dvh" }}
        onClick={e => e.stopPropagation()}
      >
        {drilldown ? (
          <>
            {drilldown.isPayouts ? (
              <PayoutDetailPanel
                title={drilldown.title}
                records={drilldown.records}
                total={drilldown.total}
                payoutKind={drilldown.payoutKind}
                onBack={() => setDrilldown(null)}
              />
            ) : (
              <DetailPanel
                title={drilldown.title}
                records={drilldown.records}
                columns={drilldown.cols}
                onBack={() => setDrilldown(null)}
              />
            )}
            <div className="shrink-0 px-4 py-3 border-t border-border/30 flex justify-end">
              <button onClick={onClose} className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">Close</button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="font-display font-black text-base tracking-tight">PLATFORM P&L</h2>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Balance sheet · paid transactions only · tap row for details</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Range Selector */}
            <div className="flex gap-1.5 px-4 pt-3 pb-1 shrink-0 flex-wrap">
              {RANGES.map(r => (
                <button key={r.key} onClick={() => setRange(r.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                    range === r.key
                      ? "bg-primary text-white border-primary"
                      : "bg-background border-border/50 text-muted-foreground hover:border-primary/40"
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>

            {/* Body */}
            {loading || !pl ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 p-4 space-y-3">

                {/* ── NET PROFIT HERO ── */}
                <div className={`p-4 rounded-xl border-2 ${pl.netProfit >= 0 ? "border-green-400/50 bg-green-400/5" : "border-destructive/50 bg-destructive/5"}`}>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Net Platform Profit</p>
                  <p className={`font-display font-black text-3xl mt-1 ${pl.netProfit >= 0 ? "text-green-400" : "text-destructive"}`}>
                    {fmt(pl.netProfit)}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground/70 mt-1 leading-relaxed">
                    Retained {fmt(pl.platformRetained)} &nbsp;−&nbsp; Payouts {fmt(pl.totalPayouts)} &nbsp;−&nbsp; Expenses {fmt(pl.totalExpenses)}
                  </p>
                </div>

                {/* ── SECTION 1: GROSS INCOME ── */}
                <SectionHeader title="1 · Gross Income" total={pl.grossIncome} color="text-primary" />
                <div className="space-y-0.5">
                  <PLRow
                    label="Ticket Sales Gross"
                    value={pl.ticketGross}
                    count={pl.ticketOrders.length}
                    indent
                    onClick={() => open("Ticket Sales", [...pl.ticketOrders].sort((a,b)=>new Date(b.created_date)-new Date(a.created_date)), orderCols)}
                  />
                  <PLRow label="↳ Platform Fee from Tickets" value={pl.ticketPlatFees} color="text-primary" indent />
                  <PLRow label="↳ Customer-Paid CC Fees (Tickets)" value={pl.ticketCCFees} color="text-accent" indent />
                  <PLRow
                    label="Table / VIP Reservation Gross"
                    value={pl.tableGross}
                    count={pl.tableRows.length}
                    indent
                    onClick={() => open("Table / VIP Reservations", [...pl.tableRows].sort((a,b)=>new Date(b.created_date)-new Date(a.created_date)), tableCols)}
                  />
                  <PLRow label="↳ Platform Fee from Tables" value={pl.tablePlatFees} color="text-primary" indent />
                  <PLRow label="↳ Customer-Paid CC Fees (Tables)" value={pl.tableCCFees} color="text-accent" indent />
                  <PLRow
                    label="Artist Donations Gross"
                    value={pl.donationGross}
                    count={pl.donationRows.length}
                    indent
                    onClick={() => open("Artist Donations", [...pl.donationRows].sort((a,b)=>new Date(b.created_date)-new Date(a.created_date)), donationCols)}
                  />
                  <PLRow label="↳ Platform Fee from Donations" value={pl.donationPlatFees} color="text-primary" indent />
                  <PLRow
                    label="Membership / Subscriptions"
                    value={pl.subGross}
                    count={pl.subRows.length}
                    indent
                    onClick={() => open("Memberships", pl.subRows, [
                      { key: "fan_email", label: "User", className: "text-muted-foreground max-w-[160px] truncate" },
                      { key: "tier", label: "Tier", render: r => r.tier || "—" },
                      { key: "amount", label: "Amount", right: true, render: r => <span className="text-primary font-bold">{fmt(r.amount)}</span> },
                      { key: "created_date", label: "Date", right: true, render: r => safeDate(r.created_date) },
                    ])}
                  />
                  <PLRow
                    label="AI Flyer Generation Income"
                    value={pl.flyerIncome}
                    count={pl.flyerPaidSessions.length}
                    indent
                    onClick={() => open("AI Flyer Sessions", pl.flyerPaidSessions, flyerCols)}
                  />
                  <PLRow
                    label="Video Hosting Income"
                    value={pl.videoIncome}
                    count={pl.videoBudgetRows.length}
                    indent
                  />
                  <PLRow
                    label="Affiliate / Referral Income"
                    value={pl.affiliateGross}
                    count={pl.affiliateRows.length}
                    indent
                  />
                </div>

                {/* ── SECTION 2: PAYOUTS / DEDUCTIONS ── */}
                <SectionHeader title="2 · Payouts / Deductions" total={pl.totalPayouts} color="text-destructive" prefix="−" />
                <div className="space-y-0.5">
                  <PLRow
                   label="Organizer Payouts (Event Sales)"
                   value={pl.orgPayoutEventTotal}
                   count={pl.orgPayoutsEvent.length}
                   color="text-destructive"
                   indent
                   onClick={pl.orgPayoutsEvent.length > 0 ? () => openPayouts("Organizer Payouts — Event Sales", pl.orgPayoutsEvent, pl.orgPayoutEventTotal, "organizer_event") : undefined}
                  />
                  <PLRow
                   label="Organizer Referral Payouts"
                   value={pl.orgPayoutReferralTotal}
                   count={pl.orgPayoutsReferral.length}
                   color="text-destructive"
                   indent
                   onClick={pl.orgPayoutsReferral.length > 0 ? () => openPayouts("Organizer Referral Payouts", pl.orgPayoutsReferral, pl.orgPayoutReferralTotal, "organizer_referral") : undefined}
                  />
                  <PLRow
                   label="Artist Payouts"
                   value={pl.artistPayoutTotal}
                   count={pl.artistPayoutRows.length}
                   color="text-destructive"
                   indent
                   onClick={pl.artistPayoutRows.length > 0 ? () => openPayouts("Artist Payouts", pl.artistPayoutRows, pl.artistPayoutTotal, "artist") : undefined}
                  />
                  <PLRow
                   label="Refunds"
                   value={pl.refundsTotal}
                   count={pl.refundedOrders.length}
                   color="text-destructive"
                   indent
                   onClick={pl.refundedOrders.length > 0 ? () => openPayouts("Refunded Orders", pl.refundedOrders, pl.refundsTotal, "refund") : undefined}
                  />
                  {pl.totalPayouts === 0 && (
                    <p className="text-xs font-mono text-muted-foreground px-3 py-1 italic ml-3">None in this period</p>
                  )}
                </div>

                {/* ── SECTION 3: OPERATING EXPENSES ── */}
                <SectionHeader title="3 · Operating Expenses" total={pl.totalExpenses} color="text-orange-400" prefix="−" />
                <div className="space-y-0.5">
                  <PLRow
                    label="CC Processing Fees (est. 2.9% + $0.30)"
                    value={pl.stripeFees}
                    count={pl.stripeableItems.length}
                    color="text-orange-400"
                    indent
                    onClick={pl.stripeableItems.length > 0 ? () => open("CC Processing Fees", pl.stripeableItems, stripeCols) : undefined}
                  />
                  <PLRow
                    label="AI Flyer Generation Cost (est. $0.40/gen)"
                    value={pl.flyerCost}
                    color="text-orange-400"
                    indent
                  />
                  <PLRow
                    label="Custom Admin Expenses"
                    value={pl.customExpenses}
                    count={pl.allExpenses.length}
                    color="text-orange-400"
                    indent
                    onClick={pl.allExpenses.length > 0 ? () => open("Admin Expenses", pl.allExpenses, expenseCols) : undefined}
                  />
                  {pl.totalExpenses === 0 && (
                    <p className="text-xs font-mono text-muted-foreground px-3 py-1 italic ml-3">None in this period</p>
                  )}
                </div>

                {/* ── NET PROFIT SUMMARY ROW ── */}
                <div className="border-t-2 border-dashed border-border/50 pt-3">
                  <div className={`flex items-center justify-between p-4 rounded-xl border-2 ${pl.netProfit >= 0 ? "border-green-400/40 bg-green-400/8" : "border-destructive/40 bg-destructive/8"}`}>
                    <div>
                      <p className="font-display font-black text-sm uppercase tracking-wide">= Net Platform Profit</p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">After all deductions & expenses</p>
                    </div>
                    <p className={`font-display font-black text-2xl ${pl.netProfit >= 0 ? "text-green-400" : "text-destructive"}`}>
                      {fmt(pl.netProfit)}
                    </p>
                  </div>
                </div>

              </div>
            )}

            <div className="shrink-0 px-4 py-3 border-t border-border/30 flex justify-end">
              <button onClick={onClose} className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}