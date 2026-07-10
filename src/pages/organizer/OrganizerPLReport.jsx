import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PLReport from "../../components/reports/PLReport";

export default function OrganizerPLReport() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);

        const [orders, events, payouts, eventExpenses, eventIncomes, generalExpenses] = await Promise.all([
          base44.entities.Order.filter({ organizer_id: u.id }, "-created_date", 1000).catch(() => []),
          base44.entities.Event.filter({ organizer_id: u.id }, null, 1000).catch(() => []),
          base44.entities.ArtistPayout.filter({ organizer_id: u.id }, "-created_date", 1000).catch(() => []),
          base44.entities.EventExpense.filter({ organizer_id: u.id }, "-created_date", 1000).catch(() => []),
          base44.entities.EventIncome.filter({ organizer_id: u.id }, "-created_date", 1000).catch(() => []),
          base44.entities.Expense.filter({ holder_type: "organizer", holder_id: u.id }, "-expense_date", 1000).catch(() => []),
        ]);

        // Create a map for cc_fee_on_buyer setting per event
        const ccFeeMap = Object.fromEntries(events.map((e) => [e.id, e.cc_fee_on_buyer !== false]));

        const txs = [
          // ── Gross ticket sales (one positive entry per completed order) ──
          ...orders.filter((o) => o.status === "completed").flatMap((o) => {
            const ccFeeOnBuyer = ccFeeMap[o.event_id] ?? true;
            const gross = o.subtotal || 0;
            const platformFee = o.service_fee || 0;
            const ccFee = ccFeeOnBuyer ? 0 : (gross + platformFee) * 0.03;

            const rows = [
              {
                id: o.id,
                created_date: o.created_date,
                transaction_type: "ticket_sale",
                amount: gross,
                description: `Order ${o.order_number} — ${o.event_title}`,
              },
            ];
            if (platformFee > 0) {
              rows.push({
                id: `pf_${o.id}`,
                created_date: o.created_date,
                transaction_type: "platform_fee",
                amount: -platformFee,
                description: `Platform fee — Order ${o.order_number} (${o.event_title})`,
              });
            }
            if (ccFee > 0) {
              rows.push({
                id: `cc_${o.id}`,
                created_date: o.created_date,
                transaction_type: "cc_fee",
                amount: -ccFee,
                description: `CC processing fee absorbed — Order ${o.order_number} (${o.event_title})`,
              });
            }
            return rows;
          }),
          ...payouts.map((p) => ({
            id: p.id,
            created_date: p.created_date,
            transaction_type: "payout",
            amount: -(p.amount || 0),
            description: `Payout processed`,
          })),
          ...eventExpenses.map((e) => ({
            id: e.id,
            created_date: e.created_date,
            transaction_type: "event_expense",
            amount: e.amount || 0,
            description: `${e.expense_name} — ${e.event_title || "Event"}`,
          })),
          ...eventIncomes.map((i) => ({
            id: i.id,
            created_date: i.created_date,
            transaction_type: "other_income",
            amount: i.amount || 0,
            description: `${i.income_name} — ${i.event_title || "Event"}`,
          })),
          // General (non-event) organizer expenses — filtered/grouped by expense_date, not creation date
          ...generalExpenses.map((e) => ({
            id: e.id,
            created_date: e.expense_date || e.created_date,
            transaction_type: "general_expense",
            amount: -(e.amount || 0),
            description: e.category ? `${e.expense_name} (${e.category})` : e.expense_name,
          })),
        ];

        setTransactions(txs);
      } catch (error) {
        console.error("Error fetching P&L data:", error);
      }
      setLoading(false);
    };

    fetchData();
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
        <h1 className="font-display font-black text-3xl tracking-tight">P&L REPORT</h1>
        <p className="text-sm text-muted-foreground mt-1">Your event revenue and payouts</p>
      </div>
      <PLReport transactions={transactions} title="Organizer Profit & Loss" />
    </div>
  );
}