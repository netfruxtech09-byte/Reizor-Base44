import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Disable browser's native scroll restoration so we always control scroll position
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

export default function ScrollToTop() {
  const { pathname, key } = useLocation();

  useEffect(() => {
    // Use rAF to ensure this runs AFTER the browser's own scroll restoration
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      // Double-ensure on next frame for browsers that restore scroll asynchronously
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    });
  }, [pathname, key]);

  return null;
}