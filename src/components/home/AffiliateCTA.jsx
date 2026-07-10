import { Link } from "react-router-dom";
import { DollarSign, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectIsIOS } from "@/hooks/useIsIOS";

export default function AffiliateCTA() {
  if (detectIsIOS()) return null;
  return (
    <section className="py-16 px-4 bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border-y border-border/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 text-accent shrink-0" strokeWidth={2.5} />
            <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight">
              Earn Money as an Affiliate
            </h2>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Refer fans to membership and earn $3 for every signup through your unique link
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <div className="p-4 rounded-xl bg-card border border-border/50">
            <DollarSign className="w-5 h-5 text-primary mb-2" />
            <p className="font-bold text-sm">$3 Per Referral</p>
            <p className="text-xs text-muted-foreground mt-1">Earn $3 for every fan membership signup</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50">
            <Users className="w-5 h-5 text-primary mb-2" />
            <p className="font-bold text-sm">Free to Join</p>
            <p className="text-xs text-muted-foreground mt-1">No upfront fees or commitments</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="glow-lime font-display font-bold">
            <Link to="/affiliate-program">Join as Affiliate</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="font-display font-bold">
            <Link to="/partner-events">Browse Partner Events</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}