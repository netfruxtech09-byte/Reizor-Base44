import { useState } from 'react';
import { Share2, Copy, Check, Users, Gift, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { safeShare } from '@/lib/mobileShare';

export default function ReferralCTA({ userId, userName }) {
  const [copied, setCopied] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Only show to logged-in users
  if (!userId) return null;

  const referralLink = `${window.location.origin}?ref=ref_${userId?.slice(-8)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Referral link copied');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleShare = async () => {
    const result = await safeShare({
      title: 'Join me on Reizor',
      text: 'Check out Reizor — discover and book independent artists and events.',
      url: referralLink,
    });
    if (result.reason === 'aborted') return;
    if (result.method !== 'native') {
      // Fallback: open the info panel so the link + copy button is visible
      setShowInfo(true);
    }
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setShowInfo(!showInfo)}
        className="w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-primary/30 hover:bg-primary/5 transition-colors">
        <Share2 className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1 text-left">
          <p className="font-bold text-sm">Invite & Earn $3</p>
          <p className="text-xs text-muted-foreground">Share your link — you earn $3 per qualifying referral</p>
        </div>
      </button>

      {showInfo && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Your Referral Link</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 text-xs font-mono bg-background px-3 py-2.5 rounded-lg border border-border/50 truncate">
                {referralLink}
              </code>
              <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0 gap-2 min-h-[40px] font-bold">
                {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </Button>
            </div>
            <Button onClick={handleShare} variant="outline" className="w-full mt-2 gap-2 min-h-[40px] font-bold">
              <Share2 className="w-4 h-4" /> Share Link
            </Button>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/20">
            <p className="text-xs font-bold uppercase tracking-wider">How It Works</p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <Users className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                <span>Share your unique referral link with friends.</span>
              </div>
              <div className="flex gap-2">
                <Gift className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                <span>When someone joins through your referral link and completes the required fan membership step, you receive a $3 affiliate reward. The person joining does not receive a referral reward.</span>
              </div>
              <div className="flex gap-2">
                <TrendingUp className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                <span>Your $3 reward is locked for 90 days, then becomes available in your affiliate dashboard.</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/80 pt-1 border-t border-border/10">
              Self-referrals, duplicate accounts, and invalid or expired codes are not eligible.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}