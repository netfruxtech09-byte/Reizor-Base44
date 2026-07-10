import { useState, useEffect } from "react";
import { X, Lock, Loader2, AlertCircle, CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

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

function SetupForm({ setupIntentId, customerId, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || status === "processing") return;
    setStatus("processing");
    setErrorMsg("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMsg(submitError.message || "Card details are invalid. Please check and try again.");
      setStatus("failed");
      return;
    }

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setErrorMsg(error.message || "We could not add your payment method. Please check your card details and try again.");
      setStatus("failed");
      return;
    }

    if (setupIntent?.status === "succeeded") {
      setStatus("confirming");
      try {
        const res = await base44.functions.invoke("savePaymentMethod", {
          action: "confirm_setup",
          setupIntentId: setupIntent.id,
          customerId,
        });
        if (!res.data?.success) throw new Error(res.data?.error || "Failed to save card");
        setStatus("succeeded");
        onSuccess(res.data.payment_method);
      } catch (err) {
        setErrorMsg("Your payment method was set up but could not be saved. Please try again.");
        setStatus("failed");
      }
      return;
    }

    setErrorMsg("We could not add your payment method. Please check your card details and try again.");
    setStatus("failed");
  };

  if (status === "succeeded" || status === "confirming") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-400/10 border border-green-400/30 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-green-400" />
        </div>
        <div>
          <p className="font-display font-black text-lg text-green-400">Payment method added successfully.</p>
          <p className="text-sm text-muted-foreground mt-1">Your card has been saved securely.</p>
        </div>
        {status === "confirming" && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  const isProcessing = status === "processing";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-muted-foreground font-mono bg-secondary/50 p-3 rounded-lg leading-relaxed">
        Enter your card details below. Your card information is encrypted and processed securely by Stripe. We only store your card brand, last four digits, and expiry date.
      </p>

      <div className={isProcessing ? "opacity-50 pointer-events-none" : ""}>
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: { applePay: "never", googlePay: "never" },
          }}
          onChange={() => { if (errorMsg) setErrorMsg(""); }}
        />
      </div>

      {errorMsg && (
        <div className="flex gap-2 items-start p-3 rounded-lg bg-destructive/10 border border-destructive/40 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-mono">Saving your payment method…</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          disabled={isProcessing || !stripe}
          className="flex-1 glow-lime font-display font-bold"
        >
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : "Save Card"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * AddPaymentMethodModal
 *
 * Opens a Stripe SetupIntent-based card form in a modal.
 * On success, calls onSuccess(paymentMethodData) with safe card metadata.
 * onCancel is called if the user dismisses without saving.
 */
export default function AddPaymentMethodModal({ onSuccess, onCancel }) {
  const [phase, setPhase] = useState("loading"); // loading | form | error
  const [stripeInstance, setStripeInstance] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [setupIntentId, setSetupIntentId] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    Promise.all([
      getStripePromise(),
      base44.functions.invoke("savePaymentMethod", { action: "create_setup_intent" }),
    ])
      .then(([stripe, res]) => {
        setStripeInstance(stripe);
        setClientSecret(res.data.clientSecret);
        setCustomerId(res.data.customerId);
        // Extract setup intent id from client secret (format: seti_xxx_secret_yyy)
        const siId = res.data.clientSecret.split("_secret_")[0];
        setSetupIntentId(siId);
        setPhase("form");
      })
      .catch((err) => {
        setLoadError(err?.message || "Failed to initialize payment form. Please try again.");
        setPhase("error");
      });
  }, []);

  const handleSuccess = (pmData) => {
    toast.success("Your payment method has been added successfully.");
    onSuccess(pmData);
  };

  const handleCancel = () => {
    toast("Payment method setup was cancelled. No charge was made.");
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-black text-base">Add Payment Method</h3>
              <p className="text-[10px] font-mono text-muted-foreground">No charge — card saved for future use</p>
            </div>
          </div>
          {phase !== "loading" && (
            <button onClick={handleCancel} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Security badge */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono">Payments processed securely by Stripe. Raw card data is never stored in our database.</span>
          </div>

          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-xs font-mono text-muted-foreground">Loading secure payment form…</p>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-destructive">Could not load payment form</p>
                  <p className="text-xs text-muted-foreground mt-1">{loadError}</p>
                </div>
              </div>
              <Button variant="outline" onClick={handleCancel} className="w-full">Close</Button>
            </div>
          )}

          {phase === "form" && stripeInstance && clientSecret && (
            <Elements
              key={clientSecret}
              stripe={stripeInstance}
              options={{ clientSecret, appearance: stripeAppearance }}
            >
              <SetupForm
                setupIntentId={setupIntentId}
                customerId={customerId}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </Elements>
          )}

        </div>
      </div>
    </div>
  );
}