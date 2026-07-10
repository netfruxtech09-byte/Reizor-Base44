import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, ShieldOff, RefreshCw, Keyboard } from "lucide-react";
import jsQR from "jsqr";
import { hapticSuccess, hapticError, hapticLight } from "@/lib/haptics";

/**
 * iOS/Android QR scanner — getUserMedia + jsQR + canvas decode loop.
 *
 * iOS WKWebView fixes baked in:
 *  A. NO overflow:hidden on any ancestor of the <video> element.
 *  B. Video is NEVER display:none — opacity:0 keeps frame delivery alive.
 *  C. Off-screen canvas is NOT display:none — visibility:hidden, off-screen.
 *  D. WebKit webkit.org/b/153588 frozen-frame bug: 1x1 flush canvas.
 *  E. After getUserMedia resolves, yield so React can flush layout.
 *  F. After play(), wait for first `timeupdate` before decode loop on iOS.
 *  G. If videoRef not in DOM when stream arrives, use "attaching" state.
 *  H. Downsample frames to 640px for optimal jsQR accuracy.
 *  I. First-time permission: stream may arrive while video layout is zero.
 *     Detect this via loadedmetadata timeout and auto-restart camera once.
 */

const DECODE_WIDTH = 640;

export default function QRScannerWidget({
  onScan,
  disabled = false,
  continuous = false,
  onStateChange,
}) {
  // state: idle | requesting | attaching | active | error | denied | nocamera
  const [state, setState] = useState("idle");
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  const setStateNotify = useCallback((s) => {
    setState(s);
    onStateChangeRef.current?.(s);
  }, []);

  const [errorMsg, setErrorMsg] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [hint, setHint] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [frameGreen, setFrameGreen] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const flushCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const pendingStreamRef = useRef(null);
  const rafRef = useRef(null);
  const lastScanRef = useRef({ text: "", time: 0 });
  const disabledRef = useRef(disabled);
  const continuousRef = useRef(continuous);
  const mountedRef = useRef(true);
  const failFramesRef = useRef(0);
  const facingRef = useRef("environment");
  // Track how many times we've auto-retried on this startCamera call
  const firstPermAutoRetryRef = useRef(false);

  useEffect(() => { disabledRef.current = disabled; }, [disabled]);
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, []); // eslint-disable-line

  // When state becomes "attaching", videoRef just became available — attach pending stream.
  useEffect(() => {
    if (state !== "attaching") return;
    const stream = pendingStreamRef.current;
    const video = videoRef.current;
    if (!stream || !video) {
      const t = setTimeout(() => {
        if (mountedRef.current && pendingStreamRef.current && videoRef.current) {
          attachAndPlay(videoRef.current, pendingStreamRef.current);
        }
      }, 100);
      return () => clearTimeout(t);
    }
    attachAndPlay(video, stream);
  }, [state]); // eslint-disable-line

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    pendingStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }, []);

  // ── Core: attach stream → video element → decode loop ──
  const attachAndPlay = useCallback(async (video, stream) => {
    if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

    // iOS: set attributes BEFORE assigning srcObject
    video.setAttribute("playsinline", "true");
    video.setAttribute("muted", "true");
    video.muted = true;
    video.playsInline = true;

    // Always clear srcObject first so loadedmetadata fires fresh on re-open
    video.pause();
    video.srcObject = null;

    // Yield so React finishes flushing layout changes (video height 0→280).
    // On first-time permission, the WKWebView JS context resumes after the dialog
    // closes — giving it extra time ensures the video element is fully laid out.
    await new Promise(r => setTimeout(r, 150));
    if (!mountedRef.current) return;

    video.srcObject = stream;
    streamRef.current = stream;
    pendingStreamRef.current = null;

    // Wait for loadedmetadata — simple, reliable promise with 8s timeout
    const metaFired = await new Promise((resolve) => {
      const onMeta = () => { clearTimeout(t); resolve(true); };
      video.addEventListener("loadedmetadata", onMeta, { once: true });
      const t = setTimeout(() => {
        video.removeEventListener("loadedmetadata", onMeta);
        resolve(false); // timeout — let caller handle
      }, 8000);
    });

    if (!mountedRef.current) return;

    if (!metaFired) {
      // loadedmetadata didn't fire within 8s. This is the first-time permission
      // scenario on iOS/Android — the video element may have been zero-sized when
      // the stream was attached. Stop the tracks, reset everything, and do ONE
      // automatic restart so the user doesn't have to kill the app.
      stream.getTracks().forEach(t => t.stop());
      streamRef.current = null;

      if (!firstPermAutoRetryRef.current) {
        firstPermAutoRetryRef.current = true;
        // Brief pause so the OS fully releases the camera track before re-requesting
        await new Promise(r => setTimeout(r, 500));
        if (!mountedRef.current) return;
        // Restart camera from scratch — this time layout is stable
        startCamera(facingRef.current);
      } else {
        // Already retried once — show error
        setErrorMsg("Camera preview could not start. Please tap Retry.");
        setStateNotify("error");
      }
      return;
    }

    // Set canvas dimensions
    if (canvasRef.current && video.videoWidth > 0) {
      canvasRef.current.width = video.videoWidth;
      canvasRef.current.height = video.videoHeight;
    }

    try {
      await video.play();
    } catch {
      await new Promise(r => setTimeout(r, 300));
      if (!mountedRef.current) return;
      await video.play();
    }

    if (!mountedRef.current) return;

    // iOS: wait for first timeupdate — guarantees real frames are flowing
    await new Promise((resolve) => {
      if (video.videoWidth > 0 && video.readyState >= 3) { resolve(); return; }
      const onTime = () => { video.removeEventListener("timeupdate", onTime); resolve(); };
      video.addEventListener("timeupdate", onTime);
      setTimeout(resolve, 2500);
    });

    if (!mountedRef.current) return;

    failFramesRef.current = 0;
    setHint("");
    setStateNotify("active");
    rafRef.current = requestAnimationFrame(decodeLoop);
  }, []); // eslint-disable-line

  // ── Decode loop ──
  const decodeLoop = useCallback(() => {
    if (!mountedRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
      rafRef.current = requestAnimationFrame(decodeLoop);
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(1, DECODE_WIDTH / vw);
    const dw = Math.round(vw * scale);
    const dh = Math.round(vh * scale);

    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // iOS WebKit webkit.org/b/153588 — flush pixel buffer via 1x1 draw first
    const flush = flushCanvasRef.current;
    if (flush) {
      flush.getContext("2d").drawImage(video, 0, 0, 1, 1);
    }

    ctx.drawImage(video, 0, 0, dw, dh);
    const imageData = ctx.getImageData(0, 0, dw, dh);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });

    if (code?.data) {
      const raw = String(code.data).trim();
      const now = Date.now();
      // In continuous mode use a long cooldown (5s) so the same QR sitting in frame
      // doesn't immediately re-fire after a successful scan.
      // In one-shot mode 2s is enough since the camera stops after the first scan.
      const cooldown = continuousRef.current ? 5000 : 2000;
      const isDupe = lastScanRef.current.text === raw && (now - lastScanRef.current.time) < cooldown;

      // Also block while parent is processing (disabled=true) so we never fire
      // a second callback for the same QR while the first API call is in-flight.
      if (raw && !isDupe && !disabledRef.current) {
        lastScanRef.current = { text: raw, time: now };
        failFramesRef.current = 0;
        setHint("");
        setFrameGreen(true);
        hapticSuccess();

        if (!continuousRef.current) {
          stopCamera();
          if (mountedRef.current) {
            setStateNotify("idle");
            setFrameGreen(false);
          }
          onScan(raw);
          return;
        } else {
          onScan(raw);
          setTimeout(() => { if (mountedRef.current) setFrameGreen(false); }, 600);
        }
      }
    } else {
      failFramesRef.current += 1;
      if (failFramesRef.current > 45 && failFramesRef.current < 90) {
        setHint("steady");
      } else if (failFramesRef.current >= 90) {
        setHint("closer");
        if (failFramesRef.current > 150) failFramesRef.current = 0;
      }
    }

    rafRef.current = requestAnimationFrame(decodeLoop);
  }, [onScan, stopCamera]);

  // ── Start camera ──
  const startCamera = useCallback(async (facingMode = "environment") => {
    stopCamera();
    if (!mountedRef.current) return;

    facingRef.current = facingMode;
    setStateNotify("requesting");
    setErrorMsg("");
    setHint("");
    setPermissionDenied(false);
    failFramesRef.current = 0;

    // Give OS time to release previous track; also lets React flush state→"requesting"
    // so the video container is rendered at full height before getUserMedia is called.
    await new Promise(r => setTimeout(r, 200));
    if (!mountedRef.current) return;

    const constraints = {
      video: {
        facingMode: { ideal: facingMode },
        width:  { ideal: 1280, min: 480 },
        height: { ideal: 720,  min: 360 },
        advanced: [{ focusMode: "continuous" }],
      },
      audio: false,
    };

    // No timeout on getUserMedia — the OS permission dialog blocks for as long as
    // the user needs. A timeout here causes the "timed out" error on first grant.
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (!mountedRef.current) return;
      const name = err?.name || "";
      if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingMode } },
            audio: false,
          });
        } catch (err2) {
          handleCameraError(err2, facingMode);
          return;
        }
      } else {
        handleCameraError(err, facingMode);
        return;
      }
    }

    if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

    // Extra yield after stream arrives — on first-time permission, the native dialog
    // just closed and WKWebView may not have re-laid-out the video element yet.
    await new Promise(r => setTimeout(r, 100));
    if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

    const video = videoRef.current;
    if (!video) {
      pendingStreamRef.current = stream;
      setStateNotify("attaching");
      return;
    }

    try {
      await attachAndPlay(video, stream);
    } catch (err) {
      if (!mountedRef.current) return;
      stream.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setErrorMsg(err?.message || "Camera failed to start. Please try again.");
      setStateNotify("error");
    }
  }, [attachAndPlay, stopCamera]); // eslint-disable-line

  const handleCameraError = (err, facingMode) => {
    if (!mountedRef.current) return;
    const name = err?.name || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      setStateNotify("denied");
      setPermissionDenied(true);
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      if (facingMode === "environment") {
        setCameraFacing("user");
        startCamera("user");
        return;
      }
      setStateNotify("nocamera");
    } else {
      setErrorMsg(err?.message || "Camera error — please check permissions and try again.");
      setStateNotify("error");
    }
    stopCamera();
  };

  const handleStop = useCallback(() => {
    stopCamera();
    setStateNotify("idle");
    setHint("");
    setFrameGreen(false);
    failFramesRef.current = 0;
    lastScanRef.current = { text: "", time: 0 };
  }, [stopCamera, setStateNotify]);

  const handleRetry = useCallback(() => {
    hapticLight();
    firstPermAutoRetryRef.current = false;
    startCamera(cameraFacing);
  }, [startCamera, cameraFacing]); // eslint-disable-line

  const handleFlipCamera = useCallback(() => {
    const next = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(next);
    firstPermAutoRetryRef.current = false;
    startCamera(next);
  }, [cameraFacing, startCamera]); // eslint-disable-line

  const isActive = state === "active";
  const isRequesting = state === "requesting" || state === "attaching";

  // ─── Error / permission states ─────────────────────────────────────────────
  if (state === "denied") {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-center">
          <ShieldOff className="w-10 h-10 text-destructive" />
          <p className="font-display font-bold text-sm">Camera Access Blocked</p>
          <p className="text-xs text-muted-foreground font-mono">Allow camera access in your device settings, then tap Try Again.</p>
          <button onClick={handleRetry} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm">
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
        <ManualFallback onScan={onScan} />
      </div>
    );
  }

  if (state === "nocamera") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
          <p className="font-display font-bold text-sm">No Camera Detected</p>
          <p className="text-xs text-muted-foreground mt-1">Use manual entry below</p>
        </div>
        <ManualFallback onScan={onScan} />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center gap-3 p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-center">
          <p className="font-display font-bold text-sm text-destructive">Camera could not start</p>
          <p className="text-xs text-muted-foreground font-mono">{errorMsg || "Please check your camera permissions and try again."}</p>
          <button onClick={handleRetry} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm">
            <RefreshCw className="w-4 h-4" /> Retry Camera
          </button>
        </div>
        <ManualFallback onScan={onScan} />
      </div>
    );
  }

  // ─── Main scanner UI ───────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {!isActive && (
        isRequesting ? (
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border/50 text-sm font-mono text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Requesting camera…
          </div>
        ) : (
          <div className="space-y-2">
            <button onClick={() => { firstPermAutoRetryRef.current = false; startCamera(cameraFacing); }} disabled={disabled}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold glow-lime disabled:opacity-50">
              <Camera className="w-4 h-4" /> Start Camera Scan
            </button>
            <button onClick={() => setManualMode(m => !m)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/50 bg-card font-display font-bold text-sm">
              <Keyboard className="w-4 h-4" /> {manualMode ? "Hide Manual Entry" : "Enter Code Manually"}
            </button>
            {manualMode && <ManualFallback onScan={onScan} />}
          </div>
        )
      )}

      {/*
        VIDEO CONTAINER — iOS WKWebView rules:
        • No overflow:hidden on any ancestor of <video> — clips compositing layer.
        • <video> is always in the DOM; hiding = opacity:0, never display:none.
        • Visual rounded corners only on a pointer-events:none overlay div.
      */}
      <div style={{ position: "relative", height: (isActive || isRequesting) ? 280 : 0, background: "#000", overflow: "hidden" }}>

        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            opacity: isActive ? 1 : 0,
            background: "#000",
          }}
        />

        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: "-9999px", visibility: "hidden", pointerEvents: "none" }}
        />
        <canvas
          ref={flushCanvasRef}
          width={1} height={1}
          style={{ position: "absolute", top: 0, left: "-9999px", visibility: "hidden", pointerEvents: "none" }}
        />

        <div style={{ position: "absolute", inset: 0, borderRadius: 12, overflow: "hidden", pointerEvents: "none" }}>
          {!isActive && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.88)" }}
                 className="flex items-center justify-center">
              {isRequesting ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
                  <p className="text-xs font-mono text-muted-foreground">Opening camera…</p>
                </div>
              ) : (
                <Camera className="w-12 h-12 text-muted-foreground opacity-40" />
              )}
            </div>
          )}

          {isActive && (
            <div style={{ position: "absolute", inset: 0 }} className="flex flex-col items-center justify-center gap-2">
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,0.4)",
                maskImage: "radial-gradient(ellipse 68% 68% at 50% 50%, transparent 48%, black 68%)",
                WebkitMaskImage: "radial-gradient(ellipse 68% 68% at 50% 50%, transparent 48%, black 68%)",
              }} />
              <div style={{ position: "relative", width: 220, height: 220 }}>
                {[
                  { top: 0, left: 0,     borderTop: `4px solid ${frameGreen ? "#22c55e" : "hsl(var(--primary))"}`, borderLeft: `4px solid ${frameGreen ? "#22c55e" : "hsl(var(--primary))"}`, borderRadius: "4px 0 0 0" },
                  { top: 0, right: 0,    borderTop: `4px solid ${frameGreen ? "#22c55e" : "hsl(var(--primary))"}`, borderRight: `4px solid ${frameGreen ? "#22c55e" : "hsl(var(--primary))"}`, borderRadius: "0 4px 0 0" },
                  { bottom: 0, left: 0,  borderBottom: `4px solid ${frameGreen ? "#22c55e" : "hsl(var(--primary))"}`, borderLeft: `4px solid ${frameGreen ? "#22c55e" : "hsl(var(--primary))"}`, borderRadius: "0 0 0 4px" },
                  { bottom: 0, right: 0, borderBottom: `4px solid ${frameGreen ? "#22c55e" : "hsl(var(--primary))"}`, borderRight: `4px solid ${frameGreen ? "#22c55e" : "hsl(var(--primary))"}`, borderRadius: "0 0 4px 0" },
                ].map((s, i) => (
                  <div key={i} style={{ position: "absolute", width: 36, height: 36, transition: "border-color 0.2s", ...s }} />
                ))}
                <div className="animate-pulse" style={{ position: "absolute", left: 6, right: 6, top: "50%", height: 2, background: frameGreen ? "rgba(34,197,94,0.8)" : "hsl(var(--primary) / 0.8)", transition: "background 0.2s" }} />
              </div>
              <div style={{ padding: "4px 14px", borderRadius: 999, background: "rgba(0,0,0,0.7)" }}
                   className="text-xs font-mono text-white text-center">
                {hint === "closer" ? "📷 Move closer or improve lighting" :
                 hint === "steady" ? "🔍 Hold steady…" :
                                     "Align QR code inside the box"}
              </div>
            </div>
          )}
        </div>
      </div>

      {isActive && (
        <div className="flex gap-2">
          <button onClick={handleStop}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive font-display font-bold text-sm">
            ■ Stop
          </button>
          <button onClick={handleFlipCamera}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border/50 bg-card font-display font-bold text-sm"
            title="Flip camera">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {isActive && (
        <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/5 border border-primary/20">
          {disabled ? (
            <>
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="font-display font-bold text-primary text-sm">Processing…</p>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <p className="font-display font-bold text-primary text-sm">Scanning — point camera at QR code</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ManualFallback({ onScan }) {
  const [code, setCode] = useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    const val = code.trim().toUpperCase();
    if (!val) return;
    setCode("");
    onScan(val);
  };
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="Enter ticket code manually…"
        className="flex-1 rounded-md bg-card border border-border/50 px-3 py-2 text-sm font-mono"
      />
      <button type="submit" disabled={!code.trim()}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-display font-bold text-sm disabled:opacity-50">
        Submit
      </button>
    </form>
  );
}