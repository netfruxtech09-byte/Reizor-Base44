import { useState, useEffect } from "react";
import { AlertTriangle, Loader2, DollarSign, X, CreditCard, Lock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import AddPaymentMethodModal from "@/components/shared/AddPaymentMethodModal";
import ModalPortal from "@/components/shared/ModalPortal";
import { detectIsIOS } from "@/hooks/useIsIOS";

const TERMS_VERSION = "v3";
const CHARGE_AMOUNT = 1;
const POLICY_TEXT = `AI flyer generation may create processing costs. If you continue and do not publish or complete the event, the generation charge will still be made to your payment method on file. AI generation charges are non-refundable once processing starts.`;
const CHECKBOX_LABEL = `I understand and agree that $${CHARGE_AMOUNT}.00 will be charged immediately to my payment method on file. This charge is non-refundable once AI generation starts.`;

let _stripePromise = null;
async function getStripePromise() {
  if (_stripePromise) return _stripePromise;
  const res = await base44.functions.invoke("stripePublicConfig", {});
  const key = res.data?.publishableKey;
  if (!key) throw new Error("Stripe not configured");
  _stripePromise = loadStripe(key);
  return _stripePromise;
}

const stripeAppearance = {
  theme: "night",
  variables: {
    colorPrimary: "#ff1b8d",
    colorBackground: "#0d1024",
    colorText: "#f0f0f0",
    colorDanger: "#ef4444",
    fontFamily: "Inter, sans-serif",
    borderRadius: "8px",
  },
  rules: {
    ".Input": { border: "1px solid rgba(255,255,255,0.2)", backgroundColor: "#131929" },
    ".Input:focus": { border: "1px solid #ff1b8d", boxShadow: "0 0 0 1px #ff1b8d" },
    ".Label": { color: "#a0a8c0" },
  },
};

// Inner Stripe payment form (new card)
function NewCardForm({ onSuccess, onCancel, onProcessingChange }) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || status === "processing") return;
    setStatus("processing");
    setErrorMsg("");
    onProcessingChange?.(true);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setErrorMsg(submitError.message || "Payment failed. Please try again.");
        setStatus("failed");
        onProcessingChange?.(false);
        return;
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (error) {
        const msg = error.message || "Payment declined. Please use a different card.";
        setErrorMsg(msg);
        setStatus("failed");
        onProcessingChange?.(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        setStatus("succeeded");
        onSuccess(paymentIntent.id, null);
        return;
      }

      setErrorMsg(`Payment status: ${paymentIntent?.status || "unknown"}. Please try again.`);
      setStatus("failed");
      onProcessingChange?.(false);
    } catch (err) {
      setErrorMsg(err?.message || "A network error occurred. Please try again.");
      setStatus("failed");
      onProcessingChange?.(false);
    }
  };

  if (status === "succeeded") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="w-12 h-12 rounded-full bg-green-400/10 border border-green-400/30 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-green-400" />
        </div>
        <p className="font-display font-black text-green-400">Payment Successful</p>
        <p className="text-xs text-muted-foreground font-mono">Starting AI generation…</p>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <div className={status === "processing" ? "opacity-50 pointer-events-none" : ""}>
        <PaymentElement
          options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never" } }}
          onChange={() => { if (errorMsg) setErrorMsg(""); }}
        />
      </div>

      {errorMsg && (
        <div className="flex gap-2 items-start p-3 rounded-lg bg-destructive/10 border border-destructive/40 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {status === "processing" && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-mono">Processing payment…</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={status === "processing" || !stripe} className="flex-1 glow-lime font-display font-bold">
          {status === "processing" ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Processing…</> :
           status === "failed" ? <><RefreshCw className="w-4 h-4 mr-1" />Retry — Pay $1</> :
           "Pay $1.00 & Generate"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={status === "processing"}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Main Modal ──
export default function AIFlyerChargeModal({ eventId, actionType = "generation", onConfirmed, onCancel }) {
  const [phase, setPhase] = useState("loading"); // loading | no_pm | policy | paying | success | error
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creditStatus, setCreditStatus] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [creditRecordId, setCreditRecordId] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [stripeInstance, setStripeInstance] = useState(null);
  const [stripeLoadError, setStripeLoadError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showAddCard, setShowAddCard] = useState(false);
  const [hasSavedCard, setHasSavedCard] = useState(false);
  const [savedCardInfo, setSavedCardInfo] = useState(null); // { brand, lastFour }
  const [needs3DS, setNeeds3DS] = useState(false);
  const [piClientSecret, setPiClientSecret] = useState(null);

  // Load credit status + payment method check on mount
  useEffect(() => {
    base44.functions.invoke("aiFlyerPayment", { action: "check_credit", eventId: eventId || "" })
      .then(res => {
        setCreditStatus(res.data);
        if (!res.data?.has_payment_method) {
          setPhase("no_pm");
        } else {
          setPhase("policy");
        }
      })
      .catch(() => setPhase("policy")); // fallback: show policy, payment will catch issues
  }, [eventId]);

  // Accept policy → create PaymentIntent + try saved card or load Stripe form
  const handleAcceptPolicy = async (skipCheck = false) => {
    if (!skipCheck && !checked) return;
    setSaving(true);
    try {
      // Save acknowledgement
      await base44.functions.invoke("aiFlyerPayment", {
        action: "save_acknowledgement",
        eventId: eventId || "",
        acknowledgementText: POLICY_TEXT,
        termsVersion: TERMS_VERSION,
        actionType,
        chargeAmount: CHARGE_AMOUNT,
      }).catch(() => {});

      // Create PaymentIntent
      const res = await base44.functions.invoke("aiFlyerPayment", {
        action: "create_payment_intent",
        eventId: eventId || "",
      });

      setClientSecret(res.data.clientSecret);
      setCreditRecordId(res.data.creditRecordId);
      setPaymentIntentId(res.data.paymentIntentId);
      setHasSavedCard(res.data.hasSavedCard || false);
      if (res.data.hasSavedCard && res.data.savedCardBrand) {
        setSavedCardInfo({ brand: res.data.savedCardBrand, lastFour: res.data.savedCardLastFour });
      }

      // If user has a saved card, try server-side confirmation first
      if (res.data.hasSavedCard) {
        setSaving(false);
        tryConfirmWithSavedCard(res.data.creditRecordId, res.data.paymentIntentId);
        return;
      }

      // No saved card — load Stripe Elements form
      const stripe = await getStripePromise();
      setStripeInstance(stripe);
      setPhase("paying");
      setSaving(false);
    } catch (err) {
      setErrorMsg(err?.message || "Failed to set up payment. Please try again.");
      setPhase("error");
      setSaving(false);
    }
  };

  // Try to confirm payment with the saved card (server-side, no new card form)
  const tryConfirmWithSavedCard = async (cid, piId) => {
    setIsProcessing(true);
    try {
      const res = await base44.functions.invoke("aiFlyerPayment", {
        action: "confirm_with_saved_card",
        creditRecordId: cid,
        paymentIntentId: piId,
      });

      if (res.data?.success) {
        // Payment succeeded server-side
        setPhase("success");
        setTimeout(() => onConfirmed(cid), 1200);
        return;
      }

      if (res.data?.status === 'requires_action') {
        // 3DS auth required — show Stripe payment form for authentication
        setNeeds3DS(true);
        setPiClientSecret(res.data.clientSecret);
        const stripe = await getStripePromise();
        setStripeInstance(stripe);
        setPhase("paying");
        setIsProcessing(false);
        return;
      }

      throw new Error(res.data?.error || "Payment failed");
    } catch (err) {
      setErrorMsg(err?.message || "Payment was declined. Please try a different card.");
      setPhase("error");
      setIsProcessing(false);
    }
  };

  // Called when Stripe payment succeeds
  const handlePaymentSuccess = async (piId, pmId) => {
    try {
      // Confirm payment on backend (verifies with Stripe + marks credit as charged)
      const res = await base44.functions.invoke("aiFlyerPayment", {
        action: "confirm_payment",
        eventId: eventId || "",
        creditRecordId,
        paymentIntentId: piId || paymentIntentId,
        paymentMethodId: pmId || "",
      });

      if (!res.data?.success) {
        throw new Error(res.data?.error || "Payment confirmation failed");
      }

      setPhase("success");
      // Short delay then call onConfirmed with the credit record ID
      setTimeout(() => onConfirmed(creditRecordId), 1200);
    } catch (err) {
      // Notify admin of failure
      await base44.functions.invoke("aiFlyerPayment", {
        action: "notify_payment_failed",
        eventId: eventId || "",
        creditRecordId,
        amount: 1,
        reason: err?.message || "Confirmation failed",
      }).catch(() => {});

      setErrorMsg("Payment was declined. Please update your payment method and try again.");
      setPhase("error");
    }
  };

  if (detectIsIOS()) return null;

  return (
    <ModalPortal open={true} onBackdropClick={onCancel}>
      <div className="w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-2xl relative flex flex-col" style={{ maxHeight: 'calc(100dvh - var(--bottom-nav-height) - 32px)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-display font-black text-base">AI Flyer — $1.00 Charge</h3>
              <p className="text-[10px] font-mono text-muted-foreground">Charged immediately, non-refundable</p>
            </div>
          </div>
          {!isProcessing && phase !== "success" && (
            <button onClick={onCancel} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Loading */}
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-xs font-mono text-muted-foreground">Checking payment method…</p>
            </div>
          )}

          {/* No payment method on file */}
          {phase === "no_pm" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-yellow-400/5 border border-yellow-400/20 flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-yellow-400">No Payment Method on File</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    AI flyer generation ($1.00 per generation) requires a saved payment method. Add a card below — no charge is made until you confirm generation.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setShowAddCard(true)}
                  className="w-full gap-2 font-display font-bold glow-lime"
                >
                  <CreditCard className="w-4 h-4" /> Add Payment Method
                </Button>
                <Button variant="ghost" onClick={onCancel} className="w-full text-muted-foreground">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* AddPaymentMethodModal — shown as nested overlay */}
          {showAddCard && (
            <AddPaymentMethodModal
              onSuccess={(pmData) => {
                setShowAddCard(false);
                setCreditStatus(prev => ({
                  ...prev,
                  has_payment_method: true,
                  payment_method_brand: pmData?.card_brand || "card",
                  payment_method_last_four: pmData?.card_last_four || "****",
                }));
                setChecked(true);
                setPhase("policy");
                // Auto-proceed to payment — card was just added, no need to re-confirm terms
                handleAcceptPolicy(true);
              }}
              onCancel={async () => {
                setShowAddCard(false);
                // Re-check backend — card may have been saved even if onSuccess wasn't called
                try {
                  const res = await base44.functions.invoke("aiFlyerPayment", { action: "check_credit", eventId: eventId || "" });
                  setCreditStatus(res.data);
                  if (res.data?.has_payment_method) {
                    setChecked(true);
                    setPhase("policy");
                    handleAcceptPolicy(true);
                  } else {
                    setPhase("no_pm");
                  }
                } catch {
                  setPhase("no_pm");
                }
              }}
            />
          )}

          {/* Policy acceptance */}
          {phase === "policy" && (
            <div className="space-y-4">
              {/* Processing state — confirming with saved card */}
              {isProcessing ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <div>
                    <p className="font-display font-black text-lg">Processing Payment</p>
                    <p className="text-sm text-muted-foreground mt-1">Charging $1.00 to your saved card…</p>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">Please do not close this window</p>
                </div>
              ) : (<>
                {/* Payment method on file badge */}
                {creditStatus?.has_payment_method && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-400/10 border border-green-400/30 text-xs font-mono text-green-400">
                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                    Card on file: <span className="font-bold capitalize">{creditStatus.payment_method_brand} •••• {creditStatus.payment_method_last_four}</span>
                  </div>
                )}

                {/* Charge breakdown */}
                <div className="p-4 rounded-xl bg-yellow-400/5 border border-yellow-400/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-muted-foreground">AI flyer {actionType}</span>
                    <span className="font-display font-black text-yellow-400">$1.00</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono leading-relaxed border-t border-yellow-400/10 pt-2">
                    Charged immediately to your payment method on file — <strong>not</strong> deducted from payout. The charge applies even if the event is not published.
                  </p>
                </div>

                {/* Policy notice */}
                <div className="p-3 rounded-lg bg-secondary/50 border border-border/40">
                  <p className="text-xs text-muted-foreground leading-relaxed">{POLICY_TEXT}</p>
                </div>

                {/* Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer group" onClick={() => setChecked(v => !v)}>
                  <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${checked ? "bg-primary border-primary" : "border-border/70 bg-secondary group-hover:border-primary/50"}`}>
                    {checked && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span className="text-sm text-muted-foreground leading-relaxed">{CHECKBOX_LABEL}</span>
                </label>

                {!checked && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    <p className="text-xs text-destructive font-mono">You must accept the terms to continue.</p>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="w-3 h-3 shrink-0" />
                  <span className="font-mono">Payments processed securely by Stripe. We never store raw card details.</span>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleAcceptPolicy}
                    disabled={!checked || saving || isProcessing}
                    className="w-full h-11 font-display font-bold glow-lime"
                  >
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Setting up payment…</> : "Accept & Pay $1.00"}
                  </Button>
                  <Button variant="outline" onClick={onCancel} disabled={saving || isProcessing} className="w-full">
                    Cancel — Don't Generate
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground text-center font-mono leading-relaxed">
                  Your acceptance is recorded as a digital audit record (timestamp, device, terms v3).
                </p>
              </>)}
            </div>
          )}

          {/* Stripe payment form — saved card 3DS or new card */}
          {phase === "paying" && stripeInstance && clientSecret && (
            <div className="space-y-4">
              {/* Saved card: 3DS authentication needed */}
              {needs3DS && savedCardInfo ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-400/10 border border-green-400/30 text-xs font-mono text-green-400">
                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                    Charging saved {savedCardInfo.brand} •••• {savedCardInfo.lastFour}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono bg-secondary/50 p-3 rounded-lg">
                    Your bank requires additional authentication. You will be charged <strong>$1.00</strong>.
                  </p>
                  <Elements key={piClientSecret || clientSecret} stripe={stripeInstance} options={{ clientSecret: piClientSecret || clientSecret, appearance: stripeAppearance }}>
                    <NewCardForm
                      onSuccess={handlePaymentSuccess}
                      onCancel={onCancel}
                      onProcessingChange={setIsProcessing}
                    />
                  </Elements>
                </div>
              ) : needs3DS ? (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground font-mono bg-secondary/50 p-3 rounded-lg">
                    Additional authentication is required. You will be charged <strong>$1.00</strong>.
                  </p>
                  <Elements key={piClientSecret || clientSecret} stripe={stripeInstance} options={{ clientSecret: piClientSecret || clientSecret, appearance: stripeAppearance }}>
                    <NewCardForm
                      onSuccess={handlePaymentSuccess}
                      onCancel={onCancel}
                      onProcessingChange={setIsProcessing}
                    />
                  </Elements>
                </div>
              ) : (
                /* No saved card — show new card form */
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground font-mono bg-secondary/50 p-3 rounded-lg">
                    Enter your card details below. You will be charged <strong>$1.00</strong> now. Generation starts immediately after payment is confirmed.
                  </p>
                  <Elements key={clientSecret} stripe={stripeInstance} options={{ clientSecret, appearance: stripeAppearance }}>
                    <NewCardForm
                      onSuccess={handlePaymentSuccess}
                      onCancel={onCancel}
                      onProcessingChange={setIsProcessing}
                    />
                  </Elements>
                </div>
              )}
            </div>
          )}

          {phase === "paying" && (!stripeInstance || !clientSecret) && !stripeLoadError && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-xs font-mono text-muted-foreground">Loading secure payment form…</p>
            </div>
          )}

          {/* Success */}
          {phase === "success" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-green-400/10 border border-green-400/30 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-400" />
              </div>
              <div>
                <p className="font-display font-black text-lg text-green-400">Payment Confirmed!</p>
                <p className="text-sm text-muted-foreground mt-1">Starting AI flyer generation…</p>
              </div>
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error state */}
          {phase === "error" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-destructive">Payment was declined</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {errorMsg || "Please update your payment method and try again."}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => { setPhase("policy"); setChecked(false); setErrorMsg(""); }} className="w-full font-display font-bold">
                  Try Again
                </Button>
                <Button variant="outline" onClick={onCancel} className="w-full">Close</Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </ModalPortal>
  );
}