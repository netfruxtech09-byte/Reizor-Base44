import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarPlus, Ticket, TrendingUp, ShieldCheck, Mic2 } from "lucide-react";
import { motion } from "framer-motion";
import { useOrganizerAccess } from "@/hooks/useOrganizerAccess";
import OrganizerAccessRequiredModal from "@/components/organizer/OrganizerAccessRequiredModal";
import { detectIsIOS } from "@/hooks/useIsIOS";

const HERO_IMAGE = "https://media.base44.com/images/public/69c45469fc66657973f432a4/ee18e9e13_generated_cd635f01.png";

export default function HeroSection() {
  const navigate = useNavigate();
  const { requestAccess, showModal: showOrgAccess, setShowModal: setShowOrgAccess } = useOrganizerAccess();
  const [showSellInfo, setShowSellInfo] = useState(false);
  const [showBookArtistInfo, setShowBookArtistInfo] = useState(false);
  const isIOS = detectIsIOS();

  const handleBookArtist = () => {
    const seen = sessionStorage.getItem("book_artist_popup_seen");
    if (seen) {
      navigate("/artists");
    } else {
      setShowBookArtistInfo(true);
    }
  };

  const handleHostEvent = () => requestAccess("/organizer/create");

  return (
    <section className="relative flex items-start overflow-hidden pt-6 pb-4 sm:pt-16 sm:pb-10 lg:pt-0 lg:pb-0 lg:min-h-[520px]">
      {/* Background */}
      <div className="absolute inset-0 min-h-full">
        <img
          src={HERO_IMAGE}
          alt="Music festival with dramatic lights and crowd"
          className="w-full h-full object-cover"
          fetchpriority="high"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full lg:py-16">
        {/* Mobile: single column stacked. Desktop: two-column side by side */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-12 xl:gap-16">

          {/* LEFT — heading + description */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg:flex-1 lg:max-w-xl"
          >
            <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl xl:text-8xl tracking-tighter leading-tight mb-4 sm:mb-6 mt-0">
              FEEL THE
              <br />
              <span className="text-primary text-glow-lime">PULSE</span>
              <br />
              OF MUSIC.
            </h1>

            <p
              className="font-semibold text-muted-foreground max-w-md mb-5 sm:mb-8 lg:mb-0"
              style={{ fontSize: 'clamp(17px, 4.5vw, 20px)', lineHeight: '1.5' }}
            >
              Discover and book the best music events, festivals, and nightlife experiences. Your next unforgettable night starts here.
            </p>

            {/* App download pills — connected to hero copy; hidden on iOS for App Store compliance */}
            {!isIOS && (
              <div className="flex flex-row items-center justify-center lg:justify-start gap-2 mt-5 sm:mt-6 lg:mt-8 mb-6 sm:mb-8 lg:mb-0">
                {/* Apple App Store — Coming Soon */}
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-foreground/10 border border-white/10 cursor-not-allowed select-none opacity-60"
                  title="Coming Soon on the App Store"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white shrink-0">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <div className="text-left">
                    <p className="text-[7px] text-white/50 font-mono leading-none uppercase tracking-wide">Coming Soon</p>
                    <p className="text-xs font-bold text-white leading-tight">App Store</p>
                  </div>
                </div>

                {/* Google Play — live link */}
                <a
                  href="https://play.google.com/store/apps/details?id=com.base69c45469fc66657973f432a4.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-foreground/10 border border-white/10 hover:bg-primary/20 hover:border-primary/40 transition-all active:scale-95"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <path d="M3.18 23.77A2 2 0 0 1 2 22V2a2 2 0 0 1 1.18-1.77l11.5 11.5-11.5 11.54z" fill="#EA4335"/>
                    <path d="M20.82 10.5l-3.03-1.74L14.62 12l3.17 3.24 3.03-1.74a2 2 0 0 0 0-3z" fill="#FBBC05"/>
                    <path d="M3.18.23 14.62 12 17.79 8.76 5.09.34A2 2 0 0 0 3.18.23z" fill="#4285F4"/>
                    <path d="M3.18 23.77a2 2 0 0 0 1.91-.11l12.7-7.42L14.62 12 3.18 23.77z" fill="#34A853"/>
                  </svg>
                  <div className="text-left">
                    <p className="text-[7px] text-white/50 font-mono leading-none uppercase tracking-wide">Get it on</p>
                    <p className="text-xs font-bold text-white leading-tight">Play Store</p>
                  </div>
                </a>
              </div>
            )}
          </motion.div>

          {/* RIGHT — action boxes + Can't Make It (desktop: right column; mobile: continues below) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            className="lg:flex-1 lg:max-w-lg xl:max-w-xl"
          >
            <div className="grid grid-cols-2 gap-2.5 lg:gap-4 max-w-sm sm:max-w-sm lg:max-w-full">
              {/* Pink boxes */}
              <button
                onClick={handleHostEvent}
                className="flex flex-col items-start gap-3 lg:gap-3 p-4 lg:p-5 rounded-xl bg-primary border border-primary hover:bg-primary/90 transition-all text-left h-full min-h-[80px]"
              >
                <div className="flex items-center justify-between w-full gap-1">
                  <span className="font-display font-bold text-sm lg:text-base text-primary-foreground leading-snug">Host an Event</span>
                  <CalendarPlus className="w-4 h-4 lg:w-5 lg:h-5 text-primary-foreground flex-shrink-0" />
                </div>
                <span className="font-mono text-xs font-semibold lg:text-sm text-primary-foreground/85 block leading-snug">Create & sell tickets</span>
              </button>
              <button onClick={handleBookArtist} className="flex flex-col items-start gap-3 lg:gap-3 p-4 lg:p-5 rounded-xl bg-primary border border-primary hover:bg-primary/90 transition-all text-left h-full min-h-[80px]">
                <div className="flex items-center justify-between w-full gap-1">
                  <span className="font-display font-bold text-sm lg:text-base text-primary-foreground leading-snug">Book an Artist</span>
                  <Mic2 className="w-4 h-4 lg:w-5 lg:h-5 text-primary-foreground flex-shrink-0" />
                </div>
                <span className="font-mono text-xs font-semibold lg:text-sm text-primary-foreground/85 block leading-snug">Request for your event</span>
              </button>
              {/* Blue boxes */}
              {!isIOS && (
                <Link to="/resale" className="flex flex-col items-start gap-3 lg:gap-3 p-4 lg:p-5 rounded-xl bg-accent border border-accent hover:bg-accent/90 transition-all h-full min-h-[80px]">
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="font-display font-bold text-sm lg:text-base text-accent-foreground leading-snug">Resale Market</span>
                    <Ticket className="w-4 h-4 lg:w-5 lg:h-5 text-accent-foreground flex-shrink-0" />
                  </div>
                  <span className="font-mono text-xs font-semibold lg:text-sm text-accent-foreground/85 block leading-snug">Can't make it?{" "}<br className="sm:hidden" />Browse resale</span>
                </Link>
              )}
              {!isIOS && (
                <button onClick={() => setShowSellInfo(true)} className="flex flex-col items-start gap-3 lg:gap-3 p-4 lg:p-5 rounded-xl bg-accent border border-accent hover:bg-accent/90 transition-all text-left h-full min-h-[80px]">
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="font-display font-bold text-sm lg:text-base text-accent-foreground leading-snug">Sell Your Ticket</span>
                    <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-accent-foreground flex-shrink-0" />
                  </div>
                  <span className="font-mono text-xs font-semibold lg:text-sm text-accent-foreground/85 block leading-snug">List on the{" "}<br className="sm:hidden" />resale market</span>
                </button>
              )}
            </div>

            {/* Can't Make It block */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.35 }}
              className="mt-7 lg:mt-6 max-w-xs sm:max-w-sm lg:max-w-full"
            >
              <p className="font-display font-bold text-sm sm:text-xl lg:text-2xl text-foreground">Can't Make It?</p>
              <p className="text-xs lg:text-sm text-muted-foreground leading-relaxed mt-0.5 lg:mt-2">
                Plans changed and can't make it to the event? No worries. List your tickets bought with us on the marketplace to resell them.
              </p>
            </motion.div>
          </motion.div>

        </div>
      </div>

      {/* Bottom gradient fade */}

      {/* Book an Artist Info Modal */}
      <Dialog open={showBookArtistInfo} onOpenChange={setShowBookArtistInfo}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display font-black text-xl tracking-tight flex items-center gap-2">
              <Mic2 className="w-5 h-5 text-primary" /> Book an Artist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm text-foreground leading-relaxed">
              🎤 <span className="font-bold text-primary">Book an Artist</span> allows you to request an artist for your event. Choose an artist, send your booking details, and the artist or their team can review your request and respond.
            </div>
            <p className="text-xs text-muted-foreground font-mono leading-relaxed">
              Browse our roster of available artists and submit a booking inquiry directly from their profile.
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1 glow-lime font-display font-bold"
                onClick={() => {
                  sessionStorage.setItem("book_artist_popup_seen", "1");
                  setShowBookArtistInfo(false);
                  navigate("/artists");
                }}
              >
                Continue to Booking
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  sessionStorage.setItem("book_artist_popup_seen", "1");
                  setShowBookArtistInfo(false);
                  navigate("/artists");
                }}
                className="border-border/50"
              >
                Got it
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sell Ticket Info Modal */}
      <Dialog open={showSellInfo} onOpenChange={setShowSellInfo}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display font-black text-xl tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Resale Market
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm text-foreground leading-relaxed">
              🎟️ Only tickets purchased through the <span className="font-bold text-primary">Reizor platform</span> can be listed for resale here.
            </div>
            <p className="text-xs text-muted-foreground font-mono leading-relaxed">
              If you have a Reizor ticket, go to <span className="text-foreground font-bold">My Tickets</span> and tap the resale option on your ticket card.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1 glow-lime font-display font-bold" onClick={() => { setShowSellInfo(false); navigate("/my-tickets"); }}>
                Go to My Tickets
              </Button>
              <Button variant="outline" onClick={() => setShowSellInfo(false)} className="border-border/50">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Organizer access required (fans) */}
      <OrganizerAccessRequiredModal open={showOrgAccess} onClose={() => setShowOrgAccess(false)} />
    </section>
  );
}