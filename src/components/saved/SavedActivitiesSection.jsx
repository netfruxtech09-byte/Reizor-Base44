import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Trophy, BarChart3, Gift, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TYPE_CONFIG = {
  raffle: { icon: Trophy, label: "Raffle", getLink: (id) => `/raffle/${id}` },
  poll: { icon: BarChart3, label: "Poll", getLink: (id) => `/poll/${id}` },
  giveaway: { icon: Gift, label: "Giveaway", getLink: () => `/giveaways` },
};

// Saved raffles, polls, and giveaways — shown alongside Saved Events so users
// can always find what they bookmarked with the Save button on those pages.
export default function SavedActivitiesSection() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const user = await base44.auth.me().catch(() => null);
      if (!user) { setLoading(false); return; }
      const entries = await base44.entities.SavedActivity.filter({ user_email: user.email }, "-created_date", 100).catch(() => []);
      setActivities(entries);
      setLoading(false);
    })();
  }, []);

  const remove = async (entry) => {
    await base44.entities.SavedActivity.delete(entry.id).catch(() => {});
    setActivities((prev) => prev.filter((a) => a.id !== entry.id));
    toast.success("Removed from saved activities");
  };

  if (loading || activities.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="font-display font-black text-2xl tracking-tight mb-4">SAVED RAFFLES, POLLS & GIVEAWAYS</h2>
      <div className="space-y-3">
        {activities.map((entry) => {
          const cfg = TYPE_CONFIG[entry.activity_type] || TYPE_CONFIG.raffle;
          const Icon = cfg.icon;
          return (
            <div key={entry.id} className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/50 group">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">{cfg.label}</span>
                <Link to={cfg.getLink(entry.activity_id)}>
                  <h3 className="font-display font-bold text-base leading-tight hover:text-primary transition-colors truncate">
                    {entry.activity_title}
                  </h3>
                </Link>
                {entry.event_title && (
                  <p className="text-xs text-muted-foreground truncate">Event: {entry.event_title}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(entry)}
                className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}