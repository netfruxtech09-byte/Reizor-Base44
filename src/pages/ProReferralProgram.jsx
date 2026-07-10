import { useState, useEffect } from "react";
import { Link2, Copy, Check, DollarSign, Users, Clock, Lock, Unlock, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, addDays, isPast } from "date-fns";
import { getAppUrl } from "@/lib/appUrl";

export default function ProReferralProgram() {
  const [user, setUser] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const refs = await base44.entities.Referral.filter({ referrer_email: u.email }, "-created_date", 200);
      setReferrals(refs.filter(r => r.referral_type === "fan_membership"));
      setLoading(false);
    });
  }, []);

  const referralCode = user?.id ? `ref_${user.id.slice(-8)}` : null;
  const referralLink = referralCode ? getAppUrl(`/?ref=${referralCode}`) : null;

  const copy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const now = new Date();
  const lockedRefs = referrals.filter(r => r.unlock_date && !isPast(new Date(r.unlock_date)));
  const availableRefs = referrals.filter(r => r.unlock_date && isPast(new Date(r.unlock_date)) && r.status !== "withdrawn");
  const lockedTotal = lockedRefs.reduce((s, r) => s + (r.credit_earned || 0), 0);
  const availableTotal = availableRefs.reduce((s, r) => s + (r.credit_earned || 0), 0);
  const totalEarned = referrals.reduce((s, r) => s + (r.credit_earned || 0), 0);

  const fanMembershipRefs = referrals.filter(r => r.referral_type === "fan_membership");

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">AFFILIATE REFERRAL PROGRAM</h1>
        <p className="text-sm text-muted-foreground mt-1">Invite people and earn $3. When someone joins through your referral link and completes the required fan membership step, you receive a $3 affiliate reward.</p>
      </div>

      {/* Your link */}
      <div className="p-5 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
        <p className="font-mono text-xs text-primary font-bold uppercase tracking-wider">Your Referral Link</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-background border border-border/50 rounded-md px-3 py-2 font-mono text-xs text-muted-foreground truncate">
            {referralLink}
          </div>
          <Button size="sm" onClick={copy} className="gap-2 shrink-0">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Share this link with friends. You earn $3 only after they complete the fan membership step — the person joining does not receive a referral reward.</p>
      </div>

      {/* Earnings breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
          <DollarSign className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="font-mono text-xl font-black">${totalEarned.toFixed(2)}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Total Earned</p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-green-400/20 text-center">
          <Unlock className="w-4 h-4 text-green-400 mx-auto mb-1" />
          <p className="font-mono text-xl font-black text-green-400">${availableTotal.toFixed(2)}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Available</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
          <Users className="w-4 h-4 text-accent mx-auto mb-1" />
          <p className="font-mono text-xl font-black">{referrals.length}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Referrals</p>
        </div>
      </div>

      {/* How it works */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <p className="font-display font-bold flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> How You Earn</p>
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="font-mono text-xs text-primary font-bold uppercase tracking-widest mb-1">Fan completes membership</p>
          <p className="font-mono text-2xl font-black text-primary">$3</p>
          <p className="text-xs text-muted-foreground">when someone joins through your referral link and completes the required fan membership step. Only you receive the reward — the person joining does not.</p>
        </div>
        <p className="text-xs text-muted-foreground font-mono">Benefits are non-refundable and non-cash. Referral rewards are handled according to Reizor's program rules.</p>
      </div>

      {/* Referral history */}
      {referrals.length > 0 && (
        <div className="space-y-3">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Referral History</p>
          <div className="space-y-2">
            {referrals.map(r => {
              const unlocked = r.unlock_date && isPast(new Date(r.unlock_date));
              const daysLeft = r.unlock_date && !unlocked
                ? Math.ceil((new Date(r.unlock_date) - now) / (1000 * 60 * 60 * 24))
                : 0;
              return (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50 text-sm">
                  <div>
                    <p className="font-bold">{r.referred_name || r.referred_email}</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {"⭐ Fan Membership"}
                      {r.created_date && ` · ${format(new Date(r.created_date), "MMM dd, yyyy")}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-mono font-bold ${unlocked ? "text-green-400" : "text-yellow-400"}`}>
                      +${(r.credit_earned || 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 justify-end">
                      {unlocked
                        ? <><Unlock className="w-3 h-3 text-green-400" /> Available</>
                        : <><Lock className="w-3 h-3 text-yellow-400" /> {daysLeft}d left</>
                      }
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}