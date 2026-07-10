import { useState, useEffect, useRef } from "react";
import { X, Lock, Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { base44 } from "@/api/base44Client";
import ModalPortal from "@/components/shared/ModalPortal";

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

function friendlyError(error) {
  if (!error) return "Payment failed. Please try again.";
  if (error.decline_code === "live_mode_test_card") {
    return "This payment is in live mode. Test cards cannot be used. Please use a real card.";
  }
  const declineMap = {
    insufficient_funds: "Your card has insufficient funds. Please use a different card.",
    card_velocity_exceeded: "Too many attempts. Please try again later.",
    do_not_honor: "Your card was declined by your bank. Please contact your bank or use a different card.",
    expired_card: "Your card has expired. Please use a different card.",
    incorrect_cvc: "Incorrect CVC. Please check and try again.",
    stolen_card: "Your card was declined. Please use a different card.",
    lost_card: "Your card was declined. Please use a different card.",
    generic_decline: "Your card was declined. Please use a different card or contact your bank.",
  };
  if (error.decline_code && declineMap[error.decline_code]) return declineMap[error.decline_code];
  if (error.message) return error.message;
  return "Payment failed. Please try again.";
}

// States: "idle" | "processing" | "succeeded" | "failed" | "cancelled"
function InnerForm({ amount, onSuccess, onCancel, onProcessingChange }) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState("idle"); // drives the UI
  const [errorMsg, setErrorMsg] = useState("");
  const statusRef = useRef("idle"); // use ref to avoid stale closure in finally

  const setStatusSafe = (s) => {
    statusRef.current = s;
    setStatus(s);
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || statusRef.current === "processing") return;

    setStatusSafe("processing");
    setErrorMsg("");
    onProcessingChange?.(true);

    try {
      // elements.submit() triggers field-level validation only on demand (not on mount)
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setErrorMsg(friendlyError(submitError));
        setStatusSafe("failed");
        return;
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (error) {
        setErrorMsg(friendlyError(error));
        setStatusSafe("failed");
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        setStatusSafe("succeeded");
        onSuccess(paymentIntent.id);
        // Keep onProcessingChange(true) — outer X stays locked while backend confirms
        return;
      }

      if (paymentIntent?.status === "requires_payment_method") {
        setErrorMsg("Your card was declined. Please update your payment details and try again.");
        setStatusSafe("failed");
        return;
      }

      if (paymentIntent?.status === "requires_action") {
        setErrorMsg("Your card requires additional authentication. Please follow the on-screen steps.");
        setStatusSafe("failed");
        return;
      }

      // Any other status
      setErrorMsg(`Payment status: ${paymentIntent?.status || "unknown"}. Please contact support if charged.`);
      setStatusSafe("failed");

    } catch (err) {
      setErrorMsg(err?.message || "A network error occurred. Please check your connection and try again.");
      setStatusSafe("failed");
    } finally {
      // Reset processing lock only if we did NOT succeed
      if (statusRef.current !== "succeeded") {
        onProcessingChange?.(false);
      }
    }
  };

  const handleCancel = () => {
    setStatusSafe("cancelled");
    onCancel();
  };

  // ── Success screen ──
  if (status === "succeeded") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-400/10 border border-green-400/30 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-green-400" />
        </div>
        <div>
          <p className="font-display font-black text-lg text-green-400">Payment Successful</p>
          <p className="text-sm text-muted-foreground mt-1">Confirming your credit and starting generation…</p>
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Cancelled screen ──
  if (status === "cancelled") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="font-display font-bold text-muted-foreground">Payment cancelled.</p>
      </div>
    );
  }

  const isProcessing = status === "processing";

  // ── Card input / failed / retry screen ──
  return (
    <form onSubmit={handlePay} className="space-y-4">
      {/* Payment form instruction — shown only on initial load */}
      {!errorMsg && !isProcessing && (
        <p className="text-xs text-muted-foreground font-mono bg-secondary/50 p-3 rounded-lg">
          Your payment will be securely processed by Stripe after you enter your payment details and submit.
        </p>
      )}

      {/* PaymentElement — validation deferred until submit, not on mount */}
      <div className={isProcessing ? "opacity-50 pointer-events-none" : ""}>
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: { applePay: "never", googlePay: "never" },
          }}
          onChange={() => {
            // Clear previous payment error when user edits the card field
            if (errorMsg) setErrorMsg("");
          }}
        />
      </div>

      {/* Inline error banner */}
      {errorMsg && (
        <div className="flex gap-2 items-start p-3 rounded-lg bg-destructive/10 border border-destructive/40 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Processing overlay hint */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-2 py-1 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-mono">Processing payment…</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          disabled={isProcessing || !stripe}
          className="flex-1 glow-lime font-display font-bold"
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</>
          ) : status === "failed" ? (
            <><RefreshCw className="w-4 h-4 mr-2" />Try Again — Pay ${amount}</>
          ) : (
            `Pay $${amount}`
          )}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancel} disabled={isProcessing}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function StripePaymentModal({ clientSecret, amount, label, onSuccess, onClose }) {
  const [stripeInstance, setStripeInstance] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    getStripePromise().then(setStripeInstance).catch(e => setLoadError(e.message));
  }, []);

  return (
    <ModalPortal open={true} onBackdropClick={!isProcessing ? onClose : undefined}>
      <div className="w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: 'calc(100dvh - var(--bottom-nav-height) - 32px)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/30 shrink-0">
          <div>
            <h2 className="font-display font-black text-xl">PAYMENT</h2>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">{label}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            <span>Payments are securely processed by Stripe. We never store your card details.</span>
          </div>

          {loadError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {loadError}
            </div>
          )}

          {stripeInstance && clientSecret ? (
            <Elements
              key={clientSecret}
              stripe={stripeInstance}
              options={{ clientSecret, appearance: stripeAppearance }}
            >
              <InnerForm
                amount={amount}
                onSuccess={onSuccess}
                onCancel={onClose}
                onProcessingChange={setIsProcessing}
              />
            </Elements>
          ) : !loadError ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-xs font-mono text-muted-foreground">Loading secure payment form...</p>
            </div>
          ) : null}
        </div>
      </div>
    </ModalPortal>
  );
}