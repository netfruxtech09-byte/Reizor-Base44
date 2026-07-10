import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { APP_BASE_URL } from "@/lib/appUrl";

const APP_HOST = (() => {
  try { return new URL(APP_BASE_URL).hostname; } catch { return "reizor.com"; }
})();

/**
 * TicketLinkButton — keeps ticket CTAs inside the mobile app.
 *
 * - If `href` points to an internal Reizor event route (/events/:id or same-origin URL),
 *   renders an in-app <Link> so navigation stays inside the app and Back works.
 * - If `href` is external, shows a confirmation dialog before opening the system browser.
 * - If `href` is missing/invalid, renders nothing.
 */
function resolveInternalEventPath(href) {
  if (!href || typeof href !== "string") return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const m = url.pathname.match(/^\/events\/([a-zA-Z0-9_-]+)/);
      if (!m) return null;
      // Internal if the link host is the app's canonical domain (or a subdomain of it),
      // or matches the current runtime host (covers white-label / other deployments).
      // This must NOT rely on window.location.origin, which differs inside the native
      // mobile app shell — otherwise internal event links get misclassified as external.
      const host = url.hostname;
      const isAppHost =
        host === window.location.hostname ||
        host === APP_HOST ||
        host.endsWith(`.${APP_HOST}`);
      return isAppHost ? `/events/${m[1]}` : null;
    }
    if (trimmed.startsWith("/")) {
      const m = trimmed.match(/^\/events\/([a-zA-Z0-9_-]+)/);
      return m ? `/events/${m[1]}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export default function TicketLinkButton({
  href,
  className = "",
  children,
  confirmTitle = "Leaving the app",
  confirmMessage = "This ticket link opens outside Reizor in your browser. Do you want to continue?",
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const internal = resolveInternalEventPath(href);

  if (!href) return null;

  const handleConfirm = () => {
    setConfirmOpen(false);
    try {
      window.open(href, "_blank", "noopener,noreferrer");
    } catch {
      /* ignore */
    }
  };

  if (internal) {
    return (
      <Link to={internal} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setConfirmOpen(true)} className={className}>
        {children}
        <ExternalLink className="w-3 h-3" />
      </button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay in app</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Open in browser</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}