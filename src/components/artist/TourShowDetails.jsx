import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, MapPin, Ticket, ExternalLink, Info, CalendarPlus, Check, Link2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import TourShowTicketCTA from "./TourShowTicketCTA";
import TicketLinkButton from "@/components/shared/TicketLinkButton";
import TourShareButton from "./TourShareButton";

function pad(n) { return String(n).padStart(2, "0"); }

function googleCalUrl(show, address) {
  if (!show.date) return null;
  const start = new Date(show.date);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const fmt = (d) =>
    d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + "00Z";
  const loc = [show.venue_name, address].filter(Boolean).join(", ");
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", show.venue_name || "Tour Date");
  url.searchParams.set("dates", `${fmt(start)}/${fmt(end)}`);
  url.searchParams.set("location", loc);
  url.searchParams.set("details", show.notes || "");
  return url.toString();
}

function directionsUrl(show, address) {
  if (!address) return null;
  const parts = [show.venue_name, show.full_address, show.city, show.state, show.country].filter(Boolean);
  return `https://www.google.com/maps/search/${encodeURIComponent(parts.join(", "))}`;
}

const BUY_BTN =
  "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#ff007f] text-white text-sm font-display font-bold glow-lime hover:bg-[#ff007f]/90 transition-all active:scale-95 touch-manipulation";
const SECONDARY_BTN =
  "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#2c2c2c] border border-[#3a3a3a] text-white text-sm font-display font-bold hover:bg-[#3a3a3a] transition-all active:scale-95 touch-manipulation";
const SECONDARY_BTN_SM =
  "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2c2c2c] border border-[#3a3a3a] text-white text-xs font-display font-bold hover:bg-[#3a3a3a] transition-all active:scale-95 touch-manipulation";

const GRID_BUY =
  "flex items-center justify-center gap-1.5 w-full min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-display font-bold bg-[#ff007f] text-white glow-lime hover:bg-[#ff007f]/90 shadow-md shadow-[#ff007f]/30 transition-all active:scale-95 touch-manipulation";
const GRID_SECONDARY =
  "flex items-center justify-center gap-1.5 w-full min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-display font-bold bg-[#2c2c2c] border border-[#3a3a3a] text-white hover:bg-[#3a3a3a] transition-all active:scale-95 touch-manipulation";
const GRID_DIR =
  "flex items-center justify-center gap-1.5 w-full min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-display font-bold bg-[#2c2c2c] border border-[#3a3a3a] text-[#ff007f] hover:bg-[#3a3a3a] transition-all active:scale-95 touch-manipulation";
const GRID_DISABLED =
  "flex items-center justify-center gap-1.5 w-full min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-display font-bold border border-[#333333] bg-[#222222] text-[#666666] cursor-not-allowed";
const FOOTER_BTN =
  "flex items-center justify-center gap-1.5 w-full min-h-[44px] px-3 py-2.5 rounded-lg bg-[#2c2c2c] border border-[#3a3a3a] text-white text-xs font-display font-bold hover:bg-[#3a3a3a] transition-all active:scale-95 touch-manipulation";

const LABEL = "text-[10px] font-display text-[#a0a0a0] uppercase tracking-widest";

/**
 * TourShowDetails — shared content block for a tour schedule item.
 * variant="inline" → accordion expanded panel (banner, time/loc, quick actions,
 *   event details, lineup, tickets, share + full details footer)
 * variant="page"   → detail screen card (event type subtitle, time/loc, event
 *   details, premium 2x2 action grid, share footer)
 * Renders only fields that exist; no video.
 */
