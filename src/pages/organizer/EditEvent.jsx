import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Trash2, Send, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import BackButton from "@/components/shared/BackButton";
import TimeInput from "@/components/ui/TimeInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { CURRENCIES, getCurrencySymbol } from "@/utils/currency";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { scrollToFirstError } from "@/utils/scrollToError";
import EventMediaUploader from "../../components/events/EventMediaUploader";
import PlatformFeeScale from "../../components/organizer/PlatformFeeScale";
import GenreSelector from "../../components/events/GenreSelector";
import AIFlyerCreator from "../../components/organizer/AIFlyerCreator";
import DressCodePicker from "../../components/organizer/DressCodePicker";
import RaffleSetupCard from "../../components/organizer/RaffleSetupCard";
import GiveawaySetupCard from "../../components/organizer/GiveawaySetupCard";
import FlyerPreviewActions from "../../components/organizer/FlyerPreviewActions";
import OrganizerPromoManager from "../../components/organizer/OrganizerPromoManager";
import PromoterLinksSection from "../../components/organizer/PromoterLinksSection";
import RecurringEventSection from "../../components/organizer/RecurringEventSection";
import EventDateTimeSection from "../../components/organizer/EventDateTimeSection";
import { detectTimezoneForLocation, getTimezoneLabel, convertLocalDateTimeBetweenTimezones } from "@/utils/timezoneUtils";
import { isEventPast } from "@/utils/eventUtils";
import LocationSelector from "@/components/shared/LocationSelector";

const TIERS = [
  { value: "early_bird", label: "Early Bird" },
  { value: "general", label: "General Admission" },
  { value: "vip", label: "VIP" },
  { value: "backstage", label: "Backstage" },
  { value: "free_rsvp", label: "Free RSVP" },
  { value: "custom", label: "Custom..." },
];

// Known default tier values — anything else is treated as a custom name
const DEFAULT_TIERS = new Set(["early_bird", "general", "vip", "backstage", "free_rsvp", "hidden"]);

