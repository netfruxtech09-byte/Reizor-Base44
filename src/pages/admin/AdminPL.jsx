import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PLReport from "../../components/reports/PLReport";

export default function AdminPL() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const [
          orders,
          organizerPayouts,
          artistPayouts,
          affiliateEarnings,
          adminExpenses,
          tableReservations,
          fanSubscriptions,
          artistDonations,
          aiFlyerSessions,
        ] = await Promise.all([
          base44.entities.Order.list("-created_date", 1000).catch(() => []),
          base44.entities.OrganizerPayoutRequest.list("-created_date", 1000).catch(() => []),
          base44.entities.ArtistPayout.list("-created_date", 1000).catch(() => []),
          base44.entities.AffiliateEarning.list("-created_date", 1000).catch(() => []),
          base44.entities.AdminExpense.list("-created_date", 1000).catch(() => []),
          base44.entities.TableReservation.list("-created_date", 1000).catch(() => []),
          base44.entities.FanSubscription.list("-created_date", 1000).catch(() => []),
          base44.entities.ArtistDonation.list("-created_date", 1000).catch(() => []),
          base44.entities.AIFlyerSession.list("-created_date", 500).catch(() => []),
        ]);

        const txs = [
          // ── INCOME ──────────────────────────────────────────────────────
          ...orders
            .filter((o) => o.status === "completed")
            .map((o) => ({
              id: o.id,
              created_date: o.created_date,
              transaction_type: "ticket_sale",
              amount: o.total || 0,
              description: `Order ${o.order_number} — ${o.event_title || ""}`,
            })),

          ...tableReservations
            .filter((t) => ["confirmed", "completed", "paid"].includes(t.status))
            .map((t) => ({
              id: t.id,
              created_date: t.created_date,
              transaction_type: "table_sale",
              amount: t.total_price || 0,
              description: `Table — ${t.event_title || ""}`,
            })),

          ...fanSubscriptions
            .filter((s) => s.status === "active")
            .map((s) => ({
              id: s.id,
              created_date: s.created_date,
              transaction_type: "fan_tier",
              amount: s.amount || 0,
              description: `Membership — ${s.fan_email || ""}`,
            })),

          ...artistDonations
            .filter((d) => d.status === "completed")
            .map((d) => ({
              id: d.id,
              created_date: d.created_date,
              transaction_type: "donation",
              amount: d.amount || 0,
              description: `Donation to ${d.artist_name || ""}`,
            })),

          ...affiliateEarnings
            .filter((a) => ["confirmed", "paid"].includes(a.status))
            .map((a) => ({
              id: a.id,
              created_date: a.paid_at || a.created_date,
              transaction_type: "affiliate_commission",
              amount: a.amount || 0,
              description: `Affiliate — ${a.event_title || ""}`,
            })),

          ...aiFlyerSessions
            .filter((s) => s.status === "paid")
            .map((s) => ({
              id: s.id,
              created_date: s.paid_at || s.created_date,
              transaction_type: "other_income",
              amount: s.paid_amount || 0,
              description: `AI Flyer Generation — ${s.organizer_email || ""}`,
            })),

          // ── DEDUCTIONS / PAYOUTS ─────────────────────────────────────────
          ...organizerPayouts
            .filter((p) => ["approved", "completed"].includes(p.status))
            .map((p) => ({
              id: p.id,
              created_date: p.request_date || p.created_date,
              transaction_type: "payout",
              amount: -(p.amount || 0),
              description: `Organizer Payout — ${p.organizer_name || p.organizer_email || ""} — ${p.event_title || ""}`,
            })),

          ...artistPayouts
            .filter((p) => p.status === "completed")
            .map((p) => ({
              id: p.id,
              created_date: p.created_date,
              transaction_type: "payout",
              amount: -(p.amount || 0),
              description: `Artist Payout — ${p.artist_name || p.artist_email || ""}`,
            })),

          ...orders
            .filter((o) => o.status === "refunded")
            .map((o) => ({
              id: o.id,
              created_date: o.refunded_at || o.created_date,
              transaction_type: "refund",
              amount: -(o.total || 0),
              description: `Refund — Order ${o.order_number || ""} — ${o.event_title || ""}`,
            })),

          // ── OPERATING EXPENSES ───────────────────────────────────────────
          ...adminExpenses.map((e) => ({
            id: e.id,
            created_date: e.expense_date ? e.expense_date + "T00:00:00" : e.created_date,
            transaction_type: "admin_expense",
            amount: -(e.amount || 0),
            description: [
              e.expense_name,
              e.holder_type === "platform" ? "Platform/Admin" : e.holder_name,
              e.event_title,
              e.category,
            ]
              .filter(Boolean)
              .join(" — "),
          })),

          // CC Processing fees — use stored card_processing_fee when available (new orders).
          // For legacy orders without the field, estimate using 2.9% + $0.30 on (total - card_fee),
          // but only deduct from platform P&L (it's always paid by someone regardless).
          ...orders
            .filter((o) => o.status === "completed")
            .map((o) => {
              // New orders store the exact fee; legacy orders: estimate from subtotal+service_fee
              const fee = o.card_processing_fee != null
                ? o.card_processing_fee
                : parseFloat((((o.subtotal || 0) + (o.service_fee || 0)) * 0.029 + 0.30).toFixed(2));
              return {
                id: `ccfee_${o.id}`,
                created_date: o.created_date,
                transaction_type: "cc_fee",
                amount: -fee,
                description: `CC Fee — Order ${o.order_number || ""}`,
              };
            }),

          ...tableReservations
            .filter((t) => ["confirmed", "completed", "paid"].includes(t.status))
            .map((t) => ({
              id: `ccfee_table_${t.id}`,
              created_date: t.created_date,
              transaction_type: "cc_fee",
              amount: -((t.total_price || 0) * 0.029 + 0.3),
              description: `CC Fee — Table ${t.event_title || ""}`,
            })),
        ];

        setTransactions(txs);
      } catch (error) {
        console.error("Error fetching P&L data:", error);
      }
      setLoading(false);
    };

    fetchTransactions();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">PLATFORM P&L</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All transactions across the platform — Gross Income minus Organizer Payouts, Artist Payouts, Refunds, CC Fees, and Admin Expenses.
        </p>
      </div>
      <PLReport transactions={transactions} title="Platform Profit & Loss" />
    </div>
  );
}