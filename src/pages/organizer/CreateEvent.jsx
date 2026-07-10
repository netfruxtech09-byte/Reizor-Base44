import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Copy, Check, ExternalLink, Eye, Download, ChevronDown, ChevronUp, Calendar, Clock, Sparkles, X, QrCode } from "lucide-react";
import { uploadToSpaces } from "@/utils/spacesStorage";
import TimeInput from "@/components/ui/TimeInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, getCurrencySymbol } from "@/utils/currency";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { scrollToFirstError } from "@/utils/scrollToError";
import EventPreview from "../../components/organizer/EventPreview";
import EventMediaUploader from "../../components/events/EventMediaUploader";
import PlatformFeeScale from "../../components/organizer/PlatformFeeScale";
import PayoutSetupModal from "../../components/organizer/PayoutSetupModal";
import GenreSelector from "../../components/events/GenreSelector";
import DressCodePicker from "../../components/organizer/DressCodePicker";
import RaffleSetupCard from "../../components/organizer/RaffleSetupCard";
import RecurringEventSection from "../../components/organizer/RecurringEventSection";
import GiveawaySetupCard from "../../components/organizer/GiveawaySetupCard";
import EventDateTimeSection from "../../components/organizer/EventDateTimeSection";
import { detectTimezoneForLocation, getTimezoneLabel, convertLocalDateTimeBetweenTimezones } from "@/utils/timezoneUtils";
import LocationSelector from "@/components/shared/LocationSelector";
import PromoCodesSection from "../../components/organizer/PromoCodesSection";
import PromoterLinksSection from "../../components/organizer/PromoterLinksSection";
import EventMarketingLinks from "../../components/organizer/EventMarketingLinks";
import AIFlyerCreator from "../../components/organizer/AIFlyerCreator";
import FlyerPreviewActions from "../../components/organizer/FlyerPreviewActions";
import { APP_BASE_URL } from "@/lib/appUrl";
import { safeShare, isIOS, isAndroid, isMobileWebView } from "@/lib/mobileShare";

const TIERS = [
  { value: "early_bird", label: "Early Bird" },
  { value: "general", label: "General Admission" },
  { value: "vip", label: "VIP" },
  { value: "backstage", label: "Backstage" },
  { value: "free_rsvp", label: "Free RSVP" },
  { value: "custom", label: "Custom…" },
];

