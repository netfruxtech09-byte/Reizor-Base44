/**
 * PullToRefresh — smooth native-feeling pull-to-refresh for iOS/Android.
 *
 * Animation strategy:
 * - All gesture tracking via direct DOM refs + RAF — zero React renders during drag.
 * - Return-to-top uses the Web Animations API (WAAPI) so React re-renders cannot
 *   overwrite inline styles mid-animation. WAAPI runs on the compositor thread and
 *   is immune to React's style reconciliation.
 * - refreshingRef stays true until animation.finished resolves — blocks new gestures.
 * - Below-threshold snap-back also uses WAAPI for the same reason.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

const PULL_THRESHOLD = 72;    // px to trigger refresh
const MAX_PULL       = 110;   // px max stretch
const RESISTANCE     = 0.42;
const INDICATOR_SIZE = 44;    // px spinner circle diameter
const HOLD_Y         = INDICATOR_SIZE + 10; // px content held down during refresh

const SNAP_BACK_MS   = 280;   // ms — below-threshold release
const RETURN_MS      = 420;   // ms — post-refresh return

function getPageScrollTop() {
  return window.scrollY ?? document.documentElement.scrollTop ?? document.body.scrollTop ?? 0;
}

function isInsideNestedScroll(el) {
  let node = el;
  while (node && node !== document.body) {
    if (node !== el) {
      const style = window.getComputedStyle(node);
      const oy = style.overflowY;
      if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight && node.scrollTop > 0) return true;
    }
    node = node.parentElement;
  }
  return false;
}

function ReizorSpinner({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="hsl(var(--primary))"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: "ptr-spin 0.75s linear infinite", display: "block" }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default function PullToRefresh({ onRefresh, children, className = "" }) {
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef  = useRef(false);

  const contentRef   = useRef(null);
  const indicatorRef = useRef(null);

  const startYRef      = useRef(null);
  const currentPullRef = useRef(0);
  const isPullingRef   = useRef(false);
  const didHapticRef   = useRef(false);
  const rafRef         = useRef(null);

  const isMobile = useRef(typeof window !== "undefined" && "ontouchstart" in window);
  const prefersReduced = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  // ── Direct DOM update during drag — no transitions, no React state ────────
  const applyDrag = useCallback((pullPx) => {
    const content   = contentRef.current;
    const indicator = indicatorRef.current;
    if (!content || !indicator) return;

    const clamped  = Math.min(pullPx, MAX_PULL);
    const progress = Math.min(1, clamped / PULL_THRESHOLD);

    content.style.transform = `translateY(${clamped}px)`;

    const indicatorY = Math.max(-INDICATOR_SIZE - 8, (clamped * 0.55) - INDICATOR_SIZE - 8);
    indicator.style.transform = `translateY(${indicatorY}px) scale(${0.55 + progress * 0.45})`;
    indicator.style.opacity   = String(Math.min(1, progress * 1.2));
  }, []);

  // ── WAAPI animation helper ─────────────────────────────────────────────────
  // Returns a Promise that resolves when the animation finishes.
  // WAAPI is completely independent of React's style reconciliation.
  const waapiAnimate = useCallback((el, keyframes, duration, easing) => {
    if (!el) return Promise.resolve();
    const dur = prefersReduced.current ? 0 : duration;
    const anim = el.animate(keyframes, { duration: dur, easing, fill: "forwards" });
    return anim.finished;
  }, []);

  // ── Return to top after a successful refresh ───────────────────────────────
  const animateReturnAfterRefresh = useCallback(async () => {
    const content   = contentRef.current;
    const indicator = indicatorRef.current;
    if (!content) return;

    // Ensure we start from exactly HOLD_Y (cancel any lingering animation)
    content.getAnimations().forEach(a => a.cancel());

    // Native-feeling spring return: fast start, decelerates near top,
    // tiny -3px overshoot then settles — achieved via keyframes + custom easing.
    const springEasing = "cubic-bezier(0.16, 1, 0.3, 1)";
    const contentAnim = prefersReduced.current
      ? waapiAnimate(content, [{ transform: `translateY(${HOLD_Y}px)` }, { transform: "translateY(0px)" }], RETURN_MS, "ease-out")
      : content.animate(
          [
            { transform: `translateY(${HOLD_Y}px)`, offset: 0 },
            { transform: "translateY(-3px)",         offset: 0.82 },
            { transform: "translateY(0px)",          offset: 1 },
          ],
          { duration: RETURN_MS, easing: springEasing, fill: "forwards" }
        ).finished;

    const indicatorAnim = waapiAnimate(
      indicator,
      [{ opacity: "1" }, { opacity: "0" }],
      Math.round(RETURN_MS * 0.65),
      "ease-in"
    );

    await Promise.all([contentAnim, indicatorAnim]);

    // Animation fully complete — clean up and unlock
    content.getAnimations().forEach(a => a.cancel());
    content.style.transform = "";

    if (indicatorRef.current) {
      indicatorRef.current.getAnimations().forEach(a => a.cancel());
      indicatorRef.current.style.opacity   = "0";
      indicatorRef.current.style.transform = `translateY(-${INDICATOR_SIZE + 16}px) scale(0.6)`;
    }

    refreshingRef.current = false;
    setRefreshing(false);
  }, [waapiAnimate]);

  // ── Snap back when below threshold ────────────────────────────────────────
  const animateSnapBack = useCallback(async () => {
    const content   = contentRef.current;
    const indicator = indicatorRef.current;
    if (!content) return;

    content.getAnimations().forEach(a => a.cancel());

    await Promise.all([
      waapiAnimate(
        content,
        [
          { transform: `translateY(${currentPullRef.current}px)` },
          { transform: "translateY(0px)" },
        ],
        SNAP_BACK_MS,
        "cubic-bezier(0.16, 1, 0.3, 1)"
      ),
      waapiAnimate(
        indicator,
        [{ opacity: String(Math.min(1, (currentPullRef.current / PULL_THRESHOLD) * 1.2)) }, { opacity: "0" }],
        Math.round(SNAP_BACK_MS * 0.7),
        "ease-in"
      ),
    ]);

    content.getAnimations().forEach(a => a.cancel());
    content.style.transform = "";

    if (indicatorRef.current) {
      indicatorRef.current.getAnimations().forEach(a => a.cancel());
      indicatorRef.current.style.opacity   = "0";
      indicatorRef.current.style.transform = `translateY(-${INDICATOR_SIZE + 16}px) scale(0.6)`;
    }
  }, [waapiAnimate]);

  // ── Touch handlers ─────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e) => {
    if (!isMobile.current || refreshingRef.current) return;
    if (getPageScrollTop() > 2) return;
    if (isInsideNestedScroll(e.target)) return;

    startYRef.current      = e.touches[0].clientY;
    currentPullRef.current = 0;
    isPullingRef.current   = false;
    didHapticRef.current   = false;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!isMobile.current || refreshingRef.current || startYRef.current === null) return;
    if (getPageScrollTop() > 2) { startYRef.current = null; return; }

    const dy = e.touches[0].clientY - startYRef.current;
    if (dy <= 0) return;

    if (e.cancelable) e.preventDefault();

    isPullingRef.current   = true;
    const clamped          = Math.min(dy * RESISTANCE, MAX_PULL);
    currentPullRef.current = clamped;

    if (clamped >= PULL_THRESHOLD && !didHapticRef.current) {
      hapticLight();
      didHapticRef.current = true;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => applyDrag(currentPullRef.current));
  }, [applyDrag]);

  const onTouchEnd = useCallback(async () => {
    if (!isMobile.current || !isPullingRef.current) return;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    const pull             = currentPullRef.current;
    isPullingRef.current   = false;
    startYRef.current      = null;
    didHapticRef.current   = false;

    if (pull >= PULL_THRESHOLD) {
      hapticSuccess();
      refreshingRef.current = true;
      setRefreshing(true);

      // Move content to hold position immediately (WAAPI, instant)
      const content   = contentRef.current;
      const indicator = indicatorRef.current;
      if (content) {
        content.getAnimations().forEach(a => a.cancel());
        content.style.transform = `translateY(${HOLD_Y}px)`;
      }
      if (indicator) {
        indicator.getAnimations().forEach(a => a.cancel());
        indicator.style.transform = "translateY(0px) scale(1)";
        indicator.style.opacity   = "1";
      }

      currentPullRef.current = 0;

      try {
        await onRefresh?.();
      } catch {
        try {
          const { toast } = await import("sonner");
          toast.error("Unable to refresh. Please try again.");
        } catch {}
      } finally {
        // WAAPI return — immune to React re-renders, unlocks only on animation.finished
        await animateReturnAfterRefresh();
      }
    } else {
      // Store pull before clearing so snap-back can use the right start value
      await animateSnapBack();
      currentPullRef.current = 0;
    }
  }, [onRefresh, animateReturnAfterRefresh, animateSnapBack]);

  useEffect(() => {
    if (!isMobile.current) return;
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove",  onTouchMove,  { passive: false });
    window.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove",  onTouchMove);
      window.removeEventListener("touchend",   onTouchEnd);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  if (!isMobile.current) return <div className={className}>{children}</div>;

  return (
    <div className={`relative ${className}`} style={{ overflowAnchor: "none" }}>
      {/* Indicator */}
      <div
        ref={indicatorRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 right-0 z-50 flex items-center justify-center"
        style={{
          top: 0,
          transform: `translateY(-${INDICATOR_SIZE + 16}px) scale(0.55)`,
          opacity: 0,
          willChange: "transform, opacity",
        }}
      >
        <div
          style={{
            width: INDICATOR_SIZE,
            height: INDICATOR_SIZE,
            borderRadius: "50%",
            background: "hsl(var(--card))",
            border: "1.5px solid hsl(var(--border))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          }}
        >
          <ReizorSpinner size={22} />
        </div>
      </div>

      {/* Page content — no inline transform style here; WAAPI owns it during animation */}
      <div ref={contentRef} style={{ willChange: "transform" }}>
        {children}
      </div>

      <style>{`
        @keyframes ptr-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}