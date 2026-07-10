import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Search, X, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import OrderPendingStatus from "@/components/admin/OrderPendingStatus";


const STATUS_STYLES = {
  completed:  { label: "Completed",  cls: "text-green-400 bg-green-400/10" },
  refunded:   { label: "Refunded",   cls: "text-yellow-400 bg-yellow-400/10" },
  chargeback: { label: "Chargeback", cls: "text-destructive bg-destructive/10" },
  pending:    { label: "Pending",    cls: "text-muted-foreground bg-muted" },
  cancelled:  { label: "Cancelled",  cls: "text-muted-foreground bg-muted" },
  failed:     { label: "Failed",     cls: "text-destructive bg-destructive/10" },
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [organizers, setOrganizers] = useState({});
  const [organizerEmails, setOrganizerEmails] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [refundOrder, setRefundOrder] = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Order.list("-created_date", 300),
      base44.entities.User.list(null, 500).catch(() => []),
      base44.auth.me().catch(() => null),
    ]).then(([ords, users, me]) => {
      setOrders(ords);
      // Build organizer id → name map
      const orgMap = {};
      // Store both name and email keyed by id, and a separate email map
      const orgEmailMap = {};
      users.filter(u => u.role === "organizer" || u.role === "admin").forEach(u => {
        orgMap[u.id] = u.full_name || u.email;
        orgEmailMap[u.id] = u.email;
      });
      setOrganizerEmails(orgEmailMap);
      setOrganizers(orgMap);
      setAdminUser(me);
      setLoading(false);
    });
  }, []);

  const handleRefund = async () => {
    if (!refundOrder) return;
    setRefunding(true);
    try {
      await base44.functions.invoke("stripeRefund", {
        orderId: refundOrder.id,
        reason: refundReason.trim(),
      });
      toast.success("Refund initiated. Status will update when Stripe confirms.");
      // Don't update locally — let webhook/reconciliation update the status
    } catch (err) {
      toast.error(err.response?.data?.error || "Refund failed");
    } finally {
      setRefunding(false);
      setRefundOrder(null);
      setRefundReason("");
    }
  };

  const handleReconcile = async (orderId) => {
    try {
      await base44.functions.invoke("reconcilePendingOrders", {});
      toast.success("Reconciliation started");
      // Reload orders
      setOrders(await base44.entities.Order.list("-created_date", 300));
    } catch (err) {
      toast.error("Reconciliation failed: " + (err.response?.data?.error || err.message));
    }
  };

  // Chargebacks are received automatically from Stripe via webhook — no manual creation.

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q || (o.order_number || "").toLowerCase().includes(q) ||
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.customer_email || "").toLowerCase().includes(q) ||
      (o.event_title || "").toLowerCase().includes(q) ||
      (organizers[o.organizer_id] || o.organizer_name || "").toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getOrganizerName = (order) =>
    organizers[order.organizer_id] || order.organizer_name || "—";

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">ORDERS</h1>
        <p className="text-sm text-muted-foreground mt-1">{orders.length} total · {filtered.length} shown</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search order, customer, event, organizer..."
            className="pl-9 bg-card border-border/50" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "completed", "refunded", "chargeback", "pending"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
              }`}>
              {s === "all" ? "All" : (STATUS_STYLES[s]?.label || s)}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-card rounded-xl border border-border/50 overflow-x-auto">
        <div>
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Order</th>
                <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Customer</th>
                <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Organizer</th>
                <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Stripe</th>
                <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
                </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">No orders found</td></tr>
              )}
              {filtered.map(order => {
                const st = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                return (
                  <tr key={order.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="p-3">
                      <p className="font-mono text-xs text-primary font-bold">{order.order_number}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">{order.event_title}</p>
                    </td>
                    <td className="p-3">
                      <p className="font-medium text-xs">{order.customer_name || "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{order.customer_email}</p>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{getOrganizerName(order)}</td>
                    <td className="p-3 font-mono text-xs font-bold">
                      <p>${order.total?.toFixed(2)}</p>
                      {(order.wl_fee_total > 0) && (
                        <p className="text-[10px] text-accent font-mono mt-0.5" title="WL hierarchy fee included">+${order.wl_fee_total?.toFixed(2)} WL</p>
                      )}
                    </td>
                    <td className="p-3 space-y-1">
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                      {order.status === "pending" && (
                        <OrderPendingStatus order={order} />
                      )}
                      {order.status === "refunded" && order.refunded_by && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">by {order.refunded_by}</p>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-muted-foreground">
                      {order.created_date ? format(new Date(order.created_date), "MMM dd") : "—"}
                    </td>
                    <td className="p-3">
                      {order.stripe_payment_intent_id && (
                        <p className="font-mono text-[9px] text-muted-foreground truncate max-w-[100px]" title={order.stripe_payment_intent_id}>
                          {order.stripe_payment_intent_id.slice(0, 12)}…
                        </p>
                      )}
                      {order.stripe_payment_status && (
                        <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${order.stripe_payment_status === 'paid' ? 'text-green-400 bg-green-400/10' : order.stripe_payment_status === 'refunded' ? 'text-yellow-400 bg-yellow-400/10' : 'text-muted-foreground bg-muted'}`}>
                          {order.stripe_payment_status}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                     {order.status === "pending" && (
                        <button onClick={() => handleReconcile(order.id)}
                          className="w-full text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                          Recheck Payment
                        </button>
                      )}
                      {order.status === "completed" && (
                        <button onClick={() => { setRefundOrder(order); setRefundReason(""); }}
                          className="w-full text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 transition-colors">
                          Refund
                        </button>
                      )}
                     {order.status === "chargeback" && order.stripe_dispute_id && (
                       <div className="space-y-0.5">
                         <p className="text-[9px] font-mono text-destructive">From Stripe</p>
                         <p className="text-[9px] font-mono text-muted-foreground truncate max-w-[100px]" title={order.stripe_dispute_id}>{order.stripe_dispute_id.slice(0, 12)}…</p>
                         {order.dispute_reason && <p className="text-[9px] font-mono text-muted-foreground capitalize">{order.dispute_reason}</p>}
                       </div>
                     )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No orders found</p>}
        {filtered.map(order => {
          const st = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
          return (
            <div key={order.id} className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-primary font-bold">{order.order_number}</p>
                  <p className="font-medium text-sm mt-0.5">{order.customer_name || "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono">{order.customer_email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-bold">${order.total?.toFixed(2)}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{order.created_date ? format(new Date(order.created_date), "MMM dd") : "—"}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Organizer: <span className="font-medium">{getOrganizerName(order)}</span></p>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                {order.status === "refunded" && order.refunded_by && (
                  <span className="text-[10px] text-muted-foreground">Refunded by: {order.refunded_by}</span>
                )}
              </div>
              {order.status === "pending" && (
                 <button onClick={() => handleReconcile(order.id)}
                   className="w-full text-xs font-mono py-1.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors mb-2">
                   Recheck Payment Status
                 </button>
               )}
               {order.status === "completed" && (
                 <button onClick={() => { setRefundOrder(order); setRefundReason(""); }}
                   className="w-full text-xs font-mono py-1.5 rounded border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 transition-colors">
                   Refund
                 </button>
               )}
               {order.status === "chargeback" && (
                <div className="p-2 rounded-lg bg-destructive/5 border border-destructive/20 text-xs space-y-0.5">
                  <p className="font-mono font-bold text-destructive text-[10px]">⚠️ DISPUTE FROM STRIPE</p>
                  {order.dispute_reason && <p className="text-muted-foreground font-mono capitalize">{order.dispute_reason}</p>}
                  {order.stripe_dispute_id && <p className="font-mono text-[10px] text-muted-foreground">{order.stripe_dispute_id}</p>}
                  {order.chargeback_at && <p className="font-mono text-[10px] text-muted-foreground">{format(new Date(order.chargeback_at), "MMM dd, yyyy")}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Refund dialog */}
      <Dialog open={!!refundOrder} onOpenChange={() => setRefundOrder(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-black">Issue Refund</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-secondary border border-border/50 space-y-1 text-sm">
              <p><span className="text-muted-foreground">Order:</span> <span className="font-mono font-bold text-primary">{refundOrder?.order_number}</span></p>
              <p><span className="text-muted-foreground">Customer:</span> {refundOrder?.customer_name}</p>
              <p><span className="text-muted-foreground">Amount:</span> <span className="font-mono font-bold">${refundOrder?.total?.toFixed(2)}</span></p>
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Reason (optional)</label>
              <Input value={refundReason} onChange={e => setRefundReason(e.target.value)}
                placeholder="e.g. Event cancelled, customer request..."
                className="mt-1 bg-secondary border-border/50" />
            </div>
            <p className="text-xs text-muted-foreground font-mono">This refund will be recorded as issued by: <strong>{adminUser?.full_name || "Admin"}</strong></p>
            <div className="flex gap-2">
              <Button onClick={handleRefund} disabled={refunding} className="flex-1 gap-2">
                <RefreshCw className="w-4 h-4" /> {refunding ? "Processing..." : "Confirm Refund"}
              </Button>
              <Button variant="outline" onClick={() => setRefundOrder(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}