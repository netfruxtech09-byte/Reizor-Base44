/**
 * VideoBudgetManager
 *
 * Shown in owner dashboards (organizer / artist).
 * Lets the owner:
 *  - View current budget / used / remaining
 *  - Set an initial budget (pay via Stripe)
 *  - Add more funds (pay via Stripe)
 */
import { useState, useEffect, useCallback } from "react";
import { DollarSign, Zap, PauseCircle, CheckCircle2, Loader2, Plus, Info, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import StripePaymentModal from "@/components/shared/StripePaymentModal";
import { detectIsIOS } from "@/hooks/useIsIOS";

const PRESET_AMOUNTS = [5, 10, 25, 50];

function StatusBadge({ status }) {
  if (status === "active") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-green-400/15 text-green-400 border border-green-400/20">
      <CheckCircle2 className="w-3 h-3" /> Active
    </span>
  );
  if (status === "paused") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-destructive/15 text-destructive border border-destructive/20">
      <PauseCircle className="w-3 h-3" /> Paused — budget limit reached
    </span>
  );
  if (status === "legacy") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-muted/40 text-muted-foreground border border-border/40">
      <Zap className="w-3 h-3" /> Legacy (active)
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-yellow-400/15 text-yellow-400 border border-yellow-400/20">
      <Info className="w-3 h-3" /> No budget set
    </span>
  );
}

