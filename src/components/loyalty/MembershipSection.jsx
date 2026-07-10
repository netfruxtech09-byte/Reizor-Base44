import { useState, useEffect } from "react";
import { Star, Zap, Check, Crown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, addYears } from "date-fns";
import StripePaymentModal from "@/components/shared/StripePaymentModal";
import { detectIsIOS } from "@/hooks/useIsIOS";

const ALL_TERMS_SECTIONS = [
  { num: "1", title: "About Reizor", body: [{ type: "p", text: "Reizor is a digital ticketing and event platform that enables users to discover events, purchase tickets, resell eligible tickets, and manage event entry." }, { type: "p", text: "Reizor operates solely as a technology platform connecting event organizers with customers. Unless explicitly stated, Reizor is not the event organizer, promoter, venue, or host." }] },
  { num: "2", title: "Acceptance of Terms", body: [{ type: "p", text: 'By accessing or using Reizor through our website, mobile application, or related services (the "Platform"), you agree to be bound by these Terms & Conditions.' }, { type: "p", text: "If you do not agree, you must not use the Platform." }] },
  { num: "3", title: "Eligibility", body: [{ type: "p", text: "You must be legally capable of entering into a binding agreement to use Reizor." }, { type: "p", text: "By using the Platform, you confirm that:" }, { type: "ul", items: ["All information you provide is accurate and current", "You meet all applicable legal age requirements"] }] },
  { num: "4", title: "Account Registration", body: [{ type: "p", text: "Certain features require account creation." }, { type: "p", text: "You are responsible for:" }, { type: "ul", items: ["Maintaining the confidentiality of your login credentials", "All activity under your account"] }, { type: "p", text: "Reizor may suspend or terminate accounts if fraud, misuse, or security concerns arise." }] },
  { num: "5", title: "Ticket Purchases", body: [{ type: "ul", items: ["All purchases are final unless otherwise stated or required by law", "Pricing, fees, and taxes are disclosed before checkout", "Tickets are delivered digitally (e.g., QR codes)", "Each ticket is valid for one-time use only"] }] },
  { num: "6", title: "Refund Policy", body: [{ type: "p", text: "ALL SALES ARE FINAL. Except where required by law or expressly authorized by the event organizer, Reizor does not provide refunds, exchanges, credits, or compensation for:" }, { type: "ul", items: ["Missed events", "Failure to attend", "Personal schedule conflicts", "Travel issues or transportation delays", "Illness or personal emergencies", "Changes in personal circumstances", "Dissatisfaction with performers, venue, lineup, seating, production quality, or event experience", "Late arrival or denied entry due to failure to comply with venue or event rules"] }, { type: "p", text: "If an event is canceled and the organizer authorizes compensation, Reizor may issue either:" }, { type: "ul", items: ["A refund to the original payment method, or", "Non-cash platform credit"] }, { type: "p", text: "The form, amount, timing, and eligibility of compensation are determined solely by the organizer and applicable law." }] },
  { num: "7", title: "Ticket Resale", body: [{ type: "ul", items: ["Resale is permitted only if enabled by the event organizer", "Resale must occur exclusively through Reizor", "Tickets resold externally may be invalidated"] }, { type: "p", text: "Reizor may control resale pricing, availability, and eligibility." }] },
  { num: "8", title: "Credit Policy", body: [{ type: "p", text: "If resale is unsuccessful, Reizor may issue account credit subject to eligibility rules." }, { type: "p", text: "Credits:" }, { type: "ul", items: ["Are non-transferable and non-cash", "May be limited to the same organizer", "May exclude fees", "May expire"] }, { type: "p", text: "Reizor may deny credit in cases of fraud, abuse, or violations." }] },
  { num: "9", title: "Credit Forfeiture", body: [{ type: "p", text: "If credit is used to purchase another ticket and that ticket is not used or resold:" }, { type: "ul", items: ["The credit and ticket are forfeited", "No replacement or refund will be issued"] }, { type: "p", text: "Credits may only be used once unless otherwise stated." }] },
  { num: "10", title: "Ticket Validity & Entry", body: [{ type: "ul", items: ["Each ticket contains a unique digital credential", "Tickets may only be used once"] }, { type: "p", text: "Invalid tickets include:" }, { type: "ul", items: ["Duplicated or altered tickets", "Unauthorized resale tickets"] }, { type: "p", text: "Reizor may deny entry or cancel tickets suspected of fraud." }] },
  { num: "11", title: "Event Responsibility", body: [{ type: "p", text: "Event organizers are solely responsible for:" }, { type: "ul", items: ["Event execution", "Lineups and scheduling", "Venue operations and safety", "Compliance with laws"] }, { type: "p", text: "Reizor does not guarantee event quality or availability." }] },
  { num: "12", title: "Organizer Rights & Platform Controls", body: [{ type: "p", text: "Reizor may:" }, { type: "ul", items: ["Remove event listings", "Suspend organizers", "Withhold payouts"] }, { type: "p", text: "This may occur due to fraud, disputes, legal risk, or safety concerns." }] },
  { num: "13", title: "Prohibited Conduct", body: [{ type: "p", text: "You may not:" }, { type: "ul", items: ["Use bots or automation tools", "Resell tickets outside the platform (when restricted)", "Copy, forge, or manipulate tickets", "Bypass security measures", "Interfere with platform operations"] }, { type: "p", text: "Violations may result in account termination, ticket cancellation, and legal action." }] },
  { num: "14", title: "Fees & Payments", body: [{ type: "p", text: "Reizor may charge service, processing, or platform fees." }, { type: "p", text: "Payments are handled by third-party processors. Reizor is not responsible for their errors or delays." }] },
  { num: "15", title: "Chargebacks & Payment Disputes", body: [{ type: "p", text: "You agree to contact Reizor before initiating a chargeback." }, { type: "p", text: "If a chargeback is filed:" }, { type: "ul", items: ["Your account may be suspended", "Tickets may be canceled", "You may be liable for associated fees"] }] },
  { num: "16", title: "Fraud Prevention", body: [{ type: "p", text: "Reizor may:" }, { type: "ul", items: ["Monitor activity", "Cancel suspicious transactions", "Require identity verification", "Limit or restrict accounts"] }, { type: "p", text: "Failure to comply may result in suspension." }] },
  { num: "17", title: "Intellectual Property", body: [{ type: "p", text: "All platform content, branding, and technology are owned by Reizor or its licensors." }, { type: "p", text: "You may not copy, modify, or use content without permission." }] },
  { num: "18", title: "Platform Availability", body: [{ type: "p", text: "Reizor does not guarantee uninterrupted service." }, { type: "p", text: "We may modify, suspend, or discontinue features at any time." }] },
  { num: "19", title: "Termination & Suspension", body: [{ type: "p", text: "Reizor may suspend or terminate access at any time for violations, fraud, or risk to the platform." }] },
  { num: "20", title: "Disclaimer", body: [{ type: "p", text: 'The Platform is provided "as is" and "as available."' }, { type: "p", text: "Reizor disclaims all warranties to the fullest extent permitted by law." }] },
  { num: "21", title: "Limitation of Liability", body: [{ type: "p", text: "Reizor is not liable for:" }, { type: "ul", items: ["Indirect or consequential damages", "Loss of profits or opportunity", "Event-related issues"] }, { type: "p", text: "This includes cancellations, injuries, or venue conditions." }] },
  { num: "22", title: "Indemnification", body: [{ type: "p", text: "You agree to indemnify and hold harmless Reizor and its affiliates from any claims arising from:" }, { type: "ul", items: ["Your use of the Platform", "Your violation of these Terms", "Your event-related conduct"] }] },
  { num: "23", title: "Force Majeure", body: [{ type: "p", text: "Reizor is not responsible for delays or failures due to events beyond its control, including:" }, { type: "ul", items: ["Natural disasters", "Government actions", "Public health emergencies", "Infrastructure failures"] }] },
  { num: "24", title: "Electronic Communications", body: [{ type: "p", text: "By using Reizor, you consent to receive electronic communications, including emails, SMS, and notifications." }] },
  { num: "25", title: "Privacy", body: [{ type: "p", text: "Your use of the Platform is also governed by our Privacy Policy." }] },
  { num: "26", title: "Assignment", body: [{ type: "p", text: "You may not transfer your rights under these Terms." }, { type: "p", text: "Reizor may assign its rights at any time." }] },
  { num: "27", title: "Severability", body: [{ type: "p", text: "If any provision is invalid, the remaining Terms remain enforceable." }] },
  { num: "28", title: "Entire Agreement", body: [{ type: "p", text: "These Terms and related policies constitute the full agreement between you and Reizor." }] },
  { num: "29", title: "Waiver", body: [{ type: "p", text: "Failure to enforce any provision does not waive that right." }] },
  { num: "30", title: "Governing Law", body: [{ type: "p", text: "These Terms are governed by the laws of the State of New York." }, { type: "p", text: "All disputes must be resolved in courts located in New York County, New York." }] },
  { num: "31", title: "Changes to Terms", body: [{ type: "p", text: "Reizor may update these Terms at any time." }, { type: "p", text: "Continued use of the Platform constitutes acceptance of updates." }] },
  { num: "32", title: "Pro Referral Program", body: [{ type: "p", text: "Reizor offers an optional referral program." }, { type: "p", text: "Participants earn:" }, { type: "ul", items: ["$3 per referred fan who signs up for any cashback membership"] }, { type: "p", text: "Credits:" }, { type: "ul", items: ["Non-transferable and non-cash"] }, { type: "p", text: "Reizor may modify or terminate the program at any time." }] },
  { num: "33", title: "Membership Raffle Benefits Policy", body: [{ type: "p", text: "Certain membership tiers on Reizor may include promotional raffle benefits, sweepstakes access, giveaways, or entry-based rewards offered by event organizers or Reizor promotional campaigns." }, { type: "p", text: "Membership tiers may receive promotional raffle entries as follows:" }, { type: "ul", items: ["Standard Membership: One (1) raffle entry", "Premium Membership: Three (3) raffle entries"] }, { type: "p", text: "Reizor reserves the right to modify, suspend, limit, or discontinue raffle entry allocations, membership benefits, or promotional programs at any time without prior notice." }, { type: "p", text: "Raffle participation does not guarantee: selection as a winner, receipt of any prize, benefit, access, ticket, or promotional reward, or future raffle availability." }, { type: "p", text: "Certain raffles, giveaways, and promotional rewards may be operated by third-party event organizers. Reizor is not responsible for organizer decisions, prize fulfillment delays, event cancellations, changes to rewards, disqualification decisions, or taxes related to prizes." }, { type: "p", text: "Raffle prizes have no cash value, are non-transferable and non-refundable. Promotional credits are redeemable only within the Reizor platform and may expire." }, { type: "p", text: "By participating, participants consent to Reizor and/or event organizers publicly announcing first name, username, social handle, city/state or country, and promotional content related to the win for marketing purposes." }, { type: "p", text: "Reizor and participating organizers reserve the right to void entries, suspend accounts, disqualify participants, or cancel promotions if fraud, abuse, manipulation, or policy violations are detected." }, { type: "p", text: "Winners are selected through an automated random selection process without human influence. Reizor may suspend, modify, void, or restart affected promotions in case of technical errors or fraud." }, { type: "p", text: "Purchasing a ticket or attending an event does not guarantee raffle prize eligibility unless explicitly stated in the specific promotion's rules." }] },
  { num: "34", title: "Contact Information", body: [{ type: "p", text: "For questions regarding these Terms:" }, { type: "contact" }] },
];

