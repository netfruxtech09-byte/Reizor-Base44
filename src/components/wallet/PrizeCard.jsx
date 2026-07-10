import { useState } from "react";
import { Gift, QrCode, Clock, CheckCircle, AlertCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PrizeCard({ prize, onRedeem }) {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const isRedeemed = prize.status === "redeemed";
  const isExpired = prize.status === "expired";
  const isActive = prize.status === "won" || prize.status === "unclaimed";

  const handleCopyCode = () => {
    navigator.clipboard.writeText(prize.redemption_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Code copied!");
  };

  return (
    <div
      className={`p-5 rounded-xl border-2 transition-all ${
        isRedeemed
          ? "bg-muted/40 border-muted/50 opacity-60"
          : isExpired
          ? "bg-destructive/5 border-destructive/20"
          : "bg-card border-primary/30 hover:border-primary/50"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
              isRedeemed
                ? "bg-muted"
                : isActive
                ? "bg-primary/15"
                : "bg-destructive/10"
            }`}
          >
            <Gift
              className={`w-6 h-6 ${
                isRedeemed ? "text-muted-foreground" : isActive ? "text-primary" : "text-destructive"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-lg">{prize.prize_title}</p>
            {prize.giveaway_title && (
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                From: {prize.giveaway_title}
              </p>
            )}
            {prize.event_title && (
              <p className="text-xs font-mono text-muted-foreground">Event: {prize.event_title}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          {isRedeemed && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-mono font-bold uppercase">
              <CheckCircle className="w-3 h-3" /> Already Used
            </span>
          )}
          {isExpired && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-mono font-bold uppercase">
              <AlertCircle className="w-3 h-3" /> Expired
            </span>
          )}
          {isActive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-400/10 text-green-400 text-[10px] font-mono font-bold uppercase">
              <CheckCircle className="w-3 h-3" /> Active
            </span>
          )}
        </div>
      </div>

      {prize.prize_description && (
        <p className="text-sm text-muted-foreground mb-3">{prize.prize_description}</p>
      )}

      {isActive && (
        <div className="space-y-3 mb-4 p-3 rounded-lg bg-secondary/40 border border-border/50">
          <div className="flex items-center gap-2 text-xs font-mono">
            <QrCode className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Redemption Code:</span>
            <code className="font-bold text-foreground">{prize.redemption_code}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopyCode}
              className="h-6 px-2 ml-auto text-[10px]"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>

          {prize.qr_code_url && (
            <>
              {!showQR ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowQR(true)}
                  className="w-full gap-2 text-xs"
                >
                  <QrCode className="w-4 h-4" /> Show QR Code
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={prize.qr_code_url}
                    alt="Redemption QR"
                    className="w-32 h-32 p-2 bg-white rounded"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowQR(false)}
                    className="text-xs"
                  >
                    Hide QR
                  </Button>
                </div>
              )}
            </>
          )}

          {prize.redemption_instructions && (
            <div className="text-[10px] text-muted-foreground p-2 rounded bg-black/20">
              <p className="font-mono font-bold mb-1">How to claim:</p>
              <p>{prize.redemption_instructions}</p>
            </div>
          )}
        </div>
      )}

      {isRedeemed && prize.redeemed_at && (
        <div className="text-xs font-mono text-muted-foreground">
          <Clock className="w-3 h-3 inline mr-1" />
          Redeemed on{" "}
          {new Date(prize.redeemed_at).toLocaleDateString()}
        </div>
      )}

      {prize.expiry_date && isActive && (
        <div className="space-y-1">
          <div className="text-xs font-mono text-muted-foreground">
            <Clock className="w-3 h-3 inline mr-1" />
            Expires {new Date(prize.expiry_date).toLocaleDateString()}
          </div>
          {(() => {
            const now = new Date();
            const expiry = new Date(prize.expiry_date);
            const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 7 && daysLeft > 0) {
              return (
                <div className="text-[10px] text-yellow-400 font-mono font-bold">
                  ⚠️ {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
}