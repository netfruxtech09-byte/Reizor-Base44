import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, RotateCcw, SkipBack, SkipForward, Settings } from "lucide-react";
import useWatchTracker from "@/hooks/useWatchTracker";

const CONTROLS_H = 56;
const DEFAULT_H = 280;

// Detect iOS (iPhone/iPad in WKWebView / Mobile Safari)
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Mac OS X/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

// Read the actual safe-area-inset-top pixel value at runtime.
// Strategy: try CSS env() measurement first. If it returns 0 on an iPhone with
// a notch/Dynamic Island, fall back to screen-height heuristics.
// In WKWebView, if the native wrapper already insets the WebView, env() returns 0
// (correct from web perspective), so we rely on the IOS_CLOSE_BTN_MIN_TOP floor.
function readSafeAreaTop() {
  try {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;top:env(safe-area-inset-top,0px);left:0;width:1px;height:1px;pointer-events:none;visibility:hidden;";
    document.body.appendChild(el);
    const val = parseInt(window.getComputedStyle(el).top, 10) || 0;
    document.body.removeChild(el);
    return val;
  } catch { return 0; }
}

// Minimum top offset for iOS close button in fullscreen.
// 80px clears Dynamic Island (59px area), old notch (44px), status bar (50px)
// on ALL modern iPhones, even when env(safe-area-inset-top) returns 0 in WKWebView
// because the native wrapper already handles the inset at the UIKit level.
const IOS_CLOSE_BTN_MIN_TOP = 80;

