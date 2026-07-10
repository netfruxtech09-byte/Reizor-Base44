import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, AlertCircle, Lock } from "lucide-react";
import { isEventPast } from "@/utils/eventUtils";
import { getTicketPlatformFeeForCurrency, getTablePlatformFeeForCurrency } from "@/utils/ticketFeeCalculator";
import { formatPrice, getUsdRate } from "@/utils/currency";
import { hapticSuccess, hapticError, hapticMedium } from "@/lib/haptics";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// stripePromise is initialized once we have the publishable key
let _stripePromise = null;
async function getStripePromise() {
  if (_stripePromise) return _stripePromise;
  const res = await base44.functions.invoke("stripePublicConfig", {});
  const key = res.data?.publishableKey;
  if (!key) throw new Error("Stripe not configured");
  _stripePromise = loadStripe(key);
  return _stripePromise;
}

// ── Inner payment form rendered inside Elements ──────────────────────────────
function PaymentForm({ grandTotal, currency, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    onError("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      hapticError();
      onError(error.message || "Payment failed. Please try again.");
      setPaying(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      hapticSuccess();
      onSuccess(paymentIntent.id);
    } else {
      onError("Unexpected payment status. Please contact support.");
      setPaying(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
          wallets: { applePay: "never", googlePay: "never" },
        }}
      />
      <Button
        type="submit"
        disabled={paying || !stripe}
        size="lg"
        className="w-full h-12 font-display font-bold text-lg glow-lime"
      >
        {paying ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
        ) : (
          `Pay ${formatPrice(grandTotal, currency)}`
        )}
      </Button>
    </form>
  );
}

