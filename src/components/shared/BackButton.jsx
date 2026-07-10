import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useEffect, useRef } from "react";

/**
 * Reusable back button with a large mobile tap target.
 * Priority:
 *   1. location.state.from  — route passed when navigating to this page
 *   2. navigate(-1)         — browser history
 *   3. `to` prop            — explicit fallback provided by the page
 *   4. role-based fallback  — /organizer, /artist, /admin, or /
 */
export default function BackButton({ to, label = "Back", className = "" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fallbackRef = useRef(to || "/");

  useEffect(() => {
    // Determine role-based fallback asynchronously — don't block render
    base44.auth.me().then((u) => {
      if (!u) { fallbackRef.current = to || "/"; return; }
      if (u.role === "admin") fallbackRef.current = to || "/admin";
      else if (u.role === "organizer") fallbackRef.current = to || "/organizer";
      else if (u.is_artist || u.role === "artist") fallbackRef.current = to || "/artist";
      else fallbackRef.current = to || "/";
    }).catch(() => {});
  }, [to]);

  const handleClick = () => {
    const from = location.state?.from;
    // Avoid navigation loop: don't go back to the same page
    if (from && from !== location.pathname) {
      navigate(from);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackRef.current);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors
        py-3 pr-4 pl-1 -ml-1 rounded-lg active:bg-muted/50 touch-manipulation select-none ${className}`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <ArrowLeft className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}