export default function TourShowDetails({ show, artistId, variant = "inline", showBanner = true }) {
  const isPage = variant === "page";
  const dateObj = show.date ? new Date(show.date) : null;
  const address = show.full_address || [show.city, show.state, show.country].filter(Boolean).join(", ");
  const hasPlatformCta = !!show.platform_event_id;
  const hasTicketLink = !!show.ticket_link;
  const hasSocial = !!show.social_link;
  const hasBanner = showBanner && !!show.promo_image;
  const dirUrl = directionsUrl(show, address);
  const calUrl = googleCalUrl(show, address);

  const [copied, setCopied] = useState(false);
  const detailUrl = `${window.location.origin}/artists/${artistId}/tour/${show.id}`;
  const copyLink = async (e) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(detailUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const renderBuy = (gridStyle) => {
    if (hasPlatformCta) {
      return (
        <TourShowTicketCTA
          show={show}
          variant={gridStyle ? "grid" : "button"}
          fallback={
            hasTicketLink ? (
              <TicketLinkButton href={show.ticket_link} className={gridStyle || BUY_BTN}>
                <Ticket className="w-4 h-4" /> Buy Tickets
              </TicketLinkButton>
            ) : (
              <div className={gridStyle || BUY_BTN}><Ticket className="w-4 h-4" /> Buy Tickets</div>
            )
          }
        />
      );
    }
    if (hasTicketLink) {
      return (
        <TicketLinkButton href={show.ticket_link} className={gridStyle || BUY_BTN}>
          <Ticket className="w-4 h-4" /> Buy Tickets
        </TicketLinkButton>
      );
    }
    return <div className={gridStyle || BUY_BTN}><Ticket className="w-4 h-4" /> Buy Tickets</div>;
  };

  return (
    <div className="rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#1a1a1c]">
      {hasBanner && (
        <div className="relative w-full aspect-video overflow-hidden">
          <img src={show.promo_image} alt={show.venue_name || "Tour date"} loading="lazy" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1c] via-[#1a1a1c]/20 to-transparent" />
        </div>
      )}

      <div className="p-4 sm:p-5 space-y-4">
        {/* Title block */}
        <div className="space-y-1">
          {dateObj && (
            <p className="text-[10px] font-display text-[#ff007f] font-bold uppercase tracking-widest">
              {format(dateObj, "EEE, MMM dd yyyy")}
            </p>
          )}
          <h3 className="font-display font-black text-xl sm:text-2xl leading-tight text-white">{show.venue_name}</h3>
          {isPage && show.lineup && <p className="text-sm text-[#a0a0a0]">Event Type : {show.lineup}</p>}
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {show.set_time && (
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-[#ff007f] shrink-0 mt-0.5" />
              <div>
                <p className={LABEL}>Time</p>
                <p className="text-sm font-bold text-white">{show.set_time}</p>
              </div>
            </div>
          )}
          {address && (
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#ff007f] shrink-0 mt-0.5" />
              <div>
                <p className={LABEL}>Location</p>
                <p className="text-sm break-words text-white">{address}</p>
              </div>
            </div>
          )}
        </div>

        {isPage ? (
          <>
            {/* Event details */}
            {show.notes && (
              <div>
                <p className={LABEL + " mb-1"}>Event Details</p>
                <p className="text-sm text-[#c0c0c0] leading-relaxed whitespace-pre-wrap">{show.notes}</p>
              </div>
            )}

            {/* Premium 2x2 action grid */}
            <div className="grid grid-cols-2 gap-3 border-t border-[#333333] pt-4">
              {renderBuy(GRID_BUY)}
              {hasSocial ? (
                <a href={show.social_link} target="_blank" rel="noopener noreferrer" className={GRID_SECONDARY}>
                  <Info className="w-4 h-4" /> More Info <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
              ) : (
                <div className={GRID_DISABLED}><Info className="w-4 h-4" /> More Info</div>
              )}
              {calUrl ? (
                <a href={calUrl} target="_blank" rel="noopener noreferrer" className={GRID_SECONDARY}>
                  <CalendarPlus className="w-4 h-4" /> Add to Google Cal
                </a>
              ) : (
                <div className={GRID_DISABLED}><CalendarPlus className="w-4 h-4" /> Add to Google Cal</div>
              )}
              {dirUrl ? (
                <a href={dirUrl} target="_blank" rel="noopener noreferrer" className={GRID_DIR}>
                  <MapPin className="w-4 h-4" /> Get Directions
                </a>
              ) : (
                <div className={GRID_DISABLED}><MapPin className="w-4 h-4" /> Get Directions</div>
              )}
            </div>

            {/* Footer: muted quick icons + Share */}
            <div className="flex items-center gap-3 border-t border-[#333333] pt-4">
              <a
                href={detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in new tab"
                className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-lg bg-[#2c2c2c] border border-[#3a3a3a] text-[#a0a0a0] hover:bg-[#3a3a3a] hover:text-white transition-all active:scale-95 touch-manipulation"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={copyLink}
                title="Copy link"
                className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-lg bg-[#2c2c2c] border border-[#3a3a3a] text-[#a0a0a0] hover:bg-[#3a3a3a] hover:text-white transition-all active:scale-95 touch-manipulation"
              >
                {copied ? <Check className="w-4 h-4 text-[#ff007f]" /> : <Link2 className="w-4 h-4" />}
              </button>
              <div className="flex-1">
                <TourShareButton show={show} artistId={artistId} />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Quick actions */}
            {(dirUrl || calUrl) && (
              <div className="flex flex-wrap items-center gap-3">
                {dirUrl && (
                  <a href={dirUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-display font-bold text-[#ff007f] hover:underline">
                    <MapPin className="w-4 h-4" /> Get Directions
                  </a>
                )}
                {calUrl && (
                  <a href={calUrl} target="_blank" rel="noopener noreferrer" className={SECONDARY_BTN_SM}>
                    <CalendarPlus className="w-4 h-4" /> Add to Google Cal
                  </a>
                )}
              </div>
            )}

            {/* Event details */}
            {show.notes && (
              <div>
                <p className={LABEL + " mb-1"}>Event Details</p>
                <p className="text-sm text-[#c0c0c0] leading-relaxed whitespace-pre-wrap">{show.notes}</p>
              </div>
            )}

            {/* Lineup */}
            {show.lineup && (
              <div>
                <p className={LABEL + " mb-1"}>Lineup</p>
                <p className="text-sm text-white">{show.lineup}</p>
              </div>
            )}

            {/* Tickets */}
            {(hasPlatformCta || hasTicketLink || hasSocial) && (
              <div className="space-y-2 border-t border-[#333333] pt-4">
                <p className={LABEL}>Tickets</p>
                <div className="flex flex-wrap gap-2">
                  {renderBuy()}
                  {hasSocial && (
                    <a href={show.social_link} target="_blank" rel="noopener noreferrer" className={SECONDARY_BTN}>
                      <Info className="w-4 h-4" /> More Info <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Footer: Share + Full Details */}
            <div className="flex gap-3 border-t border-[#333333] pt-4">
              <div className="flex-1"><TourShareButton show={show} artistId={artistId} /></div>
              <Link to={`/artists/${artistId}/tour/${show.id}`} className={`flex-1 ${FOOTER_BTN}`}>
                Full Details <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}