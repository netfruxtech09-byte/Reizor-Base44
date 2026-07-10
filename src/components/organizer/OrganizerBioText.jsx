import { useState, useLayoutEffect, useRef } from "react";

// Public-facing organizer description — collapsed to exactly 3 visible lines by
// default (CSS line-clamp) with a "Read More" / "Show Less" toggle that appears
// only when the full text overflows those 3 lines. Works on mobile and desktop.
export default function OrganizerBioText({ bio, className = "" }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const measureRef = useRef(null);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    // Only measure overflow while collapsed — once expanded, line-clamp is
    // removed and scrollHeight === clientHeight, which would falsely clear
    // the flag and hide the "Show Less" button. Persist the collapsed result.
    if (expanded) return;
    setOverflows(el.scrollHeight - el.clientHeight > 2);
  }, [bio, expanded]);

  if (!bio?.trim()) return null;

  const trimmed = bio.trim();

  return (
    <div className={className}>
      <p
        ref={measureRef}
        className={`text-sm text-muted-foreground leading-relaxed max-w-prose whitespace-pre-wrap break-words ${
          expanded ? "" : "line-clamp-3 overflow-hidden"
        }`}
      >
        {trimmed}
      </p>
      {overflows && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-mono font-bold text-primary hover:text-primary/80 transition-colors touch-manipulation"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}