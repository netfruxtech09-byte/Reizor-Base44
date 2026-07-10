import { useState, useEffect } from "react";
import { ExternalLink, MapPin, Calendar, Music, DollarSign, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import BackButton from "@/components/shared/BackButton";

const SOURCE_LABELS = {
  ticketmaster: { label: "Ticketmaster", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  eventbrite: { label: "Eventbrite", color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  seatgeek: { label: "SeatGeek", color: "text-green-400 bg-green-400/10 border-green-400/20" },
  viagogo: { label: "Viagogo", color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  stubhub: { label: "StubHub", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  other: { label: "Partner", color: "text-primary bg-primary/10 border-primary/20" },
};

export default function AffiliateEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("all");

  useEffect(() => {
    base44.entities.ExternalEvent.filter({ status: "active" }, "date", 200)
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  const handleGetTickets = async (event) => {
    // Track click in background
    base44.functions.invoke("trackAffiliateClick", {
      external_event_id: event.id,
      event_title: event.title,
      affiliate_source: event.affiliate_source,
      commission_rate: event.commission_rate,
    }).catch(() => {});

    // Open affiliate link
    window.open(event.affiliate_url, "_blank", "noopener,noreferrer");
  };

  const filtered = events.filter(e => {
    const matchSearch = !search || 
      e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.city?.toLowerCase().includes(search.toLowerCase()) ||
      e.artists?.some(a => a.toLowerCase().includes(search.toLowerCase()));
    const matchSource = filterSource === "all" || e.affiliate_source === filterSource;
    return matchSearch && matchSource;
  });

  const sources = [...new Set(events.map(e => e.affiliate_source).filter(Boolean))];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative py-16 px-4 text-center bg-gradient-to-b from-primary/10 to-background border-b border-border/30">
        <div className="absolute left-4 top-4">
          <BackButton />
        </div>
        <p className="font-mono text-xs text-primary uppercase tracking-widest mb-3">Partner Events</p>
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter mb-4">
          MORE EVENTS
        </h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Discover concerts & festivals from our ticketing partners. Purchase tickets directly on their platforms.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events, artists, cities..."
              className="pl-9 bg-card border-border/50"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterSource("all")}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${filterSource === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/50 text-muted-foreground hover:border-primary/40"}`}
            >
              All
            </button>
            {sources.map(s => {
              const cfg = SOURCE_LABELS[s] || SOURCE_LABELS.other;
              return (
                <button key={s}
                  onClick={() => setFilterSource(s)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${filterSource === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/50 text-muted-foreground hover:border-primary/40"}`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs font-mono text-muted-foreground">{filtered.length} events found</p>

        {/* Events Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Music className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No partner events found.</p>
            <p className="text-xs mt-1">Check back soon — the admin is adding events.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(event => {
              const srcCfg = SOURCE_LABELS[event.affiliate_source] || SOURCE_LABELS.other;
              return (
                <div key={event.id} className="rounded-xl bg-card border border-border/50 overflow-hidden hover:border-primary/30 transition-all group">
                  {/* Cover */}
                  <div className="relative h-44 bg-gradient-to-br from-primary/20 to-accent/10">
                    {event.cover_image ? (
                      <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-12 h-12 text-muted-foreground/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                    <span className={`absolute top-3 left-3 px-2 py-1 rounded border text-[10px] font-mono font-bold ${srcCfg.color}`}>
                      {srcCfg.label}
                    </span>
                    {event.is_featured && (
                      <span className="absolute top-3 right-3 px-2 py-1 rounded bg-primary/90 text-primary-foreground text-[10px] font-mono font-bold">
                        FEATURED
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-display font-bold text-base leading-tight">{event.title}</h3>
                      {event.artists?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">{event.artists.join(", ")}</p>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {event.date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{format(new Date(event.date), "MMM dd, yyyy")}</span>
                        </div>
                      )}
                      {(event.venue_name || event.city) && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="truncate">{[event.venue_name, event.city].filter(Boolean).join(" · ")}</span>
                        </div>
                      )}
                      {event.min_price && (
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>From ${event.min_price}{event.max_price ? ` – $${event.max_price}` : ""}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => handleGetTickets(event)}
                      className="w-full font-display font-bold gap-1.5 glow-lime"
                      size="sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Get Tickets
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}