export default function VideoBudgetManager({
  videoUrl,
  videoTitle = "",
  fileSizeBytes = 0,
  contextType = "other",
  contextId = "",
  ownerType = "organizer",
}) {
  const [budget, setBudget] = useState(null);
  const [storageUsage, setStorageUsage] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [paying, setPaying] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [pendingPaymentIntentId, setPendingPaymentIntentId] = useState(null);
  const [pendingBudgetId, setPendingBudgetId] = useState(null);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(100);
  const [topUpping, setTopUpping] = useState(false);
  const [isTopUpPayment, setIsTopUpPayment] = useState(false);

  const [streaming, setStreaming] = useState(null);

  const loadBudget = useCallback(async () => {
    if (!videoUrl) return;
    setLoading(true);
    const [budgetRes, accountRes] = await Promise.all([
      base44.functions.invoke("videoBudgetPayment", { action: "get_budget", video_url: videoUrl }),
      base44.functions.invoke("videoMinuteBilling", { action: "get_account_usage", video_url: videoUrl, video_id: contextId }).catch(() => null),
    ]);
    setBudget(budgetRes.data?.budget || null);
    setStorageUsage(budgetRes.data?.storage_usage || null);
    setSettings(budgetRes.data?.settings || { price_per_gb: 0.10, enforcement_enabled: false, free_gb_per_month: 10 });
    
    // Account-level streaming usage (no plans needed)
    const acct = accountRes?.data?.account_usage || {};
    const pricing = accountRes?.data?.pricing || {};
    setStreaming({
      pricing,
      total_used: acct.total_used ?? 0,
      free_used: acct.free_used ?? 0,
      free_limit: acct.free_limit ?? 0,
      free_remaining: acct.free_remaining ?? 0,
      billable: acct.billable ?? 0,
      billable_credit: acct.billable_credit_remaining ?? 0,
      session_count: acct.session_count ?? 0,
    });
    setLoading(false);
  }, [videoUrl]);

  useEffect(() => { loadBudget(); }, [loadBudget]);

  const finalAmount = useCustom ? parseFloat(customAmount) : selectedAmount;

  const handleInitiatePayment = async () => {
    if (!finalAmount || finalAmount < 1) {
      toast.error("Minimum budget is $1");
      return;
    }
    setPaying(true);
    const res = await base44.functions.invoke("videoBudgetPayment", {
      action: "create_payment_intent",
      video_url: videoUrl,
      video_title: videoTitle,
      amount: finalAmount,
      file_size_bytes: fileSizeBytes,
      context_type: contextType,
      context_id: contextId,
      owner_type: ownerType,
    });
    setPaying(false);

    if (!res.data?.client_secret) {
      toast.error("Failed to create payment. Please try again.");
      return;
    }
    setClientSecret(res.data.client_secret);
    setPendingPaymentIntentId(res.data.payment_intent_id);
    setPendingBudgetId(res.data.budget_id);
    setPendingAmount(finalAmount);
    setIsTopUpPayment(false);
    setShowPayModal(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPayModal(false);
    // Confirm payment server-side
    const res = await base44.functions.invoke("videoBudgetPayment", {
      action: "confirm_payment",
      payment_intent_id: pendingPaymentIntentId,
      budget_id: pendingBudgetId,
      amount: pendingAmount,
    });
    if (res.data?.success) {
      toast.success(`$${pendingAmount.toFixed(2)} added to video budget!`);
      setBudget(res.data.budget);
    } else {
      toast.error("Payment recorded by Stripe but budget update failed. Contact support.");
    }
    setClientSecret(null);
  };

  const handlePaymentCancel = () => {
    setShowPayModal(false);
    setClientSecret(null);
    toast.info("Payment cancelled — budget not changed.");
  };

  const handleTopUpInitiate = async () => {
    if (!topUpAmount || topUpAmount < 1) {
      toast.error("Minimum is 1 minute");
      return;
    }
    setTopUpping(true);
    try {
      const res = await base44.functions.invoke("videoMinuteBilling", {
        action: "create_account_checkout",
        minutes: topUpAmount,
      });
      setTopUpping(false);

      // Check for backend validation errors
      if (res.data?.error) {
        // Detect minimum charge error and show friendly message
        if (res.data.error.includes("Minimum charge")) {
          const minMinutes = (res.data.error.match(/\d+/))?.[0];
          toast.error(`Minimum purchase is $0.50${minMinutes ? ` (${minMinutes} minutes at current rate)` : ""}. Please add more minutes.`);
        } else {
          toast.error(res.data.error);
        }
        return;
      }

      if (!res.data?.client_secret) {
        toast.error("Failed to create payment. Please try again.");
        return;
      }
      setClientSecret(res.data.client_secret);
      setPendingPaymentIntentId(res.data.payment_intent_id);
      setPendingBudgetId(res.data.plan_id);
      setPendingAmount(topUpAmount);
      setIsTopUpPayment(true);
      setShowPayModal(true);
      setShowTopUpModal(false);
    } catch (e) {
      setTopUpping(false);
      toast.error("Payment setup failed. Please try again.");
    }
  };

  const handleTopUpPaymentSuccess = async () => {
    setShowPayModal(false);
    const res = await base44.functions.invoke("videoMinuteBilling", {
      action: "confirm_payment",
      payment_intent_id: pendingPaymentIntentId,
      plan_id: pendingBudgetId,
      minutes: pendingAmount,
    });
    if (res.data?.success) {
      toast.success(`${pendingAmount} streaming minutes added!`);
    } else {
      toast.error("Payment was processed but activation failed. Contact support.");
    }
    setClientSecret(null);
    loadBudget();
  };

  if (detectIsIOS()) return null;
  if (!videoUrl) return null;

  if (loading) return (
    <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground font-mono">
      <Loader2 className="w-3 h-3 animate-spin" /> Loading budget info...
    </div>
  );

  const pct = budget?.budget_amount > 0
    ? Math.min(100, ((budget.used_amount || 0) / budget.budget_amount) * 100)
    : 0;

  // Calculate free storage remaining
  const freeGBLimit = settings?.free_gb_per_month || 10;
  const usedGB = storageUsage?.total_used_gb || 0;
  const remainingFreeGB = Math.max(0, freeGBLimit - usedGB);
  const withinFreeStorage = remainingFreeGB > 0;
  const pricePerGB = settings?.price_per_gb || 0.10;

  return (
    <div className="rounded-xl bg-card border border-border/40 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-primary shrink-0" />
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Storage & Budget</p>
      </div>

      {/* Free storage info — always shown first */}
      <div className="space-y-2 p-3 rounded-lg bg-green-400/8 border border-green-400/20">
        <p className="text-xs font-mono font-bold text-green-400">FREE STORAGE (PER ACCOUNT)</p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="text-muted-foreground font-mono text-[10px]">Free Limit</p>
            <p className="font-display font-bold text-sm">{freeGBLimit}GB</p>
          </div>
          <div>
            <p className="text-muted-foreground font-mono text-[10px]">Used</p>
            <p className="font-display font-bold text-sm">{usedGB.toFixed(2)}GB</p>
          </div>
          <div>
            <p className="text-muted-foreground font-mono text-[10px]">Remaining</p>
            <p className={`font-display font-bold text-sm ${withinFreeStorage ? "text-green-400" : "text-destructive"}`}>
              {remainingFreeGB.toFixed(2)}GB
            </p>
          </div>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${usedGB >= freeGBLimit ? "bg-destructive" : "bg-green-400"}`}
            style={{ width: `${Math.min(100, (usedGB / freeGBLimit) * 100)}%` }}
          />
        </div>
        {withinFreeStorage ? (
          <p className="text-[10px] font-mono text-green-400 mt-2">
            ✓ Your upload uses the account-level free storage. You won't be charged.
          </p>
        ) : (
          <p className="text-[10px] font-mono text-yellow-400 mt-2">
            ⚠ Your account free storage is full. Paid usage (${pricePerGB.toFixed(2)}/GB) starts with new uploads.
          </p>
        )}
      </div>

      {/* Streaming Minutes section — fully automatic, account-level */}
      {(() => {
        const freeLimit = streaming?.free_limit ?? 500;
        const freeUsed = streaming?.free_used ?? 0;
        const freeRemaining = streaming?.free_remaining ?? 500;
        const totalUsed = streaming?.total_used ?? 0;
        const billable = streaming?.billable ?? 0;
        const billableCredit = streaming?.billable_credit ?? 0;
        const sessionCount = streaming?.session_count ?? 0;
        const withinFree = freeRemaining > 0;

        return (
          <div className="space-y-2 p-3 rounded-lg bg-accent/8 border border-accent/20">
            <div className="flex items-center gap-2">
              <Play className="w-3.5 h-3.5 text-accent shrink-0" />
              <p className="text-xs font-mono font-bold text-accent">STREAMING MINUTES (PER ACCOUNT)</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-muted-foreground font-mono text-[10px]">Free Limit</p>
                <p className="font-display font-bold text-sm">{freeLimit} min</p>
              </div>
              <div>
                <p className="text-muted-foreground font-mono text-[10px]">Used</p>
                <p className="font-display font-bold text-sm">{freeUsed.toFixed(1)} min</p>
              </div>
              <div>
                <p className="text-muted-foreground font-mono text-[10px]">Remaining</p>
                <p className={`font-display font-bold text-sm ${!withinFree ? "text-destructive" : "text-accent"}`}>
                  {freeRemaining.toFixed(1)} min
                </p>
              </div>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${!withinFree ? "bg-destructive" : "bg-accent"}`}
                style={{ width: `${Math.min(100, Math.max(2, (freeUsed / freeLimit) * 100))}%` }}
              />
            </div>
            {withinFree ? (
              <p className="text-[10px] font-mono text-accent mt-2">
                ✓ Streaming uses your monthly free minutes. No charges. {sessionCount > 0 && `(${sessionCount} sessions)`}
              </p>
            ) : billableCredit > 0 ? (
              <p className="text-[10px] font-mono text-green-400 mt-2">
                ✓ Free limit reached. Using billable credit — {billableCredit.toFixed(0)} min remaining.
              </p>
            ) : (
              <div className="mt-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                <p className="text-[10px] font-mono font-bold text-destructive uppercase">
                  STREAMING EXHAUSTED — VIDEOS ARE NO LONGER PUBLICLY PLAYABLE
                </p>
                <p className="text-[10px] font-mono text-destructive/80">
                  Free minutes and billable credit are both at zero. Fans see "Video Currently Unavailable" instead of your videos.
                </p>
                <p className="text-[10px] font-mono text-white/60">
                  Rate: ${(streaming?.pricing?.per_minute_rate || 0.0016).toFixed(4)}/min · {totalUsed.toFixed(0)} min used this month
                </p>
                <Button
                  onClick={() => setShowTopUpModal(true)}
                  className="w-full gap-2 font-display font-bold glow-lime mt-2"
                  size="sm"
                >
                  <Plus className="w-4 h-4" /> Top Up Streaming Minutes — from $0.50
                </Button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Budget stats — shown if budget is set */}
      {budget && budget.status !== "no_budget" ? (
        <div className="space-y-2 p-3 rounded-lg bg-primary/8 border border-primary/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono font-bold text-primary uppercase">Video Bandwidth Budget</p>
            <StatusBadge status={budget.status} />
          </div>
          {budget.estimated_view_count > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground block">{budget.estimated_view_count} views tracked</span>
          )}

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded bg-secondary/60 p-2">
              <p className="text-[10px] font-mono text-muted-foreground">Budget</p>
              <p className="font-display font-bold text-sm">${(budget.budget_amount || 0).toFixed(2)}</p>
            </div>
            <div className="rounded bg-secondary/60 p-2">
              <p className="text-[10px] font-mono text-muted-foreground">Used</p>
              <p className="font-display font-bold text-sm text-yellow-400">${(budget.used_amount || 0).toFixed(2)}</p>
            </div>
            <div className="rounded bg-secondary/60 p-2">
              <p className="text-[10px] font-mono text-muted-foreground">Remaining</p>
              <p className={`font-display font-bold text-sm ${(budget.remaining_amount || 0) <= 0 ? "text-destructive" : "text-green-400"}`}>
                ${(budget.remaining_amount || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Usage bar */}
          {budget.budget_amount > 0 && (
            <div className="space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-yellow-400" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground text-right">{pct.toFixed(0)}% of budget used</p>
            </div>
          )}

          {budget.status === "paused" && (
            <div className="p-2.5 rounded text-xs font-mono text-destructive">
              ⚠ Video paused — bandwidth budget limit reached. Add funds below to resume.
            </div>
          )}
        </div>
      ) : (
        withinFreeStorage && (
          <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs font-mono text-muted-foreground">
            <p className="font-bold mb-1">Budget is optional while you have free storage.</p>
            <p>You can set a bandwidth budget later to control costs after your free allowance is used.</p>
          </div>
        )
      )}

      {/* Amount picker — only show if budget already set or free storage is full */}
      {!withinFreeStorage || (budget && budget.budget_amount > 0) ? (
        <div className="space-y-2 pt-2 border-t border-border/30">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            {budget && budget.budget_amount > 0 ? "Add Bandwidth Funds" : "Set Bandwidth Budget"}
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_AMOUNTS.map(amt => (
              <button
                key={amt}
                onClick={() => { setSelectedAmount(amt); setUseCustom(false); }}
                className={`px-3 py-1.5 rounded-lg border text-sm font-mono font-bold transition-all ${
                  !useCustom && selectedAmount === amt
                    ? "bg-primary border-primary text-white"
                    : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
                }`}
              >
                ${amt}
              </button>
            ))}
            <button
              onClick={() => setUseCustom(true)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-mono font-bold transition-all ${
                useCustom ? "bg-primary border-primary text-white" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
              }`}
            >
              Custom
            </button>
          </div>
          {useCustom && (
            <input
              type="number"
              min="1"
              step="1"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              placeholder="Enter amount in USD"
              className="w-full h-9 rounded-md border border-white/25 bg-secondary px-3 text-sm text-foreground focus:outline-none focus:border-primary"
            />
          )}
          <p className="text-[10px] font-mono text-muted-foreground">
            Bandwidth budget controls costs after free storage is used. At ${pricePerGB.toFixed(2)}/GB, $10 = ~{((10 / pricePerGB) || 0).toFixed(1)}GB of bandwidth.
          </p>

          <Button
            onClick={handleInitiatePayment}
            disabled={paying || !finalAmount || finalAmount < 1}
            className="w-full gap-2 font-display font-bold glow-lime"
          >
            {paying ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : (
              <><Plus className="w-4 h-4" /> {budget?.budget_amount > 0 ? "Add Funds" : "Set Budget"} — ${(finalAmount || 0).toFixed(2)}</>
            )}
          </Button>
        </div>
      ) : null}

      {/* Top-up minutes picker modal */}
      {showTopUpModal && (() => {
        const perMinRate = streaming?.pricing?.per_minute_rate || 0.0016;
        const minMinutes = Math.ceil(0.50 / perMinRate);
        const belowMin = topUpAmount > 0 && topUpAmount < minMinutes;
        const estCost = (topUpAmount || 0) * perMinRate;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowTopUpModal(false)}>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-display font-bold text-lg">Top Up Streaming Minutes</h3>
              <p className="text-sm text-muted-foreground">
                Purchase billable credit minutes. These are used after your monthly free minutes are exhausted.
              </p>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Minutes to purchase</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {[minMinutes, 500, 1000, 2000].map(min => (
                    <button key={min} onClick={() => setTopUpAmount(min)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-mono font-bold transition-all ${topUpAmount === min ? "bg-primary border-primary text-white" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"}`}>
                      {min} min
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Input type="number" min={minMinutes} value={topUpAmount} onChange={e => setTopUpAmount(parseInt(e.target.value) || 0)}
                    className={`bg-secondary border-border/50 h-9 ${belowMin ? "border-destructive" : ""}`} />
                  <span className="text-xs font-mono text-muted-foreground shrink-0">minutes</span>
                </div>
                {belowMin && (
                  <p className="text-xs text-destructive mt-1.5">
                    Minimum purchase is $0.50. Please increase to at least {minMinutes} minutes.
                  </p>
                )}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                Rate: ${perMinRate.toFixed(4)}/min · Est. cost: ${estCost.toFixed(2)}
                {belowMin && <span className="text-destructive"> (below $0.50 minimum)</span>}
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowTopUpModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleTopUpInitiate} disabled={topUpping || belowMin || !topUpAmount || topUpAmount < 1} className="flex-1 glow-lime font-bold gap-2">
                  {topUpping ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : `Pay $${estCost.toFixed(2)}`}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stripe payment modal */}
      {showPayModal && clientSecret && (
        <StripePaymentModal
          isOpen={showPayModal}
          clientSecret={clientSecret}
          amount={pendingAmount}
          description={isTopUpPayment ? `Streaming minutes: ${pendingAmount} min` : `Video budget: ${videoTitle || "video"}`}
          onSuccess={isTopUpPayment ? handleTopUpPaymentSuccess : handlePaymentSuccess}
          onClose={handlePaymentCancel}
        />
      )}
    </div>
  );
}