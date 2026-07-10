import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Calendar, MapPin } from "lucide-react";
import SaveEventButton from "./SaveEventButton";
import LikeEventButton from "./LikeEventButton";
import EventCoverPlaceholder from "./EventCoverPlaceholder";
import { format } from "date-fns";
import { formatPrice } from "@/utils/currency";
import { isEventPast } from "@/utils/eventUtils";

const isVideo = (url) => url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

export default function EventCard({ event, featured = false, showLoyaltyBadge = false }) {
  const [imgError, setImgError] = useState(false);
  
  // Resolve cover media: use cover_image, fall back to first gallery item
  const coverMedia = event.cover_image || event.gallery_images?.[0] || null;
  
  // Reset error state when coverMedia changes
  useEffect(() => {
    setImgError(false);
  }, [coverMedia]);
  
  if (!event) return null;
  const soldPercent = event.total_capacity
    ? Math.round(((event.tickets_sold || 0) / event.total_capacity) * 100)
    : 0;

  const isSoldOut = event.status === "sold_out" || soldPercent >= 100;
  const isSellingFast = soldPercent >= 75 && !isSoldOut;
  const isPast = isEventPast(event);

  const dateStr = event.date
    ? format(new Date(event.date), "EEE, MMM d")
    : null;

  // Build a compact "City, Country" location string from saved fields
  const locationParts = [event.city, event.country].filter(p => p && String(p).trim());
  const locationStr = locationParts.length
    ? locationParts.map(p => String(p).trim()).join(", ")
    : (event.venue_state ? String(event.venue_state).trim() : "");

  // Validate coverMedia: must be non-empty string AND valid URL format
  const trimmedCover = coverMedia?.trim();
  const isValidCoverMedia = trimmedCover && typeof trimmedCover === 'string' && trimmedCover.length > 0 &&
    /^(https?:\/\/|blob:|data:)/.test(trimmedCover);
  const coverIsVideo = isValidCoverMedia && isVideo(trimmedCover);

  return (
    <Link
      to={`/events/${event.id}`}
      className={`group block ${featured ? "col-span-2 row-span-2" : ""}`}
    >
      <article className="relative overflow-hidden rounded-xl bg-card border border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
        {/* Poster image / video — square aspect for clean grid */}
         <div className={`relative overflow-hidden ${featured ? "aspect-[16/9]" : "aspect-square"}`}>
           {!isValidCoverMedia || imgError ? (
             <EventCoverPlaceholder featured={featured} />
           ) : coverIsVideo ? (
             <video
               src={coverMedia}
               autoPlay
               muted
               loop
               playsInline
               className="w-full h-full object-cover"
             />
           ) : (
             <img
               key={`${event.id}-${trimmedCover}`}
               src={trimmedCover}
               alt={event.title}
               className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
               onError={() => setImgError(true)}
               onLoad={() => setImgError(false)}
             />
           )}

          {/* Subtle bottom fade — only if there's valid media AND no error */}
          {isValidCoverMedia && !imgError && <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />}

          {/* Like + Save buttons — always visible */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1" onClick={e => e.preventDefault()}>
            <LikeEventButton event={event} showCount />
            <SaveEventButton event={event} />
          </div>

          {/* Status badges */}
          {isPast && (
            <div className="absolute top-2 left-2 bg-black/70 text-muted-foreground text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-border/50">
              PAST EVENT
            </div>
          )}
          {!isPast && isSoldOut && (
            <div className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-mono font-bold px-2 py-0.5 rounded">
              SOLD OUT
            </div>
          )}
          {!isPast && isSellingFast && (
            <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-mono font-bold px-2 py-0.5 rounded glow-lime">
              🔥 {soldPercent}% SOLD
            </div>
          )}
        </div>

        {/* Text below poster */}
        <div className="px-3 py-2.5">
          <h3 className={`font-display font-black tracking-tight leading-tight text-foreground group-hover:text-primary transition-colors truncate ${featured ? "text-xl" : "text-sm"}`}>
            {event.title}
          </h3>
          <div className="flex items-center justify-between mt-1 gap-2">
            {dateStr && (
              <p className="font-mono text-[11px] text-muted-foreground truncate">
                {dateStr}
              </p>
            )}
            {event.min_price != null && event.min_price > 0 ? (
              <span className="font-mono text-[11px] text-primary font-bold shrink-0">
                {formatPrice(event.min_price, event.currency || "USD")}+
              </span>
            ) : (
              <span className="font-mono text-[11px] text-muted-foreground shrink-0">Free</span>
            )}
          </div>
          {locationStr && (
            <p className="flex items-center gap-1 mt-1 font-mono text-[11px] text-muted-foreground truncate">
              <MapPin className="w-3 h-3 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{locationStr}</span>
            </p>
          )}
          {showLoyaltyBadge && (
            <div className="mt-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 font-mono text-[10px] font-bold">
                ⭐ Loyalty Rewards Available
              </span>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}