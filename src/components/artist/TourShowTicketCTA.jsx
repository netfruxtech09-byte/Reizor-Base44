import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Ticket, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { isEventPast } from "@/utils/eventUtils";

/**
 * TourShowTicketCTA — Buy Tickets / RSVP CTA for a tour schedule entry.
 *
 * Resolves the linked platform Event (show.platform_event_id), evaluates its
 * status, event type, and ticket/table inventory, and renders the correct
 * Reizor CTA linking to the existing event detail / checkout flow.
 *
 * Label rules (mirror the Event Detail buy bar):
 *   - sold out           → "Sold Out" (disabled)
 *   - sales closed/past  → "Tickets Unavailable" (disabled)
 *   - RSVP-only          → "RSVP Now"
 *   - tickets + tables   → "Buy Tickets & Tables"
 *   - tickets only       → "Buy Tickets"
 *   - tables only        → "Reserve Table"
 *
 * Props:
 *   - variant: "pill" (default, compact) | "button" (larger) | "grid" (full-width cell)
 *   - className: merged into the rendered Link
 *   - fallback: element to render when no CTA applies (e.g. event not sellable),
 *     so parent grids keep a stable layout instead of an empty cell.
 *
 * External tour dates (no platform_event_id) render `fallback` (or null) — only the
 * card's existing Details / Share / external links remain.
 */
export default function TourShowTicketCTA({ show, variant = "pill", className = "", fallback = null }) {
  const eventId = show?.platform_event_id;
  const [event, setEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      base44.entities.Event.filter({ id: eventId }, null, 1).catch(() => []),
      base44.entities.TicketType.filter({ event_id: eventId }, "sort_order", 50).catch(() => []),
      base44.entities.Table.filter({ event_id: eventId }, "sort_order", 50).catch(() => []),
    ]).then(([events, tts, tbls]) => {
      if (cancelled) return;
      setEvent(events[0] || null);
      setTicketTypes(tts);
      setTables(tbls);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [eventId]);

  if (!eventId) return fallback || null;
  if (loading) return null;
  if (!event) return fallback || null;

  // Only actively published events sell tickets through Reizor
  const isPublished = event.status === "published" || event.status === "sold_out";
  if (!isPublished) return fallback || null;

  const hasTickets = ticketTypes.length > 0;
  const hasTables = tables.length > 0;
  const isRsvp = event.event_type === "rsvp_only";
  const isSoldOut = event.status === "sold_out";
  const salesClosed = isEventPast(event);

  // Nothing to sell and not RSVP → fallback (clear disabled state for the parent grid)
  if (!hasTickets && !hasTables && !isRsvp) return fallback || null;

  let label = "Buy Tickets";
  let disabled = false;
  if (salesClosed) { label = "Tickets Unavailable"; disabled = true; }
  else if (isSoldOut) { label = "Sold Out"; disabled = true; }
  else if (isRsvp) { label = "RSVP Now"; }
  else if (hasTickets && hasTables) { label = "Buy Tickets & Tables"; }
  else if (hasTickets) { label = "Buy Tickets"; }
  else if (hasTables) { label = "Reserve Table"; }

  const Icon = isRsvp ? Users : Ticket;
  const to = `/events/${event.id}`;

  const base = "flex items-center justify-center gap-1.5 font-mono font-bold transition-all active:scale-95 touch-manipulation";
  const sizes = variant === "button"
    ? "px-4 py-2 rounded-lg text-sm"
    : variant === "grid"
    ? "w-full min-h-[42px] px-3 py-2.5 rounded-lg text-xs"
    : "px-3 py-1.5 rounded-lg text-xs";
  const colors = disabled
    ? "border border-[#333333] bg-[#222222] text-[#666666] cursor-not-allowed pointer-events-none"
    : "bg-[#ff007f] text-white glow-lime hover:bg-[#ff007f]/90 shadow-md shadow-[#ff007f]/30";
  const iconSize = variant === "button" || variant === "grid" ? "w-4 h-4" : "w-3.5 h-3.5";

  return (
    <Link to={to} className={`${base} ${sizes} ${colors} ${className}`} aria-disabled={disabled}>
      <Icon className={iconSize} />
      {label}
    </Link>
  );
}