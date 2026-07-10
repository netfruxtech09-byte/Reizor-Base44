import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Loader2, Volume2, VolumeX, PauseCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import useWatchTracker from "@/hooks/useWatchTracker";

const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Mac OS X/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/**
 * MediaVideoPlayer — mobile-safe video player.
 *
 * Features:
 *  - playsInline on all platforms
 *  - preload="metadata" (never downloads the full file on page load)
 *  - poster thumbnail support
 *  - error detection + human-readable fallback
 *  - loading spinner while metadata loads
 *  - iOS: muted by default, no autoplay
 *  - desktopSrc / mobileSrc for device-appropriate source selection
 */
const IS_MOBILE_DEVICE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  (/Mac OS X/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export default function MediaVideoPlayer({
  src,
  desktopSrc,
  mobileSrc,
  poster,
  className = "",
  muted = false,
  controls = true,
  autoPlay = false,
  loop = false,
  style,
  onClick,
  onError,
  hideChatbot = false,
  // On iOS, pass a ref to receive the video element immediately after mount
  // so the caller can call .play() within the user gesture handler
  videoElRef,
  // Watch tracking props
  trackingVideoId = "",
  trackingEventId = null,
  trackingVideoType = "normal",
  trackingOwnerType = "organizer",
}) {
  // Hide floating chatbot when video player is on screen
  useEffect(() => {
    document.body.classList.add("video-playing");
    return () => document.body.classList.remove("video-playing");
  }, []);

  // Source priority: mobile → mobileSrc, desktop → desktopSrc (if provided), fallback → src
  const resolvedSrc = IS_MOBILE_DEVICE
    ? (mobileSrc || src)
    : (desktopSrc || src);
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // Start with sound by default for user-initiated playback; muted only if browser blocks audio or explicitly passed
  const [isMuted, setIsMuted] = useState(muted ?? false);
  const [started, setStarted] = useState(false);
  const [gateStatus, setGateStatus] = useState({ checking: false, playable: true, usage: null });
  const [gateChecked, setGateChecked] = useState(false);

  // Playability gate: check if video is accessible (streaming limits not exhausted)
  useEffect(() => {
    if (!trackingVideoId) { setGateChecked(true); return; }
    setGateStatus(prev => ({ ...prev, checking: true }));
    base44.functions.invoke("videoMinuteBilling", {
      action: "check_playable",
      video_url: src,
      video_id: trackingVideoId,
    }).then(res => {
      const data = res.data || {};
      setGateStatus({ checking: false, playable: data.playable !== false, usage: data });
      setGateChecked(true);
    }).catch(() => {
      setGateStatus({ checking: false, playable: true, usage: null });
      setGateChecked(true);
    });
  }, [src, trackingVideoId]);

  // Watch tracking
  const {
    startTracking,
    stopTracking,
    setVideoElement,
  } = useWatchTracker({
    videoUrl: src,
    videoId: trackingVideoId,
    eventId: trackingEventId,
    videoType: trackingVideoType,
    ownerType: trackingOwnerType,
  });

  // Expose the raw video element immediately on mount so parent can call .play() in the gesture
  const setVideoRef = useCallback((el) => {
    videoRef.current = el;
    if (el) {
      setVideoElement(el);
      if (videoElRef) videoElRef.current = el;
    }
  }, [setVideoElement, videoElRef]);

  useEffect(() => {
    setReady(false);
    setLoadError(false);
    setErrorMessage("");
    setStarted(false);
  }, [src]);

  const handleLoadedMetadata = () => {
    setReady(true);
    setLoadError(false);

    if (!autoPlay || !videoRef.current) return;
    const v = videoRef.current;

    // Try unmuted first. On desktop this works immediately.
    // On iOS the parent already called .play() in the gesture handler via videoElRef,
    // so we just ensure muted state is correct — don't call play() again.
    if (IS_IOS) {
      // On iOS, call play() here — this is safe because loadedmetadata fires within
      // the same gesture chain when autoPlay is set, and the video element was already
      // touched by the parent's Promise.resolve() .play() call which primed the gesture.
      v.muted = false;
      v.play().then(() => {
        setIsMuted(false);
        setStarted(true);
        startTracking();
      }).catch(() => {
        v.muted = true;
        v.play().then(() => {
          setIsMuted(true);
          setStarted(true);
          startTracking();
        }).catch(() => {});
      });
      return;
    }

    v.muted = false;
    v.play().then(() => {
      setIsMuted(false);
      setStarted(true);
      startTracking();
    }).catch(() => {
      // Browser blocked unmuted — play muted (browser policy) then auto-unmute
      v.muted = true;
      v.play().then(() => {
        setIsMuted(true);
        setStarted(true);
        startTracking();
        // Try to unmute after a short delay (sometimes works after playback starts)
        setTimeout(() => {
          if (!videoRef.current) return;
          videoRef.current.muted = false;
          setIsMuted(false);
        }, 300);
      }).catch(() => {});
    });
  };

  const handleError = (e) => {
    const v = videoRef.current;
    const code = v?.error?.code;
    let msg = "This video format is not supported on your device.";

    if (code === 4) {
      msg = "This video format is not supported on this device. Please upload an MP4 video encoded with H.264 and AAC.";
    } else if (code === 3) {
      msg = "Video playback was interrupted. Please try again.";
    } else if (code === 2) {
      msg = "The video could not be loaded. The file may be too large or in an unsupported format.";
    } else if (code === 1) {
      msg = "Video loading was aborted.";
    }

    setLoadError(true);
    setErrorMessage(msg);
    onError?.(e);
  };

  const handlePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    // Always attempt to play with sound (user-initiated gesture)
    v.muted = false;
    setIsMuted(false);
    v.play().then(() => {
      setStarted(true);
      startTracking();
    }).catch(() => {
      // Browser blocked audio — fall back to muted and let user unmute manually
      v.muted = true;
      setIsMuted(true);
      v.play().then(() => {
        setStarted(true);
        startTracking();
      }).catch(() => {});
    });
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const formatTime = (s) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ── Gate: blocked (non-playable, fully confirmed) ──
  // IMPORTANT: On iOS we never block rendering with early returns — the <video> element
  // MUST be in the DOM synchronously so the parent gesture-chain .play() call works.
  // On non-iOS we can show a spinner while checking.
  if (!IS_IOS && (!gateChecked || gateStatus.checking)) {
    return (
      <div className={`flex items-center justify-center bg-black/80 rounded-lg ${className}`} style={style}>
        <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
      </div>
    );
  }

  if (gateChecked && gateStatus.playable === false) {
    return (
      <div className={`flex flex-col items-center justify-center bg-black/90 rounded-lg gap-5 p-8 text-center ${className}`} style={style}>
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          <PauseCircle className="w-6 h-6 text-white/50" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-display font-bold text-white/90">Video Currently Unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-black overflow-hidden ${className}`} style={style} onClick={onClick}>
      {/* Loading state */}
      {!ready && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
            <span className="text-[10px] font-mono text-white/50">Loading video…</span>
          </div>
        </div>
      )}

      {/* Error state — clean fallback, no technical message visible to users */}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 bg-card z-10">
          {poster ? (
            <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-card via-muted/30 to-card" />
          )}
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-muted/80 flex items-center justify-center">
              <Play className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground/70">Video unavailable</p>
              <p className="text-xs text-muted-foreground">This video can't be played on your device</p>
            </div>
            <button
              onClick={() => {
                setLoadError(false);
                setReady(false);
                if (videoRef.current) videoRef.current.load();
              }}
              className="px-4 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Play overlay — only shown when NOT autoPlaying and video hasn't started yet */}
      {!started && ready && !loadError && !autoPlay && (
        <div className="absolute inset-0 z-10 cursor-pointer" onClick={handlePlay}>
          {poster && <img src={poster} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-14 h-14 rounded-full bg-primary/85 flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
              <Play className="w-6 h-6 text-white ml-1" />
            </div>
          </div>
        </div>
      )}

      {/* Video element */}
      <video
        ref={setVideoRef}
        src={resolvedSrc}
        playsInline
        preload={autoPlay ? "auto" : "metadata"}
        controls={ready && started && controls}
        muted={isMuted}
        loop={loop}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleError}
        onPlay={() => {
          setStarted(true);
          startTracking();
          // Always sync the actual muted state from the element (parent may have set it)
          if (videoRef.current) setIsMuted(videoRef.current.muted);
        }}
        onPause={() => stopTracking()}
        onEnded={() => stopTracking()}
        className="w-full max-h-full object-contain"
      />

      {/* Mute/unmute toggle — shown whenever video is playing, on all devices */}
      {started && controls && (
        <button
          onClick={toggleMute}
          className="absolute bottom-12 left-3 z-20 w-9 h-9 rounded-lg bg-black/60 flex items-center justify-center border border-white/20 hover:bg-black/80 transition-colors"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-white/80" /> : <Volume2 className="w-4 h-4 text-white/80" />}
        </button>
      )}
    </div>
  );
}