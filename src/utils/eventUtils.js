/**
 * Returns true if the event has already ended (i.e. is in the past).
 * - If end_date is set, use it directly.
 * - If only start date is set, assume the event ends at end of that calendar day (23:59:59).
 * - If neither date is available, defaults to NOT past (show it).
 */
export function isEventPast(event) {
  if (!event) return false;
  const now = new Date();
  if (event.end_date) {
    return new Date(event.end_date) < now;
  }
  if (event.date) {
    // Treat the event as ending at the end of its start day
    const endOfDay = new Date(event.date);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay < now;
  }
  return false;
}

/**
 * Filters an array of events to only upcoming/current events.
 */
export function filterUpcomingEvents(events) {
  return (events || []).filter(e => !isEventPast(e));
}

/**
 * Returns the effective display status for an event.
 * If the event is "published" but the date has already passed, returns "past" instead.
 * Use this for all UI status badges and labels.
 */
export function getDisplayStatus(event) {
  if (!event) return "draft";
  if (
    (event.status === "published" || event.status === "sold_out") &&
    isEventPast(event)
  ) {
    return "past";
  }
  return event.status;
}

/**
 * Returns true if an event is considered "actively published".
 * Criteria:
 * - status = "published" or "sold_out"
 * - NOT deactivated
 * - NOT past its end date
 * Use this for counting and filtering published events everywhere.
 */
export function isActivePublishedEvent(event) {
  if (!event) return false;
  const isPublished = event.status === "published" || event.status === "sold_out";
  const isDeactivated = event.deactivated === true;
  const isPast = isEventPast(event);
  return isPublished && !isDeactivated && !isPast;
}

/**
 * Filter ticket types to those visible to the public on the event detail page.
 * Keeps "active" and "sold_out" tiers (sold-out still shows its status badge).
 * Excludes hidden tiers, paused/ended tiers, and tiers outside their sale window.
 */
export function getPublicTicketTypes(ticketTypes) {
  const now = new Date();
  return (ticketTypes || []).filter((tt) => {
    if (tt.tier === "hidden") return false;
    if (tt.status === "paused" || tt.status === "ended") return false;
    if (tt.sale_start && new Date(tt.sale_start) > now) return false;
    if (tt.sale_end && new Date(tt.sale_end) < now) return false;
    return true;
  });
}

/**
 * Config map for display status → label + CSS classes.
 */
export const DISPLAY_STATUS_CONFIG = {
  published:  { label: "Active",      cls: "text-green-400 bg-green-400/10 border-green-400/20" },
  past:       { label: "Past Event",  cls: "text-muted-foreground bg-muted/60 border-border/50" },
  draft:      { label: "Draft",       cls: "text-muted-foreground bg-muted border-border/50" },
  pending:    { label: "Pending",     cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  cancelled:  { label: "Cancelled",  cls: "text-destructive bg-destructive/10 border-destructive/20" },
  completed:  { label: "Completed",  cls: "text-accent bg-accent/10 border-accent/20" },
  sold_out:   { label: "Sold Out",   cls: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
};