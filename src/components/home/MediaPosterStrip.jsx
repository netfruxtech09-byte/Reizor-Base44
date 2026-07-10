import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Play, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import useInView from "@/hooks/useInView";
import SpotlightMediaModal from "./SpotlightMediaModal";
import SeeAllButton from "./SeeAllButton";

const IMAGE_DURATION = 3000;
const VIDEO_DURATION = 15000;
const GAP = 16;

function buildPosterItems(artists, albums, posts) {
  const validArtistIds = new Set(artists.map((a) => a.id));
  const items = [];

  for (const album of albums) {
    if (!album.artist_id) continue;
    if (!validArtistIds.has(album.artist_id)) continue;
    if (!album.is_public) continue;
    if (album.approval_status && album.approval_status !== "approved") continue;

    const urls = album.media_urls || [];
    const types = album.media_types || [];
    const is360Arr = album.media_is360 || [];
    const thumbnails = album.media_thumbnails || [];

    urls.forEach((url, i) => {
      if (!url) return;
      const type = (types[i] || "").toLowerCase();
      const mediaType = type.includes("video") ? "video" : "image";
      items.push({
        id: `${album.id}-${i}`, url, type: mediaType,
        is360: mediaType === "video" && (type === "video360" || is360Arr[i] === true),
        thumbnail: thumbnails[i] || "", title: album.media_titles?.[i] || album.title || "",
        caption: album.media_captions?.[i] || "", artist: album.artist_name || "", artistId: album.artist_id,
      });
    });
  }

  for (const post of posts) {
    if (!post.artist_id) continue;
    if (!validArtistIds.has(post.artist_id)) continue;
    if (post.approval_status && post.approval_status !== "approved") continue;

    const urls = post.media_urls || [];
    const types = post.media_types || [];
    const is360Arr = post.media_is360 || [];
    const thumbnails = post.media_thumbnails || [];

    urls.forEach((url, i) => {
      if (!url) return;
      const type = (types[i] || "").toLowerCase();
      const mediaType = type.includes("video") ? "video" : "image";
      items.push({
        id: `post-${post.id}-${i}`, url, type: mediaType,
        is360: mediaType === "video" && (type === "video360" || is360Arr[i] === true),
        thumbnail: thumbnails[i] || "", title: post.media_titles?.[i] || post.caption || "",
        caption: post.caption || "", artist: post.artist_name || "", artistId: post.artist_id,
        mux_playback_id: mediaType === "video" ? (post.mux_playback_id || null) : null,
        mux_status: post.mux_status || null,
        desktop_optimized_url: post.desktop_optimized_url || null,
        mobile_playback_url: post.mobile_playback_url || null,
      });
    });
  }

  const seen = new Set();
  const unique = items.filter((item) => { if (seen.has(item.url)) return false; seen.add(item.url); return true; });
  for (let i = unique.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [unique[i], unique[j]] = [unique[j], unique[i]]; }
  return unique.slice(0, 60);
}

function getViewportWidth() {
  return Math.round(window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 320);
}

function getVisibleCountByViewport(viewportWidth) {
  if (viewportWidth >= 1280) return 4;
  if (viewportWidth >= 1024) return 3;
  if (viewportWidth >= 640) return 2;
  return 1;
}

function VideoSlide({ item, isActive, onError }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) { try { el.currentTime = 0; } catch {} el.play().catch(() => {}); }
    else { el.pause(); }
  }, [isActive]);
  return <video ref={videoRef} src={item.url} muted playsInline loop preload="metadata" className="w-full h-full object-cover" onError={onError} />;
}

