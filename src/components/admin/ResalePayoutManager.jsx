import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function ResalePayoutManager() {
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    try {
      const payouts = await base44.entities.ResaleSellerPayoutRequest.list("-created_date", 500).catch(() => []);
      setPayoutRequests(payouts);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load payouts:", error);
      setLoading(false);
    }
  };

  const handleAprovePayout = async (payout) => {
    setProcessingId(payout.id);
    try {
      await base44.entities.ResaleSellerPayoutRequest.update(payout.id, {
        status: "approved",
        reviewed_by_admin_email: "admin@reizor.com",
        reviewed_at: new Date().toISOString(),
      });

      await base44.integrations.Core.SendEmail({
        to: payout.seller_email,
        subject: `✅ Payout Approved — $${payout.amount_requested.toFixed(2)}`,
        body: `Hi ${payout.seller_name},\n\nYour payout request of $${payout.amount_requested.toFixed(2)} has been approved!\n\nWe will process this within 3-5 business days. You'll receive a confirmation email once completed.\n\nThank you for selling on Reizor!`,
      }).catch(() => {});

      toast.success("Payout approved");
      setSelectedPayout(null);
      loadPayouts();
    } catch (error) {
      toast.error(error.message || "Failed to approve payout");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompletePayout = async (payout) => {
    setProcessingId(payout.id);
    try {
      // Update payout request status
      await base44.entities.ResaleSellerPayoutRequest.update(payout.id, {
        status: "completed",
        completed_by_admin_email: "admin@reizor.com",
        completed_at: new Date().toISOString(),
      });

      // Update seller balance
      const balances = await base44.entities.ResaleSellerBalance.filter(
        { seller_email: payout.seller_email },
        null,
        1
      ).catch(() => []);

      if (balances[0]) {
        const newAvailable = Math.max(0, (balances[0].available_balance || 0) - payout.amount_requested);
        const newPending = Math.max(0, (balances[0].pending_payout_amount || 0) - payout.amount_requested);
        
        await base44.entities.ResaleSellerBalance.update(balances[0].id, {
          available_balance: newAvailable,
          pending_payout_amount: newPending,
          total_paid_out: (balances[0].total_paid_out || 0) + payout.amount_requested,
        });
      }

      // Create wallet transaction for debit
      await base44.entities.ResaleWalletTransaction.create({
        seller_email: payout.seller_email,
        seller_name: payout.seller_name,
        transaction_type: "debit",
        amount: payout.amount_requested,
        payout_request_id: payout.id,
        description: `Payout Request — ${payout.payout_method}`,
        status: "completed",
      }).catch(() => {});

      await base44.integrations.Core.SendEmail({
        to: payout.seller_email,
        subject: `💰 Payout Completed — $${payout.amount_requested.toFixed(2)}`,
        body: `Hi ${payout.seller_name},\n\nYour payout of $${payout.amount_requested.toFixed(2)} has been processed!\n\nPlease allow 1-3 business days for the funds to appear in your ${payout.payout_method.replace("_", " ")}.\n\nThank you for selling on Reizor!`,
      }).catch(() => {});

      toast.success("Payout marked as completed");
      setSelectedPayout(null);
      loadPayouts();
    } catch (error) {
      toast.error(error.message || "Failed to complete payout");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectPayout = async (payout, reason) => {
    setProcessingId(payout.id);
    try {
      await base44.entities.ResaleSellerPayoutRequest.update(payout.id, {
        status: "rejected",
        rejected_reason: reason,
        reviewed_by_admin_email: "admin@reizor.com",
        reviewed_at: new Date().toISOString(),
      });

      await base44.integrations.Core.SendEmail({
        to: payout.seller_email,
        subject: `Payout Request — Further Information Needed`,
        body: `Hi ${payout.seller_name},\n\nYour payout request for $${payout.amount_requested.toFixed(2)} requires further information.\n\nReason: ${reason}\n\nPlease contact support or resubmit your request.\n\nThank you!`,
      }).catch(() => {});

      toast.success("Payout request rejected");
      setSelectedPayout(null);
      loadPayouts();
    } catch (error) {
      toast.error(error.message || "Failed to reject payout");
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = payoutRequests.filter(p => {
    const matchSearch = !search || 
      p.seller_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.seller_email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  const pendingCount = payoutRequests.filter(p => p.status === "pending").length;
  const pendingTotal = payoutRequests
    .filter(p => p.status === "pending")
    .reduce((sum, p) => sum + (p.amount_requested || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-black text-2xl">Resale Payout Requests</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingCount} pending · ${pendingTotal.toFixed(2)} total
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search seller name or email..."
            className="pl-9 bg-secondary border-border/50"
          />
        </div>
        <div className="flex gap-1.5">
          {["all", "pending", "approved", "completed", "rejected"].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                statusFilter === status
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {["Seller", "Amount", "Method", "Status", "Date", "Action"].map(h => (
                  <th key={h} className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                    No payout requests found
                  </td>
                </tr>
              )}
              {filtered.map(payout => (
                <tr key={payout.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                  <td className="p-3">
                    <p className="font-medium text-xs">{payout.seller_name}</p>
                    <p className="text-[10px] text-muted-foreground">{payout.seller_email}</p>
                  </td>
                  <td className="p-3 font-mono text-xs font-bold text-primary">${payout.amount_requested.toFixed(2)}</td>
                  <td className="p-3 text-xs">{payout.payout_method.replace(/_/g, " ").toUpperCase()}</td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                        payout.status === "completed"
                          ? "bg-green-400/10 text-green-400"
                          : payout.status === "approved"
                          ? "bg-blue-400/10 text-blue-400"
                          : payout.status === "rejected"
                          ? "bg-red-400/10 text-red-400"
                          : "bg-yellow-400/10 text-yellow-400"
                      }`}
                    >
                      {payout.status}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-[10px] text-muted-foreground">
                    {format(new Date(payout.created_date), "MMM dd, yyyy")}
                  </td>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPayout(payout)}
                      className="text-xs"
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedPayout && (
        <Dialog open={!!selectedPayout} onOpenChange={() => setSelectedPayout(null)}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display font-black">Payout Request Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Seller</p>
                <p className="font-medium">{selectedPayout.seller_name}</p>
                <p className="text-xs text-muted-foreground">{selectedPayout.seller_email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="font-mono font-bold text-lg text-primary">${selectedPayout.amount_requested.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Payout Method</p>
                <p className="font-medium">{selectedPayout.payout_method.replace(/_/g, " ").toUpperCase()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Details</p>
                <p className="font-mono text-xs bg-secondary p-2 rounded whitespace-pre-wrap break-words">
                  {selectedPayout.payout_details}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium">{selectedPayout.status.toUpperCase()}</p>
              </div>
              {selectedPayout.notes && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Admin Notes</p>
                  <p className="text-sm">{selectedPayout.notes}</p>
                </div>
              )}

              {selectedPayout.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => handleAprovePayout(selectedPayout)}
                    disabled={processingId === selectedPayout.id}
                    className="flex-1 gap-2"
                  >
                    <Check className="w-4 h-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const reason = prompt("Reason for rejection:");
                      if (reason) handleRejectPayout(selectedPayout, reason);
                    }}
                    disabled={processingId === selectedPayout.id}
                    className="flex-1 gap-2 text-destructive"
                  >
                    <X className="w-4 h-4" /> Reject
                  </Button>
                </div>
              )}

              {selectedPayout.status === "approved" && (
                <Button
                  onClick={() => handleCompletePayout(selectedPayout)}
                  disabled={processingId === selectedPayout.id}
                  className="w-full glow-lime font-bold"
                >
                  Mark As Completed
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}