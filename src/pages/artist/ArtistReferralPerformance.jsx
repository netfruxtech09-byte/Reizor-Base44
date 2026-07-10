import { useState, useEffect } from "react";
import { TrendingUp, Users, Zap, Share2, Copy, Check, Clock, CheckCircle, XCircle } from "lucide-react";
import { getAppUrl } from "@/lib/appUrl";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function ArtistReferralPerformance() {
  const [user, setUser] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      if (!u) { setLoading(false); return; }
      setUser(u);

      const [artists, refs] = await Promise.all([
        base44.entities.Artist.filter({ user_email: u.email }, null, 1).catch(() => []),
        base44.entities.Referral.filter({ referrer_email: u.email }, "-created_date", 500).catch(() => []),
      ]);

      if (artists[0]) setArtist(artists[0]);
      setReferrals(refs);
      setLoading(false);
    });
  }, []);

  const handleCopy = () => {
    const url = getAppUrl(`?ref=ref_${user?.id?.slice(-8)}`);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!user || !artist) return <div className="text-center py-20 text-muted-foreground">No artist profile found</div>;

  // Calculate stats
  const fanReferrals = referrals.filter(r => r.referral_type === "ticket");
  const proReferrals = referrals.filter(r => r.referral_type === "pro_signup");
  const completedReferrals = referrals.filter(r => r.status === "completed");
  const pendingReferrals = referrals.filter(r => r.status === "pending" || r.status === "locked");
  
  const totalCredits = completedReferrals.reduce((sum, r) => sum + (r.credit_earned || 0), 0);
  const pendingCredits = pendingReferrals.reduce((sum, r) => sum + (r.credit_earned || 0), 0);
  const lockedCredits = pendingReferrals.filter(r => r.status === "locked").reduce((sum, r) => sum + (r.credit_earned || 0), 0);

  const referralCode = `ref_${user.id?.slice(-8)}`;
  const shareUrl = getAppUrl(`?ref=${referralCode}`);

  const STATUS_ICONS = {
    completed: { icon: CheckCircle, color: "text-green-400" },
    pending: { icon: Clock, color: "text-yellow-400" },
    locked: { icon: Clock, color: "text-yellow-400" },
    withdrawn: { icon: XCircle, color: "text-destructive" },
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight mb-2">Referral Performance</h1>
        <p className="text-muted-foreground text-sm">Earn credits by referring fans and pro users to Reizor</p>
      </div>

      {/* Your Referral Link */}
      <div className="p-6 rounded-xl bg-card border border-border/50">
        <p className="font-display font-bold mb-3 flex items-center gap-2">
          <Share2 className="w-4 h-4" /> Your Referral Link
        </p>
        <div className="flex items-center gap-2 mb-3">
          <code className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border/50 font-mono text-xs truncate">
            {shareUrl}
          </code>
          <Button onClick={handleCopy} variant="outline" size="sm" className="shrink-0 gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground font-mono">Share this link on your socials to start earning credits</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border/50">
          <Users className="w-5 h-5 text-primary mb-2" />
          <p className="text-xs font-mono text-muted-foreground uppercase">Fan Referrals</p>
          <p className="font-display font-black text-2xl mt-1">{fanReferrals.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{fanReferrals.filter(r => r.status === "completed").length} completed</p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/50">
          <Zap className="w-5 h-5 text-accent mb-2" />
          <p className="text-xs font-mono text-muted-foreground uppercase">Pro Referrals</p>
          <p className="font-display font-black text-2xl mt-1">{proReferrals.length}</p>
          <p className="text-xs text-muted-foreground mt-1">${proReferrals.reduce((s, r) => s + (r.credit_earned || 0), 0).toFixed(2)} value</p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-accent/20 bg-accent/5">
          <TrendingUp className="w-5 h-5 text-accent mb-2" />
          <p className="text-xs font-mono text-accent uppercase font-bold">Completed Credits</p>
          <p className="font-display font-black text-2xl text-accent mt-1">${totalCredits.toFixed(2)}</p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/50">
          <Clock className="w-5 h-5 text-yellow-400 mb-2" />
          <p className="text-xs font-mono text-muted-foreground uppercase">Pending Credits</p>
          <p className="font-display font-black text-2xl mt-1">${pendingCredits.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">{lockedCredits > 0 ? `$${lockedCredits.toFixed(2)} locked` : "Ready to use"}</p>
        </div>
      </div>

      {/* Referral Program Info */}
      <div className="p-6 rounded-xl bg-primary/10 border border-primary/20">
        <p className="font-display font-bold text-sm mb-3">📈 How it works</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>💳 <strong>Fan Referrals:</strong> $5 credit for each fan who signs up for paid cashback membership</li>
          <li>👥 <strong>Pro Referrals:</strong> $20 credit for each artist/organizer/white-label who registers</li>
          <li>⏰ <strong>Lock Period:</strong> Credits locked for 90 days from signup date, then available to use</li>
          <li>🎯 <strong>Tier Commitment:</strong> Earn higher comp ticket allocations by reaching referral milestones</li>
        </ul>
      </div>

      {/* Referral List */}
      <div>
        <h2 className="font-display font-bold text-lg mb-4">All Referrals</h2>
        {referrals.length === 0 ? (
          <div className="p-6 rounded-xl bg-card border border-border/50 text-center text-muted-foreground">
            No referrals yet. Share your link to start earning credits!
          </div>
        ) : (
          <div className="space-y-3">
            {referrals.map((ref) => {
              const cfg = STATUS_ICONS[ref.status] || STATUS_ICONS.pending;
              const Icon = cfg.icon;
              const isProRef = ref.referral_type === "pro_signup";
              const unlockDate = ref.unlock_date ? new Date(ref.unlock_date) : null;
              const isLocked = ref.status === "locked" && unlockDate && unlockDate > new Date();

              return (
                <div key={ref.id} className="p-4 rounded-xl bg-card border border-border/50 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold truncate">{ref.referred_name || ref.referred_email}</p>
                      <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
                        isProRef ? "text-accent bg-accent/10" : "text-primary bg-primary/10"
                      }`}>
                        {isProRef ? "PRO" : "FAN"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{ref.referred_email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ref.event_title && `Event: ${ref.event_title}`}
                      {ref.referred_role && `Role: ${ref.referred_role}`}
                    </p>
                    {isLocked && unlockDate && (
                      <p className="text-xs text-yellow-400 font-mono mt-1">
                        🔒 Unlocks {unlockDate.toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-green-400">${ref.credit_earned?.toFixed(2) || "0.00"}</span>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded ${
                      ref.status === "completed" ? "text-green-400 bg-green-400/10" :
                      ref.status === "locked" ? "text-yellow-400 bg-yellow-400/10" :
                      ref.status === "pending" ? "text-yellow-400 bg-yellow-400/10" :
                      "text-destructive bg-destructive/10"
                    }`}>
                      {ref.status === "locked" ? "LOCKED" : ref.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tier Info */}
      {artist && (
        <div className="p-6 rounded-xl bg-card border border-border/50">
          <p className="font-display font-bold text-sm mb-4 flex items-center gap-2">🎯 Your Comp Tier Commitment</p>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <span className="font-mono">Tier 1: 30% of 10 guests</span>
              <span className="text-primary font-bold">3 guests allocated</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <span className="font-mono">Tier 2: 40% of 20 guests</span>
              <span className="text-primary font-bold">8 guests allocated</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <span className="font-mono">Tier 3: 50% of 50 guests</span>
              <span className="text-primary font-bold">25 guests allocated</span>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              By referring pro users, you unlock higher comp ticket allocations. Share your link to unlock Tier 2 and Tier 3 commitments!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}