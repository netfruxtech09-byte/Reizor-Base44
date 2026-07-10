import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Play, ArrowLeft, Image } from "lucide-react";
import PageMeta from "@/components/seo/PageMeta";
import MediaVideoPlayer from "@/components/media/MediaVideoPlayer";
import MediaLightbox from "@/components/media/MediaLightbox";

export default function EventGallery() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  // iOS: holds the raw <video> element so we can call .play() in the gesture handler
  const iosVideoElRef = useRef(null);

  useEffect(() => {
    Promise.all([
      base44.entities.MediaItem.filter({ status: "active", approval_status: "approved" }, "-created_date", 200).catch(() => []),
      base44.entities.OrganizerMediaPost.filter({ status: "active", approval_status: "approved", is_playable: true }, "-created_date", 200).catch(() => []),
    ]).then(([mediaItems, orgPosts]) => {
      const normalized = orgPosts.map(p => ({
        id: p.id,
        url: p.mux_playback_url || p.media_url,
        mobile_playback_url: p.mobile_playback_url || null,
        desktop_optimized_url: p.desktop_optimized_url || null,
        type: p.media_type,
        is_360: p.is_360 || false,
        title: p.caption || p.venue_name || "",
        description: [p.venue_name, p.city, p.state, p.country].filter(Boolean).join(", "),
        thumbnail_url: p.thumbnail_url || "",
        mux_playback_id: p.mux_playback_id || null,
        mux_status: p.mux_status || null,
        organizer_id: p.organizer_id,
        caption: p.caption,
        venue_name: p.venue_name,
        city: p.city,
        event_date: p.event_date,
      }));

      // Merge and deduplicate by ID
      const seen = new Set();
      const all = [];
      for (const item of [...mediaItems, ...normalized]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          all.push(item);
        }
      }
      setItems(all);
      setLoading(false);
    }).catch(() => setLoading(false));
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const videoCount = items.filter(i => i.type === "video").length;
  const imageCount = items.filter(i => i.type === "image").length;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-7xl mx-auto">
      <PageMeta
        title="Event Gallery — REIZOR"
        description="Browse event photos and videos from music events across the Reizor platform. See 360° videos, event highlights, and more."
        canonical="https://reizor.com/gallery"
      />
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span className="font-mono text-xs">Back</span>
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ Events Gallery</span>
        </div>
        <h1 className="font-display font-black text-4xl tracking-tight">EVENT GALLERY</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Browse through {items.length} media items — {imageCount} images, {videoCount} videos from events across the platform.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="py-16 text-center rounded-xl bg-card border border-border/50">
          <Image className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-display font-bold text-base text-muted-foreground">No media yet</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">Event photos and videos will appear here</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          {/* Masonry grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item, i) => (
              <button
                key={item.id}
                onClick={() => {
                  iosVideoElRef.current = null;
                  setActive(item);
                  // iOS/Android: play() must be called synchronously in the gesture handler
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
                className="group relative overflow-hidden rounded-lg border border-border/50 hover:border-primary/40 transition-all"
              >
                <div className="aspect-square sm:aspect-video bg-muted">
                  {item.type === "video" ? (
                    <div className="w-full h-full flex items-center justify-center bg-card">
                      {item.thumbnail_url
                        ? <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                        : <MediaVideoPlayer src={item.url} poster={item.thumbnail_url} className="w-full h-full" controls={false} muted loop />
                      }
                      {item.is_360 && (
                        <div className="absolute top-2 left-2 z-10 font-mono text-[9px] font-black bg-accent/90 text-white px-1.5 py-0.5 rounded-full">360°</div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img src={item.url} alt={item.title}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs font-bold text-foreground truncate">{item.title}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Lightbox — shared with home page MediaGallery */}
      <MediaLightbox item={active} currentUser={currentUser} onClose={() => setActive(null)} videoElRef={iosVideoElRef} />
    </div>
  );
}