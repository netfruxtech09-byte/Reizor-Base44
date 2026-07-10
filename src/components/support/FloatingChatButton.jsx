import { useState, useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import SupportChatbot from "./SupportChatbot";

export default function FloatingChatButton() {
  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const timerRef = useRef(null);
  const savedScrollY = useRef(0);

  useEffect(() => {
    const check = () => setVideoPlaying(document.body.classList.contains("video-playing"));
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Show a nudge after 30 seconds if chat hasn't been opened
  useEffect(() => {
    timerRef.current = setTimeout(() => setNudge(true), 30000);
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleToggle = () => {
    setOpen(prev => !prev);
    setNudge(false);
    clearTimeout(timerRef.current);
  };

  // Lock body scroll when chat is open — preserve page position
  useEffect(() => {
    if (open) {
      savedScrollY.current = window.scrollY;
      // Prevent body-scroll without losing position visually
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY.current}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
    } else {
      // Restore scroll position
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, savedScrollY.current);
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
    };
  }, [open]);

  // Hide when a sheet/modal is open (comments, reviews, etc.)
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    const check = () => setSheetOpen(document.body.classList.contains("sheet-open"));
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    check();
    return () => observer.disconnect();
  }, []);

  // When a sticky buy bar is present (e.g. event detail page), stack above it too.
  const [buyBarHeight, setBuyBarHeight] = useState("0px");
  useEffect(() => {
    const check = () => setBuyBarHeight(document.body.classList.contains("has-sticky-buy-bar") ? "var(--buy-bar-height, 0px)" : "0px");
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
    check();
    return () => observer.disconnect();
  }, []);

  if (videoPlaying || sheetOpen) return null;

  // On mobile: above bottom nav (78px) + gap. On desktop: just above bottom of screen.
  const btnBottom = `calc(var(--bottom-nav-height, 78px) + ${buyBarHeight} + 16px)`;
  const chatBottom = `calc(var(--bottom-nav-height, 78px) + ${buyBarHeight} + 84px)`;

  return (
    <>
      {/* Chat window */}
      {open && (
        <div
          className="fixed z-50 right-4 w-[340px] max-w-[calc(100vw-2rem)]"
          style={{ bottom: chatBottom, height: "min(460px, 55dvh)" }}
        >
          <SupportChatbot onClose={() => setOpen(false)} />
        </div>
      )}

      {/* Nudge tooltip */}
      {nudge && !open && (
        <div
          className="fixed z-50 right-20 bg-card border border-border/60 rounded-xl px-3 py-2 shadow-xl text-xs font-mono text-muted-foreground whitespace-nowrap"
          style={{ bottom: `calc(${btnBottom} + 4px)` }}
        >
          Need help? 👋
          <button onClick={() => setNudge(false)} className="ml-2 text-muted-foreground/60 hover:text-foreground">✕</button>
          <div className="absolute right-[-6px] bottom-3 w-3 h-3 bg-card border-r border-b border-border/60 rotate-[-45deg]" />
        </div>
      )}

      {/* Floating toggle button — always visible */}
      <button
        onClick={handleToggle}
        className="fixed z-50 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        style={{ bottom: btnBottom, WebkitTapHighlightColor: "transparent" }}
        aria-label={open ? "Close support chat" : "Open support chat"}
      >
        <MessageCircle className="w-6 h-6 text-white" />
        {nudge && !open && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-destructive border-2 border-background" />
        )}
      </button>
    </>
  );
}