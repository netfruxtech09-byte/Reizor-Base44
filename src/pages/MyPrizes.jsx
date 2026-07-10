import { useState, useEffect } from "react";
import { Gift, Trophy, QrCode, Clock, CheckCircle, AlertCircle, Copy, ArrowLeft, HelpCircle } from "lucide-react";
import PrizeGuideModal from "@/components/onboarding/PrizeGuideModal";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

export default function MyPrizes() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedQR, setExpandedQR] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [showPrizeGuide, setShowPrizeGuide] = useState(false);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/profile");
    }
  };

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      if (!u) { setLoading(false); return; }
      setUser(u);
      if (u.role !== "user") { setLoading(false); return; }
      const data = await base44.entities.PrizeWallet.filter(
        { user_email: u.email },
        "-created_date",
        100
      ).catch(() => []);
      setPrizes(data);
      setLoading(false);
    });
  }, []);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success("Code copied!");
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (user && user.role !== "user") {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <Trophy className="w-14 h-14 text-muted-foreground/30 mx-auto" />
        <p className="font-display font-bold text-xl">Fan Accounts Only</p>
        <p className="text-sm text-muted-foreground">Prizes are only available for fan accounts.</p>
        <Button variant="outline" onClick={handleBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 md:px-6">
      {/* Back Button */}
      <div className="mb-2 -mx-4 md:mx-0 px-4 md:px-0 pt-2 safe-top-header" data-safe-top>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-2xl md:text-2xl tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" /> MY PRIZES
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Your won prizes and rewards from giveaways</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowPrizeGuide(true)} className="gap-1.5 text-xs shrink-0">
          <HelpCircle className="w-3.5 h-3.5" /> Prize Guide
        </Button>
      </div>

      {prizes.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-display font-bold text-lg">No Prizes Yet</p>
          <p className="text-sm mt-1">Enter active giveaways for a chance to win!</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/giveaways">Browse Giveaways</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {prizes.map(prize => {
            const isRedeemed = prize.status === "redeemed";
            const isExpired = prize.status === "expired";
            const isActive = prize.status === "unclaimed" || prize.status === "won";

            const daysLeft = prize.expiry_date
              ? differenceInDays(new Date(prize.expiry_date), new Date())
              : null;

            const showQR = expandedQR === prize.id;

            return (
              <div
                key={prize.id}
                className={`p-5 rounded-xl border-2 transition-all ${
                  isRedeemed
                    ? "bg-destructive/5 border-destructive/30"
                    : isExpired
                    ? "bg-muted/30 border-muted/50 opacity-60"
                    : "bg-card border-primary/30"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                      isRedeemed ? "bg-destructive/15" : isActive ? "bg-primary/15" : "bg-muted"
                    }`}>
                      <Gift className={`w-6 h-6 ${isRedeemed ? "text-destructive" : isActive ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-bold text-lg">{prize.prize_title}</p>
                      {prize.giveaway_title && (
                        <p className="text-xs font-mono text-muted-foreground">From: {prize.giveaway_title}</p>
                      )}
                      {prize.event_title && (
                        <p className="text-xs font-mono text-muted-foreground">Event: {prize.event_title}</p>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  {isRedeemed && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-mono font-bold uppercase shrink-0">
                      <CheckCircle className="w-3 h-3" /> Already Used
                    </span>
                  )}
                  {isExpired && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-mono font-bold uppercase shrink-0">
                      <AlertCircle className="w-3 h-3" /> Expired
                    </span>
                  )}
                  {isActive && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-400/10 text-green-400 text-[10px] font-mono font-bold uppercase shrink-0">
                      <CheckCircle className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>

                {prize.prize_description && prize.prize_description !== prize.prize_title && (
                  <p className="text-sm text-muted-foreground mb-3">{prize.prize_description}</p>
                )}

                {/* Expiry / countdown */}
                {prize.expiry_date && isActive && (
                  <div className="mb-3 space-y-1">
                    <p className="text-xs font-mono text-muted-foreground">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Expires {format(new Date(prize.expiry_date), "MMMM d, yyyy")}
                    </p>
                    {daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
                      <p className="text-xs text-yellow-400 font-mono font-bold">
                        ⚠️ {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining — claim soon!
                      </p>
                    )}
                    {daysLeft !== null && daysLeft <= 0 && (
                      <p className="text-xs text-destructive font-mono font-bold">This prize has expired.</p>
                    )}
                  </div>
                )}

                {/* Redemption code + QR for active prizes */}
                {isActive && prize.redemption_code && (
                  <div className="space-y-3 p-3 rounded-lg bg-secondary/40 border border-border/50">
                    <div className="flex items-center gap-2 flex-wrap">
                      <QrCode className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground">Code:</span>
                      <code className="font-bold text-foreground text-xs font-mono">{prize.redemption_code}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(prize.redemption_code)}
                        className="h-6 px-2 ml-auto"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedCode === prize.redemption_code ? "Copied!" : "Copy"}
                      </Button>
                    </div>

                    {/* QR code toggle */}
                    {prize.qr_code_url && (
                      <>
                        {!showQR ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExpandedQR(prize.id)}
                            className="w-full gap-2 text-xs"
                          >
                            <QrCode className="w-4 h-4" /> Show QR Code
                          </Button>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <img
                              src={prize.qr_code_url}
                              alt="Redemption QR"
                              className="w-40 h-40 p-3 bg-white rounded-lg border border-border/50"
                            />
                            <p className="text-[10px] font-mono text-muted-foreground">Show this to staff to claim your prize</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedQR(null)}
                              className="text-xs"
                            >
                              Hide QR
                            </Button>
                          </div>
                        )}
                      </>
                    )}

                    {prize.redemption_instructions && (
                      <div className="text-xs text-muted-foreground p-2 rounded bg-black/20">
                        <p className="font-mono font-bold mb-1">How to claim:</p>
                        <p>{prize.redemption_instructions}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Redeemed info */}
                {isRedeemed && prize.redeemed_at && (
                  <div className="mt-3 text-xs font-mono text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Redeemed on {format(new Date(prize.redeemed_at), "MMMM d, yyyy")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showPrizeGuide && <PrizeGuideModal onClose={() => setShowPrizeGuide(false)} />}
    </div>
  );
}