import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { isDirectVideoUrl } from "./EventMediaUploader";
import { Button } from "@/components/ui/button";

/**
 * Full-screen fixed media viewer for event images/videos.
 * - Locks background page scroll while open.
 * - Selected media centered in the main area.
 * - Prev/next arrows + swipe + keyboard navigation + counter.
 * - Optional sticky ticket/Buy Now bar below the media (stays put while navigating).
 * - Rendered via portal at document.body so it sits above all page chrome (header, chatbot, bottom nav).
 *
 * Props:
 *   items      string[]  — image/video URLs
 *   startIndex number    — initial index
 *   onClose    function  — called when the viewer should close
 *   onBuyNow   function? — called when the Buy Now button is tapped (viewer closes first)
 *   buyLabel   string?   — label for the Buy Now button
 *   showBuy    boolean?  — whether to show the ticket bar
 */
export default function EventMediaLightbox({ items, startIndex = 0, onClose, onBuyNow, buyLabel, showBuy }) {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  // Lock background scroll (iOS-safe: position:fixed on body + restore on unmount)
  useEffect(() => {
    const scrollY = window.scrollY;
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setIndex(i => (i - 1 + items.length) % items.length);
      else if (e.key === "ArrowRight") setIndex(i => (i + 1) % items.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose]);

  const goPrev = useCallback(() => setIndex(i => (i - 1 + items.length) % items.length), [items.length]);
  const goNext = useCallback(() => setIndex(i => (i + 1) % items.length), [items.length]);

  // Swipe navigation (horizontal only)
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext(); else goPrev();
    }
  };

  const current = items[index];
  const isVideo = isDirectVideoUrl(current);

  const handleBuy = () => {
    onClose();
    if (onBuyNow) onBuyNow();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black flex flex-col" style={{ touchAction: "manipulation" }}>
      {/* Top bar: close + counter */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top, 0px))" }}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}
          aria-label="Close media viewer"
        >
          <X className="w-5 h-5" />
        </button>
        {items.length > 1 && (
          <span className="text-white/70 text-xs font-mono">{index + 1} / {items.length}</span>
        )}
      </div>

      {/* Main media area — centered, no overflow */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center relative overflow-hidden px-2"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {items.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white touch-manipulation z-10"
              style={{ WebkitTapHighlightColor: "transparent" }}
              aria-label="Previous"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white touch-manipulation z-10"
              style={{ WebkitTapHighlightColor: "transparent" }}
              aria-label="Next"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {isVideo ? (
          <video
            src={current}
            controls
            playsInline
            autoPlay
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        ) : (
          <img
            src={current}
            alt={`Event media ${index + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        )}
      </div>

      {/* Sticky ticket / Buy Now bar — stays visible while navigating media */}
      {showBuy && (
        <div
          className="shrink-0 px-4 py-3 bg-background/95 backdrop-blur-xl border-t border-border/50"
          style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
        >
          <Button onClick={handleBuy} className="w-full glow-lime font-display font-bold h-12 text-base touch-manipulation">
            🎟️ {buyLabel || "Buy Now"}
          </Button>
        </div>
      )}
    </div>,
    document.body
  );
}