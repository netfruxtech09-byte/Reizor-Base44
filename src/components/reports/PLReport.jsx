import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, ChevronDown, X, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDateRange, groupTransactionsByPeriod, calculatePLSummary, TRANSACTION_TYPES } from "@/utils/plReportUtils";
import { format } from "date-fns";

const PERIODS = ["day", "week", "month", "year"];

function DetailModal({ open, onClose, title, color, transactions, summary }) {
  if (!open) return null;

  const revenue = transactions.filter(t => (t.amount || 0) > 0);
  const expenses = transactions.filter(t => (t.amount || 0) < 0);

  const rows = title === "Net"
    ? [] // Net shows a breakdown, not raw rows
    : title === "Expenses" ? expenses : revenue;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg w-[calc(100vw-2rem)] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display font-black text-lg">{title} Details</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {title === "Net" ? (
            /* Net breakdown */
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-green-400/10 border border-green-400/30 flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-green-400 uppercase tracking-widest mb-0.5">Total Revenue</p>
                  <p className="text-xs text-muted-foreground">{revenue.length} transactions</p>
                </div>
                <p className="font-mono font-bold text-green-400 text-lg">+${summary.revenue.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-destructive uppercase tracking-widest mb-0.5">Total Expenses</p>
                  <p className="text-xs text-muted-foreground">{expenses.length} transactions</p>
                </div>
                <p className="font-mono font-bold text-destructive text-lg">−${summary.expenses.toFixed(2)}</p>
              </div>
              <div className="h-px bg-border/50" />
              <div className={`p-4 rounded-xl border flex items-center justify-between ${summary.net >= 0 ? "bg-accent/10 border-accent/30" : "bg-destructive/10 border-destructive/30"}`}>
                <div>
                  <p className={`text-xs font-mono uppercase tracking-widest mb-0.5 ${summary.net >= 0 ? "text-accent" : "text-destructive"}`}>Net P&L</p>
                  <p className="text-xs text-muted-foreground font-mono">Revenue − Expenses</p>
                </div>
                <p className={`font-mono font-bold text-xl ${summary.net >= 0 ? "text-accent" : "text-destructive"}`}>
                  {summary.net >= 0 ? "+" : ""}${summary.net.toFixed(2)}
                </p>
              </div>
              {/* Revenue breakdown by type */}
              {revenue.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Revenue Breakdown</p>
                  {Object.entries(
                    revenue.reduce((acc, t) => {
                      const label = TRANSACTION_TYPES[t.transaction_type]?.label || t.transaction_type;
                      acc[label] = (acc[label] || 0) + (t.amount || 0);
                      return acc;
                    }, {})
                  ).map(([label, total]) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="font-mono text-sm font-bold text-green-400">+${total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground text-sm">No records found for this period.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {rows.map((tx, i) => {
                const txType = TRANSACTION_TYPES[tx.transaction_type] || {};
                const amt = Math.abs(tx.amount || 0);
                const isExpense = (tx.amount || 0) < 0;
                return (
                  <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-secondary/50 border border-border/30 hover:border-border/60 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{txType.label || tx.transaction_type}</p>
                      {tx.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{tx.description}</p>}
                      {tx.created_date && (
                        <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
                          {format(new Date(tx.created_date), "MMM d, yyyy • h:mm a")}
                        </p>
                      )}
                    </div>
                    <p className={`font-mono font-bold whitespace-nowrap text-sm shrink-0 ${isExpense ? "text-destructive" : "text-green-400"}`}>
                      {isExpense ? "−" : "+"}${amt.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer total */}
        {title !== "Net" && rows.length > 0 && (
          <div className={`mt-3 pt-3 border-t border-border/50 flex items-center justify-between`}>
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Total ({rows.length} records)</span>
            <span className={`font-mono font-bold ${title === "Expenses" ? "text-destructive" : "text-green-400"}`}>
              {title === "Expenses" ? "−" : "+"}${(title === "Expenses" ? summary.expenses : summary.revenue).toFixed(2)}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PLReport({ transactions = [], title = "P&L Report" }) {
  const [period, setPeriod] = useState("month");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [detailModal, setDetailModal] = useState(null); // "revenue" | "expenses" | "net"

  const dateRange = getDateRange(period);
  const filtered = transactions.filter((t) => {
    const tDate = new Date(t.created_date || t.date);
    return tDate >= dateRange.start && tDate <= dateRange.end;
  });

  const grouped = groupTransactionsByPeriod(filtered, period);
  const summary = calculatePLSummary(filtered);
  const groups = Object.entries(grouped).sort((a, b) => new Date(b[0]) - new Date(a[0]));

  const modalTitle = detailModal === "revenue" ? "Revenue" : detailModal === "expenses" ? "Expenses" : "Net";

  return (
    <div className="space-y-6">
      {/* Header + Period Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-display font-black text-2xl tracking-tight">{title}</h2>
        <div className="flex gap-1.5 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-mono font-bold transition-all ${
                period === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/50 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards — clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Revenue */}
        <button
          onClick={() => setDetailModal("revenue")}
          className="p-4 rounded-xl bg-green-400/10 border border-green-400/30 text-left hover:border-green-400/60 hover:bg-green-400/15 active:scale-[0.98] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-green-400 uppercase tracking-widest">Revenue</span>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <p className="font-mono text-2xl font-bold text-green-400">${summary.revenue.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{summary.count} transactions</p>
          <p className="text-[10px] text-green-400/60 font-mono mt-1 group-hover:text-green-400/90 transition-colors">Tap to view details →</p>
        </button>

        {/* Expenses */}
        <button
          onClick={() => setDetailModal("expenses")}
          className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-left hover:border-destructive/60 hover:bg-destructive/15 active:scale-[0.98] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-destructive uppercase tracking-widest">Expenses</span>
            <TrendingDown className="w-4 h-4 text-destructive" />
          </div>
          <p className="font-mono text-2xl font-bold text-destructive">${summary.expenses.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">&nbsp;</p>
          <p className="text-[10px] text-destructive/60 font-mono mt-1 group-hover:text-destructive/90 transition-colors">Tap to view details →</p>
        </button>

        {/* Net */}
        <button
          onClick={() => setDetailModal("net")}
          className={`p-4 rounded-xl border text-left active:scale-[0.98] transition-all cursor-pointer group ${
            summary.net >= 0
              ? "bg-accent/10 border-accent/30 hover:border-accent/60 hover:bg-accent/15"
              : "bg-destructive/10 border-destructive/30 hover:border-destructive/60 hover:bg-destructive/15"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`font-mono text-xs uppercase tracking-widest ${summary.net >= 0 ? "text-accent" : "text-destructive"}`}>Net P/L</span>
            <DollarSign className={`w-4 h-4 ${summary.net >= 0 ? "text-accent" : "text-destructive"}`} />
          </div>
          <p className={`font-mono text-2xl font-bold ${summary.net >= 0 ? "text-accent" : "text-destructive"}`}>
            {summary.net >= 0 ? "+" : ""}${summary.net.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">&nbsp;</p>
          <p className={`text-[10px] font-mono mt-1 transition-colors ${summary.net >= 0 ? "text-accent/60 group-hover:text-accent/90" : "text-destructive/60 group-hover:text-destructive/90"}`}>Tap to view details →</p>
        </button>
      </div>

      {/* Transaction Groups */}
      {groups.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-card border border-border/50">
          <p className="text-muted-foreground">No transactions for selected period</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(([key, group]) => (
            <div key={key}>
              <button
                onClick={() => setExpandedGroup(expandedGroup === key ? null : key)}
                className="w-full p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors flex items-center justify-between"
              >
                <div className="text-left">
                  <p className="font-bold text-sm">{group.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{group.count} transactions</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-mono font-bold text-accent text-sm sm:text-base">${group.total.toFixed(2)}</p>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedGroup === key ? "rotate-180" : ""}`} />
                </div>
              </button>

              {expandedGroup === key && (
                <div className="mt-1 p-4 rounded-lg bg-card/50 border border-border/30 space-y-2">
                  {group.transactions.map((tx, i) => {
                    const txType = TRANSACTION_TYPES[tx.transaction_type] || {};
                    return (
                      <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-muted/30 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{txType.label || tx.transaction_type}</p>
                          {tx.description && <p className="text-xs text-muted-foreground truncate">{tx.description}</p>}
                        </div>
                        <p className={`font-mono font-bold whitespace-nowrap ml-2 ${txType.color || "text-foreground"}`}>
                          {txType.type === "expense" ? "-" : "+"} ${Math.abs(tx.amount || 0).toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <DetailModal
        open={!!detailModal}
        onClose={() => setDetailModal(null)}
        title={modalTitle}
        transactions={filtered}
        summary={summary}
      />
    </div>
  );
}