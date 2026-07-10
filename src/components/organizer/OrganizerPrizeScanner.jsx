import { useState } from "react";
import { QrCode, X, CheckCircle2, AlertCircle, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function OrganizerPrizeScanner({ giveaway, onClose, onRedeemed }) {
  const [mode, setMode] = useState("input"); // "input" | "scan" | "success" | "error"
  const [redemptionCode, setRedemptionCode] = useState("");
  const [prizeData, setPrizeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const handleRedeemPrize = async () => {
    if (!redemptionCode.trim()) {
      setErrorMsg("Enter or scan a redemption code");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // Call redemption endpoint
      const result = await base44.functions.invoke("prizePrizeRedemption", {
        action: "redeem",
        redemption_code: redemptionCode.trim(),
      });

      if (result.data.success) {
        setPrizeData(result.data.prize || {});
        setMode("success");
        toast.success("Prize redeemed successfully!");
        setTimeout(() => {
          setRedemptionCode("");
          setPrizeData(null);
          setMode("input");
          onRedeemed?.();
        }, 3000);
      }
    } catch (error) {
      const errorData = error.data || error;
      if (errorData.status === "already_redeemed") {
        setErrorMsg("This prize has already been claimed.");
      } else if (errorData.status === "expired") {
        setErrorMsg("This prize has expired and cannot be redeemed.");
      } else {
        setErrorMsg(errorData.error || "Prize not found or invalid code");
      }
      setMode("error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast.success("Code copied!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="font-display font-black text-lg flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" /> Redeem Prize
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {mode === "input" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter the redemption code from the QR code or manually from the user's My Prizes page.</p>
              <div>
                <Input
                  value={redemptionCode}
                  onChange={e => setRedemptionCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && handleRedeemPrize()}
                  placeholder="e.g., PRIZE-ABC123XYZ"
                  className="font-mono text-sm"
                  autoFocus
                />
              </div>
              <Button
                onClick={handleRedeemPrize}
                disabled={loading || !redemptionCode.trim()}
                className="w-full glow-lime"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
                {loading ? "Verifying..." : "Verify & Redeem"}
              </Button>
            </div>
          )}

          {mode === "success" && prizeData && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 rounded-full bg-green-400/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
              </div>
              <div>
                <p className="font-display font-bold text-lg mb-1">Prize Claimed!</p>
                <p className="text-sm text-muted-foreground">Redemption successful</p>
              </div>

              <div className="bg-secondary/40 border border-border/50 rounded-lg p-4 space-y-2 text-left text-xs">
                <div>
                  <p className="text-muted-foreground font-mono uppercase text-[10px]">Prize</p>
                  <p className="font-bold">{prizeData.title || "Unknown Prize"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-mono uppercase text-[10px]">Winner</p>
                  <p className="font-bold">{prizeData.winner || "N/A"}</p>
                </div>
                {prizeData.email && (
                  <div>
                    <p className="text-muted-foreground font-mono uppercase text-[10px]">Email</p>
                    <p className="font-mono text-[10px] truncate">{prizeData.email}</p>
                  </div>
                )}
                {prizeData.giveaway && (
                  <div>
                    <p className="text-muted-foreground font-mono uppercase text-[10px]">Giveaway</p>
                    <p className="font-bold">{prizeData.giveaway}</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">Closing in 3 seconds...</p>
            </div>
          )}

          {mode === "error" && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
              </div>
              <div>
                <p className="font-display font-bold text-lg mb-1">Cannot Redeem</p>
                <p className="text-sm text-destructive">{errorMsg}</p>
              </div>

              <Button
                onClick={() => {
                  setMode("input");
                  setRedemptionCode("");
                  setErrorMsg("");
                }}
                variant="outline"
                className="w-full"
              >
                Try Another Code
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}