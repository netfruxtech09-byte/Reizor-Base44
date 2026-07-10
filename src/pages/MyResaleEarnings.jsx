import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DollarSign, History, Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";
import { detectIsIOS } from "@/hooks/useIsIOS";

export default function MyResaleEarnings() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [submittingPayout, setSubmittingPayout] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser) {
        base44.auth.redirectToLogin();
        return;
      }
      setUser(currentUser);

      // Load balance
      const balances = await base44.entities.ResaleSellerBalance.filter(
        { seller_email: currentUser.email },
        null,
        1
      ).catch(() => []);
      setBalance(balances[0] || null);

      // Load transactions
      const txs = await base44.entities.ResaleWalletTransaction.filter(
        { seller_email: currentUser.email },
        "-created_date",
        100
      ).catch(() => []);
      setTransactions(txs);

      // Load payout requests
      const payouts = await base44.entities.ResaleSellerPayoutRequest.filter(
        { seller_email: currentUser.email },
        "-created_date",
        50
      ).catch(() => []);
      setPayoutRequests(payouts);

      setLoading(false);
    } catch (error) {
      console.error("Failed to load data:", error);
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    const amount = parseFloat(payoutAmount);
    if (!balance || amount > balance.available_balance) {
      toast.error("Insufficient balance");
      return;
    }

    if (!payoutDetails.trim()) {
      toast.error("Enter payout details");
      return;
    }

    setSubmittingPayout(true);
    try {
      await base44.entities.ResaleSellerPayoutRequest.create({
        seller_email: user.email,
        seller_name: user.full_name || user.email,
        amount_requested: amount,
        payout_method: payoutMethod,
        payout_details: payoutDetails,
        status: "pending",
      });

      toast.success("Payout request submitted! Admin will review shortly.");
      setPayoutAmount("");
      setPayoutDetails("");
      setShowPayoutForm(false);
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to submit payout request");
    } finally {
      setSubmittingPayout(false);
    }
  };

  if (detectIsIOS()) return null;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const availableBalance = balance?.available_balance || 0;
  const totalEarned = balance?.total_earned || 0;
  const totalPaidOut = balance?.total_paid_out || 0;

  const pendingPayouts = payoutRequests.filter(p => p.status === "pending");
  const pendingAmount = pendingPayouts.reduce((sum, p) => sum + (p.amount_requested || 0), 0);

  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6 max-w-4xl mx-auto py-8">
      <div>
        <h1 className="font-display font-black text-4xl tracking-tight flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-primary" /> RESALE EARNINGS
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your ticket resale balance and payouts</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-card border border-primary/30 space-y-2">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Available Balance</p>
          <p className="font-display font-black text-3xl text-primary">${availableBalance.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Ready to withdraw</p>
        </div>
        <div className="p-5 rounded-xl bg-card border border-accent/30 space-y-2">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Pending Payout</p>
          <p className="font-display font-black text-3xl text-accent">${pendingAmount.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">{pendingPayouts.length} request(s)</p>
        </div>
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-2">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Total Earned</p>
          <p className="font-display font-black text-3xl text-foreground">${totalEarned.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">All time</p>
        </div>
      </div>

      {/* Request Payout Button */}
      {availableBalance > 0 && (
        <Button
          onClick={() => setShowPayoutForm(true)}
          className="w-full glow-lime font-display font-bold gap-2 h-11"
        >
          <Send className="w-4 h-4" /> Request Payout
        </Button>
      )}

      {/* Payout Form Modal */}
      {showPayoutForm && (
        <Dialog open={showPayoutForm} onOpenChange={setShowPayoutForm}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display font-black">Request Payout</DialogTitle>
              <DialogDescription>Enter your payout details and amount</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Amount (Max: ${availableBalance.toFixed(2)})</Label>
                <Input
                  type="number"
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(e.target.value)}
                  placeholder="0.00"
                  max={availableBalance}
                  step="0.01"
                  className="mt-1 bg-secondary border-border/50"
                />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Payout Method</Label>
                <select
                  value={payoutMethod}
                  onChange={e => setPayoutMethod(e.target.value)}
                  className="w-full mt-1 rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="paypal">PayPal</option>
                  <option value="check">Check</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">
                  {payoutMethod === "bank_transfer" && "Bank Account Details (routing #, account #)"}
                  {payoutMethod === "paypal" && "PayPal Email"}
                  {payoutMethod === "check" && "Mailing Address"}
                </Label>
                <textarea
                  value={payoutDetails}
                  onChange={e => setPayoutDetails(e.target.value)}
                  placeholder="Enter details..."
                  className="w-full mt-1 rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm resize-none h-24"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPayoutForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRequestPayout}
                  disabled={submittingPayout}
                  className="flex-1 glow-lime font-bold"
                >
                  {submittingPayout ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Payout Requests */}
      {payoutRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <History className="w-5 h-5" /> PAYOUT REQUESTS
          </h2>
          <div className="space-y-2">
            {payoutRequests.map(payout => (
              <div
                key={payout.id}
                className="p-4 rounded-lg bg-card border border-border/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">${payout.amount_requested.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {payout.payout_method.replace("_", " ").toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                        payout.status === "completed"
                          ? "bg-green-400/10 text-green-400"
                          : payout.status === "approved"
                          ? "bg-blue-400/10 text-blue-400"
                          : payout.status === "rejected"
                          ? "bg-red-400/10 text-red-400"
                          : "bg-yellow-400/10 text-yellow-400"
                      }`}
                    >
                      {payout.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(payout.created_date), "MMM dd, yyyy")}
                </p>
                {payout.rejected_reason && (
                  <div className="flex gap-2 p-2 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{payout.rejected_reason}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wallet Transactions */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-lg">TRANSACTION HISTORY</h2>
          <div className="rounded-lg bg-card border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Date", "Event", "Type", "Amount", "Status"].map(h => (
                      <th key={h} className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {format(new Date(tx.created_date), "MMM dd, yyyy")}
                      </td>
                      <td className="p-3 text-xs max-w-[200px] truncate">{tx.event_title || "—"}</td>
                      <td className="p-3 font-mono text-xs">
                        {tx.transaction_type === "credit" ? "✓ Credited" : tx.transaction_type === "debit" ? "✓ Paid Out" : "✗ Reversed"}
                      </td>
                      <td className="p-3 font-mono text-xs font-bold text-primary">
                        {tx.transaction_type === "credit" || tx.transaction_type === "debit" ? "+" : "-"}$
                        {Math.abs(tx.amount).toFixed(2)}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-green-400/10 text-green-400">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {availableBalance === 0 && totalEarned === 0 && (
        <div className="text-center py-12 text-muted-foreground space-y-3">
          <DollarSign className="w-8 h-8 mx-auto opacity-50" />
          <p>No resale earnings yet</p>
          <p className="text-xs">When you sell a ticket, your earnings will appear here.</p>
        </div>
      )}
    </div>
  );
}