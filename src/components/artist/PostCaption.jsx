import { useState, useEffect, useRef } from "react";

/**
 * Truncates long post caption text to a few lines with a "Read more" toggle.
 * Only shows the toggle when the text actually overflows the clamp.
 */
export default function PostCaption({ text, className = "" }) {
  const [expanded, setExpanded] = useState(false);
  const [clampable, setClampable] = useState(false);
  const ref = useRef(null);

  // With line-clamp, scrollHeight = full unclamped content height and
  // clientHeight = clamped visible height, so overflow is detectable.
  useEffect(() => {
    if (expanded) return; // only measure in collapsed state
    const el = ref.current;
    if (!el) return;
    const check = () => {
      if (el.scrollHeight > el.clientHeight + 1) setClampable(true);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  if (!text) return null;

  return (
    <div className={`px-4 pb-3 ${className}`}>
      <p
        ref={ref}
        className={`text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words ${
          expanded ? "line-clamp-none" : "line-clamp-4"
        }`}
      >
        {text}
      </p>
      {clampable && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-1 text-xs font-bold text-primary hover:underline touch-manipulation"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}