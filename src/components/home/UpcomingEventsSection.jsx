import { useState, useEffect } from "react";
import { filterUpcomingEvents } from "@/utils/eventUtils";
import { Link } from "react-router-dom";
import { Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { formatPrice } from "@/utils/currency";
import SaveEventButton from "../events/SaveEventButton";
import SeeAllButton from "./SeeAllButton";
import EventCoverPlaceholder from "../events/EventCoverPlaceholder";
import useInView from "@/hooks/useInView";

const isVideoUrl = (url) => url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

function CompactEventCard({ event }) {
  if (!event) return null;
  const soldPercent = event.total_capacity
    ? Math.round(((event.tickets_sold || 0) / event.total_capacity) * 100)
    : 0;
  const isSoldOut = event.status === "sold_out" || soldPercent >= 100;
  const isSellingFast = soldPercent >= 75 && !isSoldOut;
  const dateStr = event.date ? format(new Date(event.date), "EEE, MMM d") : null;
  const coverMedia = event.cover_image || event.gallery_images?.[0] || null;
  
  const trimmedCover = coverMedia?.trim();
  const isValidCoverMedia = trimmedCover && typeof trimmedCover === 'string' && trimmedCover.length > 0 &&
    /^(https?:\/\/|blob:|data:)/.test(trimmedCover);
  const coverIsVideo = isValidCoverMedia && isVideoUrl(trimmedCover);

  return (
    <Link to={`/events/${event.id}`} className="group block min-w-0">
      <article className="relative overflow-hidden rounded-xl bg-card border border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
        <div className="relative overflow-hidden h-28 sm:h-40">
          {!isValidCoverMedia ? (
            <EventCoverPlaceholder featured={false} />
          ) : coverIsVideo ? (
            <video src={trimmedCover} autoPlay muted loop playsInline className="w-full h-full object-cover" />
          ) : (
            <img src={trimmedCover} alt={event.title} loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          <div className="absolute top-2 right-2 z-10" onClick={e => e.preventDefault()}>
            <SaveEventButton event={event} />
          </div>
          {isSoldOut && (<div className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-mono font-bold px-2 py-0.5 rounded">SOLD OUT</div>)}
          {isSellingFast && (<div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-mono font-bold px-2 py-0.5 rounded glow-lime">🔥 {soldPercent}% SOLD</div>)}
        </div>
        <div className="px-3 py-2.5">
          <h3 className="font-display font-black text-sm tracking-tight leading-tight text-foreground group-hover:text-primary transition-colors truncate">{event.title}</h3>
          <div className="flex items-center justify-between mt-1 gap-2">
            {dateStr && <p className="font-mono text-[11px] text-muted-foreground truncate">{dateStr}</p>}
            {event.min_price != null && event.min_price > 0 ? (
              <span className="font-mono text-[11px] text-primary font-bold shrink-0">{formatPrice(event.min_price, event.currency || "USD")}+</span>
            ) : (
              <span className="font-mono text-[11px] text-muted-foreground shrink-0">Free</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function UpcomingEventsSection({ events: propEvents, loading: propLoading }) {
  const events = propEvents || null;
  const loading = propLoading ?? false;

  const [containerRef] = useInView();
  const [maxVisible, setMaxVisible] = useState(6);

  useEffect(() => {
    const handleResize = () => {
      // Mobile/tablet: show up to 6 (3 rows of 2, or 2 rows of 3). Desktop: up to 8 (2 rows of 4).
      setMaxVisible(window.innerWidth < 1024 ? 6 : 8);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const allUpcoming = filterUpcomingEvents(events || []).filter((e) => e && e.id);
  const filteredEvents = allUpcoming.slice(0, 8);
  const visibleEvents = filteredEvents.slice(0, maxVisible);
  const hasMore = allUpcoming.length > visibleEvents.length;

  if (loading) {
    return (
      <section className="py-8 sm:py-12 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 bg-muted rounded animate-pulse" />
          <div className="h-3 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="mb-6 mt-2 space-y-2">
          <div className="h-3 w-40 bg-muted rounded animate-pulse" />
          <div className="h-8 w-72 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg bg-card border border-border/50 p-6 animate-pulse">
              <div className="h-24 w-full bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded mt-2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!events || events.length === 0 || filteredEvents.length === 0) {
    return null;
  }

  return (
    <section ref={containerRef} className="py-8 sm:py-12 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <span className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">Upcoming Events</span>
        </div>
        <SeeAllButton to="/all-events" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visibleEvents.map((event) => <CompactEventCard key={event.id} event={event} />)}
      </div>
    </section>
  );
}