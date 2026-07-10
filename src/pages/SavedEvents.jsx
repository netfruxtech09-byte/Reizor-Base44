import { useState, useEffect } from "react";
import { Bookmark, Calendar, MapPin, Trash2, ArrowLeft, ShieldAlert } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import PageMeta from "@/components/seo/PageMeta";
import PullToRefresh from "@/components/shared/PullToRefresh";
import SavedActivitiesSection from "@/components/saved/SavedActivitiesSection";

export default function SavedEvents() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState([]);
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  useEffect(() => {
    (async () => {
      const user = await base44.auth.me();
      if (user?.role === "admin") {
        setIsAdmin(true);
        setLoading(false);
        return;
      }
      const entries = await base44.entities.SavedEvent.filter({ user_email: user.email }, "-created_date", 100);
      setSaved(entries);
      const evMap = {};
      for (const s of entries) {
        const evs = await base44.entities.Event.filter({ id: s.event_id }, null, 1);
        if (evs[0]) evMap[s.event_id] = evs[0];
      }
      setEvents(evMap);
      setLoading(false);
    })();
  }, []);

  const remove = async (entry) => {
    await base44.entities.SavedEvent.delete(entry.id);
    setSaved((prev) => prev.filter((s) => s.id !== entry.id));
    toast.success("Removed from saved events");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm space-y-4">
          <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="font-display font-black text-2xl">Not Available for Admins</h1>
          <p className="text-muted-foreground text-sm">Saved Events is a fan-only page. Admin accounts don't save events.</p>
          <Button onClick={() => navigate("/admin")} className="w-full font-display font-bold glow-lime">
            Go to Admin Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleRefresh = async () => {
    setLoading(true);
    const user = await base44.auth.me();
    const entries = await base44.entities.SavedEvent.filter({ user_email: user.email }, "-created_date", 100);
    setSaved(entries);
    const evMap = {};
    for (const s of entries) {
      const evs = await base44.entities.Event.filter({ id: s.event_id }, null, 1);
      if (evs[0]) evMap[s.event_id] = evs[0];
    }
    setEvents(evMap);
    setLoading(false);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-3xl mx-auto">
      <PageMeta
        title="Saved Events — REIZOR"
        description="View and manage your saved and bookmarked events on Reizor."
        canonical="https://reizor.com/saved"
      />
      {/* Back Button */}
      <div className="mb-2 -mx-4 sm:mx-0 px-4 sm:px-0 pt-2 safe-top-header" data-safe-top>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="mb-8">
        <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ YOUR COLLECTION</span>
        <h1 className="font-display font-black text-4xl tracking-tight mt-1">SAVED EVENTS</h1>
      </div>

      {(() => {
        // Filter out past events
        const upcomingSaved = saved.filter((entry) => {
          const ev = events[entry.event_id];
          if (!ev) return false;
          return !ev.date || new Date(ev.date) >= new Date();
        });
        if (upcomingSaved.length === 0) {
          return (
            <div className="text-center py-20">
              <Bookmark className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-display font-bold text-xl text-muted-foreground mb-2">No upcoming saved events</p>
              <p className="text-sm text-muted-foreground mb-6">Bookmark events you're interested in to find them here</p>
              <Link to="/search">
                <Button>Browse Events</Button>
              </Link>
            </div>
          );
        }
        return (
        <div className="space-y-4">
          {upcomingSaved.map((entry) => {
            const ev = events[entry.event_id];
            if (!ev) return null;
            return (
              <div key={entry.id} className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/50 group">
                {ev.cover_image && (
                  <img src={ev.cover_image} alt={ev.title} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
                      {ev.genre?.replace("_", " ")}
                    </span>
                  </div>
                  <Link to={`/events/${ev.id}`}>
                    <h3 className="font-display font-bold text-lg leading-tight hover:text-primary transition-colors truncate">
                      {ev.title}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {ev.date ? format(new Date(ev.date), "MMM dd, yyyy") : "TBA"}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {ev.venue_name}, {ev.city}
                    </span>
                  </div>
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
        );
      })()}

      <SavedActivitiesSection />
    </div>
    </PullToRefresh>
  );
}