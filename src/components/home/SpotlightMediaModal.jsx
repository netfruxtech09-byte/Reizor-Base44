import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import Video360Player from "@/components/media/Video360Player";

const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Mac OS X/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/**
 * Centered media viewer for the "Artist Spotlight" poster strip.
 * Opens via portal at z-[100] (above the navbar). Handles images,
 * regular videos, and 360 videos. Locks scroll, restores position,
 * closes on backdrop / Escape / close button. Keeps a separate
 * artist-profile link so media clicks never navigate away.
 */
export default function SpotlightMediaModal({ item, onClose }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const isVideo = item?.type === "video";
  const is360 = isVideo && item?.is360;

  // ── Hide floating chatbot while modal is open ──
  useEffect(() => {
    document.body.classList.add("video-playing");
    return () => document.body.classList.remove("video-playing");
  }, []);

  // ── Lock background scroll and restore previous position on close ──
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = "hidden";
    if (IS_IOS) {
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.width = "100%";
    }
    return () => {
      body.style.overflow = prev.overflow;
      if (IS_IOS) {
        body.style.position = prev.position;
        body.style.top = prev.top;
        body.style.width = prev.width;
        window.scrollTo(0, scrollY);
      }
    };
  }, []);

  // ── Escape key close (desktop) ──
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Pause / reset video on unmount ──
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    };
  }, []);

  // ── Reset loading/error when item changes ──
  useEffect(() => {
    setLoading(true);
    setImageError(false);
  }, [item?.id]);

  const padTop = IS_IOS
    ? "max(env(safe-area-inset-top, 0px) + 12px, 12px)"
    : "12px";
  const padX = "max(env(safe-area-inset-left, 0px), 16px)";
  const padRight = "max(env(safe-area-inset-right, 0px), 16px)";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col overflow-hidden"
      onClick={onClose}
      style={{ width: "100vw", height: "100dvh" }}
    >
      {/* ── Header: info (left) + close button (right) — sits above media, never overlaps ── */}
      <div
        className="flex items-start justify-between gap-3 shrink-0 px-4 pt-3 pb-2"
        style={{ paddingTop: padTop, paddingLeft: padX, paddingRight: padRight }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          {item?.artist && (
            <Link
              to={item.artistId ? `/artists/${item.artistId}` : "/artists"}
              className="inline-block font-mono text-xs text-primary uppercase tracking-widest hover:text-primary/80 transition-colors truncate max-w-full"
              onClick={onClose}
            >
              {item.artist}
            </Link>
          )}
          {item?.title && (
            <p className="font-display font-bold text-white text-sm leading-tight truncate">{item.title}</p>
          )}
          {item?.caption && (
            <p className="text-xs text-white/60 leading-snug line-clamp-2">{item.caption}</p>
          )}
        </div>
        {!is360 && (
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="shrink-0 w-10 h-10 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* ── Media area: flex-1, centered, object-contain — no overlap with header ── */}
      <div
        className="flex-1 flex items-center justify-center min-h-0 min-w-0 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading spinner */}
        {loading && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {isVideo ? (
          is360 ? (
            <div className="absolute inset-0">
              <Video360Player
                src={item.url}
                poster={item.thumbnail}
                playbackId={item.mux_playback_id}
                muxStatus={item.mux_status}
                mobileSrc={item.mobile_playback_url}
                desktopSrc={item.desktop_optimized_url}
                isFullscreen={true}
                autoPlay
                onClose={onClose}
                trackingVideoId={item.id}
                trackingOwnerType="artist"
              />
            </div>
          ) : (
            <video
              ref={videoRef}
              src={item.url}
              className="max-w-full max-h-full object-contain rounded-lg"
              style={{ maxWidth: "100%", maxHeight: "100%" }}
              controls
              playsInline
              muted={muted}
              autoPlay
              onLoadedData={() => setLoading(false)}
              onCanPlay={() => setLoading(false)}
              onPlaying={() => setLoading(false)}
              onWaiting={() => setLoading(true)}
              onError={() => setLoading(false)}
              onEnded={onClose}
            />
          )
        ) : !item?.url || imageError ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center p-6">
            <p className="text-sm text-white/50">This media could not be loaded.</p>
          </div>
        ) : (
          <img
            src={item.url}
            alt={item.title || item.artist || "media"}
            className="max-w-full max-h-full object-contain rounded-lg"
            style={{ maxWidth: "100%", maxHeight: "100%" }}
            onError={() => { setImageError(true); setLoading(false); }}
            onLoad={() => setLoading(false)}
          />
        )}
      </div>
    </div>,
    document.body
  );
}