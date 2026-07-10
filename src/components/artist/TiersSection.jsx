import { useState, useEffect } from "react";
import { Star, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { addMonths } from "date-fns";
import { detectIsIOS } from "@/hooks/useIsIOS";

const colorClasses = {
  primary: { card: "bg-primary/10 border-primary/40",  badge: "text-primary bg-primary/10",  btn: "bg-primary text-primary-foreground hover:bg-primary/90" },
  accent:  { card: "bg-accent/10 border-accent/40",    badge: "text-accent bg-accent/10",     btn: "bg-accent text-accent-foreground hover:bg-accent/90" },
  yellow:  { card: "bg-yellow-400/10 border-yellow-400/40", badge: "text-yellow-400 bg-yellow-400/10", btn: "bg-yellow-400 text-black hover:bg-yellow-300" },
  green:   { card: "bg-green-400/10 border-green-400/40",   badge: "text-green-400 bg-green-400/10",   btn: "bg-green-400 text-black hover:bg-green-300" },
};

export default function TiersSection({ artist, user }) {
  const [tiers, setTiers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);

  useEffect(() => {
    base44.entities.FanTier.filter({ artist_id: artist.id, is_active: true }, "sort_order", 10).then(setTiers);
    if (user) {
      base44.entities.FanSubscription.filter({ artist_id: artist.id, fan_email: user.email }, null, 10).then(setSubscriptions);
    }
    setLoading(false);
  }, [artist.id, user?.email]);

  const getSubForTier = (tierId) => subscriptions.find(s => s.tier_id === tierId && s.status === "active");

  const handleSubscribe = async (tier) => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    setSubscribing(tier.id);
    const existing = getSubForTier(tier.id);
    if (existing) {
      // Cancel
      await base44.entities.FanSubscription.update(existing.id, { status: "cancelled", cancelled_at: new Date().toISOString() });
      setSubscriptions(prev => prev.map(s => s.id === existing.id ? { ...s, status: "cancelled" } : s));
      toast.success("Subscription cancelled");
    } else {
      const now = new Date();
      const sub = await base44.entities.FanSubscription.create({
        tier_id: tier.id,
        tier_name: tier.name,
        artist_id: artist.id,
        artist_name: artist.display_name,
        artist_email: artist.user_email,
        fan_email: user.email,
        fan_name: user.full_name,
        amount: tier.price,
        status: "active",
        started_at: now.toISOString(),
        next_billing_date: addMonths(now, 1).toISOString(),
      });
      setSubscriptions(prev => [...prev, sub]);
      // Notify artist
      await base44.integrations.Core.SendEmail({
        to: artist.user_email,
        subject: `⭐ New subscriber — ${user.full_name} joined ${tier.name}`,
        body: `${user.full_name} (${user.email}) just subscribed to your "${tier.name}" tier for $${tier.price}/month!\n\nCheck your Fan Tiers dashboard to see all subscribers.`,
      }).catch(() => {});
      toast.success(`Subscribed to ${tier.name}! 🎉`);
    }
    setSubscribing(null);
  };

  if (detectIsIOS()) return null;
  if (loading || tiers.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-lg">FAN TIERS</h2>
      </div>
      <p className="text-sm text-muted-foreground">Support {artist.display_name} with a monthly subscription and get exclusive perks.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {tiers.map(tier => {
          const c = colorClasses[tier.color || "primary"];
          const activeSub = getSubForTier(tier.id);
          return (
            <div key={tier.id} className={`p-4 rounded-xl border ${c.card} space-y-3`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Star className={`w-3.5 h-3.5 ${c.badge.split(" ")[0]}`} />
                    <p className="font-display font-bold">{tier.name}</p>
                  </div>
                  {tier.description && <p className="text-xs text-muted-foreground mt-0.5">{tier.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-black text-lg">${tier.price}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">/month</p>
                </div>
              </div>
              {tier.perks?.length > 0 && (
                <ul className="space-y-1">
                  {tier.perks.map((p, i) => (
                    <li key={i} className={`flex items-center gap-2 text-xs ${c.badge.split(" ")[0]}`}>
                      <Check className="w-3 h-3 shrink-0" /> <span className="text-foreground">{p}</span>
                    </li>
                  ))}
                </ul>
              )}
              {activeSub ? (
                <div className="space-y-1.5">
                  <div className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2 py-1 rounded ${c.badge} w-fit`}>
                    <Zap className="w-3 h-3" /> Subscribed
                  </div>
                  <button onClick={() => handleSubscribe(tier)} disabled={subscribing === tier.id}
                    className="text-xs font-mono text-muted-foreground hover:text-destructive transition-colors">
                    Cancel subscription
                  </button>
                </div>
              ) : (
                <button onClick={() => handleSubscribe(tier)} disabled={subscribing === tier.id}
                  className={`w-full py-2 rounded-lg text-sm font-display font-bold transition-all ${c.btn}`}>
                  {subscribing === tier.id ? "..." : `Subscribe $${tier.price}/mo`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}