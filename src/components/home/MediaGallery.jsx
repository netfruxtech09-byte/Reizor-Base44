import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Play, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { isToday, isYesterday, differenceInCalendarDays, format } from "date-fns";
import MediaLightbox from "@/components/media/MediaLightbox";
import useMediaLimitFilter from "@/hooks/useMediaLimitFilter";
import useInView from "@/hooks/useInView";
import SeeAllButton from "./SeeAllButton";

function formatPostedDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  if (isToday(d)) return "Posted today";
  if (isYesterday(d)) return "Posted yesterday";
  const daysAgo = differenceInCalendarDays(new Date(), d);
  if (daysAgo > 0 && daysAgo <= 6) return `Posted ${daysAgo} days ago`;
  return `Posted ${format(d, "MMM d, yyyy")}`;
}

export default function MediaGallery({ mediaItems: propMediaItems, orgPosts: propOrgPosts, loading: propLoading }) {
  const mediaItems = propMediaItems || null;
  const orgPosts = propOrgPosts || null;
  const loading = propLoading ?? false;
  const fetched = !propLoading && propMediaItems !== undefined;
  const [active, setActive] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  // iOS: holds the raw <video> element so we can call .play() in the gesture handler
  const iosVideoElRef = useRef(null);

  const [containerRef] = useInView();

  // Load current user for PostInteractionBar inside the lightbox
  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Normalize OrganizerMediaPost fields to match MediaItem shape
  const items = useMemo(() => {
    const normalized = (orgPosts || []).map((p) => ({
      id: p.id,
      url: p.mux_playback_url || p.media_url,
      mobile_playback_url: p.mobile_playback_url || null,
      desktop_optimized_url: p.desktop_optimized_url || null,
      type: p.media_type,
      is_360: p.is_360 || false,
      title: p.caption || p.venue_name || (p.organizer_name ? `${p.media_type === "video" ? "Video" : "Photo"} from ${p.organizer_name}` : (p.media_type === "video" ? "Event Video" : "Event Photo")),
      description: [p.venue_name, p.city, p.state, p.country].filter(Boolean).join(", "),
      thumbnail_url: p.thumbnail_url || "",
      mux_playback_id: p.mux_playback_id || null,
      mux_status: p.mux_status || null,
      show_on_homepage: true,
      status: "active",
      approval_status: "approved",
      organizer_id: p.organizer_id,
      organizer_name: p.organizer_name || "",
      caption: p.caption,
      venue_name: p.venue_name,
      city: p.city,
      event_date: p.event_date,
      created_date: p.created_date,
    }));
    return [...(mediaItems || []), ...normalized];
  }, [mediaItems, orgPosts]);

  const { filtered: visibleItems, loading: filterLoading } = useMediaLimitFilter(items);
  const itemsToShow = useMemo(() => visibleItems, [visibleItems]);

  // Only show shimmer when main data is loading, not during filter check.
  // filterLoading (useMediaLimitFilter) runs after data is already loaded;
  // showing shimmer during that brief check causes content→shimmer→content flicker.
  if (loading || !fetched) {
    return (
      <section ref={containerRef} className="py-16 sm:py-8 lg:py-6 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-28 bg-muted rounded animate-pulse" />
            <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="rounded-lg bg-card border border-border/50 animate-pulse overflow-hidden">
              <div className="aspect-video bg-muted" />
              <div className="p-2">
                <div className="h-3 w-3/4 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (itemsToShow.length === 0) return null;



  return (
    <section ref={containerRef} className="py-6 sm:py-8 lg:py-6 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="mb-5 sm:mb-8 flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ EVENTS GALLERY</span>
          <h2 className="font-display font-black text-2xl sm:text-4xl tracking-tight mt-1">FEEL THE VIBE</h2>
        </div>
        <SeeAllButton to="/gallery" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {itemsToShow.map((item, i) => (
          <button key={item.id} onClick={() => {
            iosVideoElRef.current = null;
            setActive(item);
            // iOS/Android: play() must be called synchronously in the gesture handler.
            // MediaLightbox passes iosVideoElRef to MediaVideoPlayer, which assigns the
            // <video> el on mount — available in the next microtask via Promise.resolve().
            if (item.type === "video" && !item.is_360) {
              Promise.resolve().then(() => {
                const v = iosVideoElRef.current;
                if (!v) return;
                v.muted = false;
                v.play().catch(() => {
                  v.muted = true;
                  v.play().catch(() => {});
                });
              });
            }
          }}
            className={`group relative overflow-hidden rounded-xl border border-border/50 hover:border-primary/40 transition-all ${i === 2000 ? "col-span-2 row-span-2" : ""}`}>
            <div className={`relative ${i === 0 ? "aspect-square sm:aspect-video" : "aspect-square sm:aspect-video"} bg-muted`}>
              {item.type === "video" ? (
                <div className="w-full h-full flex items-center justify-center bg-card">
                  {item.thumbnail_url
                    ? <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-black" />
                  }
                  {item.is_360 && <div className="absolute top-2 left-2 z-10 font-mono text-[9px] font-black bg-accent/90 text-white px-1.5 py-0.5 rounded-full">360°</div>}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 sm:w-12 h-14 sm:h-12 rounded-full bg-primary/80 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-6 sm:w-5 h-6 sm:h-5 text-primary-foreground ml-0.5" />
                    </div>
                  </div>
                </div>
              ) : (
                <img src={item.url} alt={item.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2 space-y-0.5 text-left">
                {item.organizer_name && (
                  <p className="text-[9px] font-mono text-primary uppercase tracking-wider truncate">{item.organizer_name}</p>
                )}
                <p className="text-xs font-bold text-white truncate drop-shadow">{item.title}</p>
                {item.created_date && (
                  <p className="text-[9px] text-white/60 truncate">{formatPostedDate(item.created_date)}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <MediaLightbox item={active} currentUser={currentUser} onClose={() => setActive(null)} videoElRef={iosVideoElRef} />
    </section>
  );
}