function TermsBody({ body }) {
  return (
    <div className="space-y-2 pl-7">
      {body.map((block, i) => {
        if (block.type === "p") return (
          <p key={i} className="text-muted-foreground text-sm leading-relaxed">{block.text}</p>
        );
        if (block.type === "ul") return (
          <ul key={i} className="space-y-1.5">
            {block.items.map((item, j) => (
              <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        );
        if (block.type === "contact") return (
          <div key={i} className="p-3 rounded-lg bg-card border border-border/50 space-y-1">
            <p className="font-display font-bold text-sm">Reizor (RZR Music Group LLC)</p>
            <p className="text-sm text-muted-foreground">Email: <a href="mailto:reizormusic@gmail.com" className="text-primary hover:underline">reizormusic@gmail.com</a></p>
          </div>
        );
        return null;
      })}
    </div>
  );
}

function RaffleTermsModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full sm:max-w-lg bg-background rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden border border-border/50">
        {/* Fixed header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
          <div>
            <p className="font-mono text-[10px] text-primary uppercase tracking-widest">Legal</p>
            <h2 className="font-display font-black text-lg tracking-tight">Terms & Conditions</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-7">
          <div>
            <p className="text-muted-foreground text-xs font-mono">Operated by RZR Music Group LLC</p>
            <p className="text-muted-foreground font-mono text-[10px]">Last updated: April 2026</p>
            <div className="mt-4 h-px bg-border/40" />
          </div>
          {ALL_TERMS_SECTIONS.map((s) => (
            <div key={s.num}>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0 leading-5">{s.num}</span>
                <h3 className="font-display font-bold text-sm sm:text-base">{s.title}</h3>
              </div>
              <TermsBody body={s.body} />
              <div className="mt-7 h-px bg-border/20" />
            </div>
          ))}
          <div className="pb-2 text-center">
            <p className="font-mono text-xs text-muted-foreground">© 2026 Reizor. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const PLANS = [
  {
    key: "standard",
    label: "Standard",
    basePrice: 4.99,
    icon: Star,
    color: "text-accent border-accent/40 bg-accent/5",
    highlight: false,
    perks: ["Loyalty badge on profile", "🎟 1 raffle entry per eligible event"],
  },
  {
    key: "premium",
    label: "Premium",
    basePrice: 9.99,
    icon: Crown,
    color: "text-primary border-primary/40 bg-primary/5",
    highlight: true,
    perks: ["Premium loyalty badge", "Priority support", "🎟 3 raffle entries per eligible event (3× chances)"],
  },
];

export default function MembershipSection({ loyalty, onUpdate }) {
   const [purchasing, setPurchasing] = useState(null);
   const [currentUser, setCurrentUser] = useState(null);
   const [membershipClientSecret, setMembershipClientSecret] = useState(null);
   const [membershipAmount, setMembershipAmount] = useState(null);
   const [membershipPlan, setMembershipPlan] = useState(null);
   const [membershipPlanKey, setMembershipPlanKey] = useState(null);
   // status: "idle" | "processing" | "success" | "failed" | "cancelled"
   const [checkoutStatus, setCheckoutStatus] = useState("idle");
   const [checkoutError, setCheckoutError] = useState("");
   const [showRaffleTerms, setShowRaffleTerms] = useState(false);

   useEffect(() => {
     base44.auth.me().then(setCurrentUser).catch(() => {});
   }, []);

   if (detectIsIOS()) return null;

   const CC_FEE = 0.03;

   const totalPrice = (base) => (base * (1 + CC_FEE)).toFixed(2);

   const activePlan = PLANS.find((p) => p.key === loyalty?.membership_plan && loyalty?.membership_status === "active");
   const isExpired = loyalty?.membership_status === "expired";
   const expiresAt = loyalty?.membership_expires_at ? new Date(loyalty.membership_expires_at) : null;

   const handlePurchase = async (plan) => {
     setPurchasing(plan.key);
     setCheckoutError("");
     try {
       const res = await base44.functions.invoke("stripeMembershipCheckout", {
         planKey: plan.key,
         loyaltyAccountId: loyalty.id,
       });
       if (res?.data?.clientSecret) {
         setMembershipClientSecret(res.data.clientSecret);
         setMembershipAmount(totalPrice(plan.basePrice));
         setMembershipPlan(plan.label);
         setMembershipPlanKey(plan.key);
         setCheckoutStatus("processing");
       } else {
         setCheckoutError("Payment setup failed. Please try again.");
         setCheckoutStatus("failed");
       }
     } catch (err) {
       setCheckoutError(err.response?.data?.error || err.message || "Payment setup failed.");
       setCheckoutStatus("failed");
     }
     setPurchasing(null);
   };

   const handleMembershipSuccess = async () => {
     setMembershipClientSecret(null);
     setCheckoutStatus("success");
     // Refresh loyalty data so UI updates immediately
     const updated = await base44.entities.LoyaltyAccount.filter({ user_email: currentUser?.email }, null, 1);
     if (updated[0]) onUpdate(updated[0]);
   };

   const handleMembershipFailed = (msg) => {
     setMembershipClientSecret(null);
     setCheckoutError(msg || "Membership payment failed. Please try again or use another payment method.");
     setCheckoutStatus("failed");
   };

   const handleMembershipModalClose = () => {
     setMembershipClientSecret(null);
     if (checkoutStatus === "processing") {
       setCheckoutStatus("cancelled");
     }
   };

   const resetCheckout = () => {
     setCheckoutStatus("idle");
     setCheckoutError("");
     setMembershipClientSecret(null);
     setMembershipAmount(null);
     setMembershipPlan(null);
     setMembershipPlanKey(null);
   };

  return (
    <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">Premium Membership</span>
      </div>

      {activePlan ? (
        <div className={`p-4 rounded-lg border ${activePlan.color}`}>
          <div className="flex items-center gap-2 mb-1">
            <activePlan.icon className="w-4 h-4" />
            <p className="font-display font-bold">{activePlan.label} Membership</p>
            <span className="ml-auto font-mono text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded uppercase">Active</span>
          </div>
          <p className="text-sm text-muted-foreground">You have an active <span className="font-bold text-foreground">{activePlan.label}</span> membership.</p>
          {expiresAt && (
            <p className="text-xs font-mono text-muted-foreground mt-1">Renews: {format(expiresAt, "MMM dd, yyyy")}</p>
          )}
        </div>
      ) : (
        <>
          {isExpired && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              Your membership has expired. Renew below to restore your membership benefits.
            </div>
          )}
          {!activePlan && !isExpired && (
            <p className="text-sm text-muted-foreground">
              Join a membership plan to unlock exclusive raffle entry bonuses and priority support.
            </p>
          )}
        </>
      )}

      {/* ── Checkout status banners ── */}
      {checkoutStatus === "success" && (
        <div className="p-4 rounded-xl bg-green-400/10 border border-green-400/30 text-center space-y-2">
          <p className="text-2xl">🎉</p>
          <p className="font-display font-bold text-green-400">Membership activated successfully!</p>
          <p className="text-sm text-muted-foreground">Your {membershipPlan} membership is now active. Enjoy your perks!</p>
          <Button variant="outline" size="sm" onClick={resetCheckout}>Close</Button>
        </div>
      )}
      {checkoutStatus === "failed" && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-center space-y-2">
          <p className="text-2xl">❌</p>
          <p className="font-display font-bold text-destructive">Membership payment failed</p>
          <p className="text-sm text-muted-foreground">{checkoutError || "Please try again or use another payment method."}</p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" onClick={resetCheckout}>Try Again</Button>
            <Button variant="outline" size="sm" onClick={resetCheckout}>Cancel</Button>
          </div>
        </div>
      )}
      {checkoutStatus === "cancelled" && (
        <div className="p-4 rounded-xl bg-muted/40 border border-border/50 text-center space-y-2">
          <p className="text-2xl">🚫</p>
          <p className="font-display font-bold text-muted-foreground">Membership checkout was canceled</p>
          <p className="text-sm text-muted-foreground">No charge was made. You can try again whenever you're ready.</p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" onClick={resetCheckout}>Try Again</Button>
            <Button variant="outline" size="sm" onClick={resetCheckout}>Dismiss</Button>
          </div>
        </div>
      )}

      <div className={`grid sm:grid-cols-2 gap-3 items-stretch ${checkoutStatus !== "idle" ? "opacity-50 pointer-events-none" : ""}`}>
        {PLANS.map((plan) => {
          const isActive = plan.key === loyalty?.membership_plan && loyalty?.membership_status === "active";
          const isStandardActive = loyalty?.membership_plan === "standard" && loyalty?.membership_status === "active";
          const ccAmount = (plan.basePrice * CC_FEE).toFixed(2);
          const buttonLabel = purchasing === plan.key
            ? "Processing..."
            : isActive
              ? "✓ Active"
              : isExpired
                ? "Renew"
                : plan.key === "premium" && isStandardActive
                  ? "Upgrade Membership"
                  : "Join Now";
          return (
            <div key={plan.key} className={`relative rounded-xl border p-4 flex flex-col transition-all ${plan.highlight ? "border-primary/50 bg-primary/5" : "border-border/50 bg-secondary/30"}`}>
              {plan.highlight && (
                <span className="absolute -top-2 right-3 font-mono text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full uppercase">Best Value</span>
              )}
              <div className="flex items-center gap-2 mb-3">
                <plan.icon className={`w-4 h-4 ${plan.highlight ? "text-primary" : "text-accent"}`} />
                <span className="font-display font-bold">{plan.label}</span>
              </div>
              <div className="mb-3">
                <p className="font-mono text-2xl font-black">${totalPrice(plan.basePrice)}<span className="text-sm font-normal text-muted-foreground">/yr</span></p>
                <p className="text-[10px] font-mono text-muted-foreground">${plan.basePrice.toFixed(2)} + ${ccAmount} CC fee</p>
              </div>
              <ul className="space-y-1 flex-1 mb-4">
                {plan.perks.map((perk, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Check className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                    {perk}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handlePurchase(plan)}
                disabled={isActive || !!purchasing || checkoutStatus === "processing"}
                variant={plan.highlight ? "default" : "outline"}
                className={`w-full font-display font-bold text-sm ${plan.highlight ? "glow-lime" : ""}`}
              >
                {buttonLabel}
              </Button>
            </div>
          );
        })}
      </div>{/* end grid */}
      <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3">
        <button onClick={() => setShowRaffleTerms(true)} className="text-[10px] font-mono text-primary hover:underline">See full raffle terms →</button>
      </div>

      {showRaffleTerms && <RaffleTermsModal onClose={() => setShowRaffleTerms(false)} />}
      <p className="text-[10px] text-muted-foreground font-mono text-center">All prices include a 3% credit card processing fee. Memberships auto-renew annually.</p>

      {membershipClientSecret && (
        <StripePaymentModal
          clientSecret={membershipClientSecret}
          amount={membershipAmount}
          label={`${membershipPlan} Membership`}
          onSuccess={handleMembershipSuccess}
          onPaymentFailed={handleMembershipFailed}
          onClose={handleMembershipModalClose}
        />
      )}
    </div>
  );
}