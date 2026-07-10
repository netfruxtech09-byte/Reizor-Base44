import { useState, useRef, useLayoutEffect } from "react";

// Truncates long text to 3 lines with a Read More / Read Less toggle.
// Uses CSS line-clamp for clean line-boundary truncation (no half-cut lines).
// Toggle only appears when the text actually overflows 3 lines.
// Expand/collapse is local UI state only — no API calls.
export default function ReadMoreText({ text, lineClassName }) {
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const contentRef = useRef(null);

  useLayoutEffect(() => {
    if (contentRef.current && !expanded) {
      // Only measure while collapsed — once expanded, line-clamp is removed
      // and scrollHeight === clientHeight, which would falsely clear the flag.
      setNeedsToggle(contentRef.current.scrollHeight - contentRef.current.clientHeight > 2);
    }
  }, [text, expanded]);

  return (
    <div>
      <p
        ref={contentRef}
        className={`${lineClassName || "text-muted-foreground whitespace-pre-wrap text-[13px] sm:text-sm leading-[1.6]"} ${
          expanded ? "" : "line-clamp-3 overflow-hidden"
        }`}
      >
        {text}
      </p>
      {needsToggle && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-mono font-bold text-primary hover:text-primary/80 transition-colors touch-manipulation"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}