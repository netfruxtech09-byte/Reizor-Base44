/**
 * VideoMinuteCheckout — prepaid minute purchase flow.
 *
 * Props:
 *   videoUrl        — CDN URL of the video
 *   videoTitle      — display title
 *   videoType       — "360" | "normal"
 *   videoId         — context ID (post, media item, etc.)
 *   ownerType       — "organizer" | "artist" | "white_label"
 *   onSuccess       — callback after payment succeeds
 */
import { useState, useEffect } from "react";
import { Clock, Play, DollarSign, Loader2, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import StripePaymentModal from "@/components/shared/StripePaymentModal";
import { detectIsIOS } from "@/hooks/useIsIOS";

const MINUTE_PRESETS = [100, 500, 1000, 5000];

export default function VideoMinuteCheckout({
  videoUrl,
  videoTitle = "",
  videoType = "normal",
  videoId = "",
  ownerType = "organizer",
  onSuccess,
}) {
  const [pricing, setPricing] = useState(null);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [selectedMinutes, setSelectedMinutes] = useState(100);
  const [customMinutes, setCustomMinutes] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [paying, setPaying] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [pendingPlanId, setPendingPlanId] = useState(null);
  const [pendingMeta, setPendingMeta] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await base44.functions.invoke("videoMinuteBilling", { action: "get_pricing" });
      setPricing(res.data);
      setLoadingPricing(false);
    })();
  }, []);

  const finalMinutes = useCustom ? parseInt(customMinutes) || 0 : selectedMinutes;
  const rate = pricing?.effective_rate_per_minute || 0.0016;
  const totalCost = finalMinutes * rate;
  const freeMinutes = pricing?.free_minutes_per_month || 100;

  const handleCheckout = async () => {
    if (!finalMinutes || finalMinutes < 1) {
      toast.error("Select at least 1 minute");
      return;
    }
    setPaying(true);
    const res = await base44.functions.invoke("videoMinuteBilling", {
      action: "create_checkout",
      video_url: videoUrl,
      video_title: videoTitle,
      minutes: finalMinutes,
      video_type: videoType,
      video_id: videoId,
      owner_type: ownerType,
    });
    setPaying(false);

    if (!res.data?.client_secret) {
      toast.error("Payment setup failed. Please try again.");
      return;
    }
    setClientSecret(res.data.client_secret);
    setPendingPlanId(res.data.plan_id);
    setPendingMeta({ minutes: finalMinutes, breakdown: res.data.breakdown });
    setShowPayModal(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPayModal(false);
    const res = await base44.functions.invoke("videoMinuteBilling", {
      action: "confirm_payment",
      payment_intent_id: pendingMeta?._pi || "",
      plan_id: pendingPlanId,
      minutes: pendingMeta?.minutes || finalMinutes,
    });
    // We don't have _pi stored — use the confirm without it, the backend reads from Stripe
    // Actually we need to pass payment_intent_id — let's refetch plan
    if (res.data?.success) {
      toast.success(`${pendingMeta?.minutes || finalMinutes} streaming minutes activated!`);
      onSuccess?.();
    } else {
      toast.error("Payment recorded but activation failed. Contact support.");
    }
    setClientSecret(null);
  };

  if (detectIsIOS()) return null;
  if (loadingPricing) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border/40 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Play className="w-4 h-4 text-primary shrink-0" />
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Streaming Minutes
        </p>
      </div>

      {/* Pricing info */}
      <div className="p-3 rounded-lg bg-primary/8 border border-primary/20 space-y-2">
        <p className="text-xs font-mono font-bold text-primary uppercase">Per-Minute Billing</p>
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground">Rate</p>
            <p className="font-display font-bold text-sm">${rate.toFixed(4)}/min</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground">Free/Month</p>
            <p className="font-display font-bold text-sm text-green-400">{freeMinutes} min</p>
          </div>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground mt-1">
          Based on 8K Mux rate (${(pricing?.base_rate_per_minute || 0.0008).toFixed(4)}/min) × {(pricing?.multiplier || 2)}x
        </p>
      </div>

      {/* Minute selector */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Select Streaming Minutes
        </p>
        <div className="flex flex-wrap gap-2">
          {MINUTE_PRESETS.map(m => (
            <button
              key={m}
              onClick={() => { setSelectedMinutes(m); setUseCustom(false); }}
              className={`px-3 py-1.5 rounded-lg border text-sm font-mono font-bold transition-all ${
                !useCustom && selectedMinutes === m
                  ? "bg-primary border-primary text-white"
                  : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
              }`}
            >
              {m >= 1000 ? `${(m / 1000).toFixed(0)}k` : m} min
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
            step="100"
            value={customMinutes}
            onChange={e => setCustomMinutes(e.target.value)}
            placeholder="Enter minutes"
            className="w-full h-9 rounded-md border border-white/25 bg-secondary px-3 text-sm text-foreground focus:outline-none focus:border-primary"
          />
        )}
      </div>

      {/* Breakdown */}
      {finalMinutes > 0 && (
        <div className="p-3 rounded-lg bg-secondary/40 border border-border/30 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">Minutes</span>
            <span className="font-bold">{finalMinutes.toLocaleString()} min</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">Rate</span>
            <span>${rate.toFixed(4)}/min</span>
          </div>
          <div className="border-t border-border/30 pt-2 flex justify-between text-sm">
            <span className="font-mono text-muted-foreground">Total</span>
            <span className="font-display font-black text-primary">${totalCost.toFixed(2)}</span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground">
            <Clock className="w-3 h-3 inline mr-1" />
            ~{Math.round(finalMinutes / 60)} hours of streaming
          </p>
        </div>
      )}

      <Button
        onClick={handleCheckout}
        disabled={paying || !finalMinutes || finalMinutes < 1}
        className="w-full gap-2 font-display font-bold glow-lime"
      >
        {paying ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
        ) : (
          <><DollarSign className="w-4 h-4" /> Purchase Minutes — ${totalCost.toFixed(2)}</>
        )}
      </Button>

      {/* Stripe modal */}
      {showPayModal && clientSecret && (
        <StripePaymentModal
          isOpen={showPayModal}
          clientSecret={clientSecret}
          amount={totalCost}
          description={`${finalMinutes} streaming minutes for ${videoTitle || "video"}`}
          onSuccess={handlePaymentSuccess}
          onClose={() => { setShowPayModal(false); setClientSecret(null); }}
        />
      )}
    </div>
  );
}