function PosterCard({ item, isActive, cardWidth, onError, onClick }) {
  const isVideo = item.type === "video";
  const cardHeight = Math.round(cardWidth * (2 / 3));
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/40 bg-card cursor-pointer group hover:border-primary/40 transition-colors"
      style={{ width: cardWidth, minWidth: cardWidth, height: cardHeight, flex: "0 0 auto" }} onClick={onClick}>
      {isVideo ? (
        item.thumbnail
          ? <img src={item.thumbnail} alt={item.title || ""} className="w-full h-full object-cover" loading="lazy" onError={onError} />
          : <VideoSlide item={item} isActive={isActive} onError={onError} />
      ) : (
        <img src={item.url} alt={item.title || item.artist || "media"} className="w-full h-full object-cover" loading="lazy" onError={onError} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      {isVideo && <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-primary/80 flex items-center justify-center"><Play className="w-3.5 h-3.5 text-white ml-0.5" /></div>}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {item.artist && <p className="font-mono text-[11px] text-primary uppercase tracking-widest truncate">{item.artist}</p>}
        {item.title && <p className="font-display font-bold text-base text-white leading-tight truncate mt-1">{item.title}</p>}
      </div>
    </div>
  );
}

function getInitialTrackWidth() {
  return Math.max(getViewportWidth() - 32, 280);
}

// ── Skeleton ──────────────────────────────────────────────────────────────

export default function MediaPosterStrip({ artists: propArtists, albums: propAlbums, posts: propPosts, loading: propLoading }) {
  const artists = propArtists || null;
  const albums = propAlbums || null;
  const posts = propPosts || null;
  const loading = propLoading ?? false;
  const fetched = !propLoading && propArtists !== undefined;
  const [brokenIds, setBrokenIds] = useState(new Set());
  const [paused, setPaused] = useState(false);
  const [activeMedia, setActiveMedia] = useState(null);

  const [containerRef] = useInView();

  const media = useMemo(() => {
    if (!artists || !albums || !posts) return [];
    return buildPosterItems(artists, albums, posts);
  }, [artists, albums, posts]);

  const [viewportWidth, setViewportWidth] = useState(getViewportWidth());
  const [trackWidth, setTrackWidth] = useState(getInitialTrackWidth());
  const [slideIndex, setSlideIndex] = useState(0);

  const wrapperRef = useRef(null);
  const roRef = useRef(null);
  const timerRef = useRef(null);

  const measureEl = useCallback((el) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);
    const pl = parseFloat(styles.paddingLeft) || 0;
    const pr = parseFloat(styles.paddingRight) || 0;
    const inner = rect.width - pl - pr;
    if (inner > 0) { setViewportWidth(getViewportWidth()); setTrackWidth(Math.max(Math.round(inner), 280)); }
  }, []);

  const setWrapperRef = useCallback((el) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    wrapperRef.current = el;
    if (!el) return;
    measureEl(el);
    requestAnimationFrame(() => measureEl(el));
    if (typeof ResizeObserver !== "undefined") {
      roRef.current = new ResizeObserver(() => measureEl(el));
      roRef.current.observe(el);
    }
  }, [measureEl]);

  useEffect(() => {
    const handleResize = () => { if (wrapperRef.current) measureEl(wrapperRef.current); };
    const vv = window.visualViewport;
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    window.addEventListener("pageshow", handleResize);
    vv?.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      window.removeEventListener("pageshow", handleResize);
      vv?.removeEventListener("resize", handleResize);
      if (roRef.current) roRef.current.disconnect();
    };
  }, [measureEl]);

  const visibleMedia = media.filter((m) => !brokenIds.has(m.id));
  const totalCards = visibleMedia.length;
  const visibleCount = getVisibleCountByViewport(viewportWidth);
  const isMobile = visibleCount === 1;
  const totalGap = GAP * (visibleCount - 1);
  const cardWidth = visibleCount === 1 ? trackWidth : Math.floor((trackWidth - totalGap) / visibleCount);
  const cardStep = cardWidth + GAP;
  const canSlide = totalCards > visibleCount;
  const maxSlideIndex = Math.max(0, totalCards - visibleCount);

  const advance = useCallback(() => { setSlideIndex((prev) => { if (!canSlide) return 0; return prev >= maxSlideIndex ? 0 : prev + 1; }); }, [canSlide, maxSlideIndex]);

  useEffect(() => {
    if (!fetched || !canSlide || paused || totalCards === 0) return;
    const currentItem = visibleMedia[slideIndex];
    const duration = currentItem?.type === "video" ? VIDEO_DURATION : IMAGE_DURATION;
    timerRef.current = setTimeout(advance, duration);
    return () => clearTimeout(timerRef.current);
  }, [fetched, slideIndex, paused, canSlide, totalCards, visibleMedia, advance]);

  useEffect(() => { if (fetched && slideIndex > maxSlideIndex) setSlideIndex(0); }, [fetched, slideIndex, maxSlideIndex]);

  if (loading || !fetched) {
    return (
      <section ref={containerRef} className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            <div className="h-8 w-56 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-card border border-border/40 animate-pulse overflow-hidden flex-shrink-0" style={{ width: "calc(25% - 12px)", minWidth: 200, aspectRatio: "3/2" }}>
              <div className="w-full h-full bg-muted" />
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (totalCards === 0) return null;

  const translateX = canSlide ? -(slideIndex * cardStep) : 0;
  const dotCount = canSlide ? maxSlideIndex + 1 : 0;

  return (
    <section ref={containerRef} className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ MEDIA</span>
          <h2 className="font-display font-black text-2xl sm:text-4xl tracking-tight mt-1">ARTIST SPOTLIGHT</h2>
        </div>
        <SeeAllButton to="/artist-media" />
      </div>

      <div className="relative overflow-hidden" onMouseEnter={() => canSlide && setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div ref={setWrapperRef} className="overflow-hidden w-full">
          <div className="flex" style={{ gap: GAP, transform: `translate3d(${translateX}px, 0, 0)`, transition: canSlide ? "transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)" : "none", willChange: "transform" }}>
            {visibleMedia.map((item, i) => {
              const isVisible = i >= slideIndex && i < slideIndex + visibleCount;
              return (
                <PosterCard key={item.id} item={item} isActive={isVisible} cardWidth={cardWidth}
                  onError={() => setBrokenIds((prev) => new Set([...prev, item.id]))}
                  onClick={() => { setPaused(true); setActiveMedia(item); }}
                />
              );
            })}
          </div>
        </div>
        {canSlide && !isMobile && <div className="pointer-events-none absolute right-0 top-0 h-full w-16 sm:w-24 bg-gradient-to-l from-background to-transparent z-10" />}
      </div>

      {canSlide && dotCount > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-5 px-4 flex-wrap">
          {Array.from({ length: dotCount }, (_, i) => i).map((i) => (
            <button key={i} type="button" onClick={() => setSlideIndex(i)} className={`rounded-full transition-all duration-300 ${i === slideIndex ? "w-6 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"}`} aria-label={`Go to slide ${i + 1}`} />
          ))}
        </div>
      )}

      {activeMedia && (
        <SpotlightMediaModal
          item={activeMedia}
          onClose={() => { setActiveMedia(null); setPaused(false); }}
        />
      )}
    </section>
  );
}