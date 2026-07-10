/**
 * PayoutFeeBreakdown — renders the fee/deduction audit trail for a payout request.
 * Works for both organizer payout history and admin payout drill-down.
 */
export default function PayoutFeeBreakdown({ feeBreakdownJson, compact = false }) {
  if (!feeBreakdownJson) return null;

  let bd;
  try { bd = JSON.parse(feeBreakdownJson); } catch { return null; }

  const row = (label, value, color = "text-muted-foreground", prefix = "") => (
    value !== undefined && value !== null && (
      <div key={label} className="flex justify-between items-center py-1 border-b border-border/20 last:border-0">
        <span className={`text-xs ${compact ? "" : "text-sm"} ${color === "text-muted-foreground" ? "text-muted-foreground" : ""}`}>{label}</span>
        <span className={`font-mono text-xs font-bold ${color}`}>{prefix}${Math.abs(Number(value)).toFixed(2)}</span>
      </div>
    )
  );

  const hasTickets = (bd.gross_ticket_sales || 0) > 0;
  const hasTables = (bd.gross_table_sales || 0) > 0;
  const hasCCFee = (bd.cc_fee_deducted || 0) > 0;
  const hasPlatformFee = (bd.platform_fee_deducted || 0) > 0;
  const hasPaidOut = (bd.already_paid_out || 0) > 0;

  return (
    <div className={`rounded-lg border border-border/40 bg-secondary/20 ${compact ? "p-2.5" : "p-3.5"} space-y-0.5`}>
      {!compact && (
        <p className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest mb-2">Fee & Deduction Audit</p>
      )}
      {hasTickets && row("Ticket Sales (gross)", bd.gross_ticket_sales, "text-foreground")}
      {hasTables && row("Table / VIP Sales (gross)", bd.gross_table_sales, "text-foreground")}
      {hasPlatformFee && row("Platform Fee deducted", bd.platform_fee_deducted, "text-destructive", "−")}
      {hasCCFee && row("CC Processing Fee (organizer-absorbed)", bd.cc_fee_deducted, "text-destructive", "−")}
      {hasPaidOut && row("Previously paid out", bd.already_paid_out, "text-muted-foreground", "−")}
      {(bd.pending_amount || 0) > 0 && row("Pending in other request", bd.pending_amount, "text-yellow-400", "−")}
      <div className="flex justify-between items-center pt-1.5 mt-0.5 border-t border-border/40">
        <span className={`font-bold text-xs ${compact ? "" : "text-sm"}`}>Net Payout</span>
        <span className="font-mono font-black text-primary text-sm">${(bd.net_payout || 0).toFixed(2)}</span>
      </div>
    </div>
  );
}