import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Music, Calendar, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useOrganizerAccess } from '@/hooks/useOrganizerAccess';
import OrganizerAccessRequiredModal from '@/components/organizer/OrganizerAccessRequiredModal';

const FAN_BENEFITS = [
  "Resell purchased tickets on our resale market (Reizor platform tickets only).",
  "Join raffles for different kinds of prizes.",
  "Leave reviews on events.",
  "Enjoy a 360° music media library. (Subject to users upload content)",
  "Option to support your favorite artists by sending a contribution directly.",
  "Participate in loyalty programs by event organizers.",
  "Communicate with artists directly.",
  "See artist tour schedules.",
];

const ORGANIZER_BENEFITS = [
  "AI flyer pic & video generation for your event",
  "3D event flyer and video creation",
  "Website embedded code for your site",
  "QR code & social media event links generated automatically for marketing",
  "Promo codes for discounts & promotions",
  "Multiple ticket sellers option",
  "Full event P&L analytics",
  "Event performance tracking",
  "Easy entry — tickets & tables QR scan",
  "Marketing blast tools",
  "Team management",
  "Post raffles & polls for fan engagement",
  "Loyalty programs",
  "Easy payout to your bank account",
  "Artist booking option within platform",
  "Artist booking notification (when an artist gets booked in your area or arrives to your area, you will get notified)",
  "Community interaction",
  "Event demographic analysis",
];

const ARTIST_BENEFITS = [
  "Easy artist booking & management",
  "Website embedded code for your site",
  "Tour schedule posting",
  "Post 360° videos with our media gallery",
  "AI flyer pic & video generation",
  "3D event flyer and video creation",
  "Direct contact with fans",
  "Event ticket sale transparency",
  "Contributions from fans",
  "Merch & digital downloads shop",
  "Loyalty tiers for your fanbase",
  "Follow Me — notify organizers in your country when you're available, boosting booking opportunities",
  "Auto-notify nearby organizers when you get booked for a date & location",
];

function BenefitItem({ text, color = "text-primary" }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
      <Check className={`w-4 h-4 ${color} shrink-0 mt-0.5`} />
      <span>{text}</span>
    </li>
  );
}

function FanCard({ handleSignup }) {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all flex flex-col gap-4">
      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
        <Users className="w-6 h-6 text-accent" />
      </div>
      <div>
        <h3 className="font-display font-bold text-xl mb-2">For Fans</h3>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
          Discover events, connect with artists, and join the community
        </p>
        <ul className="space-y-2.5">
          {FAN_BENEFITS.map((b, i) => (
            <BenefitItem key={i} text={b} color="text-primary" />
          ))}
        </ul>
      </div>
      <div className="space-y-2 mt-auto">
        <Link to="/search">
          <Button variant="outline" className="w-full border-accent/30 text-accent hover:bg-accent/10">
            Browse Events
          </Button>
        </Link>
        <Button onClick={handleSignup} className="w-full glow-lime font-display font-bold">
          Join Community
        </Button>
      </div>
    </div>
  );
}

export default function RoleBasedCTA() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requestAccess, showModal: showOrgAccess, setShowModal: setShowOrgAccess } = useOrganizerAccess();
  const [isArtist, setIsArtist] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.is_artist || user.role === 'artist') {
      setIsArtist(true);
    } else {
      base44.entities.Artist.filter({ user_email: user.email }, null, 1).then(existing => {
        if (existing.length > 0) {
          setIsArtist(true);
          base44.auth.updateMe({ is_artist: true }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [user]);

  const handleSignup = async () => {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) {
      base44.auth.redirectToLogin('/community');
    } else {
      navigate('/community');
    }
  };

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight mb-3">
            Join Our Community
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Whether you're a fan discovering events, an artist building your fanbase, an organizer hosting shows, or earning as an affiliate
          </p>
          <h3 className="font-display font-black text-3xl sm:text-4xl tracking-tight text-foreground">
            Why us ? ⬇️
          </h3>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Fans */}
          <FanCard handleSignup={handleSignup} />

          {/* Organizers */}
          <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-400/10 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl mb-2">For Organizers</h3>
              <ul className="space-y-2.5">
                {ORGANIZER_BENEFITS.map((item, i) => (
                  <BenefitItem key={i} text={item} color="text-yellow-400" />
                ))}
              </ul>
            </div>
            <Button onClick={() => requestAccess('/organizer')} className="mt-auto w-full glow-lime font-display font-bold">
              Launch Your Event
            </Button>
          </div>

          {/* Artists */}
          <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Music className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl mb-2">For Artists</h3>
              <ul className="space-y-2.5">
                {ARTIST_BENEFITS.map((item, i) => (
                  <BenefitItem key={i} text={item} color="text-primary" />
                ))}
              </ul>
            </div>
            {isArtist ? (
              <Link to="/artist" className="mt-auto">
                <Button className="w-full glow-lime font-display font-bold">
                  Visit Studio
                </Button>
              </Link>
            ) : (
              <Link to="/artist/signup" className="mt-auto">
                <Button className="w-full glow-lime font-display font-bold">
                  Get Started
                </Button>
              </Link>
            )}
          </div>


        </div>
      </div>
      <OrganizerAccessRequiredModal open={showOrgAccess} onClose={() => setShowOrgAccess(false)} />
    </section>
  );
}