import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * Standardized "SEE ALL" link button for every home-page section header.
 * Single source of truth for text, casing, font, size, border, alignment,
 * and icon placement across mobile and desktop.
 */
export default function SeeAllButton({ to }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-3 py-2 rounded-md border-2 border-primary/60 hover:border-primary hover:bg-primary/10 transition-all whitespace-nowrap font-mono text-xs font-bold text-primary mt-1 shrink-0 touch-manipulation"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      SEE ALL <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  );
}