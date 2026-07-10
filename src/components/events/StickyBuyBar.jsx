import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Ticket, Users } from "lucide-react";
import { formatPrice } from "@/utils/currency";

/**
 * Persistent fixed Buy Tickets / RSVP bar for the Event Detail page.
 *
 * Always pinned to the bottom of the viewport across mobile, tablet, and desktop.
 * Shows "From $X.XX" on the left and the action button on the right.
 *
 * Mobile/tablet: sits above the bottom nav, respecting iOS safe-area.
 * Desktop (lg+): sits at the very bottom of the viewport (no bottom nav).
 *
 * Sets a `--buy-bar-height` CSS variable on <body> while visible so other
 * floating UI (e.g. support chat button) can shift above it and avoid overlap.
 *
 * Ticket status rules:
 *  - Active tickets → "Buy Tickets" (or "Buy Tickets & Tables" if both exist)
 *  - Sold out → "Sold Out" (disabled)
 *  - Ticket sales closed (past event) → "Tickets Unavailable" (disabled)
 *  - RSVP-only event → "RSVP Now" (triggers RSVP scroll)
 *  - No ticket inventory & not RSVP → not rendered
 */
export default function StickyBuyBar({
  event,
  ticketTypes,
  tableTiers,
  eventIsPast,
  buyStarted,
  onBuyNow,
  onRsvp,
}) {
  const hasTickets = ticketTypes.length > 0;
  const hasTables = tableTiers.length > 0;
  const hasInventory = hasTickets || hasTables;
  const isRsvp = event?.event_type === "rsvp_only";
  const isSoldOut = event?.status === "sold_out";
  const salesClosed = eventIsPast;

  // Show the bar when:
  //  - Not in the expanded buy/RSVP flow (buyStarted)
  //  - Event has ticket inventory OR is an RSVP event
  //  - Sales are not closed (past event)
  const showBar = !buyStarted && !salesClosed && (hasInventory || isRsvp);

  // Expose the bar height to other floating elements via CSS var + body class
  useEffect(() => {
    if (!showBar) {
      document.body.style.removeProperty("--buy-bar-height");
      document.body.classList.remove("has-sticky-buy-bar");
      return;
    }
    // Bar: ~56px content (compact) + safe-area. Same on all breakpoints.
    const barHeight = "calc(56px + env(safe-area-inset-bottom, 0px))";
    document.body.style.setProperty("--buy-bar-height", barHeight);
    document.body.classList.add("has-sticky-buy-bar");
    return () => {
      document.body.style.removeProperty("--buy-bar-height");
      document.body.classList.remove("has-sticky-buy-bar");
    };
  }, [showBar]);

  if (!showBar) return null;

  // ── Determine label and action ──
  let label = "Buy Tickets";
  let disabled = false;
  let onClick = onBuyNow;

  if (isSoldOut) {
    label = "Sold Out";
    disabled = true;
  } else if (salesClosed) {
    label = "Tickets Unavailable";
    disabled = true;
  } else if (isRsvp) {
    label = "RSVP Now";
    onClick = onRsvp || onBuyNow;
  } else if (hasTickets && hasTables) {
    label = "Buy Tickets & Tables";
  } else if (hasTickets) {
    label = "Buy Tickets";
  } else if (hasTables) {
    label = "Reserve Table";
  }

  // Price display — shown on the left of the bar on all viewports
  const showPrice = !isRsvp && !isSoldOut && !salesClosed && hasTickets && event?.min_price > 0;
  const displayPrice = hasTickets
    ? Math.min(...ticketTypes.map((t) => t.price)).toFixed(2)
    : event?.min_price?.toFixed(2) || "0.00";

  // Portal to document.body so position:fixed pins to the viewport regardless
  // of ancestor CSS (e.g. PullToRefresh's will-change:transform, which creates a
  // containing block that would otherwise break fixed positioning).
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="sticky-buy-bar-fixed fixed left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/50"
      style={{
        // Flush directly on top of the bottom nav (56px content + 12px padding + safe-area = 68px).
        // Desktop override via .sticky-buy-bar-fixed in index.css (no bottom nav on lg+).
        bottom: "calc(68px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 px-4 sm:px-8 lg:px-12 py-2 sm:py-3">
        {showPrice ? (
          <div className="shrink-0">
            <p className="font-mono text-[10px] sm:text-xs text-muted-foreground leading-none">From</p>
            <p className="font-mono text-lg sm:text-xl font-bold text-primary leading-tight">
              {formatPrice(displayPrice, event?.currency)}
            </p>
          </div>
        ) : (
          <div className="shrink-0 flex items-center gap-1.5">
            {isRsvp ? <Users className="w-5 h-5 text-primary" /> : <Ticket className="w-5 h-5 text-primary" />}
          </div>
        )}
        <Button
          onClick={onClick}
          disabled={disabled}
          className="glow-lime font-display font-bold px-5 sm:px-10 h-10 sm:h-12 flex-1 sm:flex-none sm:min-w-[220px] touch-manipulation text-sm sm:text-base"
        >
          {label}
        </Button>
      </div>
    </div>,
    document.body
  );
}