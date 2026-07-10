import { useState, useEffect } from "react";
import { Copy, Check, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getAppUrl } from "@/lib/appUrl";

export default function ReferralWidget({ user }) {
  const [referrals, setReferrals] = useState([]);
  const [copied, setCopied] = useState(false);

  const referralCode = user?.id ? `ref_${user.id.slice(-8)}` : null;
  const referralLink = referralCode
    ? getAppUrl(`/?ref=${referralCode}`)
    : null;

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.Referral.filter({ referrer_email: user.email }, "-created_date", 50).then(setReferrals);
  }, [user?.email]);

  const copy = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const completed = referrals.filter((r) => r.status === "completed");
  const totalCreditEarned = completed.reduce((s, r) => s + (r.credit_earned || 0), 0);
  const totalCreditUsed = completed.reduce((s, r) => s + (r.credit_used || 0), 0);
  const remainingCredit = Math.max(0, totalCreditEarned - totalCreditUsed);

  return (
    <div className="space-y-4">
      {/* Reward info banner */}
      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-3">
        <Wallet className="w-5 h-5 text-primary shrink-0" />
        <div>
          <p className="text-sm font-bold text-primary">Earn $3 per eligible referral</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">When someone joins through your referral link and completes the required fan membership step, you receive a $3 affiliate reward. The person joining does not receive a referral reward. Your reward is locked for 90 days, then becomes available.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-card border border-border/50 text-center">
          <Users className="w-4 h-4 text-accent mx-auto mb-1" />
          <p className="font-mono text-lg font-bold">{completed.length}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Referred</p>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border/50 text-center">
          <Wallet className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="font-mono text-lg font-bold">${totalCreditEarned.toFixed(0)}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Earned</p>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border/50 text-center">
          <Wallet className="w-4 h-4 text-green-400 mx-auto mb-1" />
          <p className="font-mono text-lg font-bold text-green-400">${remainingCredit.toFixed(0)}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Available</p>
        </div>
      </div>

      {/* Link */}
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <p className="font-mono text-xs text-primary font-bold uppercase tracking-wider mb-2">Your Referral Link</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-background border border-border/50 rounded-md px-3 py-2 font-mono text-xs text-muted-foreground truncate">
            {referralLink}
          </div>
          <Button size="sm" onClick={copy} className="gap-2 shrink-0">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 font-mono">
          🎁 <span className="text-primary font-bold">Affiliate Referral:</span> Earn $3 when a referred user completes the fan membership step. Only you (the link owner) receive a reward — the person joining does not.
        </p>
      </div>

      {/* History */}
      {completed.length > 0 && (
        <div>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Credit History</p>
          <div className="space-y-2">
            {completed.slice(0, 10).map((r) => (
              <div key={r.id} className="flex justify-between items-center p-3 rounded-lg bg-card border border-border/50 text-sm">
                <div>
                  <p className="font-medium">{r.referred_name || r.referred_email}</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {r.created_date ? new Date(r.created_date).toLocaleDateString() : ""}
                    {r.id && <span className="ml-2 opacity-50">#{r.id.slice(-6)}</span>}
                  </p>
                </div>
                <span className="font-mono font-bold text-primary">+${(r.credit_earned || 0).toFixed(2)} credit</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}