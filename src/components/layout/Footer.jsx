import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import ContactForm from "../ContactForm";
import { base44 } from "@/api/base44Client";
import useIsIOS from "@/hooks/useIsIOS";
import { useOrganizerAccess } from "@/hooks/useOrganizerAccess";
import OrganizerAccessRequiredModal from "@/components/organizer/OrganizerAccessRequiredModal";

const ORGANIZER_ROLES = ["manager", "organizer", "admin"];

export default function Footer() {
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();
  const isIOS = useIsIOS();
  const { requestAccess, showModal: showOrgAccess, setShowModal: setShowOrgAccess } = useOrganizerAccess();

  useEffect(() => {
    base44.auth.me().then(u => setUserRole(u?.role || null)).catch(() => {});
  }, []);

  const handleHostEvent = () => requestAccess("/organizer/create");

  const showOrganizerSection = ORGANIZER_ROLES.includes(userRole);

  return (
    <footer className="bg-background border-t border-border">
      {/* Ticker Tape */}
      <div className="overflow-hidden py-3 border-b border-border/50">
        <div className="animate-ticker whitespace-nowrap flex">
          {[0, 1].map((i) => (
            <span key={i} className="font-mono text-xs text-muted-foreground/40 tracking-widest uppercase">
              &nbsp;★ LIVE MUSIC ★ FESTIVALS ★ NIGHTLIFE ★ CONCERTS ★ DJ SETS ★ WAREHOUSE RAVES ★ CLUB NIGHTS ★ OPEN AIR ★ UNDERGROUND ★ TECHNO ★ HOUSE ★ DRUM & BASS ★
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-16">
        <ContactForm />

        {/* Centered Brand Section */}
        <div className="flex flex-col items-center text-center mb-12">
          <Link to="/" className="flex items-center gap-2 mb-4 justify-center">
            <img src="https://media.base44.com/images/public/69c45469fc66657973f432a4/ad3127c8b_IMG_9581.png" alt="REIZOR" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-display font-black text-lg tracking-tighter">
              <span className="text-primary">REIZ</span><span className="text-accent">OR</span>
            </span>
          </Link>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
            The premium destination for music events, festivals, and nightlife experiences.
          </p>

          {/* WE ARE SOCIAL */}
          <div className="mt-6 w-full max-w-sm">
            <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase mb-3 text-center">We Are Social 🙂</p>
            <div className="flex items-center justify-center gap-3">
              {/* TikTok */}
              <a href="https://www.tiktok.com/@reizormusic?_r=1&_t=ZS-97aulOX6gRr" target="_blank" rel="noopener noreferrer"
                aria-label="Follow Reizor on TikTok" title="Follow Reizor on TikTok"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 border border-primary/40 text-primary active:scale-95 transition-transform">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.31 6.31 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z"/>
                </svg>
              </a>
              {/* Instagram */}
              <a href="https://www.instagram.com/reizormusic?igsh=MWowOTd1Ym9xb2dxOQ%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer"
                aria-label="Follow Reizor on Instagram" title="Follow Reizor on Instagram"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 border border-primary/40 text-primary active:scale-95 transition-transform">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              {/* Telegram */}
              <a href="https://t.me/reizormusic" target="_blank" rel="noopener noreferrer"
                aria-label="Join Reizor on Telegram" title="Join Reizor on Telegram"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 border border-primary/40 text-primary active:scale-95 transition-transform">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Footer Links Section */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-foreground mb-4">Discover</h4>
            <div className="space-y-2">
              <Link to="/discover" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Discover</Link>
              <Link to="/feed" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Feed</Link>
              <Link to="/search" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">All Events</Link>
              <Link to="/search?genre=techno" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Techno</Link>
              <Link to="/search?genre=house" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">House</Link>
              <Link to="/search?genre=hip_hop" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Hip Hop</Link>
              <Link to="/artists" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Artists</Link>
              {!isIOS && (
                <Link to="/resale" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Resale</Link>
              )}
              <Link to="/community" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Community</Link>
              {!isIOS && (
                <Link to="/affiliate-program" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Earn</Link>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-foreground mb-4">Platform</h4>
            <div className="space-y-2">
              <button onClick={handleHostEvent} className="block text-sm text-muted-foreground hover:text-foreground transition-colors text-left">Host an Event</button>
              {showOrganizerSection && (
                <Link to="/organizer" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">For Organizers</Link>
              )}
              <Link to="/pricing" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/my-tickets" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">My Tickets</Link>
              <Link to="/profile" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Account</Link>
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-foreground mb-4">Legal</h4>
            <div className="space-y-2">
               <Link to="/terms" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
               <Link to="/privacy-policy" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
               <Link to="/terms#section-6" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Refund Policy</Link>
             </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground font-mono">
            © {new Date().getFullYear()} REIZOR. ALL RIGHTS RESERVED.
          </p>
          <p className="text-xs text-muted-foreground/50 font-mono">
            BUILT FOR THE CULTURE
          </p>
        </div>
      </div>
      <OrganizerAccessRequiredModal open={showOrgAccess} onClose={() => setShowOrgAccess(false)} />
    </footer>
  );
}