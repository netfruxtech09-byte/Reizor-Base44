import { useState, useEffect } from "react";
import { Minus, Plus, Tag, AlertCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculatePlatformFeeForCurrency, getTicketPlatformFeeForCurrency } from "@/utils/ticketFeeCalculator";
import { useAuthGate } from "@/hooks/useAuthGate";
import { formatPrice, getCurrencySymbol, getUsdRate } from "@/utils/currency";

export default function TicketSelector({ ticketTypes, onCheckout, onStageChange, feeSettings, ccFeeOnBuyer, platformFeeOnBuyer, eventId, currency, appliedCreditAmount = 0, organizerExtraFee = 0, sellerLink = null }) {
  const { requireAuth } = useAuthGate();
  const [quantities, setQuantities] = useState({});
  // Pre-fill promo code from URL ?promo= param
  const urlPromo = new URLSearchParams(window.location.search).get("promo") || "";
  const [promoCode, setPromoCode] = useState(urlPromo.toUpperCase());
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [autoApplied, setAutoApplied] = useState(false);

  // Event currency for fee conversion (USD fees must convert to event currency)
  const eventCurrency = currency || ticketTypes[0]?.currency || "USD";
  const [usdRate, setUsdRate] = useState(eventCurrency === "USD" ? 1 : null);
  useEffect(() => {
    if (eventCurrency === "USD") { setUsdRate(1); return; }
    let active = true;
    getUsdRate(eventCurrency).then(r => { if (active) setUsdRate(r ?? null); });
    return () => { active = false; };
  }, [eventCurrency]);
  const rateReady = eventCurrency === "USD" || usdRate !== null;

  // Auto-apply promo from URL on mount
  useEffect(() => {
    if (urlPromo && !autoApplied && ticketTypes.length > 0) {
      setAutoApplied(true);
      const eid = eventId || ticketTypes[0]?.event_id;
      const now = new Date();
      base44.entities.PromoCode.filter({ code: urlPromo.toUpperCase(), event_id: eid, status: "active" }, null, 1)
        .then(results => {
          const promo = results[0];
          if (!promo) { setPromoError("Invalid or expired promo code."); return; }
          if (promo.valid_from && new Date(promo.valid_from) > now) { setPromoError("This promo code is not active yet."); return; }
          if (promo.valid_until && new Date(promo.valid_until) < now) { setPromoError("This promo code has expired."); return; }
          if (promo.max_uses && (promo.times_used || 0) >= promo.max_uses) { setPromoError("This promo code has reached its usage limit."); return; }
          setAppliedPromo(promo);
        })
        .catch(() => {});
    }
  }, [ticketTypes.length]);

  const updateQty = (id, delta, max) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, Math.min(current + delta, max));
      if (next > 0 && current === 0) {
        onStageChange?.("ticket_select");
        // Clear validation message once user selects a ticket
        setShowValidation(false);
      }
      return { ...prev, [id]: next };
    });
  };

  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);
  const ticketCount = totalItems;
  const subtotal = ticketTypes.reduce((sum, tt) => {
    return sum + (quantities[tt.id] || 0) * tt.price;
  }, 0);

  // Promo discount
  let promoDiscount = 0;
  if (appliedPromo) {
    if (appliedPromo.discount_type === "percentage") {
      promoDiscount = subtotal * (appliedPromo.discount_value / 100);
    } else {
      promoDiscount = Math.min(appliedPromo.discount_value, subtotal);
    }
  }
  const discountedSubtotal = Math.max(0, subtotal - promoDiscount);

  // Calculate tiered platform fees for each ticket
  let rawServiceFee = 0;
  ticketTypes.forEach((tt) => {
    const qty = quantities[tt.id] || 0;
    if (qty > 0) {
      rawServiceFee += calculatePlatformFeeForCurrency(tt.price, qty, eventCurrency, usdRate);
    }
  });
  // If organizer absorbs the platform fee, buyer doesn't see it
  const showServiceFee = platformFeeOnBuyer !== false;
  const serviceFee = showServiceFee ? rawServiceFee : 0;

  // Organizer extra fee (per ticket, applied to all tickets purchased)
  const extraFeePerTicket = parseFloat(organizerExtraFee) || 0;
  const totalOrganizerExtraFee = extraFeePerTicket > 0 ? extraFeePerTicket * ticketCount : 0;

  // Vendor/seller commission — only applies when coming through a seller link
  let vendorCommission = 0;
  if (sellerLink && sellerLink.commission_type && sellerLink.commission_type !== "none") {
    const commissionBase = discountedSubtotal; // commission on ticket price after discount
    if (sellerLink.commission_type === "fixed") {
      vendorCommission = (sellerLink.commission_value || 0) * ticketCount;
    } else if (sellerLink.commission_type === "percentage") {
      vendorCommission = commissionBase * ((sellerLink.commission_value || 0) / 100);
    }
    vendorCommission = Math.max(0, vendorCommission);
  }

  // Combined service fee shown to customer = platform fee + organizer extra fee + vendor commission
  // (organizer extra fee and vendor commission are internal — customer only sees one "Service Fee")
  const displayedServiceFee = serviceFee + totalOrganizerExtraFee + vendorCommission;

  const showCcFee = ccFeeOnBuyer !== false;
  // Use Stripe's actual formula (2.9% + $0.30) — same as Checkout & backend
  const cardFee = showCcFee ? parseFloat(((discountedSubtotal + displayedServiceFee) * 0.029 + 0.30).toFixed(2)) : 0;
  const creditDeduction = Math.min(appliedCreditAmount, discountedSubtotal + displayedServiceFee + cardFee);
  const total = Math.max(0, discountedSubtotal + displayedServiceFee + cardFee - creditDeduction);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    setAppliedPromo(null);
    const now = new Date();
    const eid = eventId || ticketTypes[0]?.event_id;
    const results = await base44.entities.PromoCode.filter({ code: promoCode.trim().toUpperCase(), event_id: eid, status: "active" }, null, 1);
    const promo = results[0];
    if (!promo) {
      setPromoError("Invalid or expired promo code.");
    } else if (promo.valid_from && new Date(promo.valid_from) > now) {
      setPromoError("This promo code is not active yet.");
    } else if (promo.valid_until && new Date(promo.valid_until) < now) {
      setPromoError("This promo code has expired.");
    } else if (promo.max_uses && (promo.times_used || 0) >= promo.max_uses) {
      setPromoError("This promo code has reached its usage limit.");
    } else {
      setAppliedPromo(promo);
    }
    setPromoLoading(false);
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoError("");
  };

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const handleCheckout = async () => {
    if (totalItems === 0) {
      setShowValidation(true);
      return;
    }
    if (checkoutLoading) return;
    
    // Store pending checkout data BEFORE auth gate (in case user needs to login)
    const items = ticketTypes
      .filter((tt) => quantities[tt.id] > 0)
      .map((tt) => ({
        ticket_type_id: tt.id,
        ticket_type_name: tt.name,
        quantity: quantities[tt.id],
        unit_price: tt.price,
        subtotal: quantities[tt.id] * tt.price,
      }));
    
    localStorage.setItem("pending_checkout_intent", JSON.stringify({
      items,
      subtotal,
      serviceFee: rawServiceFee,
      cardFee,
      total,
      currency: eventCurrency,
      usdRate,
      promoCode: appliedPromo?.code || "",
      promoDiscount,
      organizerExtraFee: totalOrganizerExtraFee,
      vendorCommission,
    }));
    
    // Auth gate: let user pick tickets first, then require login before proceeding
    const authed = await requireAuth("Please sign in or create an account to purchase tickets.");
    if (!authed) return;
    
    setCheckoutLoading(true);
    onStageChange?.("checkout_attempt");
    
    try {
      await onCheckout({ items, subtotal, serviceFee: rawServiceFee, cardFee, total, currency: eventCurrency, usdRate, promoCode: appliedPromo?.code || "", promoDiscount, organizerExtraFee: totalOrganizerExtraFee, vendorCommission });
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Derive the display currency from ticket types (all tiers share same currency per event)
  const displayCurrency = currency || ticketTypes[0]?.currency || "USD";
  const currSymbol = getCurrencySymbol(displayCurrency);

  return (
    <div className="space-y-4">
      {ticketTypes.map((tt) => {
        const totalQty = tt.quantity_total || 0;
        const soldQty = tt.quantity_sold || 0;
        const remaining = totalQty - soldQty;
        const hasNoInventory = totalQty === 0;
        const isSoldOut = !hasNoInventory && (remaining <= 0 || tt.status === "sold_out");
        const maxQty = Math.min(remaining, tt.max_per_user || 4);
        const qty = quantities[tt.id] || 0;
        const tierCurrency = tt.currency || "USD";

        return (
          <div
            key={tt.id}
            className={`rounded-xl border transition-all ${
              qty > 0 ? "border-primary/60 bg-primary/5" : "border-border/50 bg-card"
            } ${(isSoldOut || hasNoInventory) ? "opacity-60 pointer-events-none" : ""}`}
          >
            {/* Ticket header: tier, name, price */}
            <div className="px-4 py-4 space-y-2 sm:space-y-1">
              <span className={`font-mono text-[10px] font-bold uppercase tracking-wider inline-block ${
                tt.tier === "early_bird" ? "text-green-400" :
                tt.tier === "vip" ? "text-primary" :
                tt.tier === "backstage" ? "text-accent" :
                "text-muted-foreground"
              }`}>{tt.tier?.replace("_", " ")}</span>
              <h4 className="font-display font-bold text-sm sm:text-base leading-tight">{tt.name}</h4>
              
              {tt.description && (
                <p className="text-xs text-muted-foreground pt-1">{tt.description}</p>
              )}
              
              <div className="flex items-baseline gap-2 pt-2 sm:pt-1">
                <p className="font-mono font-bold text-primary text-base sm:text-lg">{formatPrice(tt.price, tierCurrency)}</p>
                {showServiceFee && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    + {rateReady ? formatPrice(getTicketPlatformFeeForCurrency(tt.price, tierCurrency, usdRate), tierCurrency) : "…"} fee
                  </p>
                )}
              </div>

              {!isSoldOut && !hasNoInventory && (() => {
                const showLeft = tt.show_tickets_left === true;
                if (!showLeft) return null;
                const threshold = tt.tickets_left_threshold;
                const belowThreshold = !threshold || remaining <= threshold;
                if (!belowThreshold) return null;
                return (
                  <p className="text-[10px] font-mono text-destructive flex items-center gap-1 pt-1">
                    <AlertCircle className="w-3 h-3 shrink-0" /> Only {remaining} left
                  </p>
                );
              })()}
            </div>

            {/* Ticket controls: quantity selector + sold out */}
            <div className="px-4 py-3 sm:py-4 border-t border-border/30 flex items-center justify-between gap-3">
              {isSoldOut ? (
                <div className="flex-1">
                  <span className="font-mono text-xs text-destructive font-bold bg-destructive/10 px-3 py-1.5 rounded inline-block">SOLD OUT</span>
                </div>
              ) : hasNoInventory ? (
                <div className="flex-1">
                  <span className="font-mono text-xs text-muted-foreground font-bold bg-muted/50 px-3 py-1.5 rounded inline-block">UNAVAILABLE</span>
                </div>
              ) : (
                <>
                  <span className="font-mono text-xs text-muted-foreground">Qty:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQty(tt.id, -1, maxQty)}
                      disabled={!qty}
                      className="h-11 w-11 rounded-lg border border-border/60 bg-secondary flex items-center justify-center font-bold disabled:opacity-30 hover:bg-muted transition-colors touch-manipulation active:scale-95"
                      aria-label={`Decrease ${tt.name} quantity`}
                      type="button"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="w-10 text-center">
                      <span className="font-mono font-bold text-base block">{qty}</span>
                      <span className="text-[10px] text-muted-foreground">tickets</span>
                    </div>
                    <button
                      onClick={() => updateQty(tt.id, 1, maxQty)}
                      disabled={qty >= maxQty}
                      className="h-11 w-11 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold disabled:opacity-30 hover:bg-primary/90 transition-colors touch-manipulation active:scale-95"
                      aria-label={`Increase ${tt.name} quantity`}
                      type="button"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Promo Code */}
      <div className="pt-2">
        {appliedPromo ? (
          <div className="flex items-center justify-between gap-2 p-3 sm:p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <div className="min-w-0">
                <p className="font-mono text-xs sm:text-sm font-bold text-green-400 truncate">{appliedPromo.code}</p>
                <p className="text-xs text-muted-foreground">
                  {appliedPromo.discount_type === "percentage" ? `${appliedPromo.discount_value}% off` : `${formatPrice(appliedPromo.discount_value, displayCurrency)} off`}
                </p>
              </div>
            </div>
            <button onClick={handleRemovePromo} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 touch-manipulation" aria-label="Remove promo code">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-mono font-bold text-muted-foreground uppercase">Promo Code</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  placeholder="Enter code"
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 pl-9 py-2 text-sm font-mono uppercase placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch-manipulation"
                />
              </div>
              <button
                onClick={handleApplyPromo}
                disabled={!promoCode || promoLoading}
                className="px-4 h-10 rounded-md border border-border/50 bg-secondary text-sm font-mono font-bold hover:bg-muted disabled:opacity-50 flex items-center gap-1.5 shrink-0 transition-colors touch-manipulation"
                aria-label="Apply promo code"
              >
                {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
              </button>
            </div>
            {promoError && (
              <p className="text-xs text-destructive font-mono flex items-center gap-1.5">
                <XCircle className="w-3 h-3 shrink-0" /> {promoError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      {totalItems > 0 && (
        <div className="p-4 sm:p-5 rounded-lg bg-card border border-border/50 space-y-3">
          <div className="flex justify-between text-xs sm:text-sm gap-2">
            <span className="text-muted-foreground">Subtotal ({totalItems} ticket{totalItems > 1 ? "s" : ""})</span>
            <span className="font-mono font-bold text-right">{formatPrice(subtotal, displayCurrency)}</span>
          </div>
          {promoDiscount > 0 && (
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="text-green-400">Promo ({appliedPromo.code})</span>
              <span className="font-mono text-green-400 font-bold text-right">-{formatPrice(promoDiscount, displayCurrency)}</span>
            </div>
          )}
          {displayedServiceFee > 0 && (
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="text-muted-foreground">Service fee</span>
              <span className="font-mono font-bold text-right">{rateReady ? formatPrice(displayedServiceFee, displayCurrency) : "…"}</span>
            </div>
          )}
          {showCcFee && (
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="text-muted-foreground">Card processing (3%)</span>
              <span className="font-mono font-bold text-right">{rateReady ? formatPrice(cardFee, displayCurrency) : "…"}</span>
            </div>
          )}
          {creditDeduction > 0 && (
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="text-accent">Credit applied</span>
              <span className="font-mono text-accent font-bold text-right">-{formatPrice(creditDeduction, displayCurrency)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-3 border-t border-border/50 text-sm sm:text-base gap-2">
            <span>Total</span>
            <span className="font-mono text-primary text-right">{rateReady ? formatPrice(total, displayCurrency) : "Calculating…"}</span>
          </div>
        </div>
      )}

      {/* Validation message */}
      {showValidation && totalItems === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-mono text-xs">Please select at least one ticket or table</span>
        </div>
      )}

      {/* Checkout Button */}
      <Button
        onClick={handleCheckout}
        disabled={checkoutLoading || !rateReady}
        className="w-full h-12 sm:h-13 font-display font-bold text-base glow-lime touch-manipulation mt-2"
      >
        {checkoutLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Processing...
          </span>
        ) : totalItems > 0 ? (
          <span className="flex items-center justify-center gap-1 text-sm sm:text-base">
            Go to Checkout · {formatPrice(total, displayCurrency)}
          </span>
        ) : (
          "Select Tickets"
        )}
      </Button>
      </div>
      );
      }