// ── Main Checkout page ────────────────────────────────────────────────────────
export default function Checkout() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestNames, setGuestNames] = useState({});
  const [tableDetails, setTableDetails] = useState(null);

  const [pendingCheckout, setPendingCheckout] = useState(null);
  const [pendingTableCheckout, setPendingTableCheckout] = useState(null);

  // Resale wallet state
  const [resaleBalance, setResaleBalance] = useState(null);
  const [walletAmountToApply, setWalletAmountToApply] = useState(0);
  const [useWallet, setUseWallet] = useState(false);

  // Stripe payment intent state
  const [clientSecret, setClientSecret] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [intentCreated, setIntentCreated] = useState(false);
  const [stripeInstance, setStripeInstance] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        setEmail(u.email);
        setName(u.full_name || "");

        const evArr = await base44.entities.Event.filter({ id: eventId }, null, 1);
        if (!evArr[0]) throw new Error("Event not found");
        setEvent(evArr[0]);

        // Load resale wallet balance for logged-in user
        const walletArr = await base44.entities.ResaleSellerBalance.filter({ seller_email: u.email }, null, 1).catch(() => []);
        if (walletArr[0]) setResaleBalance(walletArr[0]);

        let raw = sessionStorage.getItem("pending_checkout");
        if (!raw) {
          const pendingIntent = localStorage.getItem("pending_checkout_intent");
          if (pendingIntent) {
            raw = pendingIntent;
            sessionStorage.setItem("pending_checkout", raw);
            localStorage.removeItem("pending_checkout_intent");
          }
        }
        if (raw) setPendingCheckout(JSON.parse(raw));

        const rawTable = sessionStorage.getItem("pending_table_checkout");
        if (rawTable) {
          const tableData = JSON.parse(rawTable);
          setPendingTableCheckout(tableData);
          const tableArr = await base44.entities.Table.filter({ id: tableData.tableId }, null, 1).catch(() => []);
          if (tableArr[0]) setTableDetails(tableArr[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  const isTableCheckout = !!pendingTableCheckout;
  const items = pendingCheckout?.items || [];

  const currency = event?.currency || pendingCheckout?.currency || "USD";

  // USD-per-unit rate for the event currency. Reuse the rate captured on the
  // ticket selection page (guarantees the displayed total == charged amount);
  // fetch a fresh one as a fallback for legacy pending-checkout payloads.
  const [checkoutRate, setCheckoutRate] = useState(currency === "USD" ? 1 : (pendingCheckout?.usdRate ?? null));
  useEffect(() => {
    if (currency === "USD") { setCheckoutRate(1); return; }
    if (pendingCheckout?.usdRate) { setCheckoutRate(pendingCheckout.usdRate); return; }
    let active = true;
    getUsdRate(currency).then(r => { if (active) setCheckoutRate(r); });
    return () => { active = false; };
  }, [currency, pendingCheckout?.usdRate]);

  // ── Use pre-calculated values from TicketSelector (single source of truth) ──
  const subtotal = isTableCheckout
    ? (tableDetails?.price || 0)
    : (pendingCheckout?.subtotal ?? items.reduce((s, i) => s + i.unit_price * i.quantity, 0));
  const platformFee = isTableCheckout
    ? getTablePlatformFeeForCurrency(currency, checkoutRate)
    : (pendingCheckout?.serviceFee ?? items.reduce((s, i) => s + getTicketPlatformFeeForCurrency(i.unit_price, currency, checkoutRate) * i.quantity, 0));
  const organizerExtraFee = pendingCheckout?.organizerExtraFee || 0;
  const vendorCommission = pendingCheckout?.vendorCommission || 0;
  const displayedFee = platformFee + organizerExtraFee + vendorCommission;
  const promoDiscount = isTableCheckout ? 0 : (pendingCheckout?.promoDiscount || 0);
  const usedCredit = pendingCheckout?.creditToApply || 0;
  const totalDue = subtotal + displayedFee - promoDiscount;
  // Only allow full credit purchase (all-or-nothing) — no partial credit payments
  const creditApplied = isTableCheckout ? 0 : (usedCredit >= totalDue ? totalDue : 0);
  const afterCredit = subtotal + displayedFee - promoDiscount - creditApplied;

  // Resale wallet logic
  const availableWallet = resaleBalance?.available_balance || 0;
  const actualWalletAmount = useWallet ? Math.min(walletAmountToApply, availableWallet, afterCredit) : 0;
  const afterWallet = afterCredit - actualWalletAmount;

  // Only charge CC fee to buyer if organizer setting allows it (default: true)
  const chargeStripeFeeToBuyer = event?.cc_fee_on_buyer !== false;
  const stripeFee = afterWallet > 0 && chargeStripeFeeToBuyer ? parseFloat((afterWallet * 0.029 + 0.30).toFixed(2)) : 0;
  const grandTotal = parseFloat((afterWallet + stripeFee).toFixed(2));
  const totalQty = isTableCheckout ? 1 : items.reduce((s, i) => s + i.quantity, 0);

  const handleCreateIntent = async () => {
    if (!email || !name) { hapticError(); return setError("Please fill in your name and email first."); }
    if (isEventPast(event)) { hapticError(); return setError("Tickets are no longer available for this event."); }
    if (!isTableCheckout && !items.length) { hapticError(); return setError("No items selected."); }
    hapticMedium();
    setCreatingIntent(true);
    setError("");

    try {
      const guestNamesArr = Array.from({ length: totalQty }, (_, i) => guestNames[i] || (i === 0 ? name : ""));

      let res;
      if (isTableCheckout) {
        res = await base44.functions.invoke("stripeTablePaymentIntent", {
          tableId: pendingTableCheckout.tableId,
          eventId,
          sellerLinkId: pendingTableCheckout.sellerLinkId || null,
          buyerName: name,
          buyerEmail: email,
          grandTotal,
          stripeFee,
        });
      } else {
        // Free order (fully covered by credit or wallet)
        if (grandTotal <= 0) {
          const precomputedSubtotal = subtotal;
          const precomputedPlatformFee = platformFee;
          res = await base44.functions.invoke("stripeCreatePaymentIntent", {
            eventId,
            items: items.map(i => ({ ticket_type_id: i.ticket_type_id, quantity: i.quantity })),
            usedCredit: creditApplied,
            walletAmountPaid: actualWalletAmount,
            name,
            email,
            guestPhone,
            guestNames: guestNamesArr,
            sellerCode: pendingCheckout?.sellerCode || "",
            sellerLinkId: sessionStorage.getItem("seller_link_id") || "",
            promoCode: pendingCheckout?.promoCode || "",
            promoDiscount: promoDiscount,
            organizerExtraFee: organizerExtraFee,
            vendorCommission: vendorCommission,
            precomputedSubtotal: precomputedSubtotal,
            precomputedPlatformFee: precomputedPlatformFee,
          });
          if (res.data?.free) {
            sessionStorage.removeItem("pending_checkout");
            navigate(`/order-confirmation/${res.data.orderId}`);
            return;
          }
          }

          const precomputedSubtotal2 = subtotal;
          const precomputedPlatformFee2 = platformFee;
          res = await base44.functions.invoke("stripeCreatePaymentIntent", {
          eventId,
          items: items.map(i => ({ ticket_type_id: i.ticket_type_id, quantity: i.quantity })),
          usedCredit: creditApplied,
          walletAmountPaid: actualWalletAmount,
          name,
          email,
          guestPhone,
          guestNames: guestNamesArr,
          sellerCode: pendingCheckout?.sellerCode || "",
          sellerLinkId: sessionStorage.getItem("seller_link_id") || "",
          promoCode: pendingCheckout?.promoCode || "",
          promoDiscount: promoDiscount,
          organizerExtraFee: organizerExtraFee,
          vendorCommission: vendorCommission,
          precomputedSubtotal: precomputedSubtotal2,
          precomputedPlatformFee: precomputedPlatformFee2,
          });
      }

      if (!res.data?.clientSecret) throw new Error("Failed to initialize payment");
      setClientSecret(res.data.clientSecret);
      setOrderId(res.data.orderId);
      // Load stripe instance now
      const sp = await getStripePromise();
      setStripeInstance(sp);
      setIntentCreated(true);
    } catch (err) {
      hapticError();
      setError(err.response?.data?.error || err.message || "Failed to initialize payment");
    } finally {
      setCreatingIntent(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    try {
      await base44.functions.invoke("stripeConfirmTickets", {
        paymentIntentId,
        orderId,
      });
    } catch (e) {
      // Even if this fails, webhook will fulfill. Proceed to confirmation.
      console.warn("stripeConfirmTickets error (webhook will handle):", e.message);
    }
    sessionStorage.removeItem("pending_checkout");
    sessionStorage.removeItem("pending_table_checkout");
    navigate(`/order-confirmation/${orderId}`);
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Event not found</p>
          <Button onClick={() => navigate("/search")}>Back to Search</Button>
        </div>
      </div>
    );
  }

  const wasCancelled = new URLSearchParams(window.location.search).get("cancelled") === "1";

  if (!isTableCheckout && !items.length) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <p className="text-5xl mb-3">{wasCancelled ? "↩️" : "🎟️"}</p>
          <h2 className="font-display font-black text-2xl mb-2">
            {wasCancelled ? "Payment Cancelled" : "No Tickets Selected"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {wasCancelled
              ? "You cancelled the payment. Go back to select tickets again."
              : "Please select your ticket to continue checkout."}
          </p>
          <Button onClick={() => {
            sessionStorage.removeItem("pending_checkout");
            sessionStorage.removeItem("pending_table_checkout");
            localStorage.removeItem("pending_checkout_intent");
            navigate(`/events/${eventId}`);
          }} className="w-full glow-lime font-display font-bold">
            {wasCancelled ? "Back to Event" : "Select Tickets"}
          </Button>
        </div>
      </div>
    );
  }

  if (isEventPast(event)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm space-y-4 px-4">
          <p className="text-4xl">🎭</p>
          <h1 className="font-display font-black text-2xl">Event Has Ended</h1>
          <p className="text-muted-foreground text-sm">Tickets are no longer available.</p>
          <Button onClick={() => navigate(`/events/${eventId}`)} variant="outline">View Event</Button>
          <Button onClick={() => navigate("/search")} className="w-full">Browse Events</Button>
        </div>
      </div>
    );
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

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-2xl mx-auto pb-32">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="mb-8">
        <h1 className="font-display font-black text-4xl tracking-tight">
          {isTableCheckout ? "TABLE CHECKOUT" : "CHECKOUT"}
        </h1>
        <p className="text-muted-foreground mt-1">{event.title}</p>
        {isTableCheckout && tableDetails && (
          <p className="text-sm font-mono text-primary mt-1">🪑 {tableDetails.name}</p>
        )}
      </div>

      <div className="space-y-6">
        {/* Order Summary */}
        <div className="p-5 rounded-xl bg-card border border-border/50">
          <h2 className="font-display font-bold text-lg mb-4">ORDER SUMMARY</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between pb-3 border-b border-border/30 text-xs text-muted-foreground font-mono">
              <span>Purchase Date</span>
              <span>{new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
            </div>
            {isTableCheckout ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">🪑 {tableDetails?.name || "Table"}</span>
                <span className="font-mono font-bold">{formatPrice(subtotal, currency)}</span>
              </div>
            ) : (
              items.map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{item.ticket_type_name} × {item.quantity}</span>
                  <span className="font-mono font-bold">{formatPrice(item.unit_price * item.quantity, currency)}</span>
                </div>
              ))
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service Fee</span>
              <span className="font-mono">{formatPrice(displayedFee, currency)}</span>
            </div>
            {!isTableCheckout && creditApplied > 0 && (
              <div className="flex justify-between text-accent">
                <span>Credit Applied</span>
                <span className="font-mono font-bold">-{formatPrice(creditApplied, currency)}</span>
              </div>
            )}
            {!isTableCheckout && actualWalletAmount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Resale Wallet Applied</span>
                <span className="font-mono font-bold">-{formatPrice(actualWalletAmount, currency)}</span>
              </div>
            )}
            {stripeFee > 0 && chargeStripeFeeToBuyer && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Card processing (3%)</span>
                <span className="font-mono">{formatPrice(stripeFee, currency)}</span>
              </div>
            )}
            {!isTableCheckout && pendingCheckout?.promoDiscount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Promo ({pendingCheckout.promoCode})</span>
                <span className="font-mono font-bold">-{formatPrice(pendingCheckout.promoDiscount, currency)}</span>
              </div>
            )}
            <div className="border-t border-border/50 pt-3 flex justify-between">
              <span className="font-display font-bold">TOTAL</span>
              <span className="font-display font-black text-primary text-lg">{formatPrice(grandTotal, currency)}</span>
            </div>
          </div>
        </div>

        {/* Resale Wallet Option — only for ticket purchases with available balance */}
        {!isTableCheckout && !intentCreated && availableWallet > 0 && (
          <div className="p-5 rounded-xl bg-primary/10 border border-primary/30">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="font-display font-bold text-sm mb-2">💰 Use Resale Wallet Balance</h3>
                <p className="text-xs text-muted-foreground mb-3">You have {formatPrice(availableWallet, currency)} available from ticket resales.</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available Balance</span>
                    <span className="font-mono font-bold">{formatPrice(availableWallet, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Total</span>
                    <span className="font-mono font-bold">{formatPrice(subtotal + displayedFee - promoDiscount - creditApplied, currency)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setUseWallet(!useWallet);
                  if (!useWallet) {
                    setWalletAmountToApply(Math.min(availableWallet, afterCredit));
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all whitespace-nowrap ${
                  useWallet
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {useWallet ? "✓ Applied" : "Apply"}
              </button>
            </div>
            {useWallet && (
              <div className="mt-3 p-3 rounded-lg bg-primary/20 border border-primary/40 text-xs space-y-2">
                <div className="flex justify-between">
                  <span>Wallet Amount</span>
                  <span className="font-mono font-bold text-primary">{formatPrice(actualWalletAmount, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining Due</span>
                  <span className="font-mono font-bold">{formatPrice(afterWallet, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Wallet Balance After</span>
                  <span className="font-mono font-bold text-primary">{formatPrice(availableWallet - actualWalletAmount, currency)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attendee Information — only editable before intent is created */}
         {!intentCreated && (
           <div className="p-5 rounded-xl bg-card border border-border/50">
             <h2 className="font-display font-bold text-lg mb-4">ATTENDEE INFORMATION</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Full Name *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Email *</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Phone (Optional)</label>
                <Input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
              </div>
              {totalQty > 1 && (
                <div className="border-t border-border/50 pt-4">
                  <p className="text-sm font-medium mb-3">Additional Guests</p>
                  <div className="space-y-3">
                    {Array.from({ length: totalQty - 1 }).map((_, i) => (
                      <Input
                        key={i}
                        value={guestNames[i + 1] || ""}
                        onChange={e => setGuestNames({ ...guestNames, [i + 1]: e.target.value })}
                        placeholder={`Guest ${i + 2} name (optional)`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attendee info summary after intent created */}
        {intentCreated && (
          <div className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
            <button
              onClick={() => { setIntentCreated(false); setClientSecret(null); setOrderId(null); }}
              className="text-xs text-primary hover:underline"
            >
              Edit
            </button>
          </div>
        )}

        {/* Security notice */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5" />
          <span>Payments are securely processed by Stripe. We never store your card details.</span>
        </div>

        {!isTableCheckout && usedCredit > 0 && usedCredit < totalDue && (
          <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/30 flex gap-3">
            <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-400">You need {formatPrice(totalDue, currency)} in credit to cover the full ticket price. Partial credit payments are not available.</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex gap-3">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Terms */}
        <div className="p-4 rounded-lg bg-muted/40 border border-border/40 text-xs text-muted-foreground">
          By completing this purchase, you agree to our{" "}
          <a href="/terms" target="_blank" className="text-primary hover:underline font-semibold">Terms of Service</a>
          {" "}and{" "}
          <a href="/terms#section-6" target="_blank" className="text-primary hover:underline font-semibold">Refund Policy</a>.
          All sales are final.
        </div>

        {/* Step 1: Continue to Payment button */}
        {!intentCreated && (
          <Button
            onClick={handleCreateIntent}
            disabled={creatingIntent || !email || !name}
            size="lg"
            className="w-full h-12 font-display font-bold text-lg glow-lime"
          >
            {creatingIntent ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Preparing payment...</>
            ) : (
              "Continue to Payment"
            )}
          </Button>
        )}

        {/* Step 2: Embedded Stripe Payment Element */}
        {intentCreated && clientSecret && stripeInstance && (
          <div className="p-5 rounded-xl bg-card border border-border/50">
            <h2 className="font-display font-bold text-lg mb-4">PAYMENT DETAILS</h2>
            <Elements
              stripe={stripeInstance}
              options={{
                clientSecret,
                appearance: stripeAppearance,
              }}
            >
              <PaymentForm
                grandTotal={grandTotal}
                currency={currency}
                onSuccess={handlePaymentSuccess}
                onError={setError}
              />
            </Elements>
          </div>
        )}
      </div>
    </div>
  );
}