export default function EditEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [eventStatus, setEventStatus] = useState("draft");
  const [galleryImages, setGalleryImages] = useState([]);
  const [teaserVideoUrl, setTeaserVideoUrl] = useState("");
  const [ticketTypes, setTicketTypes] = useState([]);
  const [ticketCurrency, setTicketCurrency] = useState("USD");
  const [tableTiers, setTableTiers] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Poll state
  const [pollEnabled, setPollEnabled] = useState(false);
  const [existingPoll, setExistingPoll] = useState(null);
  const [poll, setPoll] = useState({ question: "", option_a: "", option_b: "", start_datetime: "", end_datetime: "" });
  const [savingPoll, setSavingPoll] = useState(false);
  const [deletingPoll, setDeletingPoll] = useState(false);

  // Raffle & Giveaway state (separated)
  const [raffleSetup, setRaffleSetup] = useState(null);
  const [existingRaffleSetup, setExistingRaffleSetup] = useState(null);
  const [giveawaySetup, setGiveawaySetup] = useState(null);
  const [existingGiveawaySetup, setExistingGiveawaySetup] = useState(null);
  const [savingRaffle, setSavingRaffle] = useState(false);
  const [savingGiveaway, setSavingGiveaway] = useState(false);
  const [lastRaffleSavedAt, setLastRaffleSavedAt] = useState(null);
  const [lastGiveawaySavedAt, setLastGiveawaySavedAt] = useState(null);
  const [lastPollSavedAt, setLastPollSavedAt] = useState(null);

  // Recurring series state
  const [isRecurring, setIsRecurring] = useState(false);
  const [existingSeriesId, setExistingSeriesId] = useState(null);
  const [recurringConfig, setRecurringConfig] = useState({
    frequency: "weekly",
    end_condition: "by_count",
    end_date: "",
    end_after_occurrences: "",
  });
  const updateRecurringConfig = (field, value) => setRecurringConfig(p => ({ ...p, [field]: value }));

  const [showAIFlyer, setShowAIFlyer] = useState(false);
  const [errors, setErrors] = useState({});
  const [tierErrors, setTierErrors] = useState({}); // keyed by `${i}_name`, `${i}_price`, `${i}_quantity`
  const [touched, setTouched] = useState({});
  const [form, setForm] = useState({
  title: "", description: "", short_description: "", date: "", end_date: "",
  doors_open: "", venue_name: "", venue_address: "", zip_code: "", city: "", venue_state: "", country: "",
  genre: "electronic", age_restriction: "18+", total_capacity: "",
  cc_fee_on_buyer: true, platform_fee_on_buyer: true,
  organizer_extra_fee: "",
  organizer_extra_fee_label: "",
  whatsapp_link: "",
  qr_code_url: "",
  dress_code: "",
  event_timezone: "",
  });

  const [artistDetails, setArtistDetails] = useState([
    { name: "", performance_time: "", social_link: "" },
  ]);

  const [ticketTiers, setTicketTiers] = useState([
    { name: "General Admission", tier: "general", price: "", quantity: "", max_per_user: 4 },
  ]);

  useEffect(() => {
    Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.Event.filter({ id }, null, 1),
      base44.entities.TicketType.filter({ event_id: id }, "sort_order", 50),
      base44.entities.Table.filter({ event_id: id }, "sort_order", 50).catch(() => []),
      base44.entities.EventPoll.filter({ event_id: id }, null, 1).catch(() => []),
      base44.entities.EventRaffleSetup.filter({ event_id: id }, null, 1).catch(() => []),
      base44.entities.EventGiveawaySetup.filter({ event_id: id }, null, 1).catch(() => []),
    ]).then(async ([u, evs, tts, tables, polls, raffles, giveaways]) => {
      setCurrentUser(u);
      const ev = evs[0];
      if (!ev) { setLoading(false); return; }
      // Block direct URL access for organizers when the event is cancelled or has ended — admins bypass this.
      if (u?.role !== "admin" && (ev.status === "cancelled" || isEventPast(ev))) {
        toast.error("This event is cancelled or has ended. Event management is no longer available.");
        navigate(`/organizer/events/${id}`);
        return;
      }
      setEventStatus(ev.status || "draft");
      // Format dates for input
      const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 16) : "";
      setForm({
        title: ev.title || "",
        description: ev.description || "",
        short_description: ev.short_description || "",
        date: fmtDate(ev.date),
        end_date: fmtDate(ev.end_date),
        doors_open: ev.doors_open || "",
        venue_name: ev.venue_name || "",
        venue_address: ev.venue_address || "",
        zip_code: ev.zip_code || "",
        city: ev.city || "",
        venue_state: ev.venue_state || "",
        country: ev.country || "",
        genre: ev.genre || "electronic",
        age_restriction: ev.age_restriction || "18+",
        total_capacity: ev.total_capacity || "",
        cc_fee_on_buyer: ev.cc_fee_on_buyer !== false,
        platform_fee_on_buyer: ev.platform_fee_on_buyer !== false,
        organizer_extra_fee: ev.organizer_extra_fee ?? "",
        organizer_extra_fee_label: ev.organizer_extra_fee_label || "",
        whatsapp_link: ev.whatsapp_link || "",
        qr_code_url: ev.qr_code_url || "",
        dress_code: ev.dress_code || "",
        event_timezone: ev.event_timezone || "",
      });
      // Backward compat: if gallery_images exists use it, else seed from cover_image
      const imgs = ev.gallery_images?.length ? ev.gallery_images : (ev.cover_image ? [ev.cover_image] : []);
      setGalleryImages(imgs);
      setTeaserVideoUrl(ev.teaser_video_url || "");
      if (ev.artist_details?.length) {
        setArtistDetails(ev.artist_details);
      } else if (ev.artists?.length) {
        setArtistDetails(ev.artists.map(a => ({ name: a, performance_time: "", social_link: "" })));
      }
      if (tts.length) {
        setTicketTiers(tts.map(t => {
          const isCustom = t.tier && !DEFAULT_TIERS.has(t.tier);
          return {
            id: t.id,
            name: t.name,
            tier: isCustom ? "custom" : (t.tier || "general"),
            custom_tier_name: isCustom ? t.tier : "",
            price: t.price,
            quantity: t.quantity_total,
            max_per_user: t.max_per_user || 4,
            show_tickets_left: t.show_tickets_left === true,
            tickets_left_threshold: t.tickets_left_threshold ?? "",
          };
        }));
        // Load currency from first ticket type (all tiers share the same currency)
        if (tts[0].currency) setTicketCurrency(tts[0].currency);
      }
      setTicketTypes(tts);
      // Load table tiers
      if (tables.length) {
        setTableTiers(tables.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description || "",
          price: t.price || "",
          capacity: t.capacity || "",
          guests_per_table: t.guests_per_table || "",
          quantity_total: t.quantity_total || "",
        })));
        setTableData(tables);
      }
      // Load existing poll
      if (polls.length) {
        const p = polls[0];
        setExistingPoll(p);
        setPollEnabled(true);
        const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 16) : "";
        setPoll({
          question: p.question || "",
          option_a: p.option_a || (p.options?.[0] || ""),
          option_b: p.option_b || (p.options?.[1] || ""),
          start_datetime: fmtDate(p.start_datetime),
          end_datetime: fmtDate(p.end_datetime),
        });
      }
      // Load existing raffle setup
      if (raffles.length) {
        const r = raffles[0];
        setExistingRaffleSetup(r);
        const fmtD = (d) => d ? new Date(d).toISOString().slice(0, 16) : "";
        setRaffleSetup({
          title: r.title || "",
          prize_name: r.prize_name || "",
          prize_description: r.prize_description || "",
          num_winners: r.num_winners || 1,
          eligibility_action: r.eligibility_action || "ticket_purchase",
          eligibility_notes: r.eligibility_notes || "",
          prize_collection_instructions: r.prize_collection_instructions || "",
          start_datetime: fmtD(r.start_datetime),
          close_datetime: fmtD(r.close_datetime),
          draw_datetime: fmtD(r.draw_datetime),
        });
      }
      // Load existing giveaway setup
      if (giveaways.length) {
        const g = giveaways[0];
        setExistingGiveawaySetup(g);
        const fmtD = (d) => d ? new Date(d).toISOString().slice(0, 16) : "";
        setGiveawaySetup({
          title: g.title || "",
          reward_name: g.reward_name || "",
          reward_description: g.reward_description || "",
          total_quantity: g.total_quantity || "",
          eligibility_action: g.eligibility_action || "ticket_purchase",
          eligibility_notes: g.eligibility_notes || "",
          collection_instructions: g.collection_instructions || "",
          start_datetime: fmtD(g.start_datetime),
          end_datetime: fmtD(g.end_datetime),
        });
      }
      // Load recurring series if event belongs to one
      if (ev.recurring_series_id) {
        setExistingSeriesId(ev.recurring_series_id);
        setIsRecurring(true);
        const series = await base44.entities.RecurringSeries.get(ev.recurring_series_id).catch(() => null);
        if (series) {
          const fmtD = (d) => d ? new Date(d).toISOString().slice(0, 16) : "";
          setRecurringConfig({
            frequency: series.frequency || "weekly",
            end_condition: series.end_condition || "by_count",
            end_date: fmtD(series.end_date),
            end_after_occurrences: series.end_after_occurrences?.toString() || "",
          });
        }
      }

      setLoading(false);
    });
  }, [id]);

  const updateField = (field, value) => {
    setForm(p => ({ ...p, [field]: value }));
    setDirty(true);
    if (errors[field]) setErrors(e => ({ ...e, [field]: null }));
  };

  const blurField = (field) => {
    setTouched(t => ({ ...t, [field]: true }));
    // Validate single field on blur
    const errs = { ...errors };
    if (field === "title") {
      if (!form.title.trim()) errs.title = "Event title is required.";
      else delete errs.title;
    }
    if (field === "date") {
      if (!form.date) errs.date = "Please select an event date.";
      else delete errs.date;
    }
    if (field === "venue_name") {
      if (!form.venue_name.trim()) errs.venue_name = "Please select a venue.";
      else delete errs.venue_name;
    }
    if (field === "city") {
      if (!form.city.trim()) errs.city = "City is required.";
      else delete errs.city;
    }
    setErrors(errs);
  };

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

  const clearTierError = (i, field) => {
    const key = `${i}_${field}`;
    if (tierErrors[key]) setTierErrors(e => ({ ...e, [key]: null }));
  };

  const validate = () => {
    const errs = {};
    const tErrs = {};

    // Required core fields
    if (!form.title.trim()) errs.title = "Event title is required.";
    if (!form.date) errs.date = "Please select an event date.";
    else if (new Date(form.date) < new Date(Date.now() - 60000)) errs.date = "Event date cannot be in the past.";
    if (form.end_date && form.date && form.end_date < form.date)
      errs.end_date = "End date must be the same as or after the start date.";
    if (!form.venue_name.trim()) errs.venue_name = "Please select a venue.";
    if (!form.country?.trim()) errs.country = "Country is required.";
    if (!form.venue_state?.trim()) errs.venue_state = "State/Region is required.";
    if (!form.city.trim()) errs.city = "City is required.";
    if (!form.zip_code?.trim()) errs.zip_code = "Zip code is required.";
    if (!form.end_date) errs.end_date = "End date is required.";
    // Capacity is always required
    if (!form.total_capacity || Number(form.total_capacity) < 1) {
      errs.total_capacity = "Capacity is required.";
    }
    // Ticket capacity vs tiers
    if (form.total_capacity) {
      const cap = Number(form.total_capacity);
      if (cap > 0) {
        const totalTickets = ticketTiers.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
        if (totalTickets > cap) {
          errs.total_capacity = `Total ticket quantity (${totalTickets}) cannot exceed event capacity of ${cap}.`;
        }
      }
    }

    // Ticket tier validation — only tiers that have any data filled in
    ticketTiers.forEach((t, i) => {
      const hasAnyData = t.name || t.price !== "" || t.quantity !== "";
      if (!hasAnyData) return; // skip completely empty tiers
      if (!t.name?.trim()) tErrs[`${i}_name`] = "Ticket name is required.";
      if (t.price === "" || t.price === undefined || t.price === null) {
        tErrs[`${i}_price`] = "Ticket price is required.";
      } else if (Number(t.price) < 0) {
        tErrs[`${i}_price`] = "Ticket price must be 0 or greater.";
      }
      if (t.quantity === "" || t.quantity === undefined || t.quantity === null) {
        tErrs[`${i}_quantity`] = "Ticket capacity is required.";
      } else if (Number(t.quantity) < 1) {
        tErrs[`${i}_quantity`] = "Ticket capacity must be at least 1.";
      }
      if (t.tier === "custom" && !t.custom_tier_name?.trim()) {
        tErrs[`${i}_custom_tier_name`] = "Custom tier name is required.";
      }
    });

    // Recurring event validations (only for new series, not existing)
    if (isRecurring && !existingSeriesId) {
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
    setTierErrors(tErrs);

    const allErrs = { ...errs };
    // Map first tier error to a scrollable anchor
    const firstTierErrKey = Object.keys(tErrs)[0];
    if (firstTierErrKey) {
      const idx = parseInt(firstTierErrKey.split("_")[0]);
      allErrs[`tier_${idx}`] = true;
    }

    if (Object.keys(errs).length > 0 || Object.keys(tErrs).length > 0) {
      scrollToFirstError(Object.keys(errs).length > 0 ? errs : { [`tier_${firstTierErrKey?.split("_")[0]}`]: true });
      // Also scroll to first tier error by id
      if (Object.keys(errs).length === 0 && firstTierErrKey) {
        const idx = parseInt(firstTierErrKey.split("_")[0]);
        const el = document.getElementById(`tier-row-${idx}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return false;
    }
    return true;
  };

  const updateArtist = (i, field, value) => {
    const updated = [...artistDetails];
    updated[i] = { ...updated[i], [field]: value };
    setArtistDetails(updated);
    setDirty(true);
  };
  const addArtist = () => { setArtistDetails([...artistDetails, { name: "", performance_time: "", social_link: "" }]); setDirty(true); };
  const removeArtist = (i) => { setArtistDetails(artistDetails.filter((_, idx) => idx !== i)); setDirty(true); };

  const updateTier = (i, field, value) => {
    const updated = [...ticketTiers];
    updated[i] = { ...updated[i], [field]: value };
    if (field === "tier" && value !== "custom") updated[i].custom_tier_name = "";
    setTicketTiers(updated);
    setDirty(true);
  };
  const addTier = () => { setTicketTiers([...ticketTiers, { name: "", tier: "general", price: "", quantity: "", max_per_user: 4, custom_tier_name: "" }]); setDirty(true); };
  const removeTier = (i) => { setTicketTiers(ticketTiers.filter((_, idx) => idx !== i)); setDirty(true); };

  const updateTableTier = (i, field, value) => {
    const updated = [...tableTiers];
    updated[i] = { ...updated[i], [field]: value };
    setTableTiers(updated);
    setDirty(true);
  };
  const addTableTier = () => { setTableTiers([...tableTiers, { name: "", description: "", price: "", capacity: "", guests_per_table: "", quantity_total: "" }]); setDirty(true); };
  const removeTableTier = (i) => { setTableTiers(tableTiers.filter((_, idx) => idx !== i)); setDirty(true); };

  const handleSavePoll = async () => {
    if (!poll.question.trim()) { toast.error("Poll question is required"); return; }
    if (!poll.option_a.trim() || !poll.option_b.trim()) { toast.error("Both answer options are required"); return; }
    if (!poll.start_datetime || !poll.end_datetime) { toast.error("Poll start and end date/time are required"); return; }
    if (new Date(poll.end_datetime) <= new Date(poll.start_datetime)) { toast.error("End date must be after start date"); return; }
    setSavingPoll(true);
    const data = {
      event_id: id,
      question: poll.question,
      option_a: poll.option_a,
      option_b: poll.option_b,
      options: [poll.option_a, poll.option_b],
      votes_a: existingPoll?.votes_a || 0,
      votes_b: existingPoll?.votes_b || 0,
      vote_counts: existingPoll?.vote_counts || [0, 0],
      start_datetime: new Date(poll.start_datetime).toISOString(),
      end_datetime: new Date(poll.end_datetime).toISOString(),
      status: "upcoming",
    };
    try {
      if (existingPoll) {
        await base44.entities.EventPoll.update(existingPoll.id, data);
        toast.success(`Poll saved successfully to "${form.title}".`);
      } else {
        const user = currentUser || await base44.auth.me().catch(() => null);
        const created = await base44.entities.EventPoll.create({ ...data, organizer_id: user?.id, event_title: form.title });
        setExistingPoll(created);
        toast.success(`Poll saved successfully to "${form.title}".`);
      }
      setLastPollSavedAt(new Date());
    } catch {
      toast.error("Failed to save the poll. Please try again.");
    } finally {
      setSavingPoll(false);
    }
  };

  const handleDeletePoll = async () => {
    if (!existingPoll) { setPollEnabled(false); return; }
    setDeletingPoll(true);
    await base44.entities.EventPoll.delete(existingPoll.id);
    setExistingPoll(null);
    setPollEnabled(false);
    setPoll({ question: "", option_a: "", option_b: "", start_datetime: "", end_datetime: "" });
    setDeletingPoll(false);
    toast.success("Poll deleted");
  };

  const handleSaveRaffle = async () => {
    if (!raffleSetup || !raffleSetup.title?.trim() || !raffleSetup.prize_name?.trim()) {
      toast.error("Raffle title and prize name are required"); return;
    }
    setSavingRaffle(true);
    const user = currentUser || await base44.auth.me().catch(() => null);
    const data = {
      event_id: id, event_title: form.title, organizer_id: user?.id,
      title: raffleSetup.title, prize_name: raffleSetup.prize_name,
      prize_description: raffleSetup.prize_description || "",
      num_winners: Number(raffleSetup.num_winners) || 1,
      eligibility_action: raffleSetup.eligibility_action || "ticket_purchase",
      eligibility_notes: raffleSetup.eligibility_notes || "",
      prize_collection_instructions: raffleSetup.prize_collection_instructions || "",
      start_datetime: raffleSetup.start_datetime ? new Date(raffleSetup.start_datetime).toISOString() : undefined,
      close_datetime: raffleSetup.close_datetime ? new Date(raffleSetup.close_datetime).toISOString() : undefined,
      draw_datetime: raffleSetup.draw_datetime ? new Date(raffleSetup.draw_datetime).toISOString() : undefined,
    };
    try {
      if (existingRaffleSetup) {
        await base44.entities.EventRaffleSetup.update(existingRaffleSetup.id, data);
      } else {
        const created = await base44.entities.EventRaffleSetup.create({ ...data, status: "upcoming", total_entries: 0 });
        setExistingRaffleSetup(created);
      }
      toast.success(`Saved successfully to "${raffleSetup.title}".`);
      setLastRaffleSavedAt(new Date());
    } catch {
      toast.error("Failed to save the raffle. Please try again.");
    } finally {
      setSavingRaffle(false);
    }
  };

  const handleSaveGiveaway = async () => {
    if (!giveawaySetup || !giveawaySetup.title?.trim() || !giveawaySetup.reward_name?.trim() || !giveawaySetup.total_quantity) {
      toast.error("Giveaway title, reward name and quantity are required"); return;
    }
    setSavingGiveaway(true);
    const user = currentUser || await base44.auth.me().catch(() => null);
    const data = {
      event_id: id, event_title: form.title, organizer_id: user?.id,
      title: giveawaySetup.title, reward_name: giveawaySetup.reward_name,
      reward_description: giveawaySetup.reward_description || "",
      total_quantity: Number(giveawaySetup.total_quantity),
      eligibility_action: giveawaySetup.eligibility_action || "ticket_purchase",
      eligibility_notes: giveawaySetup.eligibility_notes || "",
      collection_instructions: giveawaySetup.collection_instructions || "",
      start_datetime: giveawaySetup.start_datetime ? new Date(giveawaySetup.start_datetime).toISOString() : undefined,
      end_datetime: giveawaySetup.end_datetime ? new Date(giveawaySetup.end_datetime).toISOString() : undefined,
    };
    try {
      if (existingGiveawaySetup) {
        await base44.entities.EventGiveawaySetup.update(existingGiveawaySetup.id, data);
      } else {
        const created = await base44.entities.EventGiveawaySetup.create({ ...data, status: "upcoming", claimed_quantity: 0 });
        setExistingGiveawaySetup(created);
      }
      toast.success(`Saved successfully to "${giveawaySetup.title}".`);
      setLastGiveawaySavedAt(new Date());
    } catch {
      toast.error("Failed to save the giveaway. Please try again.");
    } finally {
      setSavingGiveaway(false);
    }
  };

  // Core save — shared by "Save Changes" and "Publish"
  const saveEventData = async (overrideStatus = null) => {
    const missingCustomName = ticketTiers.some(t => t.tier === "custom" && !t.custom_tier_name?.trim());
    if (missingCustomName) {
      toast.error("Please enter a name for each custom ticket tier.");
      return false;
    }
    const validArtists = artistDetails.filter(a => a.name.trim());
    const prices = ticketTiers.filter(t => t.price).map(t => Number(t.price));

    const updateData = {
      ...form,
      total_capacity: form.total_capacity ? Number(form.total_capacity) : 0,
      organizer_extra_fee: form.organizer_extra_fee !== "" ? Number(form.organizer_extra_fee) : 0,
      cover_image: galleryImages[0] || "",
      gallery_images: galleryImages,
      teaser_video_url: teaserVideoUrl || "",
      artists: validArtists.map(a => a.name),
      artist_details: validArtists,
      min_price: prices.length ? Math.min(...prices) : 0,
      max_price: prices.length ? Math.max(...prices) : 0,
      currency: ticketCurrency,
    };

    // Apply status override (e.g. "published") — this allows cancelled events to be re-published
    if (overrideStatus) {
      updateData.status = overrideStatus;
      if (overrideStatus === "published") updateData.published_at = new Date().toISOString();
    }

    await base44.entities.Event.update(id, updateData);

    // Create recurring series if newly enabled (not yet part of one)
    if (isRecurring && !existingSeriesId && recurringConfig.frequency) {
      const user = currentUser || await base44.auth.me().catch(() => null);
      const durationMs = form.end_date && form.date
        ? new Date(form.end_date) - new Date(form.date)
        : 4 * 60 * 60 * 1000;
      const series = await base44.entities.RecurringSeries.create({
        organizer_id: user?.id,
        organizer_name: user?.full_name,
        title: form.title,
        frequency: recurringConfig.frequency,
        start_date: new Date(form.date).toISOString(),
        event_duration_minutes: Math.round(durationMs / 60000),
        end_condition: recurringConfig.end_condition,
        end_date: recurringConfig.end_condition === "by_date" && recurringConfig.end_date
          ? new Date(recurringConfig.end_date).toISOString() : undefined,
        end_after_occurrences: recurringConfig.end_condition === "by_count"
          ? Number(recurringConfig.end_after_occurrences) : undefined,
        template_event_id: id,
        total_occurrences_generated: 1,
        status: "active",
      }).catch(() => null);
      if (series) {
        await base44.entities.Event.update(id, { recurring_series_id: series.id, occurrence_index: 0 }).catch(() => {});
        setExistingSeriesId(series.id);
      }
    }

    // Update / create ticket types
    for (let i = 0; i < ticketTiers.length; i++) {
      const t = ticketTiers[i];
      if (!t.name || !t.price || !t.quantity) continue;
      const resolvedTier = t.tier === "custom" ? (t.custom_tier_name?.trim() || "custom") : t.tier;
      const ticketsLeftData = {
        show_tickets_left: t.show_tickets_left === true,
        tickets_left_threshold: t.tickets_left_threshold ? Number(t.tickets_left_threshold) : null,
      };
      if (t.id) {
        await base44.entities.TicketType.update(t.id, {
          name: t.name, tier: resolvedTier,
          price: Number(t.price), currency: ticketCurrency,
          quantity_total: Number(t.quantity),
          max_per_user: t.max_per_user || 4, sort_order: i,
          ...ticketsLeftData,
        });
      } else {
        await base44.entities.TicketType.create({
          event_id: id, name: t.name, tier: resolvedTier,
          price: Number(t.price), currency: ticketCurrency,
          quantity_total: Number(t.quantity),
          max_per_user: t.max_per_user || 4, status: "active", sort_order: i,
          ...ticketsLeftData,
        });
      }
    }

    // Save table tiers
    for (let i = 0; i < tableTiers.length; i++) {
      const t = tableTiers[i];
      if (!t.name || !t.price) continue;
      if (t.id) {
        await base44.entities.Table.update(t.id, {
          name: t.name, description: t.description || "",
          price: Number(t.price), capacity: t.capacity ? Number(t.capacity) : 0,
          guests_per_table: t.guests_per_table ? Number(t.guests_per_table) : 1,
          quantity_total: t.quantity_total ? Number(t.quantity_total) : 1,
          sort_order: i,
        });
      } else {
        await base44.entities.Table.create({
          event_id: id, name: t.name, description: t.description || "",
          price: Number(t.price), capacity: t.capacity ? Number(t.capacity) : 0,
          guests_per_table: t.guests_per_table ? Number(t.guests_per_table) : 1,
          quantity_total: t.quantity_total ? Number(t.quantity_total) : 1,
          sort_order: i, status: "available",
        });
      }
    }

    // Notify existing ticket holders of the update (only if there are active tickets)
    try {
      const activeTickets = await base44.entities.Ticket.filter({ event_id: id, status: "active" }, null, 500);
      const uniqueEmails = [...new Set(activeTickets.map(t => t.owner_email))];
      if (uniqueEmails.length > 0) {
        const dateStr = form.date ? new Date(form.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "TBA";
        const subject = `Event Updated: ${form.title}`;
        const body = `Hi,\n\nThe details for "${form.title}" have been updated.\n\nDate: ${dateStr}\nDoors: ${form.doors_open || "Check event page"}\nVenue: ${form.venue_name}, ${form.city}\n\nView event: ${window.location.origin}/events/${id}`;
        await Promise.all(uniqueEmails.map(email =>
          Promise.all([
            base44.integrations.Core.SendEmail({ to: email, subject, body }),
            base44.entities.Notification.create({
              user_email: email,
              title: `Event Updated: ${form.title}`,
              message: `Details for "${form.title}" have changed. Check your tickets.`,
              type: "event_update",
              event_id: id,
              event_title: form.title,
              link: `/events/${id}`,
            }),
          ]).catch(err => console.error(`[EditEvent] Failed to notify ${email}:`, err.message))
        ));
      }
    } catch (err) {
      console.error("[EditEvent] Could not fetch ticket holders for notification:", err.message);
    }

    return true;
  };

  // Save without publishing (keeps existing status)
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await saveEventData(null);
    setSaving(false);
    setDirty(false);
    toast.success("Event media updated successfully.");
    navigate(`/organizer/events/${id}`);
  };

  // Validate that date is in the future before publishing
  const validateForPublish = () => {
    if (!validate()) return false;
    return true;
  };

  // Publish — saves all data AND sets status to "published" (works for cancelled events too)
  const handlePublish = async () => {
    if (!validateForPublish()) return;
    setPublishing(true);
    const ok = await saveEventData("published");
    setPublishing(false);
    if (ok) {
      setDirty(false);
      toast.success("Event published successfully!");
      navigate(`/organizer/events/${id}`);
    }
  };

  const handleCancel = () => {
    if (dirty) {
      setShowCancelConfirm(true);
    } else {
      navigate(`/organizer/events/${id}`);
    }
  };

  // Warn on browser back/refresh when there are unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl w-full overflow-x-hidden pb-24 sm:pb-8">
      <div>
        <BackButton to={`/organizer/events/${id}`} label="Back to Event" />
        <h1 className="font-display font-black text-4xl tracking-tight mt-2" style={{ wordSpacing: '0.3em' }}>EDIT EVENT</h1>
        <p className="text-sm text-muted-foreground mt-1">Update your event details</p>
      </div>

      {/* Media: Flyer Image + Video */}
      <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
        <div>
          <h3 className="font-display font-bold text-base px-3 py-1.5 bg-accent/20 text-accent rounded-md inline-block">Flyer Image</h3>
          <div className="p-4 rounded-lg bg-secondary/60 border border-accent/30">
            <p className="text-sm text-foreground font-mono leading-relaxed">Enter all the necessary event information below, then come back here to generate a flyer using the details you chose.</p>
          </div>
        </div>

        {/* Current flyer preview with View / Edit / Delete / Add QR */}
        {(galleryImages[0] || teaserVideoUrl) && (
          <FlyerPreviewActions
            url={galleryImages[0] || teaserVideoUrl}
            type={teaserVideoUrl && !galleryImages[0] ? "video" : "image"}
            label={teaserVideoUrl && !galleryImages[0] ? "Video flyer" : "Active cover image"}
            qrUrl={form.qr_code_url || null}
            onEdit={() => setShowAIFlyer(true)}
            onDelete={() => {
              setGalleryImages([]);
              setTeaserVideoUrl("");
              setDirty(true);
            }}
            onQRSaved={(newUrl) => {
              setGalleryImages(prev => [newUrl, ...prev.filter((_, i) => i !== 0)]);
              setDirty(true);
            }}
          />
        )}

        <EventMediaUploader
          images={galleryImages}
          onImagesChange={(urls) => { setGalleryImages(urls); setDirty(true); }}
          videoUrl={teaserVideoUrl}
          onVideoChange={(url) => { setTeaserVideoUrl(url); setDirty(true); }}
          eventId={id}
          afterImages={
            !showAIFlyer ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAIFlyer(true)}
                className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/10 font-display font-bold"
              >
                <Sparkles className="w-4 h-4" /> Create / Update Flyer with AI
              </Button>
            ) : null
          }
        />

        {/* Inline AI Flyer Creator */}
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
                Close
              </button>
            </div>
            <AIFlyerCreator
              event={{ id, ...form, gallery_images: galleryImages }}
              artistDetails={artistDetails}
              mode="edit"
              userRole={currentUser?.role}
              onFlyerSaved={(url, type) => {
                setGalleryImages(prev => [url, ...prev.filter(u => u !== url)]);
                setShowAIFlyer(false);
                setDirty(true);
                toast.success("Flyer saved to this event successfully.");
              }}
              onSkip={() => setShowAIFlyer(false)}
            />
          </div>
        )}
      </div>

      {/* Event Details */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-border/30">
          <div className="w-1 h-5 rounded-full bg-accent" />
          <h3 className="font-display font-bold text-base text-accent">Event Details</h3>
        </div>
        <div id="field-title">
            <Label className="text-xs text-muted-foreground font-mono">Title *</Label>
            <Input value={form.title} onChange={e => updateField("title", e.target.value)}
              onBlur={() => blurField("title")}
              placeholder="Event title" className={`mt-1 bg-card border-border/50 ${errors.title ? "border-destructive ring-1 ring-destructive/40" : ""}`} />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>
        <div>
          <Label className="text-xs text-muted-foreground font-mono">Description</Label>
          <textarea value={form.description} onChange={e => updateField("description", e.target.value)}
            rows={5} placeholder="Tell your audience what to expect..."
            className="mt-1 w-full rounded-md bg-card border border-border/50 px-3 py-2 text-sm" />
        </div>

        {/* Dress Code */}
        <DressCodePicker
          value={form.dress_code}
          onChange={v => updateField("dress_code", v)}
          organizerId={currentUser?.id}
        />

        {/* Recurring Event */}
        {existingSeriesId ? (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-xs text-white font-mono">
            🔁 This event is part of a recurring series. To manage the full series, visit the series organizer settings.
          </div>
        ) : (
          <RecurringEventSection
            enabled={isRecurring}
            onToggle={setIsRecurring}
            config={recurringConfig}
            onChange={(field, value) => {
              updateRecurringConfig(field, value);
              setErrors(prev => ({ ...prev, recurring_frequency: null, recurring_end_date: null, recurring_end_count: null }));
            }}
            todayMin={new Date().toISOString().slice(0, 16)}
            errors={{
              frequency: errors.recurring_frequency,
              end_date: errors.recurring_end_date,
              end_count: errors.recurring_end_count,
            }}
          />
        )}

        <div id="field-date">
          <EventDateTimeSection
            startValue={form.date}
            endValue={form.end_date}
            todayMin={new Date().toISOString().slice(0, 16)}
            startError={errors.date}
            endError={errors.end_date}
            timezoneLabel={getTimezoneLabel(form.event_timezone, form.date)}
            onStartChange={(newDate) => {
              updateField("date", newDate);
              blurField("date");
              if (form.end_date && newDate && form.end_date < newDate) {
                updateField("end_date", "");
                setErrors(er => ({ ...er, end_date: "End date must be the same as or after the start date." }));
              } else {
                setErrors(er => ({ ...er, end_date: null }));
              }
            }}
            onEndChange={(newEnd) => {
              if (form.date && newEnd && newEnd < form.date) {
                setErrors(er => ({ ...er, end_date: "End date must be the same as or after the start date." }));
                return;
              }
              updateField("end_date", newEnd);
              setErrors(er => ({ ...er, end_date: null }));
            }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground font-mono">Doors Open</Label>
            <TimeInput ampm value={form.doors_open} onChange={v => updateField("doors_open", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground font-mono">Genre *</Label>
            <GenreSelector value={form.genre} onChange={v => updateField("genre", v)} />
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
            </div>
          )}
        </div>
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
            onBlur={() => blurField("venue_name")}
            placeholder="Enter venue name" className={`mt-1 bg-card border-border/50 ${errors.venue_name ? "border-destructive ring-1 ring-destructive/40" : ""}`} />
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
            placeholder="Enter postal code" className={`mt-1 bg-card border-border/50 max-w-xs ${errors.zip_code ? "border-destructive ring-1 ring-destructive/40" : ""}`} />
          {errors.zip_code && <p className="text-xs text-destructive mt-1">{errors.zip_code}</p>}
        </div>
        <div id="field-total_capacity">
          <Label className="text-xs text-muted-foreground font-mono">Capacity *</Label>
          <Input type="number" value={form.total_capacity} onChange={e => updateField("total_capacity", e.target.value)}
            placeholder="Enter capacity" className={`mt-1 bg-card border-border/50 ${errors.total_capacity ? "border-destructive ring-1 ring-destructive/40" : ""}`} />
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

      {/* Artists */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-border/30">
          <div className="w-1 h-5 rounded-full bg-accent" />
          <div>
            <h3 className="font-display font-bold text-base text-accent">Artists / Line-up</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Name, set time, and optional social link</p>
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
                <Label className="text-[10px] text-muted-foreground font-mono">Set Time</Label>
                <Input value={artist.performance_time} onChange={e => updateArtist(i, "performance_time", e.target.value)}
                  placeholder="22:00" className="mt-1 bg-secondary border-border/50 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground font-mono">Social Media Link (optional)</Label>
              <Input value={artist.social_link} onChange={e => updateArtist(i, "social_link", e.target.value)}
                placeholder="https://instagram.com/djname" className="mt-1 bg-secondary border-border/50 text-sm" />
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addArtist} className="gap-2">
          <Plus className="w-3 h-3" /> Add Artist
        </Button>
      </div>

      {/* Ticket Tiers */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-border/30">
          <div className="w-1 h-5 rounded-full bg-accent" />
          <h3 className="font-display font-bold text-base text-accent">Ticket Tiers</h3>
        </div>

        {/* Currency selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-secondary/60 border border-border/50">
          <Label className="text-xs text-muted-foreground font-mono shrink-0">Ticket Currency</Label>
          <Select value={ticketCurrency} onValueChange={setTicketCurrency}>
            <SelectTrigger className="bg-card border-border/50 text-sm h-9 w-full sm:flex-1 sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(c => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="font-mono text-xs text-muted-foreground">All tiers use this currency</span>
        </div>

        {ticketTiers.map((tier, i) => (
          <div key={i} id={`tier-row-${i}`} className="p-4 rounded-lg bg-card border border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">Tier {i + 1}</span>
              {ticketTiers.length > 1 && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTier(i)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Name</Label>
                <Input value={tier.name} onChange={e => { updateTier(i, "name", e.target.value); clearTierError(i, "name"); }}
                  onBlur={() => { if (!tier.name?.trim() && (tier.price !== "" || tier.quantity !== "")) setTierErrors(e => ({ ...e, [`${i}_name`]: "Ticket name is required." })); }}
                  placeholder="e.g. General Admission, VIP, Early Bird"
                  className={`mt-1 bg-secondary border-border/50 text-sm ${tierErrors[`${i}_name`] ? "border-destructive ring-1 ring-destructive/40" : ""}`} />
                {tierErrors[`${i}_name`] && <p className="text-xs text-destructive mt-1">{tierErrors[`${i}_name`]}</p>}
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
                    onChange={e => { updateTier(i, "custom_tier_name", e.target.value.slice(0, 50)); clearTierError(i, "custom_tier_name"); }}
                    placeholder="e.g. Early Bird, Student Pass, Backstage, Ladies Free"
                    className={`mt-1 bg-secondary border-border/50 text-sm ${tierErrors[`${i}_custom_tier_name`] ? "border-destructive ring-1 ring-destructive/40" : ""}`}
                    maxLength={50}
                  />
                  {tierErrors[`${i}_custom_tier_name`]
                    ? <p className="text-xs text-destructive mt-0.5">{tierErrors[`${i}_custom_tier_name`]}</p>
                    : <p className="text-[10px] text-muted-foreground font-mono mt-0.5">This name will appear on tickets and in checkout.</p>
                  }
                </div>
              )}
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Price ({getCurrencySymbol(ticketCurrency)})</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  value={tier.price}
                  onChange={e => { if (/^(\d*\.?\d*)$/.test(e.target.value)) { updateTier(i, "price", e.target.value); clearTierError(i, "price"); } }}
                  onBlur={() => {
                    if (tier.price === "" || tier.price === undefined) setTierErrors(e => ({ ...e, [`${i}_price`]: "Ticket price is required." }));
                    else if (Number(tier.price) < 0) setTierErrors(e => ({ ...e, [`${i}_price`]: "Ticket price must be 0 or greater." }));
                    else clearTierError(i, "price");
                  }}
                  placeholder="50"
                  className={`mt-1 bg-secondary border-border/50 text-sm ${tierErrors[`${i}_price`] ? "border-destructive ring-1 ring-destructive/40" : ""}`}
                />
                {tierErrors[`${i}_price`] && <p className="text-xs text-destructive mt-1">{tierErrors[`${i}_price`]}</p>}
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Quantity</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={tier.quantity}
                  onChange={e => { if (/^\d*$/.test(e.target.value)) { updateTier(i, "quantity", e.target.value); clearTierError(i, "quantity"); } }}
                  onBlur={() => {
                    if (tier.quantity === "" || tier.quantity === undefined) setTierErrors(e => ({ ...e, [`${i}_quantity`]: "Ticket capacity is required." }));
                    else if (Number(tier.quantity) < 1) setTierErrors(e => ({ ...e, [`${i}_quantity`]: "Ticket capacity must be at least 1." }));
                    else clearTierError(i, "quantity");
                  }}
                  placeholder="200"
                  className={`mt-1 bg-secondary border-border/50 text-sm ${tierErrors[`${i}_quantity`] ? "border-destructive ring-1 ring-destructive/40" : ""}`}
                />
                {tierErrors[`${i}_quantity`] && <p className="text-xs text-destructive mt-1">{tierErrors[`${i}_quantity`]}</p>}
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

      {/* Table / VIP Tiers */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-border/30">
          <div className="w-1 h-5 rounded-full bg-accent" />
          <div>
            <h3 className="font-display font-bold text-base text-accent">Table / VIP Reservations</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Optional — add VIP table packages for this event</p>
          </div>
        </div>
        {tableTiers.map((table, i) => (
          <div key={i} className="p-4 rounded-lg bg-card border border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">Table {i + 1}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTableTier(i)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Name</Label>
                <Input value={table.name} onChange={e => updateTableTier(i, "name", e.target.value)}
                  placeholder="e.g. VIP Booth, Birthday Table, Bottle Service" className="mt-1 bg-secondary border-border/50 text-sm" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Guests per Table *</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={table.guests_per_table}
                  onChange={e => { if (/^\d*$/.test(e.target.value)) updateTableTier(i, "guests_per_table", e.target.value); }}
                  placeholder="e.g. 10"
                  className="mt-1 bg-secondary border-border/50 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Quantity (tables available) *</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={table.quantity_total}
                  onChange={e => { if (/^\d*$/.test(e.target.value)) updateTableTier(i, "quantity_total", e.target.value); }}
                  placeholder="e.g. 5"
                  className="mt-1 bg-secondary border-border/50 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Price ({getCurrencySymbol(ticketCurrency)})</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  value={table.price}
                  onChange={e => { if (/^(\d*\.?\d*)$/.test(e.target.value)) updateTableTier(i, "price", e.target.value); }}
                  placeholder="500"
                  className="mt-1 bg-secondary border-border/50 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground font-mono">Description</Label>
                <Input value={table.description} onChange={e => updateTableTier(i, "description", e.target.value)}
                  placeholder="Includes bottle service" className="mt-1 bg-secondary border-border/50 text-sm" />
              </div>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addTableTier} className="gap-2">
          <Plus className="w-3 h-3" /> Add Table Tier
        </Button>
      </div>

      {/* Poll Setup */}
      <div className="rounded-xl bg-primary/15 border-2 border-primary/50 overflow-hidden shadow-lg shadow-primary/10">
        <button type="button" onClick={() => { setPollEnabled(v => !v); }}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/20 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-lg">📊</span>
            <div className="text-left">
              <p className="font-display font-bold text-sm text-foreground">Poll — Audience Voting</p>
              <p className="text-xs text-muted-foreground font-mono">
                {existingPoll ? "Poll configured — click to edit" : "Let fans vote on a question during the event"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${pollEnabled ? "bg-primary text-primary-foreground" : "bg-primary/30 text-primary"}`}>
              {existingPoll ? "SAVED" : pollEnabled ? "ADDING" : "OFF"}
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
            <div>
              <Label className="text-xs text-foreground font-mono font-bold">Poll Opens *</Label>
              <Input type="datetime-local" value={poll.start_datetime} onChange={e => setPoll(p => ({ ...p, start_datetime: e.target.value }))}
                className="mt-1 bg-card border border-primary/40" />
            </div>
            <div>
              <Label className="text-xs text-foreground font-mono font-bold">Poll Closes *</Label>
              <Input type="datetime-local" value={poll.end_datetime} onChange={e => setPoll(p => ({ ...p, end_datetime: e.target.value }))}
                className="mt-1 bg-card border border-primary/40" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSavePoll} disabled={savingPoll} className="flex-1 sm:flex-none glow-lime font-mono">
                {savingPoll ? "Saving..." : existingPoll ? "Update Poll" : "Save Poll"}
              </Button>
              {(existingPoll || pollEnabled) && (
                <Button size="sm" variant="outline" onClick={handleDeletePoll} disabled={deletingPoll}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 font-mono">
                  {deletingPoll ? "Deleting..." : "Delete Poll"}
                </Button>
              )}
            </div>
            {existingPoll && (
              <p className="text-[10px] text-green-400 font-mono">Poll is saved. Votes so far: A={existingPoll.votes_a || 0}, B={existingPoll.votes_b || 0}</p>
            )}
            {lastPollSavedAt && (
              <p className="text-[10px] text-muted-foreground font-mono">Last saved {lastPollSavedAt.toLocaleTimeString()}</p>
            )}
          </div>
        )}
      </div>

      {/* Raffle — Random Draw */}
      <RaffleSetupCard value={raffleSetup} onChange={setRaffleSetup} />
      {raffleSetup && (
        <div className="flex items-center gap-3 -mt-6">
          <Button size="sm" onClick={handleSaveRaffle} disabled={savingRaffle} className="glow-lime font-mono">
            {savingRaffle ? "Saving..." : existingRaffleSetup ? "Update Raffle" : "Save Raffle"}
          </Button>
          {lastRaffleSavedAt && (
            <span className="text-[10px] text-muted-foreground font-mono">Last saved {lastRaffleSavedAt.toLocaleTimeString()}</span>
          )}
        </div>
      )}

      {/* Giveaway — First to Claim */}
      <GiveawaySetupCard value={giveawaySetup} onChange={setGiveawaySetup} />
      {giveawaySetup && (
        <div className="flex items-center gap-3 -mt-6">
          <Button size="sm" onClick={handleSaveGiveaway} disabled={savingGiveaway} className="glow-lime font-mono">
            {savingGiveaway ? "Saving..." : existingGiveawaySetup ? "Update Giveaway" : "Save Giveaway"}
          </Button>
          {lastGiveawaySavedAt && (
            <span className="text-[10px] text-muted-foreground font-mono">Last saved {lastGiveawaySavedAt.toLocaleTimeString()}</span>
          )}
        </div>
      )}

      {/* Promo Codes */}
      <div className="p-5 rounded-xl bg-yellow-900/20 border-2 border-yellow-600/50">
        <OrganizerPromoManager event={{ id, ...form }} ticketTypes={ticketTypes} />
      </div>

      {/* Ticket Seller / Promoter Links */}
      <PromoterLinksSection links={form.promoter_links || []} eventId={id} onChange={links => setForm(f => ({ ...f, promoter_links: links }))} />

      {/* Payment Settings */}
      <div className="p-4 rounded-lg bg-card border border-border/50 space-y-5">
        <h3 className="font-display font-bold text-base px-3 py-1.5 bg-accent/20 text-accent rounded-md inline-block">Payment Settings</h3>

        {/* Organizer Extra Fee */}
        <div className="space-y-2 pb-2 border-b border-border/30">
          <div>
            <p className="text-sm font-medium text-primary">Organizer Extra Fee</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">An additional per-ticket fee added to your payout. <strong>Never shown to buyers.</strong></p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          {Number(form.organizer_extra_fee) > 0 && (
            <p className="text-xs text-green-400 font-mono bg-green-400/10 px-3 py-2 rounded">
              {getCurrencySymbol(ticketCurrency)}{Number(form.organizer_extra_fee).toFixed(2)} extra per ticket will be added to your payout automatically.
            </p>
          )}
        </div>

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

        {/* Platform fee scale disclosure — at bottom */}
        <div className="mt-6 pt-4 border-t border-border/30">
          <PlatformFeeScale />
        </div>
      </div>

      {/* Actions — desktop */}
      <div className="hidden sm:flex gap-3 pb-8">
        <Button onClick={handleCancel} variant="outline" className="font-display font-bold">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !dirty} variant="outline" className="font-display font-bold">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button onClick={handlePublish} disabled={publishing} className="glow-lime font-display font-bold gap-2">
          <Send className="w-4 h-4" />
          {publishing ? "Posting..." : eventStatus === "published" ? "Save & Update Live" : "Post Event"}
        </Button>
      </div>

      {/* Actions — mobile sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-background/95 backdrop-blur border-t border-border/50 px-4 py-3 flex gap-3">
        <Button onClick={handleCancel} variant="outline" className="flex-1 font-display font-bold text-sm">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !dirty} variant="outline" className="flex-1 font-display font-bold text-sm">
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button onClick={handlePublish} disabled={publishing} className="flex-1 glow-lime font-display font-bold gap-1 text-sm">
          <Send className="w-3.5 h-3.5" />
          {publishing ? "Posting..." : eventStatus === "published" ? "Update Live" : "Post"}
        </Button>
      </div>

      {/* Cancel confirmation — unsaved changes */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <AlertDialogCancel className="mt-0">Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setShowCancelConfirm(false); navigate(`/organizer/events/${id}`); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}