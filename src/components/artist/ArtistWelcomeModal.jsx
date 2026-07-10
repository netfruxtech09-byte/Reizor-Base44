import { Mic2, Star, TrendingUp, Music, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown immediately after a first-time signup when the user had "Join as Artist" intent.
 * CTA navigates to the existing /artist/signup application page.
 */
export default function ArtistWelcomeModal({ open, userName, onContinue, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border/60 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Top gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />

        {/* Hero banner */}
        <div className="relative bg-gradient-to-br from-primary/20 via-accent/10 to-background px-6 pt-8 pb-6 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon cluster */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Mic2 className="w-6 h-6 text-primary" />
            </div>
            <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
              <Music className="w-5 h-5 text-accent" />
            </div>
          </div>

          <h2 className="font-display font-black text-2xl tracking-tight">
            Welcome{userName ? `, ${userName.split(" ")[0]}` : ""}! 🎤
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Your account is ready. Now let's get you set up as an artist on REIZOR.
          </p>
        </div>

        {/* Perks */}
        <div className="px-6 py-4 space-y-3">
          {[
            { icon: Star, label: "Artist Profile", desc: "Build your public profile with bio, links & music" },
            { icon: TrendingUp, label: "Fan Growth Tools", desc: "Donations, raffles, merchandise & more" },
            { icon: Mic2, label: "Tour & Bookings", desc: "Manage your schedule and get booked for events" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-3 pt-2">
          <Button
            onClick={onContinue}
            className="w-full h-12 glow-lime font-display font-bold text-base gap-2"
          >
            Continue as Artist <ArrowRight className="w-4 h-4" />
          </Button>
          <button
            onClick={onClose}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}