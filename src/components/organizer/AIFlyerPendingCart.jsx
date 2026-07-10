import { useState } from "react";
import { ShoppingCart, CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import StripePaymentModal from "@/components/shared/StripePaymentModal";
import { detectIsIOS } from "@/hooks/useIsIOS";

export default function AIFlyerPendingCart({ session, onPaid, onRefresh }) {
  const [showStripe, setShowStripe] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [initiating, setInitiating] = useState(false);

  if (!session || session.pending_count === 0) return null;

  const handlePayNow = async () => {
    setInitiating(true);
    const res = await base44.functions.invoke("aiFlyerPayment", {
      action: "create_cart_payment_intent",
    });
    setInitiating(false);

    if (!res.data?.clientSecret) {
      toast.error("Failed to initialize payment. Please try again.");
      return;
    }

    setClientSecret(res.data.clientSecret);
    setShowStripe(true);
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    const res = await base44.functions.invoke("aiFlyerPayment", {
      action: "confirm_cart_payment",
      paymentIntentId,
    });

    setShowStripe(false);
    setClientSecret(null);

    if (res.data?.success) {
      toast.success("Payment successful! Your flyer generations are now credited.");
      onPaid?.();
    } else {
      toast.error("Payment verified but confirmation failed. Please contact support.");
      onRefresh?.();
    }
  };

  const count = session.pending_count;
  const total = session.pending_amount;

  if (detectIsIOS()) return null;
  return (
    <>
      <div className="p-4 rounded-xl bg-accent/5 border border-accent/30 space-y-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-accent shrink-0" />
          <p className="font-display font-bold text-sm text-accent">
            {count} paid flyer {count === 1 ? "change" : "changes"} added · Total ${total.toFixed(2)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          These generations will be charged together in one payment. You can generate more and pay once.
        </p>
        <Button
          onClick={handlePayNow}
          disabled={initiating}
          className="w-full h-10 font-display font-bold glow-lime gap-2"
        >
          {initiating
            ? <><Loader2 className="w-4 h-4 animate-spin" />Preparing payment…</>
            : <><CreditCard className="w-4 h-4" />Pay ${total.toFixed(2)} Now</>
          }
        </Button>
      </div>

      {showStripe && clientSecret && (
        <StripePaymentModal
          clientSecret={clientSecret}
          amount={total.toFixed(2)}
          label={`AI Flyer — ${count} generation${count > 1 ? "s" : ""} · $${total.toFixed(2)}`}
          onSuccess={handlePaymentSuccess}
          onClose={() => {
            setShowStripe(false);
            setClientSecret(null);
            toast.info("Payment cancelled. Your pending charges are still saved.");
          }}
        />
      )}
    </>
  );
}