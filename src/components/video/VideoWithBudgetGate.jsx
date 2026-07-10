/**
 * VideoWithBudgetGate
 *
 * Wraps <video> with streaming limit enforcement.
 * Calls check_playable before allowing playback.
 * Blocks video when limits are exhausted with clear UI + CTA.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { PauseCircle, DollarSign, Loader2, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function VideoWithBudgetGate({
  videoUrl,
  videoId = "",
  isOwner = false,
  ownerLink = "/organizer/media",
  className = "",
  poster,
  controls = true,
  muted = false,
  autoPlay = false,
  loop = false,
  playsInline = true,
  style,
  ...rest
}) {
  const [status, setStatus] = useState({ checking: true, playable: null, usage: null });
  const videoRef = useRef(null);
  const viewTracked = useRef(false);

  useEffect(() => {
    if (!videoUrl && !videoId) {
      setStatus({ checking: false, playable: true, usage: null });
      return;
    }
    setStatus(prev => ({ ...prev, checking: true }));
    base44.functions.invoke("videoMinuteBilling", {
      action: "check_playable",
      video_url: videoUrl,
      video_id: videoId,
    }).then(res => {
      const data = res.data || {};
      setStatus({
        checking: false,
        playable: data.playable !== false,
        usage: data,
      });
    }).catch(() => {
      setStatus({ checking: false, playable: true, usage: null });
    });
  }, [videoUrl, videoId]);

  const trackView = useCallback(() => {
    if (viewTracked.current || !videoUrl) return;
    viewTracked.current = true;
    base44.functions.invoke("videoBudgetPayment", {
      action: "track_view",
      video_url: videoUrl,
      file_size_bytes: 0,
    }).catch(() => {});
  }, [videoUrl]);

  // ── Loading ──
  if (status.checking) return (
    <div className={`flex items-center justify-center bg-black/80 rounded-lg ${className}`} style={style}>
      <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
    </div>
  );

  // ── Blocked: streaming limit exhausted ──
  if (status.playable === false) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-black/90 rounded-lg gap-5 p-8 text-center ${className}`}
        style={style}
      >
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          <PauseCircle className="w-6 h-6 text-white/50" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-display font-bold text-white/90">Video Currently Unavailable</p>
        </div>

        {isOwner && ownerLink && (
          <a
            href={ownerLink}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-display font-bold hover:bg-primary/90 transition-colors"
          >
            <DollarSign className="w-4 h-4" /> Add Budget / Unlock Video
          </a>
        )}
      </div>
    );
  }

  // ── Playable ──
  return (
    <video
      ref={videoRef}
      src={videoUrl}
      className={className}
      style={style}
      poster={poster}
      controls={controls}
      muted={muted}
      autoPlay={autoPlay}
      loop={loop}
      playsInline={playsInline}
      onPlay={trackView}
      {...rest}
    />
  );
}