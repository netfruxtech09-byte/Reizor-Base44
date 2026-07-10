import { useNavigate } from "react-router-dom";
import { Sparkles, Users, Rss, Trophy, QrCode, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModalPortal from "@/components/shared/ModalPortal";
import { markFanOnboardingSeen } from "@/lib/onboardingGuides";

const POINTS = [
  { icon: Users, color: "text-accent", text: <>Find organizers and artists you follow under <span className="text-foreground font-bold">Profile → Following</span>.</> },
  { icon: Rss, color: "text-primary", text: <>See posts and media from accounts you follow in your <span className="text-foreground font-bold">Feed</span>.</> },
  { icon: Trophy, color: "text-yellow-400", text: <>Prizes you win from giveaways show up under <span className="text-foreground font-bold">Profile → My Prizes</span>.</> },
  { icon: QrCode, color: "text-primary", text: "Giveaway prizes may include a QR code and a redemption code." },
  { icon: MapPin, color: "text-destructive", text: "Prizes must be claimed at the bar, event desk, or organizer location, per the prize instructions." },
];

export default function FanOnboardingModal({ onClose }) {
  const navigate = useNavigate();

  const handleDismiss = async () => {
    await markFanOnboardingSeen();
    onClose();
  };

  const handleViewProfile = async () => {
    await markFanOnboardingSeen();
    onClose();
    navigate("/fan-profile");
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
            <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-black text-xl tracking-tight">Welcome to Reizor! 🎉</h2>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">A quick guide to get you started</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {POINTS.map((p, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/40 border border-border/40">
                <p.icon className={`w-4 h-4 mt-0.5 shrink-0 ${p.color}`} />
                <p className="text-sm text-muted-foreground leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button onClick={handleViewProfile} className="flex-1 glow-lime font-display font-bold">
              View My Profile
            </Button>
            <Button variant="outline" onClick={handleDismiss} className="flex-1">
              Got It
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}