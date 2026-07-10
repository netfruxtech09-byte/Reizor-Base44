import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, endOfWeek, endOfMonth, endOfYear, format } from "date-fns";

/**
 * Get date range boundaries for aggregation
 */
export function getDateRange(period) {
  const now = new Date();
  const ranges = {
    day: { start: startOfDay(now), end: endOfDay(now) },
    week: { start: startOfWeek(now), end: endOfWeek(now) },
    month: { start: startOfMonth(now), end: endOfMonth(now) },
    year: { start: startOfYear(now), end: endOfYear(now) },
  };
  return ranges[period] || ranges.month;
}

/**
 * Group transactions by day/week/month/year
 */
export function groupTransactionsByPeriod(transactions, period) {
  const grouped = {};
  const formatMap = {
    day: "MMM dd, yyyy",
    week: "'Week of' MMM dd",
    month: "MMM yyyy",
    year: "yyyy",
  };
  const keyMap = {
    day: (date) => format(date, "yyyy-MM-dd"),
    week: (date) => `${format(startOfWeek(date), "yyyy-MM-dd")}`,
    month: (date) => format(date, "yyyy-MM"),
    year: (date) => format(date, "yyyy"),
  };

  transactions.forEach((tx) => {
    const txDate = new Date(tx.created_date || tx.date);
    const key = keyMap[period](txDate);
    const label = format(txDate, formatMap[period]);
    if (!grouped[key]) {
      grouped[key] = { label, transactions: [], total: 0, count: 0 };
    }
    grouped[key].transactions.push(tx);
    grouped[key].total += tx.amount || 0;
    grouped[key].count += 1;
  });

  return grouped;
}

/**
 * Calculate summary stats — counts revenue transactions only (to match Revenue Details modal)
 */
export function calculatePLSummary(transactions) {
  const revenueTransactions = transactions.filter((t) => {
    const txType = TRANSACTION_TYPES[t.transaction_type];
    return txType ? txType.type === "income" : t.amount > 0;
  });
  const expenseTransactions = transactions.filter((t) => {
    const txType = TRANSACTION_TYPES[t.transaction_type];
    return txType ? txType.type === "expense" : t.amount < 0;
  });
  
  const revenue = revenueTransactions.reduce((s, t) => s + (t.amount || 0), 0);
  const expenses = expenseTransactions.reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const net = revenue - expenses;
  
  // count = revenue transactions only (matches Revenue Details modal display)
  return { revenue, expenses, net, count: revenueTransactions.length, revenueCount: revenueTransactions.length, expenseCount: expenseTransactions.length };
}

/**
 * Transaction types and categories
 */
export const TRANSACTION_TYPES = {
  ticket_sale: { label: "Ticket Sale", type: "income", color: "text-green-400" },
  table_sale: { label: "Table Sale", type: "income", color: "text-green-400" },
  other_income: { label: "Other Income", type: "income", color: "text-green-400" },
  event_expense: { label: "Event Expense", type: "expense", color: "text-destructive" },
  general_expense: { label: "General Expense", type: "expense", color: "text-destructive" },
  merch_sale: { label: "Merch Sale", type: "income", color: "text-green-400" },
  donation: { label: "Donation", type: "income", color: "text-green-400" },
  shoutout: { label: "Shoutout", type: "income", color: "text-green-400" },
  fan_tier: { label: "Fan Tier", type: "income", color: "text-green-400" },
  digital_product: { label: "Digital Product", type: "income", color: "text-green-400" },
  booking: { label: "Booking", type: "income", color: "text-green-400" },
  affiliate_commission: { label: "Affiliate Commission", type: "income", color: "text-accent" },
  platform_fee: { label: "Platform Fee", type: "expense", color: "text-destructive" },
  cc_fee: { label: "CC Processing Fees", type: "expense", color: "text-destructive" },
  payout: { label: "Payout", type: "expense", color: "text-destructive" },
  refund: { label: "Refund", type: "expense", color: "text-yellow-400" },
  admin_expense: { label: "Admin Expense", type: "expense", color: "text-destructive" },
};