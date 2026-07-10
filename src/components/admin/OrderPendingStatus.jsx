import { AlertCircle, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

const PENDING_REASON_LABELS = {
  awaiting_payment_completion: "Awaiting payment completion",
  awaiting_stripe_confirmation: "Waiting for Stripe confirmation",
  payment_processing: "Payment processing",
  refund_requested: "Refund requested",
  manual_review_required: "Manual review required",
  payment_verification_required: "Payment verification required",
};

export default function OrderPendingStatus({ order }) {
  if (!order) return null;
  
  const isPending = order.status === "pending";
  const isRefundPending = order.refund_requested_at && !order.refunded_at;
  
  if (!isPending && !isRefundPending) return null;

  const getColor = () => {
    if (isRefundPending) return "text-yellow-400 bg-yellow-400/10";
    return "text-muted-foreground bg-muted";
  };

  const getIcon = () => {
    if (isRefundPending) return <Clock className="w-3.5 h-3.5" />;
    if (order.pending_since) {
      const timePending = new Date() - new Date(order.pending_since);
      const hoursAgo = Math.floor(timePending / (1000 * 60 * 60));
      if (hoursAgo > 24) return <AlertCircle className="w-3.5 h-3.5" />;
    }
    return <Clock className="w-3.5 h-3.5" />;
  };

  const reason = PENDING_REASON_LABELS[order.pending_reason] || order.pending_reason || "Pending";
  
  const pendingDuration = order.pending_since 
    ? `for ${formatDuration(new Date() - new Date(order.pending_since))}`
    : "";

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${getColor()}`}>
      {getIcon()}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase">
          {isRefundPending ? "Refund Pending" : "Pending"}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {reason} {pendingDuration}
        </p>
        {order.last_payment_check_at && (
          <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono">
            Last checked: {format(new Date(order.last_payment_check_at), "MMM d, HH:mm")}
          </p>
        )}
        {order.reconciliation_status === "reconciliation_failed" && (
          <p className="text-[10px] text-destructive mt-1 font-bold">
            ⚠️ Reconciliation failed — manual review needed
          </p>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return "just now";
}