import { useState, useRef, useEffect } from "react";
import { Play } from "lucide-react";
import Video360Player from "./Video360Player";

/**
 * VideoThumbnail
 * Shows a thumbnail (custom, auto-generated, or placeholder) with a play overlay.
 * On click, replaces itself with the actual video player.
 *
 * Props:
 *   src         - video URL
 *   thumbnail   - optional pre-set thumbnail URL
 *   is360       - render Video360Player on play
 *   className   - extra classes on the wrapper
 *   title       - optional caption overlay
 */
export default function VideoThumbnail({ src, thumbnail, is360 = false, className = "", title, onPlay }) {
  const [thumb, setThumb] = useState(thumbnail || null);
  const [playing, setPlaying] = useState(false);
  const canvasRef = useRef(null);

  // Auto-generate thumbnail from video if none provided
  useEffect(() => {
    if (thumbnail || !src) return;
    let cancelled = false;

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = src;

    const captureFrame = () => {
      if (cancelled) return false;
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 270;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      // Reject black/blank frames (too small = likely solid black)
      if (dataUrl && dataUrl.length > 8000) {
        setThumb(dataUrl);
        return true;
      }
      return false;
    };

    const seekAndCapture = (time, fallbacks) => {
      if (cancelled) return;
      const onSeeked = () => {
        if (cancelled) return;
        const ok = captureFrame();
        if (!ok && fallbacks.length > 0) {
          seekAndCapture(fallbacks[0], fallbacks.slice(1));
        } else {
          video.src = "";
        }
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = time;
    };

    video.addEventListener("loadedmetadata", () => {
      if (cancelled) return;
      const dur = video.duration;
      if (!dur || !isFinite(dur)) {
        // No duration info — clean up
        video.src = "";
        return;
      }
      // Try middle first, then 30%, 60%, 1s as last resort
      const mid = dur / 2;
      const fallbacks = [dur * 0.3, dur * 0.6, Math.min(1, dur * 0.1)];
      seekAndCapture(mid, fallbacks);
    });

    video.addEventListener("error", () => { video.src = ""; });
    video.load();

    return () => {
      cancelled = true;
      video.src = "";
    };
  }, [src, thumbnail]);

  useEffect(() => {
    if (playing) {
      document.body.classList.add("video-playing");
    } else {
      document.body.classList.remove("video-playing");
    }
    return () => document.body.classList.remove("video-playing");
  }, [playing]);

  if (playing) {
    return (
      <div className={`relative rounded-xl bg-black w-full ${className}`}>
        {is360 ? (
          <Video360Player src={src} autoPlay />
        ) : (
          <video
            src={src}
            className="w-full rounded-xl"
            controls
            autoPlay
            playsInline
          />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onPlay ? onPlay() : setPlaying(true)}
      className={`relative group overflow-hidden rounded-xl bg-black w-full aspect-video block ${className}`}
      aria-label="Play video"
    >
      {/* Thumbnail image or gradient placeholder */}
      {thumb ? (
        <img
          src={thumb}
          alt="Video thumbnail"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 flex items-center justify-center">
          <svg className="w-12 h-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
        </div>
      )}

      {/* Dark overlay on hover */}
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />

      {/* 360° badge */}
      {is360 && (
        <div className="absolute top-2 left-2 font-mono text-[9px] font-black bg-black/70 text-white px-1.5 py-0.5 rounded-full tracking-widest pointer-events-none z-10">
          360°
        </div>
      )}

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-primary/90 group-hover:bg-primary flex items-center justify-center shadow-lg shadow-primary/40 transition-all group-hover:scale-110">
          <Play className="w-6 h-6 text-white translate-x-0.5" />
        </div>
      </div>

      {/* Optional title overlay */}
      {title && (
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-xs text-white font-medium truncate">{title}</p>
        </div>
      )}
    </button>
  );
}