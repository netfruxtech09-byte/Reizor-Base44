import { useState, useEffect, useMemo } from "react";
import { filterUpcomingEvents } from "@/utils/eventUtils";
import { Link } from "react-router-dom";
import { Calendar, ChevronRight } from "lucide-react";
import BackButton from "@/components/shared/BackButton";
import DiscoveryFilters, { haversineKm } from "@/components/discovery/DiscoveryFilters";
import { base44 } from "@/api/base44Client";
import PageMeta from "@/components/seo/PageMeta";
import { format } from "date-fns";

export default function AllEvents() {
  const [user, setUser] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    genres: [],
    dateRange: null,
    price: null,
    distanceKm: null,
    userLocation: null,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const u = await base44.auth.me().catch(() => null);
        setUser(u);

        const events = await base44.entities.Event.filter(
          { status: "published" },
          "date",
          1000
        );

        const upcoming = filterUpcomingEvents(events);
        setAllEvents(upcoming);
      } catch (error) {
        console.error("Failed to fetch events:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredEvents = useMemo(() => {
    let events = allEvents;
    const { genres, dateRange, price, distanceKm, userLocation } = filters;
    const hasFilters =
      genres.length > 0 || dateRange || price || distanceKm;
    if (!hasFilters) return events;

    if (genres.length > 0) {
      events = events.filter((e) => genres.includes(e.genre));
    }
    if (dateRange) {
      events = events.filter((e) => {
        const d = new Date(e.date);
        return d >= dateRange.start && d <= dateRange.end;
      });
    }
    if (price) {
      events = events.filter((e) => {
        const p = e.min_price || 0;
        if (price.key === "free") return p === 0;
        if (price.max === Infinity) return p >= price.min;
        return p >= price.min && p <= price.max;
      });
    }
    if (distanceKm && userLocation) {
      events = events.filter((e) => {
        if (!e.latitude || !e.longitude) return true;
        const d = haversineKm(
          userLocation.lat,
          userLocation.lon,
          e.latitude,
          e.longitude
        );
        return d <= distanceKm;
      });
    }
    return events;
  }, [allEvents, filters]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      <PageMeta
        title="All Events — REIZOR"
        description="Discover all upcoming music events on Reizor. Search, filter, and find your next event."
        canonical="https://reizor.com/all-events"
      />
      <BackButton />

      {/* Header */}
      <div>
        <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight">
          ALL EVENTS
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Explore all upcoming events. Use filters to narrow down by genre, date,
          price, or location.
        </p>
      </div>

      {/* Filters */}
      <div>
        <DiscoveryFilters onFiltersChange={setFilters} />
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="py-16 text-center rounded-xl bg-card border border-border/50">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-base font-semibold">
            No events found
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Try adjusting or clearing your filters to see more events.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event) => {
            const cover = event.cover_image || event.gallery_images?.[0] || null;
            const coverIsVid =
              cover && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(cover);
            return (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="group flex gap-4 p-4 rounded-xl bg-card border border-border/50 hover:border-accent/40 transition-all overflow-hidden"
              >
                {cover ? (
                  coverIsVid ? (
                    <video
                      src={cover}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-20 h-20 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <img
                      src={cover}
                      alt={event.title}
                      className="w-20 h-20 rounded-lg object-cover shrink-0"
                    />
                  )
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-7 h-7 text-accent" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-sm leading-tight truncate">
                    {event.title}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1 truncate">
                    {event.venue_name}
                    {event.city ? `, ${event.city}` : ""}
                  </p>
                  <p className="font-mono text-[10px] text-accent mt-1 font-bold">
                    {event.date
                      ? format(new Date(event.date), "EEE, MMM dd · yyyy")
                      : "Date TBA"}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {event.genre && (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {event.genre.replace(/_/g, " ")}
                      </span>
                    )}
                    {event.min_price != null && (
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {event.min_price === 0 ? "Free" : `From $${event.min_price}`}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}