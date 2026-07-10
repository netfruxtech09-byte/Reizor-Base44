import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Calendar, MapPin, Clock, ShieldCheck, ArrowLeft, Share2, ExternalLink, ChevronRight } from "lucide-react";
import { isEventPast, getPublicTicketTypes } from "@/utils/eventUtils";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { TABLE_PLATFORM_FEE } from "@/utils/ticketFeeCalculator";
import { formatPrice } from "@/utils/currency";
import { motion } from "framer-motion";
import PageMeta from "@/components/seo/PageMeta";
import StructuredData from "@/components/seo/StructuredData";
import PullToRefresh from "@/components/shared/PullToRefresh";
import EventCoverPlaceholder from "../components/events/EventCoverPlaceholder";
import TicketSelector from "../components/events/TicketSelector";
import EventReviews from "../components/events/EventReviews";
import WaitlistButton from "../components/events/WaitlistButton";
import SaveEventButton from "../components/events/SaveEventButton";
import LikeEventButton from "../components/events/LikeEventButton";
import RsvpButton from "../components/events/RsvpButton";
import RaffleHighlight from "../components/events/RaffleHighlight";
import GiveawayHighlight from "../components/events/GiveawayHighlight";
import EventRafflePublic from "../components/events/EventRafflePublic";
import EventGiveawayPublic from "../components/events/EventGiveawayPublic";
import RaffleHighlightCell from "../components/events/RaffleHighlightCell";
import PollManager from "../components/organizer/PollManager";
import AddToCalendarButton from "../components/events/AddToCalendarButton";
import SeatingMap from "../components/events/SeatingMap";
import LineupArtistLink from "../components/events/LineupArtistLink";
import MapDirectionLink from "../components/shared/MapDirectionLink";
import EventMediaGallery from "../components/events/EventMediaGallery";
import ReadMoreText from "../components/events/ReadMoreText";
import StickyBuyBar from "../components/events/StickyBuyBar";
import EventDetailShimmer from "../components/events/EventDetailShimmer";
import { useAuthGate } from "../hooks/useAuthGate";
import { toast } from "sonner";
import { safeShare } from "@/lib/mobileShare";

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { requireAuth } = useAuthGate();
  const [event, setEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [tableTiers, setTableTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableCredit, setAvailableCredit] = useState(null);
  const [useCredit, setUseCredit] = useState(false);
  const [loyaltyAccount, setLoyaltyAccount] = useState(null);
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [feeSettings, setFeeSettings] = useState(null);
  const [organizerLoyaltyTiers, setOrganizerLoyaltyTiers] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [sellerLink, setSellerLink] = useState(null); // active SellerLink record
  const [organizerBusinessName, setOrganizerBusinessName] = useState("");
  // Buy Now flow: false = not started, true = show unified list
  const [buyStarted, setBuyStarted] = useState(false);
  const ticketSectionRef = useRef(null);
  const sessionId = useRef(`s-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const referralCode = new URLSearchParams(window.location.search).get("ref") || null;
  const sellerCode = new URLSearchParams(window.location.search).get("seller") || sessionStorage.getItem("seller_code") || null;
  const tracked = useRef(new Set());
  const loadedRef = useRef(null); // Prevent duplicate loads (React strict mode double-invoke)

  const trackStage = useCallback(async (stage, eventId, eventTitle) => {
    if (tracked.current.has(stage)) return;
    tracked.current.add(stage);
    const user = await base44.auth.me().catch(() => null);
    base44.entities.EventView.create({
      event_id: eventId,
      event_title: eventTitle,
      stage,
      session_id: sessionId.current,
      user_email: user?.email || "",
    });
  }, []);

  useEffect(() => {
    // Prevent duplicate loads from React strict mode double-invoke or re-renders
    if (loadedRef.current === id) return;
    loadedRef.current = id;

    const load = async () => {
      const _stagger = (ms) => new Promise(r => setTimeout(r, ms));

      try {
        // Batch 1: core event data — fetch event first (critical path)
        const events = await base44.entities.Event.filter({ id }, null, 1).catch(() => []);
        const ev = events[0] || null;

        if (ev) {
          trackStage("view", ev.id, ev.title);
          setEvent(ev);
        }
        
        // Fetch ticket types and tables in parallel
        await _stagger(500);
        const [tts, tables] = await Promise.all([
          base44.entities.TicketType.filter({ event_id: id }, "sort_order", 50).catch(() => []),
          base44.entities.Table.filter({ event_id: id }, "sort_order", 50).catch(() => []),
        ]);
        setTicketTypes(getPublicTicketTypes(tts));
        setTableTiers(tables);
        setLoading(false);

        // Resolve seller link (non-critical, fire-and-forget)
        if (ev) {
          const codeToCheck = new URLSearchParams(window.location.search).get("seller") || sessionStorage.getItem("seller_code");
          if (codeToCheck) {
            base44.entities.SellerLink.filter({ event_id: ev.id, tracking_code: codeToCheck }, null, 1)
              .then(slResults => {
                if (slResults[0]) {
                  const sl = slResults[0];
                  const now = new Date();
                  const expired = sl.expiry_date && new Date(sl.expiry_date) < now;
                  const notStarted = sl.start_date && new Date(sl.start_date) > now;
                  if (sl.status === 'active' && !expired && !notStarted) {
                    setSellerLink(sl);
                    sessionStorage.setItem("seller_code", codeToCheck);
                    sessionStorage.setItem("seller_link_id", sl.id);
                  }
                }
              })
              .catch(() => {});
          }
        }

        // Batch 2: user-dependent data (non-blocking, after page shown)
        if (!ev?.organizer_id) return;

        // Resolve the organizer's public Business Name (authoritative over event.organizer_name)
        base44.entities.OrganizerProfile.filter({ organizer_id: ev.organizer_id }, null, 1)
          .then(res => { if (res[0]?.business_name) setOrganizerBusinessName(res[0].business_name); })
          .catch(() => {});

        await _stagger(600);
        const user = await base44.auth.me().catch(() => null);

        if (!user) return;

        // Fetch all user-dependent data in parallel instead of sequential
        await _stagger(600);
        const [fees, credits, loyAccs, orgTiers] = await Promise.all([
          base44.entities.OrganizerFeeSettings.filter({ organizer_id: ev.organizer_id }, null, 1).catch(() => []),
          base44.entities.OrganizerCredit.filter({ user_email: user.email, organizer_id: ev.organizer_id }, "-created_date", 10).catch(() => []),
          base44.entities.LoyaltyAccount.filter({ user_email: user.email }, null, 1).catch(() => []),
          base44.entities.OrganizerLoyaltyTier.filter({ organizer_id: ev.organizer_id }, "tier_number", 10).catch(() => []),
        ]);

        if (fees.length > 0) setFeeSettings(fees[0]);
        if (credits.length > 0) {
          const total = credits.reduce((s, c) => s + (c.amount || 0), 0);
          setAvailableCredit({ ids: credits.map((c) => c.id), amount: total });
        }
        if (loyAccs.length > 0 && loyAccs[0].cashback_balance >= 1) {
          setLoyaltyAccount(loyAccs[0]);
        }
        if (orgTiers.length > 0) {
          setOrganizerLoyaltyTiers(orgTiers.filter(t => t.tier_name?.trim()));
        }
      } catch (err) {
        console.error("EventDetail load error:", err);
        setLoading(false);
      }
    };

    load();
  // trackStage is stable (useCallback with []) — intentionally excluded from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [tableRedirecting, setTableRedirecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Table checkout — route through the same /checkout page as ticket purchase
  const handleTableOnlyCheckout = async () => {
    const authed = await requireAuth("Please sign in to reserve a table.");
    if (!authed) return;
    if (!selectedTableId) return;
    setTableRedirecting(true);

    const activeSellerId2 = sessionStorage.getItem("seller_link_id");
    const sellerLinkIdToUse = sellerLink?.id || activeSellerId2 || null;

    // Store table selection in sessionStorage and navigate to checkout page
    sessionStorage.setItem("pending_table_checkout", JSON.stringify({
      tableId: selectedTableId,
      eventId: event.id,
      sellerLinkId: sellerLinkIdToUse,
      currency: event.currency,
    }));
    sessionStorage.removeItem("pending_checkout");

    navigate(`/checkout/${event.id}`);
    setTableRedirecting(false);
  };

  // Redirect to dedicated Stripe checkout page — pass items via sessionStorage for multi-type support
  const handleCheckout = async (checkoutData) => {
    const authed = await requireAuth("Please sign in to purchase tickets.");
    if (!authed) return;
    if (!checkoutData.items?.length) return;

    const creditToApply = (useCredit && availableCredit) ? availableCredit.amount : (useLoyalty && loyaltyAccount) ? loyaltyAccount.cashback_balance : 0;
    const activeSellerId = sessionStorage.getItem("seller_link_id");
    const sellerCodeToUse = sellerCode || (sellerLink?.tracking_code) || activeSellerId || "";

    // Store full checkout data in sessionStorage for the Checkout page
    // CRITICAL: Pass ALL precomputed values so Checkout uses the SAME prices (single source of truth)
    sessionStorage.setItem("pending_checkout", JSON.stringify({
      items: checkoutData.items,
      subtotal: checkoutData.subtotal,
      serviceFee: checkoutData.serviceFee,
      cardFee: checkoutData.cardFee,
      total: checkoutData.total,
      promoCode: checkoutData.promoCode || "",
      promoDiscount: checkoutData.promoDiscount || 0,
      creditToApply,
      sellerCode: sellerCodeToUse,
      organizerExtraFee: checkoutData.organizerExtraFee || 0,
      vendorCommission: checkoutData.vendorCommission || 0,
      currency: event.currency,
    }));

    // Navigate to checkout page (this will handle the actual payment flow)
    navigate(`/checkout/${event.id}`);
  };

  const getWhatsAppUrl = (value) => {
    if (!value) return null;
    const trimmed = value.trim();
    // WhatsApp group invite link
    if (trimmed.startsWith("https://chat.whatsapp.com/")) return trimmed;
    // Generic URL — return as-is
    if (trimmed.startsWith("http")) return trimmed;
    // Phone number — strip everything except digits and leading +
    const digits = trimmed.replace(/[\s\-().]/g, "");
    if (/^\+?\d{7,15}$/.test(digits)) {
      const normalized = digits.startsWith("+") ? digits.slice(1) : digits;
      return `https://wa.me/${normalized}`;
    }
    return null;
  };

  const handleShare = async () => {
    const url = window.location.href;
    await safeShare({ title: event?.title || document.title, url });
  };

  const handleBuyNow = () => {
    setBuyStarted(true);
    setTimeout(() => {
      ticketSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleRsvpNow = () => {
    setBuyStarted(true);
    setTimeout(() => {
      ticketSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <div className="text-5xl mb-2">🔍</div>
          <p className="font-display font-bold text-2xl">Event Not Found</p>
          <p className="text-sm text-muted-foreground">This event link is invalid or the event has been removed.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Go Back
            </Button>
            <Button onClick={() => navigate("/search")} className="gap-2 glow-lime font-bold">
              Browse Events
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Unpublished / draft event — show "unavailable" message
  if (event.status === "draft") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <div className="text-5xl mb-2">🔒</div>
          <p className="font-display font-bold text-2xl">Event Unavailable</p>
          <p className="text-sm text-muted-foreground">This event is currently not available to the public.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Go Back
            </Button>
            <Button onClick={() => navigate("/search")} className="gap-2 glow-lime font-bold">
              Browse Events
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Completed / cancelled event — show friendly ended page instead of "Not Found"
  const isEndedEvent = ["completed", "cancelled"].includes(event.status);
  if (isEndedEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-5">
          <div className="text-5xl mb-2">{event.status === "cancelled" ? "❌" : "🎭"}</div>
          <div>
            <p className="font-display font-bold text-2xl">
              {event.status === "cancelled" ? "Event Cancelled" : "This Event Has Ended"}
            </p>
            {event.title && (
              <p className="text-lg font-display font-bold text-primary mt-1">{event.title}</p>
            )}
          </div>
          {event.date && (
            <p className="text-sm text-muted-foreground font-mono">
              📅 {format(new Date(event.date), "EEEE, MMMM dd, yyyy · h:mm a")}
            </p>
          )}
          {event.venue_name && (
            <p className="text-sm text-muted-foreground font-mono">
              📍 {event.venue_name}{event.city ? `, ${event.city}` : ""}
            </p>
          )}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            {event.status === "cancelled" ? (
              <>
                <p className="font-display font-bold text-sm mb-1">Event Cancelled</p>
                <p className="text-xs text-muted-foreground">
                  {event.cancellation_note || "This event has been cancelled by the organiser."}
                </p>
              </>
            ) : (
              <>
                <p className="font-display font-bold text-sm mb-1">Ticket Sales Closed</p>
                <p className="text-xs text-muted-foreground">This event has already taken place. Tickets are no longer available.</p>
              </>
            )}
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Go Back
            </Button>
            <Button onClick={() => navigate("/search")} className="gap-2 glow-lime font-bold">
              Browse Upcoming Events
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Past event check
  const eventIsPast = isEventPast(event);

  // Seller link limit checks
  const sellerTicketsFull = sellerLink && sellerLink.max_tickets > 0 && (sellerLink.tickets_sold || 0) >= sellerLink.max_tickets;
  const sellerTablesFull = sellerLink && sellerLink.max_tables > 0 && (sellerLink.tables_sold || 0) >= sellerLink.max_tables;

  const soldPercent = event.total_capacity
    ? Math.round(((event.tickets_sold || 0) / event.total_capacity) * 100)
    : 0;

  // Build the primary hero media — cover_image is authoritative; fall back to first gallery item
  const displayOrganizerName = organizerBusinessName || event.organizer_name || "";
  const heroMedia = event.cover_image || event.gallery_images?.[0];
  const hasHeroMedia = !!heroMedia;
  const isHeroVideo = hasHeroMedia && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(heroMedia);
  const canBuyNow = !eventIsPast && event?.event_type !== "rsvp_only" && (ticketTypes.length > 0 || tableTiers.length > 0) && !buyStarted;
  const buyNowLabel = ticketTypes.length > 0 && event.min_price > 0 ? `Buy Now · from ${formatPrice(event.min_price, event.currency)}` : "Buy Now";

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [events, tts, tables] = await Promise.all([
        base44.entities.Event.filter({ id }, null, 1),
        base44.entities.TicketType.filter({ event_id: id }, "sort_order", 50),
        base44.entities.Table.filter({ event_id: id }, "sort_order", 50),
      ]);
      const ev = events[0] || null;
      if (ev) {
        setEvent(ev);
        setTicketTypes(getPublicTicketTypes(tts));
        setTableTiers(tables);
      }
    } catch (err) {
      toast.error("Couldn't refresh. Showing last loaded data.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="min-h-screen pb-44 lg:pb-32">
      {event && (
        <>
          <PageMeta
            title={`${event.title} Tickets — REIZOR`}
            description={`${event.title} at ${event.venue_name}${event.city ? `, ${event.city}` : ""}${event.date ? ` on ${format(new Date(event.date), "MMMM d, yyyy")}` : ""}. ${event.genre ? event.genre.replace(/_/g, " ").toUpperCase() + " event" : "Event"} by ${event.organizer_name || "Reizor"}. Get tickets now.`}
            canonical={`https://reizor.com/events/${event.id}`}
            ogImage={event.cover_image || ""}
            ogType="event"
          />
          <StructuredData data={{
            "@context": "https://schema.org",
            "@type": "MusicEvent",
            "name": event.title,
            "description": event.description || event.short_description || "",
            "startDate": event.date || "",
            "endDate": event.end_date || "",
            "location": {
              "@type": "Place",
              "name": event.venue_name || "",
              "address": [event.venue_address, event.city, event.country].filter(Boolean).join(", "),
            },
            "performer": (event.artists || []).map(a => ({ "@type": "MusicGroup", "name": a })),
            "organizer": displayOrganizerName ? {
              "@type": "Organization",
              "name": displayOrganizerName,
              "url": `https://reizor.com/organizers/${event.organizer_id}`,
            } : undefined,
            "offers": event.min_price != null ? {
              "@type": "Offer",
              "price": event.min_price.toString(),
              "priceCurrency": event.currency || "USD",
              "url": `https://reizor.com/events/${event.id}`,
            } : undefined,
            "image": event.cover_image || undefined,
          }} />
        </>
      )}
      {/* Sticky Header: back + title + actions */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-full text-foreground hover:bg-muted transition-colors touch-manipulation shrink-0"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 font-display font-bold text-base sm:text-lg leading-tight truncate">
            {displayOrganizerName || event.title}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            <LikeEventButton event={event} showCount />
            <SaveEventButton event={event} showCount />
            <button
              onClick={handleShare}
              className="w-11 h-11 rounded-full bg-accent/90 backdrop-blur-sm flex items-center justify-center shadow-lg text-white hover:bg-accent transition-colors touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}
              title="Share event"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {refreshing ? <EventDetailShimmer /> : (<>
      {/* Hero Image or Video — full image visible (contain) with blurred fill background */}
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-muted to-muted/50" style={{ height: "280px" }}>
        {/* Blurred background fill — same media, blurred to fill letterboxing */}
        {hasHeroMedia && (
          isHeroVideo ? (
            <video
              src={heroMedia}
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110"
              style={{ filter: "blur(20px) brightness(0.4)" }}
            />
          ) : (
            <div
              className="absolute inset-0 scale-110"
              style={{
                backgroundImage: `url(${heroMedia})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(20px) brightness(0.4)",
              }}
            />
          )
        )}

        {/* Main media — contain so the full image is visible, never cropped */}
        {hasHeroMedia ? (
          isHeroVideo ? (
            <video
              src={heroMedia}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : (
            <img
              src={heroMedia}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-contain"
            />
          )
        ) : (
          <EventCoverPlaceholder featured={true} />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 mt-3 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-4">
            {/* Event title — visible heading on the page (sticky header shows the organizer name for consistency with the "Hosted by" card) */}
            <h2 className="font-display font-bold text-xl sm:text-2xl leading-tight">{event.title}</h2>
            {/* Organizer — prominent "Hosted by" banner */}
            {displayOrganizerName && (
              <Link
                to={`/organizers/${event.organizer_id}`}
                className="flex items-center gap-3 w-full sm:w-fit px-4 py-3 rounded-xl bg-card border border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all group touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-base">🎤</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Hosted by</p>
                  <p className="font-display font-bold text-base truncate group-hover:text-primary transition-colors">{displayOrganizerName}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            )}
            <div>
              {soldPercent >= 75 && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-destructive bg-destructive/10 px-2 py-1 rounded">
                    {soldPercent}% SOLD
                  </span>
                </div>
              )}

              <div className="mt-1 flex flex-wrap items-center gap-3">
                <AddToCalendarButton event={event} />
                {event.whatsapp_link && getWhatsAppUrl(event.whatsapp_link) && (
                  <a
                    href={getWhatsAppUrl(event.whatsapp_link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25d366]/10 border border-[#25d366]/30 text-sm font-mono font-bold text-[#25d366] hover:bg-[#25d366]/20 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Join our WhatsApp group
                  </a>
                )}
              </div>
            </div>

            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-card border border-border/50">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center mb-2">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">Date</p>
                <p className="font-display font-bold text-xs mt-0.5 leading-tight">
                  {event.date ? format(new Date(event.date), "MMM dd") : "TBA"}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border/50">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">Doors</p>
                <p className="font-display font-bold text-xs mt-0.5 leading-tight">
                  {event.doors_open || "TBA"}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border/50 col-span-2 sm:col-span-1">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center mb-2">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">Location</p>
                <p className="font-display font-bold text-xs mt-0.5 leading-tight">
                  {event.venue_name}
                </p>
                <MapDirectionLink
                  venueName={event.venue_name}
                  address={event.venue_address}
                  city={event.city}
                  state={event.venue_state}
                  country={event.country}
                  postalCode={event.zip_code}
                  latitude={event.latitude}
                  longitude={event.longitude}
                  className="mt-2 text-xs font-mono"
                />
              </div>
              <RaffleHighlightCell eventId={event.id} event={event} />
              {event.genre && (
                <div className="p-3 rounded-lg bg-card border border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center mb-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">Genre</p>
                  <p className="font-display font-bold text-xs mt-0.5 leading-tight capitalize">
                    {event.genre.replace(/_/g, " ")}
                  </p>
                </div>
              )}
              {event.age_restriction && (
                <div className="p-3 rounded-lg bg-card border border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center mb-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">Age Restriction</p>
                  <p className="font-display font-bold text-xs mt-0.5 leading-tight">
                    {event.age_restriction === "all_ages" ? "All Ages" : event.age_restriction}
                  </p>
                </div>
              )}
            </div>

            {/* Artists */}
            {event.artist_details?.filter(a => a.name).length > 0 ? (
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <h3 className="font-display font-bold text-sm">LINE-UP</h3>
                </div>
                <div className="space-y-1.5">
                  {event.artist_details.filter(a => a.name).map((artist, i) => (
                    <LineupArtistLink
                      key={i}
                      artistName={artist.name}
                      performanceTime={artist.performance_time}
                      socialLink={artist.social_link}
                      eventId={event.id}
                      eventTitle={event.title}
                    />
                  ))}
                </div>
              </div>
            ) : event.artists?.length > 0 ? (
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <h3 className="font-display font-bold text-sm">LINE-UP</h3>
                </div>
                <div className="space-y-1.5">
                  {event.artists.map((artist, i) => (
                    <LineupArtistLink
                      key={i}
                      artistName={artist}
                      eventId={event.id}
                      eventTitle={event.title}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Media Gallery + External Video */}
            {(() => {
              const galleryBeyondCover = (event.gallery_images || []).filter(u => u && u !== event.cover_image);
              const hasExternalVideo = event.teaser_video_url && !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(event.teaser_video_url);
              return (galleryBeyondCover.length > 0 || hasExternalVideo) ? (
              <div className="p-5 rounded-xl bg-card border border-border/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1 h-5 rounded-full bg-accent" />
                  <h3 className="font-display font-bold text-base">MEDIA</h3>
                </div>
                  <EventMediaGallery
                    coverImage={event.cover_image}
                    galleryImages={event.gallery_images}
                    teaserVideoUrl={event.teaser_video_url}
                    onBuyNow={handleBuyNow}
                    buyLabel={buyNowLabel}
                    showBuy={canBuyNow}
                  />
                </div>
              ) : null;
            })()}

            {/* Description */}
            {event.description && (
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <h3 className="font-display font-bold text-sm">ABOUT</h3>
                </div>
                <ReadMoreText text={event.description} />
              </div>
            )}

            {/* Dress Code */}
            {event.dress_code && (
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <h3 className="font-display font-bold text-sm">DRESS CODE</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👔</span>
                  <p className="font-display font-bold text-base">{event.dress_code}</p>
                </div>
              </div>
            )}

            {/* Photography & Filming Notice — all published events */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border/40">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-1 h-4 rounded-full bg-muted-foreground/50" />
                <h3 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wide">Photography &amp; Filming Notice</h3>
              </div>
              <ReadMoreText
                text="Photography and video recording may take place at this event. Images and footage captured may be used by the organiser, performing artists, the venue, and Reizor for event coverage, promotional materials, and marketing across digital and print platforms. By attending, you acknowledge that you may appear in such content. If you have any concerns, please speak to a member of the event team upon arrival."
                collapsedHeight={54}
                lineClassName="text-[11px] text-muted-foreground leading-relaxed font-mono"
              />
            </div>

            {/* Raffle — Random Draw */}
            <EventRafflePublic eventId={event.id} />

            {/* Giveaway — First to Claim */}
            <EventGiveawayPublic eventId={event.id} />

            {/* Legacy giveaway highlight (old data) */}
            <GiveawayHighlight eventId={event.id} />

            {/* Polls */}
            <PollManager event={event} isOrganizer={false} />

            {/* Reviews */}
            <EventReviews eventId={event.id} eventTitle={event.title} organizerId={event.organizer_id} organizerName={displayOrganizerName} />


          </div>

          {/* Ticket Sidebar */}
          <div className="lg:col-span-1" ref={ticketSectionRef}>
            <div className="sticky top-20 space-y-4">
              {/* Organizer Loyalty Badge */}
              {organizerLoyaltyTiers.length > 0 && (
                <a
                  href={`/organizers/${event.organizer_id}?section=loyalty-program`}
                  className="block rounded-xl bg-gradient-to-br from-yellow-400/10 to-yellow-400/5 border border-yellow-400/30 hover:border-yellow-400/60 transition-all cursor-pointer overflow-hidden"
                >
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 text-base">⭐</span>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-yellow-400">Loyalty Rewards Available</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Attend <strong className="text-foreground">{displayOrganizerName}</strong>'s events to earn rewards across <strong className="text-foreground">{organizerLoyaltyTiers.length} tier{organizerLoyaltyTiers.length !== 1 ? "s" : ""}</strong>.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {organizerLoyaltyTiers.slice(0, 3).map((t, i) => (
                        <span key={i} className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 border border-yellow-400/20">
                          {t.tier_name}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] font-mono font-bold text-yellow-400 flex items-center gap-1">
                      View loyalty program →
                    </p>
                  </div>
                </a>
              )}

              {/* Seller link banner */}
              {sellerLink && (
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-xs font-mono">
                  <p className="text-accent font-bold">🔗 Referred by: {sellerLink.promoter_name}</p>
                  {(sellerTicketsFull && sellerTablesFull) && (
                    <p className="text-destructive mt-1 font-bold">⚠ This seller link has reached its sales limit.</p>
                  )}
                </div>
              )}
              {/* Ticket card: always shown on published events (tiers visible up-front; past notice / RSVP / coming-soon handled below) */}
              {(eventIsPast || event.event_type === "rsvp_only" || ticketTypes.length > 0 || tableTiers.length > 0) && (
              <div className="p-6 rounded-xl bg-card border border-border/50 space-y-4">

                {/* ── Past event notice ── */}
                {eventIsPast && (
                  <div className="p-4 rounded-xl bg-muted/40 border border-border/50 text-center space-y-2">
                    <p className="text-2xl">🎭</p>
                    <p className="font-display font-bold text-sm">This event has already ended</p>
                    <p className="text-xs text-muted-foreground font-mono">Tickets are no longer available for this event.</p>
                  </div>
                )}



                {/* ── Unified Tickets + Tables list ── */}
                {!eventIsPast && (ticketTypes.length > 0 || tableTiers.length > 0) && (
                  <div className="space-y-6">
                    {/* Credits */}
                    {loyaltyAccount && (
                      <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-mono text-yellow-400 font-bold">⭐ LOYALTY CASHBACK</p>
                            <p className="text-sm font-bold">${loyaltyAccount.cashback_balance.toFixed(2)} available</p>
                          </div>
                          <button
                            onClick={() => { setUseLoyalty((v) => !v); if (useCredit) setUseCredit(false); }}
                            className={`px-3 py-1.5 rounded text-xs font-mono font-bold border transition-all ${
                              useLoyalty ? "bg-yellow-400 text-black border-yellow-400" : "bg-secondary border-border/50 text-muted-foreground hover:border-yellow-400/50"
                            }`}
                          >
                            {useLoyalty ? "✓ Applied" : "Apply"}
                          </button>
                        </div>
                        {useLoyalty && <p className="text-[10px] text-muted-foreground mt-2 font-mono">⚠ Loyalty-paid tickets are non-refundable as store credit.</p>}
                      </div>
                    )}
                    {availableCredit && (
                      <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-mono text-accent font-bold">ORGANIZER CREDIT</p>
                            <p className="text-sm font-bold">${availableCredit.amount.toFixed(2)} available</p>
                          </div>
                          <button
                            onClick={() => setUseCredit((v) => !v)}
                            className={`px-3 py-1.5 rounded text-xs font-mono font-bold border transition-all ${
                              useCredit ? "bg-accent text-accent-foreground border-accent" : "bg-secondary border-border/50 text-muted-foreground hover:border-accent/50"
                            }`}
                          >
                            {useCredit ? "✓ Applied" : "Apply"}
                          </button>
                        </div>
                        {useCredit && <p className="text-[10px] text-muted-foreground mt-2 font-mono">⚠ If unused & unsold after event, credit will not be reissued.</p>}
                      </div>
                    )}

                    {/* Tickets section */}
                    {ticketTypes.length > 0 && (
                       <div className="space-y-4">
                         {tableTiers.length > 0 && (
                           <div className="flex items-center gap-2 pt-2">
                             <span className="text-base">🎟️</span>
                             <h3 className="font-display font-bold text-xs uppercase tracking-widest text-muted-foreground">Tickets</h3>
                             <div className="flex-1 h-px bg-border/30" />
                           </div>
                         )}
                         <TicketSelector
                          ticketTypes={ticketTypes}
                          onCheckout={handleCheckout}
                          onStageChange={(stage) => event && trackStage(stage, event.id, event.title)}
                          feeSettings={feeSettings}
                          ccFeeOnBuyer={event?.cc_fee_on_buyer !== false}
                          platformFeeOnBuyer={event?.platform_fee_on_buyer !== false}
                          eventId={event?.id}
                          currency={event?.currency}
                          appliedCreditAmount={(useCredit && availableCredit) ? availableCredit.amount : (useLoyalty && loyaltyAccount) ? loyaltyAccount.cashback_balance : 0}
                          organizerExtraFee={event?.organizer_extra_fee || 0}
                          sellerLink={sellerLink}
                        />
                        {event && event.status === "sold_out" && (
                          <WaitlistButton event={event} />
                        )}
                      </div>
                    )}

                    {/* Tables section */}
                    {tableTiers.length > 0 && (
                       <div className="space-y-4">
                         {ticketTypes.length > 0 && (
                           <div className="flex items-center gap-2 pt-4">
                             <span className="text-base">🪑</span>
                             <h3 className="font-display font-bold text-xs uppercase tracking-widest text-muted-foreground">Tables / VIP</h3>
                             <div className="flex-1 h-px bg-border/30" />
                           </div>
                         )}
                        <SeatingMap
                          eventId={event.id}
                          tableTiers={tableTiers}
                          selectedTableId={selectedTableId}
                          onTableSelect={(tableId) => {
                            setSelectedTableId(tableId);
                            trackStage("ticket_select", event.id, event.title);
                          }}
                        />
                        {selectedTableId && (() => {
                           const t = tableTiers.find(t => t.id === selectedTableId);
                           if (!t) return null;
                           const baseTableTotal = (t.price || 0) + TABLE_PLATFORM_FEE;
                           let tableSellerCommission = 0;
                           if (sellerLink && sellerLink.commission_type && sellerLink.commission_type !== "none") {
                             if (sellerLink.commission_type === "fixed") tableSellerCommission = sellerLink.commission_value || 0;
                             else if (sellerLink.commission_type === "percentage") tableSellerCommission = (t.price || 0) * ((sellerLink.commission_value || 0) / 100);
                           }
                           const tableFinalTotal = baseTableTotal + tableSellerCommission;
                           return (
                             <div className="p-4 sm:p-5 rounded-xl bg-primary/10 border border-primary/30 space-y-4">
                               <div className="flex items-start justify-between gap-2">
                                 <div>
                                   <p className="font-display font-bold text-base">🪑 {t.name}</p>
                                   {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                                 </div>
                                 <span className="inline-block shrink-0 bg-primary text-primary-foreground text-xs font-mono font-bold px-2.5 py-1 rounded">SELECTED</span>
                               </div>

                               <div className="space-y-2 border-t border-primary/20 pt-3">
                                 <div className="flex justify-between text-xs sm:text-sm gap-2">
                                   <span className="text-muted-foreground">👥 Capacity</span>
                                   <span className="font-mono font-bold">{t.guests_per_table} guests</span>
                                 </div>
                                 <div className="flex justify-between text-xs sm:text-sm gap-2">
                                   <span className="text-muted-foreground">Table price</span>
                                   <span className="font-mono font-bold">{formatPrice(t.price || 0, event.currency)}</span>
                                 </div>
                                 <div className="flex justify-between text-xs sm:text-sm gap-2">
                                   <span className="text-muted-foreground">Service fee</span>
                                   <span className="font-mono font-bold">{formatPrice(TABLE_PLATFORM_FEE + tableSellerCommission, event.currency)}</span>
                                 </div>
                                 <div className="flex justify-between font-bold border-t border-primary/20 pt-2 text-sm gap-2">
                                   <span>Total</span>
                                   <span className="font-mono text-primary">{formatPrice(tableFinalTotal, event.currency)}</span>
                                 </div>
                               </div>

                               <Button onClick={handleTableOnlyCheckout} disabled={tableRedirecting} className="w-full glow-lime font-display font-bold h-12 touch-manipulation text-base">
                                 {tableRedirecting ? "Redirecting to payment..." : `Reserve Table · ${formatPrice(tableFinalTotal, event.currency)}`}
                               </Button>
                               <p className="text-[10px] text-muted-foreground text-center font-mono leading-relaxed">No GA ticket required — reserve your table independently</p>
                             </div>
                           );
                         })()}
                      </div>
                    )}

                    <div className="border-t border-border/30 pt-4 space-y-3">
                      {/* Legal notice */}
                      <p className="text-[10px] text-muted-foreground/70 text-center font-mono leading-relaxed">
                        By purchasing, you agree to our{" "}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">Terms</a>
                        {" "}&amp;{" "}
                        <a href="/terms#section-6" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">Refund Policy</a>
                        . All sales are final.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── RSVP-only / no inventory fallback ── */}
                {!eventIsPast && event.event_type === "rsvp_only" && (
                  <div className="text-center py-4 space-y-4">
                    <div className="space-y-2">
                      <p className="font-display font-bold">RSVP Required</p>
                      <p className="text-sm text-muted-foreground">This is a guest-list event. Request access below.</p>
                    </div>
                    <RsvpButton event={event} />
                  </div>
                )}
                {!eventIsPast && event.event_type !== "rsvp_only" && ticketTypes.length === 0 && tableTiers.length === 0 && (
                  <div className="text-center py-8 space-y-3">
                    <p className="font-display font-bold text-lg mb-1">Tickets Coming Soon</p>
                    <p className="text-sm text-muted-foreground">Stay tuned for ticket sales</p>
                    {event && <WaitlistButton event={event} />}
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      </>)}

      {/* Persistent floating Buy Tickets / RSVP bar — mobile + desktop */}
      <StickyBuyBar
        event={event}
        ticketTypes={ticketTypes}
        tableTiers={tableTiers}
        eventIsPast={eventIsPast}
        buyStarted={buyStarted}
        onBuyNow={handleBuyNow}
        onRsvp={handleRsvpNow}
      />
    </div>
    </PullToRefresh>
  );
}