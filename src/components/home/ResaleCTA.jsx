import { Link } from 'react-router-dom';
import { TrendingUp, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { detectIsIOS } from '@/hooks/useIsIOS';

export default function ResaleCTA() {
  if (detectIsIOS()) return null;
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 border border-primary/20 p-8 sm:p-12 space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h2 className="font-display font-black text-2xl sm:text-3xl tracking-tight mb-2">
                Can't Make It?
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Plans changed and can't make it to the event? No worries. List your tickets bought with us on the marketplace to resell them.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/resale">
              <Button className="glow-lime font-display font-bold gap-2">
                <Ticket className="w-4 h-4" /> Browse Resale Tickets
              </Button>
            </Link>
            <Link to="/my-tickets">
              <Button variant="outline" className="font-display font-bold gap-2">
                <TrendingUp className="w-4 h-4" /> Sell Your Tickets
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}