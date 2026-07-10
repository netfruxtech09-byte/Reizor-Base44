import { useNavigate } from "react-router-dom";
import { Trophy, Bell, FolderOpen, QrCode, ScanLine, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModalPortal from "@/components/shared/ModalPortal";
import { markPrizeGuideSeen } from "@/lib/onboardingGuides";

const STEPS = [
  { icon: Bell, text: "If you win, you'll get an in-app notification and email." },
  { icon: FolderOpen, text: "Your prize will appear in Profile → My Prizes." },
  { icon: QrCode, text: "Open the prize to view the QR code and redemption code." },
  { icon: ScanLine, text: "Show the QR code at the bar, event desk, or authorized organizer staff." },
  { icon: CheckCircle2, text: "Staff will scan and confirm the claim." },
  { icon: Trophy, text: 'After redemption, the prize will show "Already Used" and cannot be claimed again.' },
];

export default function PrizeGuideModal({ onClose }) {
  const navigate = useNavigate();

  const handleDismiss = async () => {
    await markPrizeGuideSeen();
    onClose();
  };

  const handleGoToPrizes = async () => {
    await markPrizeGuideSeen();
    onClose();
    navigate("/my-prizes");
  };

  return (
    <ModalPortal open={true} onBackdropClick={handleDismiss}>
      <div
        className="w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "calc(100dvh - var(--bottom-nav-height) - 32px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-yellow-400/15 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="font-display font-black text-xl tracking-tight">You're In! 🎉</h2>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">Here's how prize claiming works</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/40 border border-border/40">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button onClick={handleGoToPrizes} className="flex-1 glow-lime font-display font-bold">
              Go to My Prizes
            </Button>
            <Button variant="outline" onClick={handleDismiss} className="flex-1">
              Got It
            </Button>
          </div>
          <button onClick={handleDismiss} className="text-xs text-muted-foreground hover:text-foreground text-center w-full font-mono">
            Do not show again
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}