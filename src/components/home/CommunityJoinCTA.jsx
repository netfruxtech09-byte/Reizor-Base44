import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function CommunityJoinCTA() {
  const navigate = useNavigate();

  const handleSignup = async () => {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) {
      base44.auth.redirectToLogin('/community');
    } else {
      navigate('/community');
    }
  };

  return (
    <div className="py-16 px-4 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-2xl border border-primary/20">
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Users className="w-6 h-6 text-primary" />
          <h2 className="font-display font-black text-2xl sm:text-3xl tracking-tight">
            Join Our Community
          </h2>
        </div>
        <h3 className="font-display font-black text-2xl sm:text-3xl tracking-tight text-white mt-2">
          Why us ? ⬇️
        </h3>
        <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
          Connect with fans, artists, and organizers. Share moments, discover events, and be part of something bigger.
        </p>
        <Button
          onClick={handleSignup}
          className="glow-lime font-display font-bold gap-2 h-12 text-base"
        >
          Signup to Join
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}