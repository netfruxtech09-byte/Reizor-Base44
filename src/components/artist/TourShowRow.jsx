import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MapPin, Ticket } from "lucide-react";
import { format } from "date-fns";
import TourShowTicketCTA from "./TourShowTicketCTA";
import TicketLinkButton from "@/components/shared/TicketLinkButton";
import TourShowDetails from "./TourShowDetails";

const BUY_PILL =
  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ff007f] text-white text-xs font-display font-bold glow-lime hover:bg-[#ff007f]/90 transition-all active:scale-95 touch-manipulation";

/**
 * TourShowRow — horizontal tour schedule row with click-to-expand accordion.
 * Collapsed: Date | venue + lineup + address | Buy button | chevron, with the
 * promo image faded behind the right side. Expanded: TourShowDetails panel.
 */
export default function TourShowRow({ show, artistId, expanded, onToggle, past }) {
  const dateObj = show.date ? new Date(show.date) : null;
  const day = dateObj ? format(dateObj, "d") : "—";
  const mon = dateObj ? format(dateObj, "MMM").toUpperCase() : "—";
  const address =
    show.full_address ||
    [show.city, show.state, show.country].filter(Boolean).join(", ");
  const hasPlatformCta = !!show.platform_event_id;
  const hasTicketLink = !!show.ticket_link;
  const canBuy = hasPlatformCta || hasTicketLink;
  const hasBg = !!show.promo_image;

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors ${
        past
          ? "border-[#2a2a2a] opacity-60"
          : expanded
          ? "border-[#ff007f]/50"
          : "border-[#2a2a2a] hover:border-[#ff007f]/40"
      }`}
    >
      {/* Collapsed row — clickable */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="relative w-full flex items-center bg-[#1a1a1c] overflow-hidden cursor-pointer touch-manipulation"
        aria-expanded={expanded}
      >
        {/* Faded promo image behind the right side */}
        {hasBg && (
          <div className="absolute inset-y-0 right-0 w-2/5 sm:w-1/3 pointer-events-none overflow-hidden">
            <img src={show.promo_image} alt="" aria-hidden="true" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1c] via-[#1a1a1c]/80 to-[#1a1a1c]/30" />
          </div>
        )}

        {/* Foreground content */}
        <div className="relative z-10 w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
          {/* Date */}
          <div className="shrink-0 flex flex-col items-center justify-center min-w-[48px] sm:min-w-[60px] pr-3 sm:pr-4 border-r border-[#333333]">
            <span className="font-display font-black text-xl sm:text-2xl leading-none text-white">{day}</span>
            <span className="font-display text-[10px] sm:text-xs text-[#ff007f] font-bold uppercase tracking-wider mt-1">{mon}</span>
          </div>

          {/* Center info */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <p className="font-display font-bold text-sm sm:text-base leading-tight truncate text-white">{show.venue_name}</p>
            {show.lineup && <p className="text-xs text-[#a0a0a0] truncate">{show.lineup}</p>}
            {address && (
              <p className="flex items-center gap-1 text-[11px] sm:text-xs text-[#a0a0a0] font-display truncate">
                <MapPin className="w-3 h-3 shrink-0 text-[#ff007f]/70" />
                <span className="truncate">{address}</span>
              </p>
            )}
          </div>

          {/* Right: Buy (if any) + chevron */}
          <div className="shrink-0 flex items-center gap-2 sm:gap-3">
            {canBuy && (
              <div onClick={(e) => e.stopPropagation()} className="touch-manipulation">
                {hasPlatformCta ? (
                  <TourShowTicketCTA show={show} variant="pill" />
                ) : (
                  <TicketLinkButton href={show.ticket_link} className={BUY_PILL}>
                    <Ticket className="w-3.5 h-3.5" /> Buy
                  </TicketLinkButton>
                )}
              </div>
            )}
            <ChevronDown
              className={`w-5 h-5 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180 text-[#ff007f]" : "text-[#a0a0a0]"}`}
            />
          </div>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-3 sm:p-4 pt-1">
              <TourShowDetails show={show} artistId={artistId} variant="inline" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}