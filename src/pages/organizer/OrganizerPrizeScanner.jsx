import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QrCodeIcon, CheckCircle, AlertCircle, Loader2, Copy, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import QRScannerWidget from "@/components/scanner/QRScannerWidget";

export default function OrganizerPrizeScanner() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(true);
  const [lastResult, setLastResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [confirming, setConfirming] = useState(null); // prize to confirm redemption for
  const [stats, setStats] = useState({
    total_awarded: 0,
    total_redeemed: 0,
    pending: 0,
  });

  useEffect(() => {
    base44.auth.me().then((u) => {
      if (!u) {
        navigate("/");
        return;
      }
      setUser(u);
      // Load stats immediately with the resolved user
      base44.entities.PrizeWallet.filter(
        { organizer_id: u.id },
        null,
        500
      ).then(prizes => {
        setStats({
          total_awarded: prizes.length,
          total_redeemed: prizes.filter((p) => p.status === "redeemed").length,
          pending: prizes.filter((p) => p.status === "unclaimed" || p.status === "won").length,
        });
      }).catch(() => {});
    });
  }, [navigate]);

  const loadStats = async () => {
    if (!user) return;
    try {
      const prizes = await base44.entities.PrizeWallet.filter(
        { organizer_id: user.id },
        null,
        500
      ).catch(() => []);
      setStats({
        total_awarded: prizes.length,
        total_redeemed: prizes.filter((p) => p.status === "redeemed").length,
        pending: prizes.filter((p) => p.status === "unclaimed" || p.status === "won").length,
      });
    } catch (e) {
      console.error("Error loading stats:", e);
    }
  };

  const handleScanSuccess = async (code) => {
    await validateAndShowPrize(code);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast.error("Enter a redemption code");
      return;
    }
    await validateAndShowPrize(manualCode.trim().toUpperCase());
    setManualCode("");
  };

  const validateAndShowPrize = async (code) => {
    setValidating(true);
    setLastResult(null);

    try {
      const prizes = await base44.entities.PrizeWallet.filter(
        { redemption_code: code },
        null,
        1
      ).catch(() => []);

      if (prizes.length === 0) {
        setLastResult({
          success: false,
          message: "Prize code not found",
          code,
        });
        toast.error("Prize code not found");
        setValidating(false);
        return;
      }

      const prize = prizes[0];

      // Check if already redeemed
      if (prize.status === "redeemed") {
        setLastResult({
          success: false,
          message: "Prize already redeemed",
          code,
          prize: prize.prize_title,
        });
        toast.error("This prize has already been redeemed");
        setValidating(false);
        return;
      }

      // Check if expired
      if (prize.status === "expired") {
        setLastResult({
          success: false,
          message: "Prize expired",
          code,
        });
        toast.error("This prize has expired");
        setValidating(false);
        return;
      }

      // Verify organizer owns this prize
      if (prize.organizer_id !== user.id) {
        setLastResult({
          success: false,
          message: "Unauthorized - not your prize",
          code,
        });
        toast.error("You do not have permission to redeem this prize");
        setValidating(false);
        return;
      }

      // Valid — show confirmation dialog
      setConfirming(prize);
      setValidating(false);
    } catch (error) {
      console.error("Validation error:", error);
      setLastResult({
        success: false,
        message: "Error validating prize",
        code,
      });
      toast.error("Error validating prize");
      setValidating(false);
    }
  };

  const confirmRedemption = async (prize) => {
    setValidating(true);
    try {
      await base44.entities.PrizeWallet.update(prize.id, {
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
        redeemed_by_email: user.email,
      });

      setLastResult({
        success: true,
        message: "Prize redeemed successfully!",
        prize: prize.prize_title,
        winner: prize.user_name,
        code: prize.redemption_code,
      });

      toast.success(`${prize.prize_title} redeemed for ${prize.user_name}`);
      setConfirming(null);
      loadStats();
    } catch (error) {
      console.error("Redemption error:", error);
      setLastResult({
        success: false,
        message: "Error processing redemption",
        code: prize.redemption_code,
      });
      toast.error("Error processing redemption");
    }
    setValidating(false);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/organizer")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-display font-black text-2xl flex items-center gap-2">
              <QrCodeIcon className="w-6 h-6 text-primary" /> Prize Redemption
            </h1>
            <p className="text-xs text-muted-foreground font-mono">Scan or enter codes to mark prizes as claimed</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-card border border-border/50">
            <p className="text-xs font-mono text-muted-foreground uppercase">Total Awarded</p>
            <p className="font-display font-black text-2xl mt-1">{stats.total_awarded}</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50">
            <p className="text-xs font-mono text-muted-foreground uppercase">Redeemed</p>
            <p className="font-display font-black text-2xl mt-1 text-green-400">{stats.total_redeemed}</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50">
            <p className="text-xs font-mono text-muted-foreground uppercase">Pending</p>
            <p className="font-display font-black text-2xl mt-1 text-yellow-400">{stats.pending}</p>
          </div>
        </div>

        {/* Scanner or Manual Entry */}
        <div className="space-y-6">
          {scanning && (
            <div className="p-6 rounded-xl bg-card border-2 border-primary/30">
              <QRScannerWidget onScanSuccess={handleScanSuccess} disabled={validating} />
            </div>
          )}

          {/* Manual Entry */}
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wide font-bold">
              Or Enter Code Manually
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="PRIZE-XXXXXXXXXXXX"
                className="flex-1 px-4 py-2.5 rounded-lg bg-secondary border border-white/25 text-sm font-mono uppercase focus:outline-none focus:border-primary"
                disabled={validating}
              />
              <Button
                type="submit"
                disabled={validating || !manualCode.trim()}
                className="gap-2"
              >
                {validating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCodeIcon className="w-4 h-4" />
                )}
                Claim
              </Button>
            </div>
          </form>

          {/* Confirmation Dialog */}
        {confirming && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-sm bg-card border border-border/50 rounded-2xl p-6 space-y-4">
              <h3 className="font-display font-bold text-lg">Confirm Prize Redemption</h3>
              <div className="space-y-2 p-4 rounded-lg bg-secondary/40 border border-border/50">
                <p className="text-sm"><strong>Prize:</strong> {confirming.prize_title}</p>
                <p className="text-sm"><strong>Winner:</strong> {confirming.user_name}</p>
                <p className="text-sm"><strong>Event:</strong> {confirming.event_title || "N/A"}</p>
                <p className="text-sm font-mono text-muted-foreground"><strong>Code:</strong> {confirming.redemption_code}</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setConfirming(null)} disabled={validating} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => confirmRedemption(confirming)} disabled={validating} className="flex-1 glow-lime">
                  {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Redemption"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Last Result */}
          {lastResult && (
            <div
              className={`p-5 rounded-xl border-2 ${
                lastResult.success
                  ? "bg-green-400/5 border-green-400/30"
                  : "bg-destructive/5 border-destructive/30"
              }`}
            >
              <div className="flex items-start gap-3">
                {lastResult.success ? (
                  <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-bold ${lastResult.success ? "text-green-400" : "text-destructive"}`}>
                    {lastResult.message}
                  </p>
                  {lastResult.prize && (
                    <p className="text-sm text-foreground mt-1">Prize: {lastResult.prize}</p>
                  )}
                  {lastResult.winner && (
                    <p className="text-sm text-muted-foreground">Winner: {lastResult.winner}</p>
                  )}
                  {lastResult.code && (
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs bg-black/30 px-2 py-1 rounded font-mono">
                        {lastResult.code}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(lastResult.code);
                          toast.success("Copied!");
                        }}
                        className="h-6 px-2"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}