import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const TERMS_TEXT = `CASHBACK PROGRAM TERMS & CONDITIONS

By participating in Reizor's Cashback Program, you agree to the following terms:

1. PROGRAM OVERVIEW
The Cashback Program allows artists, organizers, and white-label partners to earn credits through ticket sales, fan memberships, and referrals. Credits are subject to a 90-day holding period before withdrawal.

2. ELIGIBILITY
You must be an active artist, organizer, or white-label partner on Reizor. Your account must remain in good standing to participate.

3. CREDIT EARNING
• $5 credit per referred fan membership signup
• $20 credit per referred pro (artist/organizer/whitelabel) signup
• 5% referral bonus on ticket purchases using your referral code
• Additional cashback rewards based on your loyalty tier and membership status

4. HOLDING PERIOD
All credits earned are locked for 90 days from the date earned. You cannot withdraw, transfer, or use locked credits during this period. After 90 days, credits become available for withdrawal or platform use.

5. CREDIT USAGE
Available credits can be used to:
• Purchase event tickets for yourself or others
• Pay platform fees for your events
• Redeem via bank transfer or PayPal (subject to withdrawal terms)

Credits are non-transferable and have no cash value unless explicitly redeemed through Reizor.

6. WITHDRAWAL & PAYOUTS
To withdraw credits as cash:
• Minimum withdrawal: $10
• Processing time: 5-7 business days
• PayPal or bank transfer only
• Reizor reserves the right to withhold payouts for suspicious activity

7. PROGRAM TERMINATION
Your account and all credits may be forfeited if you:
• Engage in fraud or abuse of the program
• Violate Reizor's terms of service
• Create fake referrals or manipulate the system
• Repeatedly fail to honor comp ticket commitments (for Pro tier participants)

8. COMMISSION & TIER COMMITMENT
Pro participants (artists/organizers) who refer other professionals must commit to allocating a portion of their guest list to comped tickets:
• Tier 1: 30% of 10 guest slots = 3 comp tickets per event
• Tier 2: 40% of 20 guest slots = 8 comp tickets per event
• Tier 3: 50% of 50 guest slots = 25 comp tickets per event

9. MODIFICATION
Reizor may modify these terms at any time. Continued participation constitutes acceptance of updated terms.

10. DISPUTES
All disputes are subject to Reizor's dispute resolution process and Terms & Conditions.

By signing below, you acknowledge that you have read, understood, and agree to these Cashback Program Terms & Conditions.`;

export default function CashbackTermsModal({ userRole, onAccept }) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [signing, setSigning] = useState(false);
  const scrollRef = useRef(null);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Check if scrolled within 50px of bottom
    if (scrollHeight - scrollTop - clientHeight < 50) {
      setScrolledToBottom(true);
    }
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.CashbackTermsSignature.create({
        user_email: user.email,
        user_name: user.full_name || user.email,
        user_role: userRole,
        signed_at: new Date().toISOString(),
        accepted: true,
      });
      toast.success("Terms accepted! You're all set for the Cashback Program.");
      onAccept();
    } catch (err) {
      toast.error("Failed to record signature. Please try again.");
      console.error(err);
    }
    setSigning(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl border border-border/50 shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="border-b border-border/30 px-6 py-4">
          <h2 className="font-display font-black text-2xl tracking-tight">CASHBACK PROGRAM</h2>
          <p className="text-sm text-muted-foreground mt-1">Terms & Conditions</p>
        </div>

        {/* Content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
        >
          {TERMS_TEXT.split("\n\n").map((para, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {para}
            </p>
          ))}
        </div>

        {/* Scroll Indicator */}
        {!scrolledToBottom && (
          <div className="px-6 py-3 bg-accent/10 border-t border-accent/20 text-center text-xs text-accent font-mono">
            👇 Scroll to the bottom to continue
          </div>
        )}

        {/* Footer / Actions */}
        <div className="border-t border-border/30 px-6 py-4 flex gap-3">
          <Button
            onClick={handleSign}
            disabled={!scrolledToBottom || signing}
            className={`flex-1 font-display font-bold gap-2 ${
              scrolledToBottom && !signing ? "glow-lime" : ""
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {signing ? "Recording..." : "I Have Read & Agree"}
          </Button>
        </div>
      </div>
    </div>
  );
}