export default function CreateEvent() {
  const navigate = useNavigate();
  const [step, setStep] = useState("form"); // "form" | "preview" | "done"
  const [isClone, setIsClone] = useState(false);

  // Handle post-login organizer promotion and clone-from prefill
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("become_organizer") === "1") {
      base44.functions.invoke("becomeOrganizer", {}).catch(() => {});
      const url = new URL(window.location.href);
      url.searchParams.delete("become_organizer");
      window.history.replaceState({}, "", url.toString());
    }

    // Clone past event — prefill all fields from the source event
    const cloneFromId = params.get("clone_from");
    if (cloneFromId) {
      setIsClone(true);
      const loadClone = async () => {
        try {
          const src = await base44.entities.Event.get(cloneFromId);
          if (!src) return;
          // Prefill form fields (exclude date/end_date/published_at/status/id/slug)
          setForm({
            title: src.title || "",
            description: src.description || "",
            short_description: src.short_description || "",
            date: "", // organizer must pick a new date
            end_date: "",
            doors_open: src.doors_open || "",
            venue_name: src.venue_name || "",
            venue_address: src.venue_address || "",
            zip_code: src.zip_code || "",
            city: src.city || "",
            venue_state: src.venue_state || "",
            country: src.country || "",
            event_timezone: src.event_timezone || "",
            genre: src.genre || "electronic",
            age_restriction: src.age_restriction || "18+",
            total_capacity: src.total_capacity || 0,
            cc_fee_on_buyer: src.cc_fee_on_buyer !== false,
            platform_fee_on_buyer: src.platform_fee_on_buyer !== false,
            organizer_extra_fee: src.organizer_extra_fee || "",
            organizer_extra_fee_label: src.organizer_extra_fee_label || "",
            event_type: src.event_type || "ticketed",
            rsvp_capacity: src.rsvp_capacity || "",
            rsvp_start: "",
            rsvp_end: "",
            rsvp_approval_required: src.rsvp_approval_required !== false,
            whatsapp_link: src.whatsapp_link || "",
            dress_code: src.dress_code || "",
          });
          if (src.gallery_images?.length) setGalleryImages(src.gallery_images);
          if (src.teaser_video_url) setTeaserVideoUrl(src.teaser_video_url);
          if (src.currency) setTicketCurrency(src.currency);
          // Artist details
          if (src.artist_details?.length) {
            setArtistDetails(src.artist_details.map(a => ({ name: a.name || "", performance_time: a.performance_time || "", social_link: a.social_link || "" })));
          } else if (src.artists?.length) {
            setArtistDetails(src.artists.map(name => ({ name, performance_time: "", social_link: "" })));
          }
          // Ticket tiers
          const tts = await base44.entities.TicketType.filter({ event_id: cloneFromId }).catch(() => []);
          if (tts.length) {
            setTicketTiers(tts.map(t => ({
              name: t.name || "",
              tier: t.tier || "general",
              price: t.price ?? 0,
              quantity: t.quantity_total ?? 0,
              max_per_user: t.max_per_user || 4,
              show_tickets_left: t.show_tickets_left || false,
              tickets_left_threshold: t.tickets_left_threshold || "",
              custom_tier_name: "",
            })));
          }
          // Table tiers
          const tables = await base44.entities.Table.filter({ event_id: cloneFromId }).catch(() => []);
          if (tables.length) {
            setTableTiers(tables.map(t => ({
              name: t.name || "",
              description: t.description || "",
              price: t.price ?? 0,
              quantity: t.quantity_total ?? 0,
              guests_per_table: t.guests_per_table || "",
            })));
          }
          // Raffle
          const raffles = await base44.entities.EventRaffleSetup.filter({ event_id: cloneFromId }).catch(() => []);
          if (raffles[0]) {
            const r = raffles[0];
            setRaffleSetup({ title: r.title, prize_name: r.prize_name, prize_description: r.prize_description || "", num_winners: r.num_winners || 1, eligibility_action: r.eligibility_action || "ticket_purchase", eligibility_notes: r.eligibility_notes || "", prize_collection_instructions: r.prize_collection_instructions || "", start_datetime: "", close_datetime: "", draw_datetime: "" });
          }
          // Giveaway
          const giveaways = await base44.entities.EventGiveawaySetup.filter({ event_id: cloneFromId }).catch(() => []);
          if (giveaways[0]) {
            const g = giveaways[0];
            setGiveawaySetup({ title: g.title, reward_name: g.reward_name, reward_description: g.reward_description || "", total_quantity: g.total_quantity || 1, eligibility_action: g.eligibility_action || "ticket_purchase", eligibility_notes: g.eligibility_notes || "", collection_instructions: g.collection_instructions || "", start_datetime: "", end_datetime: "" });
          }
          toast.success("Event details prefilled — update the date and review before publishing.");
        } catch {
          toast.error("Could not load event details for cloning.");
        }
      };
      loadClone();
      // Clean param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("clone_from");
      window.history.replaceState({}, "", url.toString());
    }

    base44.auth.me().then(u => {
      setCurrentUser(u);
      if (u?.id) {
        base44.entities.OrganizerProfile.filter({ organizer_id: u.id }, null, 1)
          .then(res => { if (res[0]?.business_name) setOrganizerBusinessName(res[0].business_name); })
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);
  const [publishing, setPublishing] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [teaserVideoUrl, setTeaserVideoUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [createdEvent, setCreatedEvent] = useState(null);
  const [errors, setErrors] = useState({});
  const [flyerErrors, setFlyerErrors] = useState({});
  const [showFlyerValidationAlert, setShowFlyerValidationAlert] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [organizerBusinessName, setOrganizerBusinessName] = useState("");
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showAIFlyer, setShowAIFlyer] = useState(false);
  // Track the last AI-generated media so it survives preview ↔ edit navigation
  const [aiGeneratedMedia, setAiGeneratedMedia] = useState(null); // { url, type: "image"|"video" }

  const [form, setForm] = useState({
    title: "", description: "", short_description: "", date: "", end_date: "",
    doors_open: "", venue_name: "", venue_address: "", zip_code: "", city: "", venue_state: "", country: "",
    genre: "electronic", age_restriction: "18+", total_capacity: 0,
    cc_fee_on_buyer: true,
    platform_fee_on_buyer: true,
    organizer_extra_fee: "",
    organizer_extra_fee_label: "",
    event_type: "ticketed",
    rsvp_capacity: "",
    rsvp_start: "",
    rsvp_end: "",
    rsvp_approval_required: true,
    whatsapp_link: "",
    dress_code: "",
    event_timezone: "",
  });

  const [seatMapUrl, setSeatMapUrl] = useState("");
  const [uploadingSeatMap, setUploadingSeatMap] = useState(false);

  const [artistDetails, setArtistDetails] = useState([
    { name: "", performance_time: "", social_link: "" },
  ]);

  const [ticketCurrency, setTicketCurrency] = useState("USD");

  const [ticketTiers, setTicketTiers] = useState([
    { name: "", tier: "general", price: 0, quantity: 0, max_per_user: 4, show_tickets_left: false, tickets_left_threshold: "" },
  ]);

  const [tableTiers, setTableTiers] = useState([]);

  // Promo codes
  const [promoCodes, setPromoCodes] = useState([]);


  const [promoterLinks, setPromoterLinks] = useState([]);

  // Poll setup
  const [pollEnabled, setPollEnabled] = useState(false);
  const [poll, setPoll] = useState({ question: "", option_a: "", option_b: "", start_datetime: "", end_datetime: "" });

  // Raffle & Giveaway setup (separated)
  const [raffleSetup, setRaffleSetup] = useState(null); // null = disabled
  const [giveawaySetup, setGiveawaySetup] = useState(null); // null = disabled

  // Recurring event
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringConfig, setRecurringConfig] = useState({
    frequency: "weekly",
    end_condition: "by_count",
    end_date: "",
    end_after_occurrences: "",
  });
  const updateRecurringConfig = (field, value) => setRecurringConfig(p => ({ ...p, [field]: value }));

  const updateField = (field, value) => {
    setForm(p => ({ ...p, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: null }));
    if (flyerErrors[field]) {
      setFlyerErrors(e => ({ ...e, [field]: null }));
      // If all flyer errors cleared, dismiss the alert
      setFlyerErrors(prev => {
        const next = { ...prev, [field]: null };
        const remaining = Object.values(next).filter(Boolean);
        if (remaining.length === 0) setShowFlyerValidationAlert(false);
        return next;
      });
    }
  };

  const todayMin = new Date().toISOString().slice(0, 16);

  // Cascading location selection — updates country/state/city together and
  // detects the IANA timezone once the full location is known.
  const handleLocationChange = async ({ country, state, city }) => {
    setForm(p => ({ ...p, country, venue_state: state, city }));
    setErrors(e => ({ ...e, country: null, venue_state: null, city: null }));
    if (!city) return; // wait until the full Country → State → City selection is complete

    const prevTz = form.event_timezone;
    const detected = await detectTimezoneForLocation({ venue_address: form.venue_address, city, state, country });
    if (!detected || detected === prevTz) return;
    if (prevTz && form.date) {
      toast(`Location changed — timezone updated to ${detected}`, {
        description: "The event date/time was previously set. What would you like to do?",
        action: {
          label: "Convert time",
          onClick: () => {
            setForm(p => ({
              ...p,
              event_timezone: detected,
              date: convertLocalDateTimeBetweenTimezones(p.date, prevTz, detected),
              end_date: p.end_date ? convertLocalDateTimeBetweenTimezones(p.end_date, prevTz, detected) : p.end_date,
            }));
          },
        },
        cancel: {
          label: "Keep same local time",
          onClick: () => setForm(p => ({ ...p, event_timezone: detected })),
        },
      });
    } else {
      updateField("event_timezone", detected);
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = "Event title is required";
    if (!form.date) {
      errs.date = "Event date is required";
    } else if (new Date(form.date) < new Date(Date.now() - 60000)) {
      errs.date = "Event date cannot be in the past";
    }
    if (form.end_date && form.date && form.end_date < form.date) {
      errs.end_date = "End date must be the same as or after the start date.";
    }
    if (!form.venue_name.trim()) errs.venue_name = "Venue name is required";
    if (!form.country?.trim()) errs.country = "Country is required";
    if (!form.venue_state?.trim()) errs.venue_state = "State/Region is required";
    if (!form.city.trim()) errs.city = "City is required";
    if (!form.zip_code?.trim()) errs.zip_code = "Zip code is required";
    if (!form.end_date) errs.end_date = "End date is required";
    // Capacity is always required
    if (!form.total_capacity || Number(form.total_capacity) < 1) {
      errs.total_capacity = "Capacity is required.";
    }
    // Ticket capacity vs tiers
    if (form.event_type === "ticketed" && form.total_capacity) {
      const cap = Number(form.total_capacity);
      if (cap > 0) {
        const totalTickets = ticketTiers.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
        if (totalTickets > cap) {
          errs.total_capacity = `Total ticket quantity (${totalTickets}) cannot exceed event capacity of ${cap}.`;
        }
      }
    }
    // Recurring event validations
    if (isRecurring) {
      if (!recurringConfig.frequency) {
        errs.recurring_frequency = "Please select a recurrence frequency.";
      }
      if (recurringConfig.end_condition === "by_date") {
        if (!recurringConfig.end_date) {
          errs.recurring_end_date = "Please set a series end date.";
        } else if (form.date && recurringConfig.end_date <= form.date) {
          errs.recurring_end_date = "Series end date must be after the first occurrence date.";
        }
      }
      if (recurringConfig.end_condition === "by_count") {
        const count = Number(recurringConfig.end_after_occurrences);
        if (!count || count < 2) {
          errs.recurring_end_count = "Number of occurrences must be at least 2.";
        } else if (count > 104) {
          errs.recurring_end_count = "Maximum 104 occurrences allowed.";
        }
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      scrollToFirstError(errs);
      return false;
    }
    return true;
  };

  // ── Flyer-specific field validation ──
  const FLYER_REQUIRED_FIELDS = [
    { key: "title", label: "Event title" },
    { key: "date", label: "Event date" },
    { key: "venue_name", label: "Venue name" },
    { key: "city", label: "City" },
    { key: "genre", label: "Genre" },
    { key: "description", label: "Description" },
  ];

  const validateFlyerFields = () => {
    const errs = {};
    for (const field of FLYER_REQUIRED_FIELDS) {
      const val = form[field.key];
      if (!val || (typeof val === "string" && !val.trim())) {
        errs[field.key] = `${field.label} is required to generate a flyer`;
      }
    }
    setFlyerErrors(errs);
    if (Object.keys(errs).length > 0) {
      // Also set form errors for inline display
      setErrors(prev => {
        const merged = { ...prev };
        for (const [k, v] of Object.entries(errs)) merged[k] = v;
        return merged;
      });
      setShowFlyerValidationAlert(true);
      scrollToFirstError(errs);
      return false;
    }
    return true;
  };

  const handleOpenFlyer = () => {
    if (validateFlyerFields()) {
      setShowFlyerValidationAlert(false);
      setShowAIFlyer(true);
    }
  };

  const updateArtist = (i, field, value) => {
    const updated = [...artistDetails];
    updated[i] = { ...updated[i], [field]: value };
    setArtistDetails(updated);
  };

  const addArtist = () => setArtistDetails([...artistDetails, { name: "", performance_time: "", social_link: "" }]);
  const removeArtist = (i) => setArtistDetails(artistDetails.filter((_, idx) => idx !== i));

  const addTier = () => setTicketTiers([...ticketTiers, { name: "", tier: "general", price: 0, quantity: 0, max_per_user: 4, custom_tier_name: "", show_tickets_left: false, tickets_left_threshold: "" }]);
  const updateTier = (i, field, value) => {
    const updated = [...ticketTiers];
    updated[i] = { ...updated[i], [field]: value };
    if (field === "tier") {
      if (value === "custom") {
        // Clear name so user can type custom name
        updated[i].name = "";
        updated[i].custom_tier_name = "";
      } else {
        // Auto-fill name from the predefined label
        const tierDef = TIERS.find(t => t.value === value);
        if (tierDef) updated[i].name = tierDef.label;
        updated[i].custom_tier_name = "";
      }
    }
    setTicketTiers(updated);
  };
  const removeTier = (i) => setTicketTiers(ticketTiers.filter((_, idx) => idx !== i));

  const addTableTier = () => setTableTiers([...tableTiers, { name: "", description: "", price: 0, quantity: 0, guests_per_table: "" }]);
  const updateTableTier = (i, field, value) => {
    const updated = [...tableTiers];
    updated[i] = { ...updated[i], [field]: value };
    setTableTiers(updated);
  };
  const removeTableTier = (i) => setTableTiers(tableTiers.filter((_, idx) => idx !== i));

  const handleSeatMapUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error("Only PNG, JPG, or PDF files are supported");
      return;
    }
    setUploadingSeatMap(true);
    try {
      const file_url = await uploadToSpaces(file, "events/general/seatmaps");
      setSeatMapUrl(file_url);
      toast.success("Seat map uploaded!");
    } catch {
      toast.error("Seat map upload failed. Please try again.");
    } finally {
      setUploadingSeatMap(false);
      e.target.value = "";
    }
  };

  const handlePreview = () => {
    if (!validate()) return;
    setStep("preview");
  };

  const handlePublish = async () => {
    if (!validate()) return;
    // Validate custom tier names
    const missingCustomName = ticketTiers.some(t => t.tier === "custom" && !t.custom_tier_name?.trim());
    if (missingCustomName) {
      toast.error("Please enter a name for each custom ticket tier.");
      setPublishing(false);
      return;
    }
    // Validate promo codes if any were added
    if (promoCodes.length > 0) {
      const promoErrs = PromoCodesSection.validate(promoCodes);
      if (Object.keys(promoErrs).length > 0) {
        toast.error("Please fix the promo code errors before publishing.");
        return;
      }
    }
    setPublishing(true);
    const user = await base44.auth.me();
    const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const validArtists = artistDetails.filter(a => a.name.trim());
    const prices = ticketTiers.filter(t => t.price).map(t => Number(t.price));

    const event = await base44.entities.Event.create({
      ...form,
      slug,
      zip_code: form.zip_code || "",
      total_capacity: form.total_capacity ? Number(form.total_capacity) : 0,
      rsvp_capacity: form.rsvp_capacity ? Number(form.rsvp_capacity) : 0,
      organizer_extra_fee: form.organizer_extra_fee ? Number(form.organizer_extra_fee) : 0,
      artists: validArtists.map(a => a.name),
      artist_details: validArtists,
      status: "published",
      organizer_id: user.id,
      organizer_name: organizerBusinessName || user.full_name,
      min_price: prices.length ? Math.min(...prices) : 0,
      max_price: prices.length ? Math.max(...prices) : 0,
      currency: ticketCurrency,
      published_at: new Date().toISOString(),
      cover_image: galleryImages[0] || "",
      gallery_images: galleryImages,
      teaser_video_url: teaserVideoUrl || (aiGeneratedMedia?.type === "video" ? aiGeneratedMedia.url : ""),
      seat_map_url: seatMapUrl || "",
    });

    // Generate QR code for the event
    const ticketUrl = `${APP_BASE_URL}/events/${event.id}`;
    const qrRes = await base44.functions.invoke("generateEventQR", {
      event_id: event.id,
      ticket_url: ticketUrl,
    });

    if (qrRes.data.success) {
      await base44.entities.Event.update(event.id, {
        qr_code_url: qrRes.data.qr_code_url,
      });
      event.qr_code_url = qrRes.data.qr_code_url;
    }

    // ── Recurring series: generate future occurrences ──
    if (isRecurring && recurringConfig.frequency) {
      const durationMs = form.end_date
        ? new Date(form.end_date) - new Date(form.date)
        : 4 * 60 * 60 * 1000; // default 4h

      // Create the series record
      const series = await base44.entities.RecurringSeries.create({
        organizer_id: user.id,
        organizer_name: organizerBusinessName || user.full_name,
        title: event.title,
        frequency: recurringConfig.frequency,
        start_date: new Date(form.date).toISOString(),
        event_duration_minutes: Math.round(durationMs / 60000),
        end_condition: recurringConfig.end_condition,
        end_date: recurringConfig.end_condition === "by_date" && recurringConfig.end_date
          ? new Date(recurringConfig.end_date).toISOString()
          : undefined,
        end_after_occurrences: recurringConfig.end_condition === "by_count"
          ? Number(recurringConfig.end_after_occurrences)
          : undefined,
        template_event_id: event.id,
        total_occurrences_generated: 1,
        status: "active",
      }).catch(() => null);

      if (series) {
        // Tag the first event as part of the series
        await base44.entities.Event.update(event.id, {
          recurring_series_id: series.id,
          occurrence_index: 0,
        }).catch(() => {});

        // Generate subsequent occurrences
        const getNextDate = (baseDate, freq) => {
          const d = new Date(baseDate);
          if (freq === "weekly") d.setDate(d.getDate() + 7);
          else if (freq === "biweekly") d.setDate(d.getDate() + 14);
          else if (freq === "monthly") d.setMonth(d.getMonth() + 1);
          return d;
        };

        const maxOccurrences = recurringConfig.end_condition === "by_count"
          ? Number(recurringConfig.end_after_occurrences)
          : 104; // safety cap

        const seriesEndDate = recurringConfig.end_condition === "by_date" && recurringConfig.end_date
          ? new Date(recurringConfig.end_date)
          : null;

        let currentDate = new Date(form.date);
        let occurrenceIndex = 1;
        const prices2 = ticketTiers.filter(t => t.price).map(t => Number(t.price));

        while (occurrenceIndex < maxOccurrences) {
          currentDate = getNextDate(currentDate, recurringConfig.frequency);
          if (seriesEndDate && currentDate > seriesEndDate) break;

          const occEndDate = form.end_date
            ? new Date(currentDate.getTime() + durationMs)
            : undefined;

          const occSlug = `${slug}-${occurrenceIndex + 1}`;
          const occ = await base44.entities.Event.create({
            ...form,
            slug: occSlug,
            zip_code: form.zip_code || "",
            total_capacity: form.total_capacity ? Number(form.total_capacity) : 0,
            rsvp_capacity: form.rsvp_capacity ? Number(form.rsvp_capacity) : 0,
            organizer_extra_fee: form.organizer_extra_fee ? Number(form.organizer_extra_fee) : 0,
            artists: validArtists.map(a => a.name),
            artist_details: validArtists,
            status: "published",
            organizer_id: user.id,
            organizer_name: organizerBusinessName || user.full_name,
            min_price: prices2.length ? Math.min(...prices2) : 0,
            max_price: prices2.length ? Math.max(...prices2) : 0,
            currency: ticketCurrency,
            published_at: new Date().toISOString(),
            cover_image: galleryImages[0] || "",
            gallery_images: galleryImages,
            teaser_video_url: teaserVideoUrl || "",
            date: currentDate.toISOString(),
            end_date: occEndDate ? occEndDate.toISOString() : undefined,
            recurring_series_id: series.id,
            occurrence_index: occurrenceIndex,
          }).catch(() => null);

          if (occ) {
            // Clone ticket types for each occurrence
            for (let i = 0; i < ticketTiers.length; i++) {
              const t = ticketTiers[i];
              if (!t.name || t.price === "" || t.quantity === "") continue;
              await base44.entities.TicketType.create({
                event_id: occ.id,
                name: t.name,
                tier: t.tier === "custom" ? (t.custom_tier_name?.trim() || "custom") : t.tier,
                price: Number(t.price),
                currency: ticketCurrency,
                quantity_total: Number(t.quantity),
                max_per_user: t.max_per_user || 4,
                status: "active",
                sort_order: i,
                show_tickets_left: t.show_tickets_left === true,
                tickets_left_threshold: t.tickets_left_threshold ? Number(t.tickets_left_threshold) : null,
              }).catch(() => {});
            }
          }
          occurrenceIndex++;
        }

        await base44.entities.RecurringSeries.update(series.id, {
          total_occurrences_generated: occurrenceIndex,
        }).catch(() => {});
      }
    }

    // Send notifications to mentioned artists with QR code
    const artistNotifications = validArtists.map(async (artist) => {
      const matchingArtists = await base44.entities.Artist.filter({ display_name: artist.name }, null, 1).catch(() => []);
      if (matchingArtists.length > 0) {
        const a = matchingArtists[0];
        await base44.entities.Notification.create({
          user_email: a.user_email,
          title: `🎫 You're featured in ${event.title}!`,
          message: `Your event ${event.title} has been published on Reizor. Download the QR code to share on your socials!`,
          type: "general",
          event_id: event.id,
          event_title: event.title,
        }).catch(() => {});
      }
    });
    await Promise.all(artistNotifications);

    // Notify paid members immediately (early access)
    const artistNames = validArtists.map(a => a.name);
    await base44.functions.invoke("notifyPaidMembersEventLive", {
      event_id: event.id,
      event_title: event.title,
      artist_names: artistNames,
    }).catch(() => {});

    for (let i = 0; i < ticketTiers.length; i++) {
      const t = ticketTiers[i];
      if (!t.name || t.price === "" || t.price === undefined || t.quantity === "" || t.quantity === undefined) continue;
      await base44.entities.TicketType.create({
        event_id: event.id,
        name: t.name,
        tier: t.tier === "custom" ? (t.custom_tier_name?.trim() || "custom") : t.tier,
        price: Number(t.price),
        currency: ticketCurrency,
        quantity_total: Number(t.quantity),
        max_per_user: t.max_per_user || 4,
        status: "active",
        sort_order: i,
        show_tickets_left: t.show_tickets_left === true,
        tickets_left_threshold: t.tickets_left_threshold ? Number(t.tickets_left_threshold) : null,
      });
    }

    for (let i = 0; i < tableTiers.length; i++) {
      const t = tableTiers[i];
      if (!t.name || t.price === "" || t.price === undefined || t.quantity === "" || t.quantity === undefined || !t.guests_per_table) continue;
      await base44.entities.Table.create({
        event_id: event.id,
        event_title: event.title,
        name: t.name,
        description: t.description,
        price: Number(t.price),
        quantity_total: Number(t.quantity),
        guests_per_table: Number(t.guests_per_table),
        status: "active",
        sort_order: i,
      });
    }

    // Create poll if configured
    if (pollEnabled && poll.question.trim() && poll.option_a.trim() && poll.option_b.trim() && poll.start_datetime && poll.end_datetime) {
      await base44.entities.EventPoll.create({
        event_id: event.id,
        event_title: event.title,
        organizer_id: user.id,
        question: poll.question,
        option_a: poll.option_a,
        option_b: poll.option_b,
        votes_a: 0,
        votes_b: 0,
        start_datetime: new Date(poll.start_datetime).toISOString(),
        end_datetime: new Date(poll.end_datetime).toISOString(),
        status: "upcoming",
      }).catch(() => {});
    }

    // Create Raffle if configured
    if (raffleSetup && raffleSetup.title?.trim() && raffleSetup.prize_name?.trim()) {
      await base44.entities.EventRaffleSetup.create({
        event_id: event.id,
        event_title: event.title,
        organizer_id: user.id,
        title: raffleSetup.title,
        prize_name: raffleSetup.prize_name,
        prize_description: raffleSetup.prize_description || "",
        num_winners: Number(raffleSetup.num_winners) || 1,
        eligibility_action: raffleSetup.eligibility_action || "ticket_purchase",
        eligibility_notes: raffleSetup.eligibility_notes || "",
        prize_collection_instructions: raffleSetup.prize_collection_instructions || "",
        start_datetime: raffleSetup.start_datetime ? new Date(raffleSetup.start_datetime).toISOString() : undefined,
        close_datetime: raffleSetup.close_datetime ? new Date(raffleSetup.close_datetime).toISOString() : undefined,
        draw_datetime: raffleSetup.draw_datetime ? new Date(raffleSetup.draw_datetime).toISOString() : undefined,
        status: "upcoming",
        total_entries: 0,
      }).catch(() => {});
    }

    // Create Giveaway if configured
    if (giveawaySetup && giveawaySetup.title?.trim() && giveawaySetup.reward_name?.trim() && giveawaySetup.total_quantity) {
      await base44.entities.EventGiveawaySetup.create({
        event_id: event.id,
        event_title: event.title,
        organizer_id: user.id,
        title: giveawaySetup.title,
        reward_name: giveawaySetup.reward_name,
        reward_description: giveawaySetup.reward_description || "",
        total_quantity: Number(giveawaySetup.total_quantity),
        claimed_quantity: 0,
        eligibility_action: giveawaySetup.eligibility_action || "ticket_purchase",
        eligibility_notes: giveawaySetup.eligibility_notes || "",
        collection_instructions: giveawaySetup.collection_instructions || "",
        start_datetime: giveawaySetup.start_datetime ? new Date(giveawaySetup.start_datetime).toISOString() : undefined,
        end_datetime: giveawaySetup.end_datetime ? new Date(giveawaySetup.end_datetime).toISOString() : undefined,
        status: "upcoming",
      }).catch(() => {});
    }

    // Save promo codes linked to the newly created event
    const promoErrors = [];
    for (const p of promoCodes) {
      if (!p.code || !p.discount_value) continue;
      await base44.entities.PromoCode.create({
        code: p.code.toUpperCase(),
        event_id: event.id,
        discount_type: p.discount_type || "percentage",
        discount_value: Number(p.discount_value),
        max_uses: p.max_uses ? Number(p.max_uses) : 999,
        valid_from: p.valid_from ? new Date(p.valid_from).toISOString() : undefined,
        valid_until: p.valid_until ? new Date(p.valid_until).toISOString() : undefined,
        tier_id: p.tier_id || undefined,
        tier_name: p.tier_name || undefined,
        status: p.status || "active",
        times_used: 0,
      }).catch(err => promoErrors.push({ code: p.code, err }));
    }
    if (promoErrors.length > 0) {
      toast.error(`${promoErrors.length} promo code(s) failed to save. Please add them manually from the Promo Codes section.`);
    } else if (promoCodes.length > 0) {
      toast.success(`${promoCodes.length} promo code${promoCodes.length > 1 ? "s" : ""} created!`);
    }

    setPublishing(false);
    setCreatedEvent(event);

    // Check if organizer has bank info — show modal if not
    const bankInfos = await base44.entities.OrganizerBankInfo.filter({ organizer_id: user.id }, null, 1).catch(() => []);
    if (bankInfos.length === 0) {
      setCurrentUser(user);
      setShowPayoutModal(true);
    }

    setStep("done");
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };

  const handleSaveDraft = async () => {
    // Draft: no validation required — allow partial data
    const user = await base44.auth.me();
    const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const validArtists = artistDetails.filter(a => a.name.trim());
    const prices = ticketTiers.filter(t => t.price).map(t => Number(t.price));

    await base44.entities.Event.create({
      ...form,
      slug,
      zip_code: form.zip_code || "",
      total_capacity: form.total_capacity ? Number(form.total_capacity) : 0,
      organizer_extra_fee: form.organizer_extra_fee ? Number(form.organizer_extra_fee) : 0,
      cover_image: galleryImages[0] || "",
      gallery_images: galleryImages,
      teaser_video_url: teaserVideoUrl || (aiGeneratedMedia?.type === "video" ? aiGeneratedMedia.url : ""),
      seat_map_url: seatMapUrl || "",
      artists: validArtists.map(a => a.name),
      artist_details: validArtists,
      status: "draft",
      organizer_id: user.id,
      organizer_name: organizerBusinessName || user.full_name,
      min_price: prices.length ? Math.min(...prices) : 0,
      max_price: prices.length ? Math.max(...prices) : 0,
      currency: ticketCurrency,
    });
    toast.success("Saved as draft");
    navigate("/organizer/events");
  };

  const copyLink = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied!");
  };

  // ── Published confirmation ──
  if (step === "done" && createdEvent) {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const ticketUrl = `${APP_BASE_URL}/events/${createdEvent.id}`;
    const text = encodeURIComponent(`🎉 ${createdEvent.title} — grab your tickets now!`);
    const encodedUrl = encodeURIComponent(ticketUrl);

    const downloadQR = async () => {
      if (!createdEvent.qr_code_url) return;
      try {
        const response = await fetch(createdEvent.qr_code_url, { mode: "cors" });
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const filename = `event-${createdEvent.title.replace(/\s+/g, "-").toLowerCase()}-qr-code.png`;

        if (!isMobileWebView() && !isIOS() && !isAndroid()) {
          // Desktop: direct download
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
          return;
        }

        // Mobile: try native share sheet with the file
        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], filename, { type: "image/png" });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: "Event QR Code", url: ticketUrl });
              URL.revokeObjectURL(blobUrl);
              return;
            }
          } catch (e) {
            if (e.name === "AbortError") { URL.revokeObjectURL(blobUrl); return; }
          }
        }
        // Fallback: share just the URL
        await safeShare({ title: "Event QR Code", url: ticketUrl });
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(createdEvent.qr_code_url, "_blank");
      }
    };

    return (
      <div className="max-w-xl space-y-6">
        {showPayoutModal && currentUser && (
          <PayoutSetupModal
            user={currentUser}
            onClose={() => setShowPayoutModal(false)}
            onSaved={() => setShowPayoutModal(false)}
          />
        )}
        <div>
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">✓ PUBLISHED</span>
          <h1 className="font-display font-black text-3xl tracking-tight mt-1">Ticket Sale Link</h1>
          <p className="text-sm text-muted-foreground mt-1">Your event is live! Share the ticket link with your audience.</p>
        </div>
        <div className="p-5 rounded-xl bg-card border border-primary/30 space-y-3">
          <p className="font-mono text-xs text-primary uppercase tracking-widest">🎟️ Ticket Link</p>
          <div className="flex gap-2">
            <input readOnly value={ticketUrl}
              className="flex-1 rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm font-mono text-muted-foreground" />
            <Button size="icon" variant="outline" onClick={() => copyLink(ticketUrl)} className="border-border/50 shrink-0">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="outline" asChild className="border-border/50 shrink-0">
              <a href={ticketUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
            </Button>
          </div>

          {/* QR Code for Flyer */}
          {createdEvent.qr_code_url && (
            <div className="p-4 rounded-lg bg-secondary/50 border border-border/30 space-y-3">
              <p className="font-mono text-[10px] text-primary uppercase tracking-wider">📲 QR Code for Flyers</p>
              <div className="flex items-center justify-center p-3 bg-white rounded-lg">
                <img src={createdEvent.qr_code_url} alt="Event QR Code" className="w-32 h-32" />
              </div>
              <p className="text-xs text-muted-foreground">Scan this QR code to view the event and purchase tickets. Perfect for posters and flyers!</p>
              <Button onClick={downloadQR} variant="outline" size="sm" className="w-full gap-1.5 font-mono">
                <Download className="w-3.5 h-3.5" /> {(isIOS() || isAndroid()) ? "Share / Save QR Code" : "Download QR Code"}
              </Button>
            </div>
          )}

          <div className="pt-2">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Share on</p>
            <div className="flex flex-wrap gap-2">
              <a href={`https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-black border border-border/50 text-sm font-mono font-bold hover:border-white/30 transition-colors">𝕏 Post</a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-[#1877f2]/10 border border-[#1877f2]/30 text-sm font-mono font-bold text-[#1877f2] hover:bg-[#1877f2]/20 transition-colors">Facebook</a>
              <a href={`https://wa.me/?text=${text}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-[#25d366]/10 border border-[#25d366]/30 text-sm font-mono font-bold text-[#25d366] hover:bg-[#25d366]/20 transition-colors">WhatsApp</a>
              <a href={`https://t.me/share/url?url=${encodedUrl}&text=${text}`} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-[#2ca5e0]/10 border border-[#2ca5e0]/30 text-sm font-mono font-bold text-[#2ca5e0] hover:bg-[#2ca5e0]/20 transition-colors">Telegram</a>
              <a href={`https://www.instagram.com/`} target="_blank" rel="noopener noreferrer"
                onClick={() => { navigator.clipboard.writeText(ticketUrl); toast.success("Link copied — paste it in your Instagram post or story!"); }}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#f09433]/10 to-[#e6683c]/10 border border-[#e6683c]/30 text-sm font-mono font-bold text-[#e6683c] hover:opacity-80 transition-all">Instagram</a>
            </div>
          </div>
        </div>
        {/* Marketing Links */}
        <EventMarketingLinks eventId={createdEvent.id} event={createdEvent} compact />

        <div className="flex gap-3">
          <Button onClick={() => navigate("/organizer/events")} variant="outline" className="font-display font-bold">Go to Events</Button>
          <Button onClick={() => navigate(`/organizer/events/${createdEvent.id}`)} className="glow-lime font-display font-bold">Manage Event</Button>
        </div>
      </div>
    );
  }

  // ── Preview step ──
  if (step === "preview") {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    // Determine best cover image: prefer gallery, fall back to AI video thumbnail hint
    const previewCoverImage = galleryImages[0] || "";
    const previewVideoUrl = teaserVideoUrl || (aiGeneratedMedia?.type === "video" ? aiGeneratedMedia.url : "");
    return (
      <EventPreview
        event={{
          ...form,
          cover_image: previewCoverImage,
          gallery_images: galleryImages,
          teaser_video_url: previewVideoUrl,
        }}
        artistDetails={artistDetails}
        ticketTiers={ticketTiers}
        tableTiers={tableTiers}
        currency={ticketCurrency}
        onEdit={() => setStep("form")}
        onPublish={handlePublish}
        publishing={publishing}
      />
    );
  }

  // ── Form ──
  return (
    <div className="space-y-8 max-w-3xl w-full overflow-x-hidden mobile-bottom-nav-spacing">
      <div>
        <h1 className="font-display font-black text-2xl sm:text-4xl tracking-tight" style={{ wordSpacing: '0.3em' }}>{isClone ? "REUSE EVENT" : "CREATE EVENT"}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">{isClone ? "Details prefilled from your past event — update the date and any changes, then publish." : "Fill in the details, preview, then make it live"}</p>
      </div>

      {/* Flyer Validation Alert */}
      {showFlyerValidationAlert && (
        <div className="p-4 rounded-xl bg-yellow-400/10 border-2 border-yellow-400/40 space-y-3">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-display font-bold text-sm text-yellow-400">Missing Event Information</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please complete the following fields before generating your flyer. Adding the event title, date, venue, city, genre, and description will help create a better design.
              </p>
              <ul className="mt-2 space-y-1">
                {FLYER_REQUIRED_FIELDS.filter(f => flyerErrors[f.key]).map(f => (
                  <li key={f.key} className="flex items-center gap-2 text-xs text-yellow-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setShowFlyerValidationAlert(false)}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Event Details */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-border/30">
          <div className="w-1 h-5 rounded-full bg-accent" />
          <h3 className="font-display font-bold text-base text-accent">Event Details</h3>
        </div>
        <div id="field-title">
          <Label className="text-xs text-muted-foreground font-mono">Title *</Label>
          <Input value={form.title} onChange={e => updateField("title", e.target.value)}
            placeholder="Event title" className={`mt-1 bg-card border-border/50 ${errors.title ? "border-destructive ring-1 ring-destructive/40" : ""}`} />
          {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
        </div>
        <div id="field-description">
          <Label className="text-xs text-muted-foreground font-mono">Description (visible on post)</Label>
          <textarea value={form.description} onChange={e => updateField("description", e.target.value)}
            rows={5} placeholder="Tell your audience what to expect — vibe, special moments..."
            className={`mt-1 w-full rounded-md bg-card border px-3 py-2 text-sm ${flyerErrors.description ? "border-destructive ring-1 ring-destructive/40" : "border-border/50"}`} />
          {flyerErrors.description && <p className="text-xs text-destructive mt-1">{flyerErrors.description}</p>}
        </div>

        <div id="field-date">
          <EventDateTimeSection
            startValue={form.date}
            endValue={form.end_date}
            isRecurring={isRecurring}
            todayMin={todayMin}
            startError={errors.date}
            endError={errors.end_date}
            timezoneLabel={getTimezoneLabel(form.event_timezone, form.date)}
            onStartChange={(newDate) => {
              updateField("date", newDate);
              if (form.end_date && newDate && form.end_date < newDate) {
                updateField("end_date", "");
                setErrors(prev => ({ ...prev, end_date: "End date must be the same as or after the start date." }));
              } else {
                setErrors(prev => ({ ...prev, end_date: null }));
              }
            }}
            onEndChange={(newEnd) => {
              if (form.date && newEnd && newEnd < form.date) {
                setErrors(prev => ({ ...prev, end_date: "End date must be the same as or after the start date." }));
                return;
              }
              updateField("end_date", newEnd);
              setErrors(prev => ({ ...prev, end_date: null }));
            }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground font-mono">Doors Open</Label>
            <TimeInput ampm value={form.doors_open} onChange={v => updateField("doors_open", v)}
              className="mt-1" />
          </div>
          <div id="field-genre">
            <Label className="text-xs text-muted-foreground font-mono">Genre *</Label>
            <GenreSelector value={form.genre} onChange={v => updateField("genre", v)} />
            {flyerErrors.genre && <p className="text-xs text-destructive mt-1">{flyerErrors.genre}</p>}
          </div>
        </div>

        {/* Age Requirement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground font-mono">Age Requirement</Label>
            <Select
              value={["all_ages","18+","21+"].includes(form.age_restriction) ? form.age_restriction : "custom"}
              onValueChange={v => {
                if (v !== "custom") updateField("age_restriction", v);
                else updateField("age_restriction", "");
              }}
            >
              <SelectTrigger className="mt-1 bg-card border-border/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_ages">All Ages</SelectItem>
                <SelectItem value="18+">18+</SelectItem>
                <SelectItem value="21+">21+</SelectItem>
                <SelectItem value="custom">Custom Age</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!["all_ages","18+","21+"].includes(form.age_restriction) && (
            <div>
              <Label className="text-xs text-muted-foreground font-mono">Minimum Age *</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={form.age_restriction ? form.age_restriction.replace("+","") : ""}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "") { updateField("age_restriction", ""); return; }
                    const n = parseInt(v);
                    if (!isNaN(n) && n >= 1 && n <= 99) updateField("age_restriction", `${n}+`);
                  }}
                  placeholder="e.g. 16"
                  className="bg-card border-border/50"
                />
                <span className="text-muted-foreground font-mono text-sm">+</span>
              </div>
              {errors.age_restriction && <p className="text-xs text-destructive mt-1">{errors.age_restriction}</p>}
            </div>
          )}
        </div>

        {/* Dress Code — directly below Age Requirement */}
        <DressCodePicker
          value={form.dress_code}
          onChange={v => updateField("dress_code", v)}
          organizerId={currentUser?.id}
        />

        {/* Recurring Event — directly below Dress Code */}
        <RecurringEventSection
          enabled={isRecurring}
          onToggle={setIsRecurring}
          config={recurringConfig}
          onChange={(field, value) => {
            updateRecurringConfig(field, value);
            setErrors(prev => ({ ...prev, recurring_frequency: null, recurring_end_date: null, recurring_end_count: null }));
          }}
          todayMin={todayMin}
          errors={{
            frequency: errors.recurring_frequency,
            end_date: errors.recurring_end_date,
            end_count: errors.recurring_end_count,
          }}
        />
      </div>

      {/* Venue */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-border/30">
          <div className="w-1 h-5 rounded-full bg-accent" />
          <h3 className="font-display font-bold text-base text-accent">Venue</h3>
        </div>
        <div id="field-venue_name">
          <Label className="text-xs text-muted-foreground font-mono">Venue Name *</Label>
          <Input value={form.venue_name} onChange={e => updateField("venue_name", e.target.value)}
            placeholder="Enter venue name" className={`mt-1 bg-card border-border/50 text-sm ${errors.venue_name ? "border-destructive ring-1 ring-destructive/40" : ""}`} />
          {errors.venue_name && <p className="text-xs text-destructive mt-1">{errors.venue_name}</p>}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground font-mono">Address</Label>
          <Input value={form.venue_address} onChange={e => updateField("venue_address", e.target.value)}
            placeholder="Enter street address" className="mt-1 bg-card border-border/50" />
        </div>
        <div id="field-city">
          <LocationSelector
            value={{ country: form.country, state: form.venue_state, city: form.city }}
            onChange={handleLocationChange}
            errors={{ country: errors.country, state: errors.venue_state, city: errors.city }}
          />
        </div>
        <div id="field-zip_code">
          <Label className="text-xs text-muted-foreground font-mono">Zip Code *</Label>
          <Input value={form.zip_code} onChange={e => updateField("zip_code", e.target.value)}
            placeholder="Enter postal code" className={`mt-1 bg-card border-border/50 text-sm max-w-xs ${errors.zip_code ? "border-destructive ring-1 ring-destructive/40" : ""}`} />
          {errors.zip_code && <p className="text-xs text-destructive mt-1">{errors.zip_code}</p>}
        </div>
        <div id="field-total_capacity">
          <Label className="text-xs text-muted-foreground font-mono">Capacity *</Label>
          <Input type="number" value={form.total_capacity} onChange={e => updateField("total_capacity", e.target.value)}
            onFocus={e => e.target.select()}
            placeholder="0" className={`mt-1 bg-card border-border/50 ${errors.total_capacity ? "border-destructive ring-1 ring-destructive/40" : ""}`} />
          {errors.total_capacity && <p className="text-xs text-destructive mt-1">{errors.total_capacity}</p>}
        </div>
      </div>

      {/* WhatsApp Group */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
        <div className="flex items-center gap-3 pb-2 border-b border-border/30">
          <div className="w-1 h-5 rounded-full bg-accent" />
          <h3 className="font-display font-bold text-base text-accent">WhatsApp Group</h3>
        </div>
        <p className="text-xs text-muted-foreground font-mono">Attendees will see a "Join our WhatsApp group" button on the event page.</p>
        <Input
          value={form.whatsapp_link}
          onChange={e => updateField("whatsapp_link", e.target.value)}
          placeholder="https://chat.whatsapp.com/xxxxx  or  +1 234 567 8900"
          className="bg-card border-border/50"
        />
      </div>

      {/* Artists / Line-up */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-border/30">
          <div className="w-1 h-5 rounded-full bg-accent" />
          <div>
            <h3 className="font-display font-bold text-base text-accent">Artists / Line-up</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Add each artist, their set time, and social link</p>
          </div>
        </div>
        {artistDetails.map((artist, i) => (
          <div key={i} className="p-4 rounded-lg bg-card border border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">Artist {i + 1}</span>
              {artistDetails.length > 1 && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeArtist(i)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Name *</Label>
                <Input value={artist.name} onChange={e => updateArtist(i, "name", e.target.value)}
                  placeholder="DJ Name" className="mt-1 bg-secondary border-border/50 text-sm" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Set Time (24h)</Label>
                <TimeInput value={artist.performance_time} onChange={v => updateArtist(i, "performance_time", v)}
                  className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground font-mono">Social Media Link</Label>
              <Input value={artist.social_link} onChange={e => updateArtist(i, "social_link", e.target.value)}
                placeholder="https://instagram.com/djname" className="mt-1 bg-secondary border-border/50 text-sm" />
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addArtist} className="gap-2">
          <Plus className="w-3 h-3" /> Add Artist
        </Button>
      </div>

      {/* Event Type */}
      <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
        <div>
          <h3 className="font-display font-bold text-base px-3 py-1.5 bg-accent/20 text-accent rounded-md inline-block">Event Type</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Choose how attendees access this event.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={() => updateField("event_type", "ticketed")}
            className={`p-4 rounded-xl border text-left transition-all ${form.event_type === "ticketed" ? "border-primary bg-primary/10" : "border-border/50 bg-secondary hover:border-primary/40"}`}>
            <p className="font-display font-bold text-sm">🎟️ Ticketed Event</p>
            <p className="text-xs text-muted-foreground mt-1">Attendees purchase tickets (paid or free). Standard checkout flow.</p>
          </button>
          <button type="button" onClick={() => updateField("event_type", "rsvp_only")}
            className={`p-4 rounded-xl border text-left transition-all ${form.event_type === "rsvp_only" ? "border-accent bg-accent/10" : "border-border/50 bg-secondary hover:border-accent/40"}`}>
            <p className="font-display font-bold text-sm">📋 RSVP-Only Event</p>
            <p className="text-xs text-muted-foreground mt-1">Guest-list style — attendees request access, you approve and issue entry codes.</p>
          </button>
        </div>

        {form.event_type === "rsvp_only" && (
          <div className="space-y-4 pt-2 border-t border-border/30">
            <p className="text-xs text-accent font-mono font-bold uppercase tracking-widest">RSVP Settings</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground font-mono">RSVP Capacity</Label>
                <Input type="number" value={form.rsvp_capacity} onChange={e => updateField("rsvp_capacity", e.target.value)}
                  placeholder="100" className="mt-1 bg-secondary border-border/50 text-sm" />
                <p className="text-[10px] text-muted-foreground mt-0.5">Max approved RSVPs (0 = unlimited)</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-mono">Approval Mode</Label>
                <div className="mt-1 flex rounded-lg border border-border/50 overflow-hidden">
                  <button type="button" onClick={() => updateField("rsvp_approval_required", true)}
                    className={`flex-1 py-2 text-xs font-mono font-bold transition-all ${form.rsvp_approval_required ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground"}`}>
                    Manual
                  </button>
                  <button type="button" onClick={() => updateField("rsvp_approval_required", false)}
                    className={`flex-1 py-2 text-xs font-mono font-bold transition-all ${!form.rsvp_approval_required ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground"}`}>
                    Auto-approve
                  </button>
                </div>
              </div>

              {/* RSVP Opens */}
              <div>
                <Label className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> RSVP Opens — Date &amp; Time
                </Label>
                <label className="mt-1 flex items-center gap-2 w-full rounded-md bg-secondary border border-white/25 px-3 h-10 cursor-pointer hover:border-white/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring transition-colors group">
                  <Calendar className="w-4 h-4 text-muted-foreground group-focus-within:text-primary shrink-0" />
                  <input
                    type="datetime-local"
                    value={form.rsvp_start}
                    onChange={e => updateField("rsvp_start", e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none min-w-0 cursor-pointer text-foreground placeholder:text-muted-foreground"
                    placeholder="Select RSVP open date and time"
                  />
                </label>
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">📅 Tap to select when RSVP opens</p>
              </div>

              {/* RSVP Closes */}
              <div>
                <Label className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> RSVP Closes — Date &amp; Time
                </Label>
                <label className="mt-1 flex items-center gap-2 w-full rounded-md bg-secondary border border-white/25 px-3 h-10 cursor-pointer hover:border-white/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring transition-colors group">
                  <Clock className="w-4 h-4 text-muted-foreground group-focus-within:text-primary shrink-0" />
                  <input
                    type="datetime-local"
                    value={form.rsvp_end}
                    onChange={e => updateField("rsvp_end", e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none min-w-0 cursor-pointer text-foreground placeholder:text-muted-foreground"
                    placeholder="Select RSVP close date and time"
                  />
                </label>
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">🕐 Tap to select when RSVP closes</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ticket & Table Tiers Toggle */}
      {form.event_type === "ticketed" && (
      <div className="flex gap-3 border-b border-border/50 pb-4">
        <button className="font-display font-bold text-primary border-b-2 border-primary pb-1">Tickets & Tables</button>
      </div>
      )}

      {/* Ticket Tiers */}
      {form.event_type === "ticketed" && (<>
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-accent" />
            <h3 className="font-display font-bold text-base text-accent">Ticket Tiers</h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">Sell individual tickets</span>
        </div>

        {/* Currency selector — applies to all ticket tiers */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-secondary/60 border border-border/50">
          <Label className="text-xs text-muted-foreground font-mono shrink-0">Ticket Currency</Label>
          <Select value={ticketCurrency} onValueChange={setTicketCurrency}>
            <SelectTrigger className="bg-card border-border/50 text-sm h-9 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(c => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">All tiers use this currency</span>
        </div>

        {ticketTiers.map((tier, i) => (
          <div key={i} className="p-4 rounded-lg bg-card border border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">Tier {i + 1}</span>
              {ticketTiers.length > 1 && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTier(i)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Name</Label>
                <Input value={tier.name} onChange={e => updateTier(i, "name", e.target.value)}
                  placeholder="e.g. General Admission, VIP, Early Bird" className="mt-1 bg-secondary border-border/50 text-sm" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Type</Label>
                <Select value={tier.tier} onValueChange={v => updateTier(i, "tier", v)}>
                  <SelectTrigger className="mt-1 bg-secondary border-border/50 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {tier.tier === "custom" && (
                <div className="col-span-2">
                  <Label className="text-[10px] text-muted-foreground font-mono">Custom Tier Name *</Label>
                  <Input
                    value={tier.custom_tier_name || ""}
                    onChange={e => updateTier(i, "custom_tier_name", e.target.value.slice(0, 50))}
                    placeholder="e.g. Early Bird, Student Pass, Backstage, Ladies Free"
                    className="mt-1 bg-secondary border-border/50 text-sm"
                    maxLength={50}
                  />
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">This name will appear on tickets and in checkout.</p>
                </div>
              )}
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Price ({getCurrencySymbol(ticketCurrency)})</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  value={tier.price}
                  onChange={e => { if (/^(\d*\.?\d*)$/.test(e.target.value)) updateTier(i, "price", e.target.value); }}
                  onFocus={e => e.target.select()}
                  placeholder="0"
                  className="mt-1 bg-secondary border-border/50 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Quantity</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={tier.quantity}
                  onChange={e => { if (/^\d*$/.test(e.target.value)) updateTier(i, "quantity", e.target.value); }}
                  onFocus={e => e.target.select()}
                  placeholder="0"
                  className="mt-1 bg-secondary border-border/50 text-sm"
                />
              </div>
            </div>

            {/* Tickets-left visibility setting */}
            <div className="pt-2 border-t border-border/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">Show tickets left to buyers?</p>
                  <p className="text-[10px] text-muted-foreground font-mono">Controls whether remaining ticket count is visible on the event page</p>
                </div>
                <div className="flex rounded-md border border-border/50 overflow-hidden shrink-0">
                  <button type="button"
                    onClick={() => updateTier(i, "show_tickets_left", true)}
                    className={`px-3 py-1.5 text-[10px] font-mono font-bold transition-all ${tier.show_tickets_left ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                    Yes
                  </button>
                  <button type="button"
                    onClick={() => updateTier(i, "show_tickets_left", false)}
                    className={`px-3 py-1.5 text-[10px] font-mono font-bold transition-all ${!tier.show_tickets_left ? "bg-secondary text-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                    No
                  </button>
                </div>
              </div>
              {tier.show_tickets_left && (
                <div>
                  <Label className="text-[10px] text-muted-foreground font-mono">Show count only when tickets left are below:</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={tier.tickets_left_threshold}
                      onChange={e => { if (/^\d*$/.test(e.target.value)) updateTier(i, "tickets_left_threshold", e.target.value); }}
                      placeholder="e.g. 10"
                      className="bg-secondary border-border/50 text-sm w-28"
                    />
                    <p className="text-[10px] text-muted-foreground font-mono">Leave blank to always show the count</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addTier} className="gap-2">
          <Plus className="w-3 h-3" /> Add Tier
        </Button>
      </div>

      {/* Table Tiers */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-accent" />
            <h3 className="font-display font-bold text-base text-accent">Table Packages</h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">Sell reserved tables with guest count</span>
        </div>
        {tableTiers.map((tier, i) => (
          <div key={i} className="p-4 rounded-lg bg-card border border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">Table Package {i + 1}</span>
              {tableTiers.length > 0 && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTableTier(i)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Package Name *</Label>
                <Input value={tier.name} onChange={e => updateTableTier(i, "name", e.target.value)}
                  placeholder="e.g. VIP Booth, Birthday Table, Bottle Service" className="mt-1 bg-secondary border-border/50 text-sm" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Guests Per Table *</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={tier.guests_per_table}
                  onChange={e => { if (/^\d*$/.test(e.target.value)) updateTableTier(i, "guests_per_table", e.target.value); }}
                  placeholder="10"
                  className="mt-1 bg-secondary border-border/50 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Price ({getCurrencySymbol(ticketCurrency)}) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  value={tier.price}
                  onChange={e => { if (/^(\d*\.?\d*)$/.test(e.target.value)) updateTableTier(i, "price", e.target.value); }}
                  onFocus={e => e.target.select()}
                  placeholder="0"
                  className="mt-1 bg-secondary border-border/50 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Available Tables *</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={tier.quantity}
                  onChange={e => { if (/^\d*$/.test(e.target.value)) updateTableTier(i, "quantity", e.target.value); }}
                  onFocus={e => e.target.select()}
                  placeholder="0"
                  className="mt-1 bg-secondary border-border/50 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground font-mono">What's Included</Label>
              <textarea value={tier.description} onChange={e => updateTableTier(i, "description", e.target.value)}
                rows={2} placeholder="e.g. Premium seating, complimentary drinks, dedicated server..."
                className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm" />
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addTableTier} className="gap-2">
          <Plus className="w-3 h-3" /> Add Table Package
        </Button>
      </div>
      </>)}


      {/* Poll Setup */}
      <div className="rounded-xl bg-primary/15 border-2 border-primary/50 overflow-hidden shadow-lg shadow-primary/10">
        <button type="button" onClick={() => setPollEnabled(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/20 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-lg">📊</span>
            <div className="text-left">
              <p className="font-display font-bold text-sm text-foreground">Poll — Audience Voting</p>
              <p className="text-xs text-muted-foreground font-mono">Let fans vote on a question during the event</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${pollEnabled ? "bg-primary text-primary-foreground" : "bg-primary/30 text-primary"}`}>
              {pollEnabled ? "ENABLED" : "OFF"}
            </span>
            {pollEnabled ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />}
          </div>
        </button>

        {pollEnabled && (
          <div className="px-4 pb-4 space-y-3 border-t-2 border-primary/50 bg-primary/10">
            <div className="pt-3">
              <Label className="text-xs text-foreground font-mono font-bold">Poll Question *</Label>
              <Input value={poll.question} onChange={e => setPoll(p => ({ ...p, question: e.target.value }))}
                placeholder="e.g. What genre should the next set be?" className="mt-1 bg-card border border-primary/40" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-foreground font-mono font-bold">Option A *</Label>
                <Input value={poll.option_a} onChange={e => setPoll(p => ({ ...p, option_a: e.target.value }))}
                  placeholder="e.g. Techno" className="mt-1 bg-card border border-primary/40" />
              </div>
              <div>
                <Label className="text-xs text-foreground font-mono font-bold">Option B *</Label>
                <Input value={poll.option_b} onChange={e => setPoll(p => ({ ...p, option_b: e.target.value }))}
                  placeholder="e.g. House" className="mt-1 bg-card border border-primary/40" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-foreground font-mono font-bold">Poll Opens *</Label>
                <div className="mt-1 w-full overflow-hidden">
                  <input type="datetime-local" value={poll.start_datetime} onChange={e => setPoll(p => ({ ...p, start_datetime: e.target.value }))}
                    style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", WebkitAppearance: "none", appearance: "none", lineHeight: "normal" }}
                    className="h-9 w-full rounded-md border border-primary/40 bg-card px-3 py-0 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary" />
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs text-foreground font-mono font-bold">Poll Closes *</Label>
                <div className="mt-1 w-full overflow-hidden">
                  <input type="datetime-local" value={poll.end_datetime} onChange={e => setPoll(p => ({ ...p, end_datetime: e.target.value }))}
                   style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", WebkitAppearance: "none", appearance: "none", lineHeight: "normal" }}
                   className="h-9 w-full rounded-md border border-primary/40 bg-card px-3 py-0 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary" />
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">Poll will be created and linked to this event automatically on publish.</p>
          </div>
        )}
      </div>

      {/* Raffle — Random Draw */}
      <RaffleSetupCard value={raffleSetup} onChange={setRaffleSetup} />

      {/* Giveaway — First to Claim */}
      <GiveawaySetupCard value={giveawaySetup} onChange={setGiveawaySetup} />

      {/* Promo Codes */}
      <div className="p-5 rounded-xl bg-yellow-900/20 border-2 border-yellow-600/50 shadow-lg shadow-yellow-600/10">
        <PromoCodesSection
          promos={promoCodes}
          onChange={setPromoCodes}
          ticketTiers={ticketTiers}
        />
      </div>

      {/* Ticket Seller / Promoter Links */}
      <PromoterLinksSection links={promoterLinks} onChange={setPromoterLinks} />

      {/* Payment Settings — only for ticketed events */}
      {form.event_type === "rsvp_only" && (
        <div className="p-4 rounded-lg bg-accent/5 border border-accent/20 text-sm text-accent font-mono">
          📋 RSVP-only events don't require payment settings. Attendees request access and you approve them.
        </div>
      )}
      {form.event_type === "ticketed" && (
      <div className="p-4 rounded-lg bg-card border border-border/50 space-y-5">
        <h3 className="font-display font-bold text-lg px-3 py-1.5 bg-primary/20 text-primary rounded-md inline-block">Payment Settings</h3>

        {/* Organizer Extra Fee — moved to top */}
        <div className="space-y-2 pb-2 border-b border-border/30">
          <div>
            <p className="text-sm font-medium text-primary">Organizer Extra Fee</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">An additional per-ticket fee added to your payout. <strong>Never shown to buyers.</strong></p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground font-mono">Amount ({getCurrencySymbol(ticketCurrency)}) per ticket</Label>
              <Input
                type="number"
                value={form.organizer_extra_fee}
                onChange={e => updateField("organizer_extra_fee", e.target.value)}
                placeholder="0.00"
                className="mt-1 bg-secondary border-border/50 text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground font-mono">Internal label</Label>
              <Input
                value={form.organizer_extra_fee_label}
                onChange={e => updateField("organizer_extra_fee_label", e.target.value)}
                placeholder="e.g. Venue surcharge"
                className="mt-1 bg-secondary border-border/50 text-sm"
              />
            </div>
          </div>
          {form.organizer_extra_fee > 0 && (
            <p className="text-xs text-green-400 font-mono bg-green-400/10 px-3 py-2 rounded">
              ✓ {getCurrencySymbol(ticketCurrency)}{Number(form.organizer_extra_fee).toFixed(2)} extra per ticket will be added to your payout automatically.
            </p>
          )}
        </div>

        {/* Platform fee */}
        <div className="space-y-2 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-accent">Platform fee</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">Who absorbs the platform fee?</p>
            </div>
            <div className="flex rounded-lg border border-border/50 overflow-hidden shrink-0 w-full sm:w-auto">
              <button type="button" onClick={() => updateField("platform_fee_on_buyer", true)}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-mono font-bold transition-all ${form.platform_fee_on_buyer ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                Buyer pays
              </button>
              <button type="button" onClick={() => updateField("platform_fee_on_buyer", false)}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-mono font-bold transition-all ${!form.platform_fee_on_buyer ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                I absorb it
              </button>
            </div>
          </div>
          {form.platform_fee_on_buyer ? (
            <p className="text-xs text-muted-foreground font-mono bg-muted/40 px-3 py-2 rounded">
              ℹ Service fee will appear as a separate line item at checkout (e.g. "Ticket $50 + Service fee $5").
            </p>
          ) : (
            <p className="text-xs text-yellow-400 font-mono bg-yellow-400/10 px-3 py-2 rounded">
              ⚠ Service fee will be deducted from your payout. Buyers see the ticket price only.
            </p>
          )}
        </div>

        {/* CC fee */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-accent">Card Processing Fee (3%)</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">Who absorbs the 3% credit card processing fee?</p>
            </div>
            <div className="flex rounded-lg border border-border/50 overflow-hidden shrink-0 w-full sm:w-auto">
              <button type="button" onClick={() => updateField("cc_fee_on_buyer", true)}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-mono font-bold transition-all ${form.cc_fee_on_buyer ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                Buyer pays
              </button>
              <button type="button" onClick={() => updateField("cc_fee_on_buyer", false)}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-mono font-bold transition-all ${!form.cc_fee_on_buyer ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                I absorb it
              </button>
            </div>
          </div>
          {!form.cc_fee_on_buyer && (
            <p className="text-xs text-yellow-400 font-mono bg-yellow-400/10 px-3 py-2 rounded">
              ⚠ The 3% CC fee will be deducted from your payout, not shown to buyers.
            </p>
          )}
        </div>

        {/* Platform fee scale disclosure — at bottom */}
        <div className="mt-6 pt-4 border-t border-border/30">
          <PlatformFeeScale />
        </div>
      </div>
      )}

      {/* Media: Images + Video — Event Flyer */}
      <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
        <div className="space-y-3">
          <h3 className="font-display font-bold text-base px-3 py-1.5 bg-accent/20 text-accent rounded-md inline-block">Event Flyer</h3>
          <p className="text-xs text-muted-foreground mt-1 font-mono">Upload your event flyer image or video, or generate one with AI.</p>
        </div>

        {/* Current flyer preview with View / Edit / Delete / Add QR */}
        {(galleryImages[0] || teaserVideoUrl || aiGeneratedMedia) && (
          <div className="space-y-2">
            {aiGeneratedMedia && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-xs font-mono text-primary">
                <span className="shrink-0">✓</span>
                <span className="font-bold">Selected event {aiGeneratedMedia.type === "video" ? "video flyer" : "flyer"}</span>
                {aiGeneratedMedia.type === "video" && !galleryImages[0] && (
                  <span className="text-muted-foreground ml-1">— add a thumbnail image above to use as cover</span>
                )}
              </div>
            )}
            <FlyerPreviewActions
              url={galleryImages[0] || teaserVideoUrl}
              type={teaserVideoUrl && !galleryImages[0] ? "video" : "image"}
              qrUrl={createdEvent?.qr_code_url || null}
              onEdit={() => setShowAIFlyer(true)}
              onDelete={() => {
                setGalleryImages([]);
                setTeaserVideoUrl("");
                setAiGeneratedMedia(null);
              }}
              onQRSaved={(newUrl) => {
                setGalleryImages(prev => [newUrl, ...prev.filter((_, i) => i !== 0)]);
              }}
            />
          </div>
        )}

        <EventMediaUploader
          images={galleryImages}
          onImagesChange={setGalleryImages}
          videoUrl={teaserVideoUrl}
          onVideoChange={setTeaserVideoUrl}
          afterImages={
            !showAIFlyer ? (
              <Button
                type="button"
                onClick={handleOpenFlyer}
                className="w-full gap-2 bg-primary text-white hover:bg-primary/90 font-display font-bold glow-lime"
              >
                <Sparkles className="w-4 h-4" /> Create Flyer with AI
              </Button>
            ) : null
          }
        />

        {/* Inline AI Flyer Creator — LAST optional step */}
        {showAIFlyer && (
          <div className="border border-primary/30 rounded-xl p-4 bg-primary/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-mono text-xs text-primary uppercase tracking-widest font-bold">AI Flyer Studio</span>
              </div>
              <button
                onClick={() => setShowAIFlyer(false)}
                className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕ Close
              </button>
            </div>
            <AIFlyerCreator
              event={{ ...form, gallery_images: galleryImages }}
              artistDetails={artistDetails}
              mode="create"
              previewOnly={true}
              userRole={currentUser?.role}
              onFlyerSaved={(url, type) => {
                setAiGeneratedMedia({ url, type });
                if (type === "video") {
                  setTeaserVideoUrl(url);
                  if (!galleryImages[0]) {
                  }
                } else {
                  setGalleryImages(prev => [url, ...prev.filter(u => u !== url)]);
                }
                setShowAIFlyer(false);
                toast.success(type === "video"
                  ? "Video flyer selected! It will be saved when you publish the event."
                  : "Flyer selected! It will be saved when you publish the event.");
              }}
              onSkip={() => setShowAIFlyer(false)}
            />
          </div>
        )}
      </div>

      {/* Helper text — marketing assets only available after event is created */}
      <div className="flex items-start gap-3 p-5 rounded-xl bg-card border border-primary/30 text-sm text-foreground font-mono space-y-2">
        <span className="text-2xl leading-none shrink-0 mt-1">📲</span>
        <span>After you complete and save this event, the <span className="font-bold text-primary">QR code</span> and <span className="font-bold text-primary">shareable marketing link</span> will be available in the event details.</span>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-8">
        <Button onClick={handleSaveDraft} variant="outline" className="font-display font-bold">
          Save Draft
        </Button>
        <Button onClick={handlePreview} className="glow-lime font-display font-bold gap-2">
          <Eye className="w-4 h-4" /> Preview Post
        </Button>
      </div>
    </div>
  );
}