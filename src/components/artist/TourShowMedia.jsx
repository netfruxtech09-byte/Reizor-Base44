import { useState, useEffect } from "react";
import { Play, Music, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";

const isValidUrl = (u) => !!u && typeof u === "string" && /^https?:\/\/.+/i.test(u.trim());

/**
 * Extract a YouTube video id from any common YouTube URL shape, including
 * watch links, youtu.be short links, /embed/, /shorts/, /live/, and links
 * carrying extra query params (playlist, t, utm, etc.). Returns null otherwise.
 */
function getYouTubeId(url) {
  if (!url) return null;
  const u = url.trim();
  const patterns = [
    /youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = u.match(p);
    if (m) return m[1];
  }
  return null;
}

function YouTubeEmbed({ youtubeId, autoplay, title }) {
  const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&playsinline=1${autoplay ? "&autoplay=1" : ""}`;
  return (
    <>
      <iframe
        src={src}
        title={title || "Tour video"}
        className="w-full h-full"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      {/* Escape hatch if the embed is blocked by the video owner */}
      <a
        href={`https://www.youtube.com/watch?v=${youtubeId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-black/60 text-white text-[10px] font-mono font-bold hover:bg-black/80 transition-colors touch-manipulation"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <ExternalLink className="w-3 h-3" /> YouTube
      </a>
    </>
  );
}

/**
 * TourShowMedia — resilient media block for tour schedule cards and detail.
 *
 * Priority: promo_image (as poster) + promo_video_url → linked platform Event
 * cover_image/teaser_video_url → branded placeholder. YouTube URLs render via
 * a youtube-nocookie iframe embed (never a native <video>); direct MP4 / HLS /
 * storage URLs use the native player. Consistent 16:9 aspect ratio throughout.
 */
export default function TourShowMedia({ show, rounded = true, className = "" }) {
  const promoImage = isValidUrl(show?.promo_image) ? show.promo_image.trim() : null;
  const promoVideo = isValidUrl(show?.promo_video_url) ? show.promo_video_url.trim() : null;

  const [eventCover, setEventCover] = useState(null);
  const [eventVideo, setEventVideo] = useState(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (promoImage || promoVideo || !show?.platform_event_id) return;
    let cancelled = false;
    setEventLoading(true);
    base44.entities.Event.filter({ id: show.platform_event_id }, null, 1)
      .then(events => {
        if (cancelled) return;
        const ev = events[0];
        if (ev) {
          setEventCover(isValidUrl(ev.cover_image) ? ev.cover_image : null);
          setEventVideo(isValidUrl(ev.teaser_video_url) ? ev.teaser_video_url : null);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEventLoading(false); });
    return () => { cancelled = true; };
  }, [promoImage, promoVideo, show?.platform_event_id]);

  const videoSrc = promoVideo || eventVideo || null;
  const youtubeId = getYouTubeId(videoSrc);
  // YouTube thumbnail used as a poster when no promo image is set
  const ytThumb = youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null;

  const baseImage = (promoImage && !imgFailed) ? promoImage : (eventCover && !coverFailed) ? eventCover : null;
  const posterImage = (!posterFailed && baseImage) ? baseImage : (!posterFailed && ytThumb) ? ytThumb : null;

  const wrapClass = `relative w-full overflow-hidden bg-muted/30 aspect-video ${rounded ? "rounded-xl" : ""} ${className}`;

  // Resolving linked-event fallback media
  if (eventLoading && !promoImage && !promoVideo) {
    return <div className={`${wrapClass} shimmer`} aria-hidden="true" />;
  }

  // Active playback (entered after tapping the play overlay)
  if (playing && videoSrc) {
    return (
      <div className={wrapClass}>
        {youtubeId
          ? <YouTubeEmbed youtubeId={youtubeId} autoplay title={show?.venue_name} />
          : <video src={videoSrc} controls autoPlay playsInline className="w-full h-full object-cover" onError={() => setPlaying(false)} />}
      </div>
    );
  }

  // Poster thumbnail with a play overlay when a video is available
  if (posterImage && videoSrc) {
    return (
      <div className={wrapClass}>
        <img
          src={posterImage}
          alt={show?.venue_name || "Tour date"}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => { if (posterImage === promoImage) setImgFailed(true); else if (posterImage === eventCover) setCoverFailed(true); else setPosterFailed(true); }}
        />
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors touch-manipulation"
          aria-label="Play tour video"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <span className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
            <Play className="w-6 h-6 text-white ml-0.5" />
          </span>
        </button>
      </div>
    );
  }

  // Video exists but no usable poster — load the player directly
  if (videoSrc) {
    return (
      <div className={wrapClass}>
        {youtubeId
          ? <YouTubeEmbed youtubeId={youtubeId} title={show?.venue_name} />
          : <video src={videoSrc} controls playsInline preload="metadata" className="w-full h-full object-cover" />}
      </div>
    );
  }

  // Branded placeholder — controlled 16:9, never blank
  return (
    <div className={`${wrapClass} flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/5`}>
      <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
        <Music className="w-8 h-8" />
        <span className="font-mono text-[10px] uppercase tracking-widest">Tour Date</span>
      </div>
    </div>
  );
}