export default function Video360Player({ src, mobileSrc, desktopSrc, poster, playbackId, muxStatus, isFullscreen = false, autoPlay = false, onClose, trackingVideoId = "", trackingEventId = null, trackingVideoType = "360", trackingOwnerType = "organizer" }) {
  // Use mobile-optimized URL when available on mobile devices
  const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (/Mac OS X/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  // Source priority: 
  // 1. playbackId → construct Mux HLS URL
  // 2. src (if it's already a Mux .m3u8 URL or raw URL)
  // 3. mobile/desktop optimized URLs (legacy)
  const muxHlsUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null;
  // iOS: cap resolution for smooth playback on native HLS (avoid 6K/8K freezing)
  const iosMuxHlsUrl = muxHlsUrl && IS_IOS ? `${muxHlsUrl}?max_resolution=1080p` : muxHlsUrl;
  const resolvedSrc = iosMuxHlsUrl || (IS_MOBILE ? (mobileSrc || src) : (desktopSrc || src));
  const isMuxHls = resolvedSrc?.includes("stream.mux.com") || resolvedSrc?.endsWith(".m3u8");
  const wrapperRef = useRef(null);
  const mountRef = useRef(null);
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const textureRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const initDoneRef = useRef(false);

  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const spherical = useRef({ theta: 0, phi: Math.PI / 2 });
  const velocity = useRef({ theta: 0, phi: 0 });

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(IS_IOS);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressRef = useRef(null);
  const progressDragRef = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [inNativeFS, setInNativeFS] = useState(false);
  const [iosFS, setIosFS] = useState(false);
  const iosFSRef = useRef(false); // sync ref so handleClose can read without stale closure
  useEffect(() => { iosFSRef.current = iosFS; }, [iosFS]);
  const [webglFailed, setWebglFailed] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [qualityLevels, setQualityLevels] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  // Measured safe-area-inset-top in px (read via JS to work in WKWebView)
  const [safeTop, setSafeTop] = useState(0);
  const loadTimeoutRef = useRef(null);
  const userPausedRef = useRef(false);
  const hlsRef = useRef(null);
  const qualityMenuRef = useRef(null);

  // ── Watch tracking ──
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

  // ── Production hardening: track user's explicit mute preference ──
  const userMutedRef = useRef(IS_IOS); // tracks what the user explicitly chose
  // Debounce/action locks for rapid clicking
  const seekLockRef = useRef(false);
  const playLockRef = useRef(false);
  const qualityLockRef = useRef(false);
  // iOS: throttle auto-resume attempts to avoid fighting native HLS buffering
  const lastResumeAttemptRef = useRef(0);
  // Track selected quality separately from HLS actual level (fixes Auto display bug)
  const selectedQualityRef = useRef(-1); // -1 = auto

  // Only one fullscreen state — iOS uses iosFS, Android uses inNativeFS
  const anyFS = isFullscreen || inNativeFS || iosFS;

  // Hide floating chatbot when 360° video player is on screen
  useEffect(() => {
    document.body.classList.add("video-playing");
    return () => document.body.classList.remove("video-playing");
  }, []);

  // ── iOS: init Three.js renderer on demand (called after mount div has size) ──
  const ensureRenderer = useCallback(() => {
    if (initDoneRef.current) return;
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.offsetWidth || window.innerWidth;
    const h = mount.offsetHeight || DEFAULT_H;

    // ── Performance optimization: lower internal canvas resolution ──
    // Render at reduced resolution and let CSS scale up. On mobile this
    // dramatically reduces GPU fill-rate. iOS needs extra headroom for
    // smooth 360° + native HLS video decoding — 55% scale, 0.75 DPR cap.
    const isIOSMobile = IS_IOS && IS_MOBILE;
    const renderScale = isIOSMobile ? 0.55 : IS_MOBILE ? 0.72 : 0.85;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !IS_MOBILE,
        alpha: false,
        powerPreference: IS_MOBILE ? "low-power" : "high-performance",
        preserveDrawingBuffer: false,
      });
    } catch (e) {
      setWebglFailed(true);
      return;
    }
    // Cap DPR aggressively: 0.75 iOS, 1.0 Android, 1.5 desktop
    const maxDPR = isIOSMobile ? 0.75 : IS_MOBILE ? 1.0 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDPR));
    renderer.setSize(Math.round(w * renderScale), Math.round(h * renderScale), false);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;position:relative;z-index:1;";
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── WebGL context lost recovery (iOS can kill WebGL under memory pressure) ──
    renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault(); // ask browser to attempt recovery
      setBuffering(true);
    }, false);
    renderer.domElement.addEventListener("webglcontextrestored", () => {
      setBuffering(false);
      // Force fresh texture upload after context restore
      if (texture._lastVideoTime !== undefined) texture._lastVideoTime = -1;
      texture.needsUpdate = true;
      startRenderLoop();
    }, false);

    let scene, camera, texture;
    try {
      scene = new THREE.Scene();
      sceneRef.current = scene;

      camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
      camera.position.set(0, 0, 0.001);
      cameraRef.current = camera;

      const video = videoRef.current;
      texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      if (THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
      textureRef.current = texture;

      // ── Reduced sphere geometry ──
      const segments = isIOSMobile ? 14 : IS_MOBILE ? 20 : 30;
      const rings = isIOSMobile ? 10 : IS_MOBILE ? 14 : 20;
      const geo = new THREE.SphereGeometry(500, segments, rings);
      geo.scale(-1, 1, 1);
      scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture })));
    } catch (e) {
      setWebglFailed(true);
      return;
    }

    // ── iOS stall / recovery tracking ──
    const stallWatchRef = { lastTime: 0, lastCheck: 0 };
    const stalledPauseSinceRef = { since: 0 }; // when video paused (not user-initiated)
    const stallRecoveryCountRef = { count: 0 };

    // ── Optimized animation loop ──
    // CRITICAL: The loop MUST stay alive while the user wants playback, even
    // during buffering. On iOS native HLS, readyState can drop below 2 when
    // the buffer runs out, and if the loop exits, the auto-resume code is dead.
    // The fix: only exit when user explicitly paused; keep the loop alive
    // through buffering. Auto-resume runs BEFORE the hasData guard so it
    // always fires when the video is stuck, regardless of readyState.
    const animate = () => {
      const v = videoRef.current;

      // Only kill the loop if user explicitly paused
      if (userPausedRef.current) {
        frameRef.current = null;
        return;
      }

      // Schedule next frame immediately — loop stays alive through buffering
      frameRef.current = requestAnimationFrame(animate);

      const hasData = v && v.readyState >= 2;
      const now = performance.now();

      // ── AUTO-RESUME: runs BEFORE the hasData guard so it always fires ──
      // iOS: throttle to once per 2s — native HLS needs time to buffer.
      // CRITICAL: Do NOT call v.load() on iOS. It resets native HLS, re-downloads
      // the manifest, and restarts from already-buffered segments — creating the
      // "looping segment" effect. Use pause/play cycle instead to restart decoding.
      if (v && v.paused && !userPausedRef.current) {
        if (!stalledPauseSinceRef.since) stalledPauseSinceRef.since = now;
        const pauseDuration = now - stalledPauseSinceRef.since;
        const minInterval = IS_IOS ? 2000 : 500;

        if (now - lastResumeAttemptRef.current > minInterval) {
          lastResumeAttemptRef.current = now;
          v.play().catch(() => {});
        }

        // Backup: if paused >8s despite resume attempts, force decoder restart
        // WITHOUT resetting the stream (no v.load() — that causes iOS HLS reset)
        if (pauseDuration > 8000 && stallRecoveryCountRef.count < 3) {
          stallRecoveryCountRef.count++;
          stalledPauseSinceRef.since = 0;
          setBuffering(true);
          // pause+play restart the decoder at current position without reset
          v.pause();
          v.play().catch(() => {});
        }
      } else {
        stalledPauseSinceRef.since = 0;
      }

      // ── iOS stall detection: currentTime not advancing = stuck decoder ──
      // Only fires when video says it's playing (!paused) but currentTime frozen.
      // On iOS native HLS, NEVER call v.load() — it resets the manifest and
      // replays buffered segments. Use pause/play cycle instead.
      if (IS_IOS && hasData && v && !v.paused) {
        if (now - stallWatchRef.lastCheck > 3000) {
          stallWatchRef.lastCheck = now;
          if (v.currentTime === stallWatchRef.lastTime && stallWatchRef.lastTime > 0) {
            stallRecoveryCountRef.count++;
            if (stallRecoveryCountRef.count <= 3) {
              setBuffering(true);
              v.pause();
              v.play().catch(() => {});
            }
          }
          stallWatchRef.lastTime = v.currentTime;
        }
      }

      // No data yet — skip rendering but loop stays alive for auto-resume
      if (!hasData) return;

      // Check if the video has advanced since last frame (avoids redundant GPU uploads)
      const currentVideoTime = v.currentTime;
      const frameAdvanced = currentVideoTime !== texture._lastVideoTime;
      texture._lastVideoTime = currentVideoTime;

      // Update texture only when new frame data is available
      if (frameAdvanced) texture.needsUpdate = true;

      if (!isDragging.current) {
        velocity.current.theta *= 0.88;
        velocity.current.phi *= 0.88;
        spherical.current.theta += velocity.current.theta;
        spherical.current.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.current.phi + velocity.current.phi));
      }
      const { theta, phi } = spherical.current;
      camera.lookAt(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
      renderer.render(scene, camera);
    };

    // ── Start/re-start the render loop ──
    const startRenderLoop = () => {
      if (frameRef.current) return; // already running
      if (userPausedRef.current) return; // user paused — don't restart
      if (texture._lastVideoTime !== undefined) texture._lastVideoTime = -1;
      animate();
    };

    // ── Page visibility: pause rendering when tab hidden ──
    const onVisibility = () => {
      if (document.hidden) {
        if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
      } else {
        const v = videoRef.current;
        if (v && !v.paused) startRenderLoop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Store startRenderLoop + resetStallCounter on the renderer for external use
    renderer._startRenderLoop = startRenderLoop;
    renderer._resetStallCounter = () => { stallRecoveryCountRef.count = 0; };

    // Start the loop — animate() will self-manage based on video state
    startRenderLoop();

    // Drag
    const onMouseDown = (e) => { isDragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY }; velocity.current = { theta: 0, phi: 0 }; renderer.domElement.style.cursor = "grabbing"; e.preventDefault(); };
    const onMouseMove = (e) => { if (!isDragging.current) return; const dx = e.clientX - lastPos.current.x; const dy = e.clientY - lastPos.current.y; const dt = dx * 0.007, dp = dy * 0.007; velocity.current = { theta: -dt, phi: -dp }; spherical.current.theta -= dt; spherical.current.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.current.phi - dp)); lastPos.current = { x: e.clientX, y: e.clientY }; };
    const onMouseUp = () => { isDragging.current = false; renderer.domElement.style.cursor = "grab"; };
    const onTouchStart = (e) => { if (e.touches.length !== 1) return; isDragging.current = true; lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; velocity.current = { theta: 0, phi: 0 }; };
    const onTouchMove = (e) => { if (!isDragging.current || e.touches.length !== 1) return; e.preventDefault(); const dx = e.touches[0].clientX - lastPos.current.x; const dy = e.touches[0].clientY - lastPos.current.y; const dt = dx * 0.007, dp = dy * 0.007; velocity.current = { theta: -dt, phi: -dp }; spherical.current.theta -= dt; spherical.current.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.current.phi - dp)); lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const onTouchEnd = () => { isDragging.current = false; };

    renderer.domElement.addEventListener("mousedown", onMouseDown, { passive: false });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
    renderer.domElement.addEventListener("touchend", onTouchEnd);

    // Resize — maintain the render scale factor
    const syncSize = () => {
      const rw = mount.offsetWidth, rh = mount.offsetHeight;
      if (!rw || !rh) return;
      renderer.setSize(Math.round(rw * renderScale), Math.round(rh * renderScale), false);
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(() => requestAnimationFrame(syncSize));
    ro.observe(mount);
    window.addEventListener("resize", syncSize);
    setTimeout(syncSize, 100);

    // Fullscreen change events — non-iOS only
    // (iOS must never listen to webkitfullscreenchange; it fires spuriously
    //  in WKWebView and incorrectly sets inNativeFS, causing a ghost X button)
    let onFSChange = null;
    if (!IS_IOS) {
      onFSChange = () => {
        const active = !!(document.fullscreenElement || document.webkitFullscreenElement);
        setInNativeFS(active);
        setTimeout(syncSize, 50);
        setTimeout(syncSize, 200);
      };
      document.addEventListener("fullscreenchange", onFSChange);
      document.addEventListener("webkitfullscreenchange", onFSChange);
    }

    initDoneRef.current = true;

    // Store cleanup on renderer for later use
    renderer._cleanup = () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      ro.disconnect();
      window.removeEventListener("resize", syncSize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (!IS_IOS && onFSChange) {
        document.removeEventListener("fullscreenchange", onFSChange);
        document.removeEventListener("webkitfullscreenchange", onFSChange);
      }
      texture.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      initDoneRef.current = false;
    };
  }, []);

  // ── Video element setup (runs once per src) ──
  useEffect(() => {
    initDoneRef.current = false;
    setReady(false);
    setPlaying(false);
    setStarted(false);
    setLoadError(false);
    setWebglFailed(false);
    setMuted(IS_IOS);

    // Clear any previous load timeout
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);

    const video = document.createElement("video");
    video.src = resolvedSrc;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    // CRITICAL: iOS uses "none" to avoid aggressive buffering that fights WebGL.
    // Android/desktop use "metadata" — fetches only the header for fast start.
    // Never use "auto" — it downloads the entire file and freezes mobile browsers.
    video.preload = IS_IOS ? "none" : "metadata";
    // iOS: always start muted — required for programmatic play in WKWebView
    video.muted = true;
    video.crossOrigin = "anonymous";
    // Poster thumbnail — shown before playback starts
    if (poster) video.poster = poster;

    // ── HLS.js setup for Mux adaptive streaming ──
    // Strategy:
    //   - Android / Desktop Chrome: use hls.js (MediaSource-based)
    //   - iOS Safari / Chrome / WKWebView: native HLS via direct .m3u8 src
    //     (hls.js depends on MediaSource which iOS doesn't expose reliably)
    //   - canPlayType("application/vnd.apple.mpegurl") = secondary iOS check
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");
    const useHlsJs = isMuxHls && Hls.isSupported() && !IS_IOS && nativeHls !== "probably";
    if (useHlsJs) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        // Start with auto quality, prefer lower on mobile
        startLevel: -1,
        capLevelToPlayerSize: IS_MOBILE,
        // Auto adjust based on network
        abrEwmaDefaultEstimate: IS_MOBILE ? 500000 : 2000000,
      });
      hls.loadSource(resolvedSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Build quality levels list
        const levels = hls.levels.map((l, i) => ({
          index: i,
          label: l.height >= 2160 ? "4K" : l.height >= 1080 ? "1080p" : l.height >= 720 ? "720p" : l.height >= 480 ? "480p" : `${l.height}p`,
          height: l.height,
          bitrate: l.bitrate,
        }));
        setQualityLevels(levels);
        selectedQualityRef.current = -1;
        setCurrentQuality(-1); // auto
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        // Only update UI state when user manually selected a level (not auto).
        // In auto mode, the HLS engine switches levels internally but the UI
        // should keep showing "Auto" — not the transient actual level.
        if (selectedQualityRef.current !== -1) {
          setCurrentQuality(data.level);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover on network errors
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              // Fatal — destroy and fall back to native
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    }

    const onReady = () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      setReady(true);
      setLoadError(false);
    };
    const onError = () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      setLoadError(true);
    };

    // Progress tracking
    const onTimeUpdate = () => {
      const dur = video.duration;
      if (isFinite(dur) && dur > 0) {
        setCurrentTime(video.currentTime);
        setDuration(dur);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);

    // iOS: loadeddata + canplay both listened — whichever fires first marks ready
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", () => {
      onReady();
      // iOS native HLS: canplay signals enough data buffered — clear loading state
      if (IS_IOS) { setBuffering(false); setLoadError(false); }
    });
    // iOS: also listen for loadedmetadata as an earlier signal
    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("playing", () => {
      setPlaying(true);
      setStarted(true);
      setBuffering(false);
      setLoadError(false);
      startTracking();
      // Reset stall recovery counter on successful playback resume
      if (rendererRef.current?._resetStallCounter) {
        rendererRef.current._resetStallCounter();
      }
      // Restart animation loop when playback resumes (e.g. after seek completes).
      if (rendererRef.current?._startRenderLoop) {
        rendererRef.current._startRenderLoop();
      }
    });
    video.addEventListener("waiting", () => {
      // HLS segment transition — just show buffering, don't interfere
      if (!userPausedRef.current) setBuffering(true);
    });
    video.addEventListener("pause", () => {
      // Only set playing=false if user explicitly paused.
      // HLS buffering also fires pause — the animation loop handles auto-resume.
      if (userPausedRef.current) {
        setPlaying(false);
        stopTracking();
      } else {
        // Not user-paused — let the animation loop handle auto-resume
        setBuffering(true);
      }
    });
    video.addEventListener("error", onError);
    video.addEventListener("stalled", () => {
      // iOS native HLS: stalled during playback — attempt auto-recovery.
      // Do NOT call video.load() — it resets the HLS manifest on iOS and
      // causes the video to replay already-buffered segments (looping bug).
      if (IS_IOS && video.paused && !userPausedRef.current) {
        setBuffering(true);
        video.play().catch(() => {});
      }
    });
    // iOS native HLS sometimes fires suspend instead of waiting during buffering
    video.addEventListener("suspend", () => {
      if (IS_IOS && video.paused && !userPausedRef.current && ready) {
        setBuffering(true);
        // Don't immediately re-play — let canplay/playing events drive recovery
      }
    });
    video.addEventListener("ended", () => {
      stopTracking();
      userPausedRef.current = true;
    });

    videoRef.current = video;
    setVideoElement(video);

    // CRITICAL: Video element MUST be in the DOM AND visibly sized for WebGL VideoTexture
    // to receive decoded frames on mobile browsers. Mobile browsers (iOS WKWebView,
    // Android Chrome) skip video frame decoding for elements that are opacity:0,
    // 1x1px, or positioned off-screen. The fix: place the video as a full-size layer
    // BEHIND the WebGL canvas (z-index: -1) so it's technically "visible" to the
    // decoder but hidden from the user by the canvas rendered on top.
    // DO NOT use opacity:0 or off-screen positioning — that causes audio-only playback.
    const mountEl = mountRef.current;
    if (mountEl) {
      video.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:-1;pointer-events:none;";
      mountEl.appendChild(video);
    } else {
      // Fallback: if mount isn't ready yet, defer to when renderer inits
      video.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:-1;pointer-events:none;";
      document.body.appendChild(video);
    }

    video.load();

    // Load timeout: if video metadata isn't ready after 30s, show error + retry option.
    // With preload="metadata", this should be fast even for large files, but slow
    // CDN or network conditions can delay it on mobile.
    loadTimeoutRef.current = setTimeout(() => {
      if (!video.readyState || video.readyState < 1) {
        setLoadError(true);
      }
    }, 30000);

    // Defer renderer init on iOS to let flex layout resolve; desktop can init now
    let tid;
    if (IS_IOS) {
      tid = setTimeout(() => ensureRenderer(), 80);
    } else {
      ensureRenderer();
    }

    return () => {
      if (tid) clearTimeout(tid);
      clearTimeout(loadTimeoutRef.current);
      stopTracking();
      video.pause(); video.src = "";
      // Destroy hls.js instance
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      // Remove video from wherever it was appended (mount div or body fallback)
      if (video.parentNode) video.parentNode.removeChild(video);
      if (rendererRef.current?._cleanup) rendererRef.current._cleanup();
      rendererRef.current = null;
    };
  }, [resolvedSrc, poster, ensureRenderer]);

  // ── autoPlay (runs after video + renderer are ready) ──
  // iOS WKWebView blocks autoplay even when muted in many cases.
  // We attempt it, but on failure we simply show the play button — no infinite spinner.
  useEffect(() => {
    if (!autoPlay || !ready) return;
    const video = videoRef.current;
    if (!video) return;

    // iOS: skip autoplay attempt entirely — user must tap (avoids silent block + spinner)
    if (IS_IOS) return;

    video.muted = true;
    const p = video.play();
    if (p !== undefined) {
      p.then(() => {
        setPlaying(true);
        setStarted(true);
        setMuted(true);
        startTracking();
        ensureRenderer();
        if (rendererRef.current?._startRenderLoop) rendererRef.current._startRenderLoop();
      }).catch(() => {
        // Autoplay blocked — play button is shown, user taps to start
      });
    }
  }, [autoPlay, ready, ensureRenderer]);

  // ── iOS fullscreen: lock body scroll + measure real safe-area-inset-top ──
  useEffect(() => {
    if (!IS_IOS || !iosFS) return;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    // Measure immediately, then again after layout settles (WKWebView may report 0 initially)
    const m1 = readSafeAreaTop();
    setSafeTop(m1);
    const tid = setTimeout(() => {
      const m2 = readSafeAreaTop();
      setSafeTop(m2);
    }, 150);
    return () => {
      clearTimeout(tid);
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [iosFS]);

  // ── Controls ──
  const doPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    userPausedRef.current = false;
    // Ensure renderer is ready (iOS: might not be if user taps very fast)
    ensureRenderer();
    // Respect user's explicit mute preference — don't force-mute after user unmuted
    v.muted = userMutedRef.current;
    startTracking();
    const p = v.play();
    if (p !== undefined) {
      p.then(() => {
        setPlaying(true);
        setStarted(true);
        setMuted(userMutedRef.current);
        if (rendererRef.current?._startRenderLoop) rendererRef.current._startRenderLoop();
      }).catch(() => {});
    } else {
      setPlaying(true);
      setStarted(true);
      setMuted(userMutedRef.current);
      if (rendererRef.current?._startRenderLoop) rendererRef.current._startRenderLoop();
    }
  }, [ensureRenderer, startTracking]);

  const togglePlay = useCallback(() => {
    if (playLockRef.current) return; // debounce rapid clicks
    playLockRef.current = true;
    const v = videoRef.current;
    if (!v) { playLockRef.current = false; return; }
    if (v.paused) {
      userPausedRef.current = false;
      doPlay();
    } else {
      userPausedRef.current = true;
      v.pause();
      setPlaying(false);
      stopTracking();
    }
    setTimeout(() => { playLockRef.current = false; }, 150);
  }, [doPlay, stopTracking]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    // Persist user's explicit choice in the ref so resume respects it
    userMutedRef.current = v.muted;
    setMuted(v.muted);
  }, []);

  const changeQuality = useCallback((levelIndex) => {
    if (qualityLockRef.current) return; // debounce rapid quality toggles
    const hls = hlsRef.current;
    if (!hls) return;
    qualityLockRef.current = true;
    // Track user's choice and apply
    selectedQualityRef.current = levelIndex;
    hls.currentLevel = levelIndex; // -1 for auto, >=0 for manual
    setCurrentQuality(levelIndex);
    setShowQualityMenu(false);
    setTimeout(() => { qualityLockRef.current = false; }, 350);
  }, []);



  // Close quality menu on outside click
  useEffect(() => {
    if (!showQualityMenu) return;
    const onClick = (e) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target)) {
        setShowQualityMenu(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
    };
  }, [showQualityMenu]);

  // Always use the tracked ref for quality label badge — prevents Auto from showing
  // transient level numbers during adaptive bitrate switching.
  const qualityLabel = selectedQualityRef.current === -1 ? "Auto" : qualityLevels.find(l => l.index === selectedQualityRef.current)?.label || "Auto";

  const resetView = useCallback(() => {
    spherical.current = { theta: 0, phi: Math.PI / 2 };
    velocity.current = { theta: 0, phi: 0 };
  }, []);

  const formatTime = (t) => {
    if (!isFinite(t) || t < 0) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleProgressSeek = useCallback((e) => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    const bar = progressRef.current;
    if (!bar) return;
    // Support both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const wasPlaying = !v.paused;
    v.currentTime = pct * v.duration;
    setCurrentTime(pct * v.duration);
    if (wasPlaying) {
      userPausedRef.current = false;
      v.play().catch(() => {});
    }
  }, []);

  const handleProgressStart = useCallback((e) => {
    e.preventDefault();
    progressDragRef.current = true;
    handleProgressSeek(e);
  }, [handleProgressSeek]);

  const handleProgressMove = useCallback((e) => {
    if (!progressDragRef.current) return;
    e.preventDefault();
    handleProgressSeek(e);
  }, [handleProgressSeek]);

  const handleProgressEnd = useCallback(() => {
    progressDragRef.current = false;
  }, []);

  const doSeek = useCallback((delta) => {
    if (seekLockRef.current) return; // debounce rapid clicks
    seekLockRef.current = true;
    const v = videoRef.current;
    if (!v) { seekLockRef.current = false; return; }
    const dur = v.duration || 0;
    if (!isFinite(dur) || dur <= 0) { seekLockRef.current = false; return; }

    // Remember whether the video was currently playing BEFORE seeking.
    // If the user explicitly paused, we must NOT auto-resume after seek.
    const wasPlaying = !v.paused && !v.ended;

    const target = Math.max(0, Math.min(dur, v.currentTime + delta));

    // Seek — HLS will trigger waiting/buffering while loading new segments
    v.currentTime = target;

    // If video was playing before seek, resume playback immediately.
    // HLS will buffer the new position and the 'playing' event will fire
    // once enough data is available — restarting the animation loop.
    if (wasPlaying) {
      v.play().then(() => {
        setBuffering(false);
        setPlaying(true);
        if (rendererRef.current?._startRenderLoop) {
          rendererRef.current._startRenderLoop();
        }
      }).catch(() => {
        // Play may reject if still buffering — the 'playing' event handler
        // covers this case by restarting the loop when data arrives.
      });
    }

    setTimeout(() => { seekLockRef.current = false; }, 200);
  }, []);

  const rewind = useCallback(() => doSeek(-10), [doSeek]);
  const fastForward = useCallback(() => doSeek(10), [doSeek]);

  const goFullscreen = useCallback(() => {
    if (IS_IOS) { setIosFS(f => !f); return; }
    const el = wrapperRef.current;
    if (!el) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
  }, []);

  const handleClose = useCallback(() => {
    // iOS fullscreen exit: just leave fullscreen, don't close the modal
    if (IS_IOS && iosFSRef.current) { setIosFS(false); return; }
    // Desktop fullscreen exit before closing
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
    }
    // Always call onClose to close the lightbox/modal
    if (onClose) onClose();
  }, [onClose]);

  // ── Styles ──
  const wrapperStyle = iosFS
    ? { position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "#000", display: "flex", flexDirection: "column" }
    : {
        position: "relative", width: "100%", backgroundColor: "#000",
        borderRadius: anyFS ? 0 : "0.75rem",
        overflow: "hidden",
        height: anyFS ? "100dvh" : DEFAULT_H + CONTROLS_H,
        display: "flex", flexDirection: "column",
      };

  // Show close button in fullscreen OR whenever onClose is provided (lightbox/modal usage).
  // Previously only anyFS (fullscreen), which hid the button in non-fullscreen modals.
  const showClose = anyFS || !!onClose;

  // Compute the close button top offset for iOS as a plain pixel number.
  // Uses the JS-measured safe area (works in WKWebView even when env() returns 0),
  // with a minimum of IOS_CLOSE_BTN_MIN_TOP to always clear Dynamic Island / notch.
  const iosCloseBtnTop = IS_IOS
    ? Math.max(IOS_CLOSE_BTN_MIN_TOP, safeTop + 12)
    : 12;

  // When NOT fullscreen but in lightbox mode, use a smaller offset (no notch concern)
  const closeBtnTop = anyFS
    ? iosCloseBtnTop
    : 12;

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      {/* WebGL fallback: when 360 renderer can't initialize, show a clean placeholder */}
      {webglFailed ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "hsl(228 45% 10%)", minHeight: DEFAULT_H, gap: 12, padding: 24 }}>
          {poster ? (
            <img src={poster} alt="" style={{ width: "100%", maxHeight: DEFAULT_H, objectFit: "cover", borderRadius: 8, opacity: 0.5 }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Play style={{ width: 24, height: 24, color: "rgba(255,255,255,0.3)" }} />
            </div>
          )}
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", fontFamily: "monospace" }}>
            360° video not supported on this device
          </p>
          <button
            onClick={() => { setWebglFailed(false); initDoneRef.current = false; ensureRenderer(); }}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", cursor: "pointer",
              fontSize: 12, fontFamily: "monospace",
            }}
          >Try again</button>
        </div>
      ) : (
        /* Canvas mount */
        <div
          ref={mountRef}
          style={{
            width: "100%", flex: 1, cursor: "grab",
            overflow: "hidden", position: "relative",
            minHeight: DEFAULT_H,
          }}
        />
      )}

      {/* Processing overlay — Mux still encoding */}
      {!webglFailed && muxStatus && muxStatus !== "ready" && muxStatus !== "idle" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 30,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.85)",
        }}>
          <span style={{
            width: 28, height: 28,
            border: "3px solid rgba(255,255,255,0.2)",
            borderTopColor: "hsl(330,100%,55%)", borderRadius: "50%",
            display: "block",
            animation: "spin360 1s linear infinite",
            marginBottom: 12,
          }} />
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "monospace", fontWeight: 700, textAlign: "center" }}>
            {muxStatus === "preparing" ? "Video is processing..." : "Preparing 360° video..."}
          </p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "monospace", textAlign: "center", marginTop: 4 }}>
            Please check back shortly
          </p>
        </div>
      )}

      {/* Buffering indicator */}
      {!webglFailed && buffering && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 25, pointerEvents: "none",
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(0,0,0,0.65)", borderRadius: 12,
          padding: "8px 16px",
        }}>
          <span style={{
            width: 16, height: 16,
            border: "2.5px solid rgba(255,255,255,0.3)",
            borderTopColor: "#fff", borderRadius: "50%",
            display: "block",
            animation: "spin360 0.8s linear infinite",
          }} />
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontFamily: "monospace" }}>Buffering...</span>
        </div>
      )}

      {/* 360° badge — hidden when using fallback */}
      {!webglFailed && (
        <div style={{
          position: "absolute",
          top: anyFS ? (IS_IOS ? iosCloseBtnTop : "calc(16px + env(safe-area-inset-top, 0px))") : 16,
          left: 16,
          fontFamily: "monospace", fontSize: 10, fontWeight: 900,
          background: "rgba(0,0,0,0.65)", color: "#fff",
          padding: "3px 8px", borderRadius: 999, letterSpacing: "0.15em",
          pointerEvents: "none", zIndex: 10,
        }}>360°</div>
      )}

      {/* Close button — always on top, never overlapped by controls */}
      {showClose && onClose && (
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: closeBtnTop,
            right: 12,
            width: 44, height: 44, borderRadius: 8,
            background: "rgba(0,0,0,0.85)", color: "#fff",
            border: "2px solid rgba(255,255,255,0.2)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 500, fontSize: 20, fontWeight: "bold",
            WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
            boxShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}
        >✕</button>
      )}

      {/* Play overlay (before first play) — hidden when using fallback */}
      {!webglFailed && !started && !buffering && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          zIndex: 20, pointerEvents: "none",
        }}>
          {loadError ? (
            // Error state — video failed to load, show retry
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, pointerEvents: "auto" }}>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "monospace", textAlign: "center" }}>
                Video failed to load
              </p>
              <button
                onClick={() => {
                  setLoadError(false);
                  setReady(false);
                  const v = videoRef.current;
                  if (v) { v.load(); }
                }}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)",
                  background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer",
                  fontSize: 13, fontFamily: "monospace",
                  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
                }}
              >Retry</button>
            </div>
          ) : (
            // Normal state — spinner while loading, play button when ready
            <>
              <button
                onClick={togglePlay}
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "hsl(330 100% 55% / 0.92)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  pointerEvents: "auto", boxShadow: "0 0 28px hsl(330 100% 55% / 0.5)",
                  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
                }}
              >
                {ready
                  ? <Play style={{ width: 28, height: 28, color: "#fff", marginLeft: 3 }} />
                  : <span style={{ width: 22, height: 22, border: "2.5px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", display: "block", animation: "spin360 0.8s linear infinite" }} />
                }
              </button>
              {ready && (
                <p style={{ marginTop: 10, color: "rgba(255,255,255,0.45)", fontSize: 11, fontFamily: "monospace" }}>
                  Drag to look around · Tap to play
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* iOS: unmute hint shown after play starts (video forced muted on iOS initially) */}
      {!webglFailed && IS_IOS && started && muted && (
        <button
          onClick={toggleMute}
          style={{
            position: "absolute", bottom: CONTROLS_H + 12, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.72)", color: "#fff",
            border: "none", borderRadius: 20,
            padding: "6px 18px", fontSize: 12, fontFamily: "monospace",
            cursor: "pointer", zIndex: 30, whiteSpace: "nowrap",
            WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
          }}
        >🔇 Tap to unmute</button>
      )}

      {/* Progress bar — shown when video has started and has finite duration */}
      {!webglFailed && started && isFinite(duration) && duration > 0 && (
        <div
          ref={progressRef}
          onMouseDown={handleProgressStart}
          onTouchStart={handleProgressStart}
          onMouseMove={handleProgressMove}
          onTouchMove={handleProgressMove}
          onMouseUp={handleProgressEnd}
          onTouchEnd={handleProgressEnd}
          onMouseLeave={handleProgressEnd}
          style={{
            position: "relative", zIndex: 55,
            height: 24, cursor: "pointer",
            display: "flex", alignItems: "center",
            padding: "0 8px",
            background: "rgba(0,0,0,0.45)",
          }}
        >
          {/* Time display */}
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.7)", minWidth: 40, textAlign: "right", marginRight: 8 }}>
            {formatTime(currentTime)}
          </span>
          {/* Track */}
          <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 2, position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", left: 0, top: 0, height: "100%",
              width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              background: "hsl(330,100%,55%)",
              borderRadius: 2,
              transition: "width 0.1s linear",
            }} />
          </div>
          {/* Duration */}
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.5)", minWidth: 40, marginLeft: 8 }}>
            {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Controls bar — hidden when fallback player is active */}
      <div style={{
        position: "relative", minHeight: CONTROLS_H, flexShrink: 0,
        display: webglFailed ? "none" : "flex", alignItems: "center",
        justifyContent: IS_MOBILE ? "center" : "space-between",
        flexWrap: IS_MOBILE ? "nowrap" : "nowrap",
        padding: "0 8px", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
        gap: IS_MOBILE ? 6 : 4,
        background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.7))",
        zIndex: 50, boxSizing: "border-box", overflowX: "hidden",
      }}>
        {[
          { icon: <SkipBack style={{ width: 16, height: 16 }} />, onClick: rewind, title: "Rewind 10s" },
          { icon: playing ? <Pause style={{ width: 18, height: 18 }} /> : <Play style={{ width: 18, height: 18 }} />, onClick: togglePlay, title: playing ? "Pause" : "Play" },
          { icon: <SkipForward style={{ width: 16, height: 16 }} />, onClick: fastForward, title: "Forward 10s" },
          { icon: muted ? <VolumeX style={{ width: 16, height: 16 }} /> : <Volume2 style={{ width: 16, height: 16 }} />, onClick: toggleMute, title: muted ? "Unmute" : "Mute" },
          { icon: <RotateCcw style={{ width: 16, height: 16 }} />, onClick: resetView, title: "Reset 360° view" },
          // Fullscreen button — hidden on mobile/tablet (unnecessary, causes layout issues)
          ...(!IS_MOBILE ? [{
            icon: anyFS ? <Minimize style={{ width: 16, height: 16 }} /> : <Maximize style={{ width: 16, height: 16 }} />, onClick: goFullscreen, title: anyFS ? "Exit fullscreen" : "Fullscreen",
          }] : []),
          {
            icon: (
              <div style={{ position: "relative" }}>
                <Settings style={{ width: 14, height: 14 }} />
                <span style={{
                  position: "absolute", bottom: -3, right: -5,
                  fontSize: 7, fontFamily: "monospace", fontWeight: 900,
                  background: qualityLabel === "Auto" ? "hsl(220,100%,55%)" : "hsl(330,100%,55%)",
                  color: "#fff",
                  borderRadius: 3, padding: "0 3px", lineHeight: "11px",
                }}>{qualityLabel}</span>
              </div>
            ),
            onClick: () => setShowQualityMenu(s => !s),
            title: `Quality: ${qualityLabel}${IS_IOS ? " (managed by iOS)" : ""}`,
          },
        ].map(({ icon, onClick, title }, i) => (
          <button key={i} onClick={onClick} title={title} style={{
            width: IS_MOBILE ? 36 : 40, height: IS_MOBILE ? 36 : 40, borderRadius: 8, border: "none",
            background: "rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
          }}>
            {icon}
          </button>
        ))}
      </div>

      {/* Quality selector popup — always available */}
      {showQualityMenu && (
        <div ref={qualityMenuRef} style={{
          position: "absolute", bottom: CONTROLS_H + 8, right: 8,
          zIndex: 100, minWidth: 130,
          background: "rgba(15,15,20,0.96)", borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.15)",
          padding: 4, overflow: "hidden",
        }}>
          <button
            onClick={() => changeQuality(-1)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", borderRadius: 8, border: "none",
              background: currentQuality === -1 ? "rgba(255,255,255,0.12)" : "transparent",
              color: currentQuality === -1 ? "#fff" : "rgba(255,255,255,0.6)",
              cursor: "pointer", fontSize: 12, fontFamily: "monospace",
              WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
            }}
          >
            Auto {currentQuality === -1 && <span style={{ fontSize: 10, color: "hsl(330,100%,55%)" }}>✓</span>}
          </button>
          {qualityLevels.map(l => (
            <button
              key={l.index}
              onClick={() => changeQuality(l.index)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", borderRadius: 8, border: "none",
                background: currentQuality === l.index ? "rgba(255,255,255,0.12)" : "transparent",
                color: currentQuality === l.index ? "#fff" : "rgba(255,255,255,0.6)",
                cursor: "pointer", fontSize: 12, fontFamily: "monospace",
                WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
              }}
            >
              {l.label} {currentQuality === l.index && <span style={{ fontSize: 10, color: "hsl(330,100%,55%)" }}>✓</span>}
            </button>
          ))}
          {qualityLevels.length === 0 && IS_IOS && (
            <div style={{
              padding: "8px 12px",
              color: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "monospace",
              textAlign: "center", lineHeight: 1.5,
            }}>
              Quality is managed automatically by iOS for best playback.
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin360 { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}