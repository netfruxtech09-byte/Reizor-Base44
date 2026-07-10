import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Check, DollarSign, Users, Lock, Unlock, QrCode, TrendingUp, Calendar, Star, ChevronDown, ChevronUp, ArrowRight, Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, isPast, startOfMonth, startOfYear } from "date-fns";
import { detectIsIOS } from "@/hooks/useIsIOS";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AffiliateProgram() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      if (!u) { setLoading(false); return; }
      setUser(u);
      const refs = await base44.entities.Referral.filter({ referrer_email: u.email }, "-created_date", 500).catch(() => []);
      setReferrals(refs.filter(r => ["fan_membership", "pro_signup", "affiliate"].includes(r.referral_type)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const referralCode = user?.id ? `ref_${user.id.slice(-8)}` : null;
  const referralLink = referralCode ? `${window.location.origin}/?ref=${referralCode}` : null;
  const qrUrl = referralLink ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=ff1b8d&bgcolor=0a0c17&data=${encodeURIComponent(referralLink)}` : null;
  const isAffiliate = user?.is_affiliate;

  const joinAffiliate = async () => {
    setJoining(true);
    await base44.auth.updateMe({ is_affiliate: true });
    setUser(u => ({ ...u, is_affiliate: true }));
    setJoining(false);
    toast.success("Welcome to the Affiliate Program! 🎉");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const now = new Date();
  const yearStart = startOfYear(now);

  // Stats
  const totalEarned = referrals.reduce((s, r) => s + (r.credit_earned || 0), 0);
  const lockedTotal = referrals.filter(r => r.unlock_date && !isPast(new Date(r.unlock_date))).reduce((s, r) => s + (r.credit_earned || 0), 0);
  const availableTotal = referrals.filter(r => r.unlock_date && isPast(new Date(r.unlock_date)) && r.status !== "withdrawn").reduce((s, r) => s + (r.credit_earned || 0), 0);
  const ytdEarned = referrals.filter(r => r.created_date && new Date(r.created_date) >= yearStart).reduce((s, r) => s + (r.credit_earned || 0), 0);

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    const map = {};
    referrals.forEach(r => {
      if (!r.created_date) return;
      const d = new Date(r.created_date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if (!map[key]) map[key] = { label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, earned: 0, signups: 0, refs: [] };
      map[key].earned += r.credit_earned || 0;
      map[key].signups += 1;
      map[key].refs.push(r);
    });
    return Object.entries(map).sort((a,b) => b[0].localeCompare(a[0])).map(([k,v]) => ({ key: k, ...v }));
  }, [referrals]);

  if (detectIsIOS()) return null;
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl bg-card border border-border/50">
        <div className="w-14 h-14 rounded-2xl bg-green-400/10 flex items-center justify-center mx-auto">
          <DollarSign className="w-7 h-7 text-green-400" />
        </div>
        <div>
          <h2 className="font-display font-black text-2xl tracking-tight mb-2">Affiliate Program</h2>
          <p className="text-sm text-muted-foreground">Please log in or create an account to start earning commissions by promoting events.</p>
        </div>
        <div className="flex flex-col gap-3">
          <Button onClick={() => base44.auth.redirectToLogin('/affiliate-program')} className="w-full glow-lime font-display font-bold">
            Log In
          </Button>
          <Button variant="outline" onClick={() => base44.auth.redirectToLogin('/affiliate-program')} className="w-full font-display font-bold">
            Create Account
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 py-8">
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")}
        className="flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-primary" />
          <span className="font-mono text-xs text-primary uppercase tracking-widest font-bold">Affiliate Program</span>
          {isAffiliate && <span className="font-mono text-[10px] bg-green-400/10 text-green-400 px-2 py-0.5 rounded-full font-bold">Active</span>}
        </div>
        <h1 className="font-display font-black text-3xl tracking-tight">AFFILIATE REFERRAL</h1>
        <p className="text-sm text-muted-foreground mt-1">Share your link, earn cash credits for every signup — no commitments required.</p>
      </div>

      {/* How it works — combined card: $3 Per Referral + How to Join */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <p className="font-display font-bold flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> How You Earn</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="font-mono text-[10px] text-primary font-bold uppercase tracking-widest mb-1">$3 Per Referral</p>
            <p className="font-mono text-3xl font-black text-primary">$3</p>
            <p className="text-xs text-muted-foreground mt-1">per fan who signs up for any membership via your link</p>
          </div>
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
            <p className="font-mono text-[10px] text-accent font-bold uppercase tracking-widest mb-1">How to Join</p>
            <p className="text-sm font-bold text-foreground mt-1">It's free — no commitments</p>
            <p className="text-xs text-muted-foreground mt-1">Activate your affiliate account below, share your unique link, and earn credits automatically for every signup.</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-3">
          ⏳ Payout will be distributed <span className="text-yellow-400 font-bold">14 days after the date the new member signs up</span>. Platform may modify this program at any time.
        </p>
      </div>

      {/* Join / Activate */}
      {!isAffiliate ? (
        <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/30 text-center space-y-4">
          <p className="font-display font-black text-xl">Join the Affiliate Program</p>
          <p className="text-sm text-muted-foreground">It's free. No commitments. Just share your link and earn.</p>
          <Button onClick={joinAffiliate} disabled={joining} className="glow-lime font-display font-bold px-8 h-11">
            {joining ? "Activating..." : "Activate My Affiliate Account →"}
          </Button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: DollarSign, label: "Total Earned", value: `$${totalEarned.toFixed(2)}`, color: "text-primary" },
              { icon: Lock, label: "Locked", value: `$${lockedTotal.toFixed(2)}`, color: "text-yellow-400" },
              { icon: Unlock, label: "Available", value: `$${availableTotal.toFixed(2)}`, color: "text-green-400" },
              { icon: Users, label: "Signups", value: referrals.length, color: "text-accent" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="p-4 rounded-xl bg-card border border-border/50 text-center">
                <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
                <p className={`font-mono text-xl font-black ${color}`}>{value}</p>
                <p className="font-mono text-[10px] text-muted-foreground uppercase">{label}</p>
              </div>
            ))}
          </div>

          {/* YTD */}
          <div className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Year-to-Date Earnings</p>
                <p className="font-display font-black text-2xl text-primary">${ytdEarned.toFixed(2)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] text-muted-foreground">{now.getFullYear()} YTD</p>
              <p className="text-sm font-bold">{referrals.filter(r => r.created_date && new Date(r.created_date) >= yearStart).length} referrals</p>
            </div>
          </div>

          {/* Referral Link */}
          <div className="p-5 rounded-xl bg-primary/5 border border-primary/30 space-y-4">
            <p className="font-mono text-xs text-primary font-bold uppercase tracking-wider">Your Affiliate Link</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-background border border-border/50 rounded-md px-3 py-2 font-mono text-xs text-muted-foreground truncate">
                {referralLink}
              </div>
              <Button size="sm" onClick={copy} className="gap-1.5 shrink-0">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Share on social media, in bio links, or anywhere. Anyone who signs up through this link earns you credits.</p>

            {/* QR Code */}
            <div>
              <button
                onClick={() => setShowQR(q => !q)}
                className="flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                <QrCode className="w-4 h-4" />
                {showQR ? "Hide QR Code" : "Show QR Code for Social Media"}
                {showQR ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showQR && qrUrl && (
                <div className="mt-4 flex flex-col items-center gap-3">
                  <div className="p-4 rounded-xl bg-card border border-border/50 inline-block">
                    <img src={qrUrl} alt="QR Code" className="w-[220px] h-[220px] rounded-lg" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center max-w-xs">Download this QR code and share it on your Instagram, TikTok, or anywhere — scans go directly to your affiliate link.</p>
                  <a href={qrUrl} download="affiliate-qr.png" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <QrCode className="w-3.5 h-3.5" /> Download QR Code
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Statements */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" />
              <h2 className="font-display font-bold">MONTHLY STATEMENTS</h2>
            </div>
            {monthlyData.length === 0 ? (
              <div className="p-8 rounded-xl bg-card border border-border/50 text-center">
                <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No referrals yet. Start sharing your link!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {monthlyData.map(month => (
                  <div key={month.key} className="rounded-xl bg-card border border-border/50 overflow-hidden">
                    <button
                      onClick={() => setExpandedMonth(m => m === month.key ? null : month.key)}
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div className="text-left">
                          <p className="font-bold">{month.label}</p>
                          <p className="text-xs font-mono text-muted-foreground">{month.signups} signup{month.signups !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-primary">${month.earned.toFixed(2)}</span>
                        {expandedMonth === month.key ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {expandedMonth === month.key && (
                      <div className="border-t border-border/30 divide-y divide-border/20">
                        {month.refs.map(r => {
                          const unlocked = r.unlock_date && isPast(new Date(r.unlock_date));
                          const daysLeft = r.unlock_date && !unlocked
                            ? Math.ceil((new Date(r.unlock_date) - new Date()) / (1000*60*60*24))
                            : 0;
                          return (
                            <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                              <div>
                                <p className="font-bold">{r.referred_name || r.referred_email}</p>
                                <p className="text-xs font-mono text-muted-foreground">
                                  {r.referral_type === "fan_membership" ? "⭐ Fan Membership" : "🚀 Pro Signup"}
                                  {r.created_date && ` · ${format(new Date(r.created_date), "MMM dd, yyyy")}`}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`font-mono font-bold ${unlocked ? "text-green-400" : "text-yellow-400"}`}>
                                  +${(r.credit_earned || 0).toFixed(2)}
                                </p>
                                <p className="text-[10px] font-mono text-muted-foreground">
                                  {unlocked ? "✓ Available" : `🔒 ${daysLeft}d left`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
    </div>
  );
}