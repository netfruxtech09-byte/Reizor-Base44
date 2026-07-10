import { useState, useEffect, useCallback } from "react";
import { Wand2, ImageIcon, Video, RefreshCw, Check, Loader2, ChevronRight, Sparkles, DollarSign, Layers, Music } from "lucide-react";
import AIFlyerAudioPicker from "./AIFlyerAudioPicker";
import FlyerPreviewActions from "./FlyerPreviewActions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { uploadToSpaces, recordStorageUsage, deleteStorageRecord } from "@/utils/spacesStorage";
import { toast } from "sonner";
import { format } from "date-fns";
import StripePaymentModal from "@/components/shared/StripePaymentModal";
import AIFlyerChargeModal from "./AIFlyerChargeModal";
import AIFlyerBlockedBanner from "./AIFlyerBlockedBanner";
import { detectIsIOS } from "@/hooks/useIsIOS";

const VIDEO_STYLE_DESCRIPTORS = [
  { id: "style_1", description: "Premium luxury nightclub style: slow cinematic camera movement through a dark upscale venue, dramatic spotlight beams, crowd silhouettes, gold and deep purple tones. Event name appears in large elegant serif typography with a subtle glowing effect." },
  { id: "style_2", description: "Artist-focused promo style: dynamic close-up of a DJ at the decks, energetic crowd reaction, intense stage lighting, fast cuts synced to beat. Bold modern sans-serif text overlay with the event name. High energy, gritty feel." },
  { id: "style_3", description: "Fast-paced social media teaser style: quick-cut montage of flashing lights, hands in the air, bass drop moment, vibrant neon colors. Eye-catching vertical format optimized for Instagram/TikTok. Text animates on screen with the event name." },
];



const DURATION_OPTIONS = [
  { value: 4, label: "4 seconds" },
  { value: 6, label: "6 seconds (default)" },
  { value: 8, label: "8 seconds" },
];

const FLYER_TYPES = [
  {
    id: "image",
    label: "Standard Image Flyer",
    icon: ImageIcon,
    description: "Create a regular event flyer image.",
    color: "border-primary bg-primary/10 text-primary",
    inactive: "border-border/50 bg-card text-muted-foreground",
  },
  {
    id: "3d_image",
    label: "3D Image Flyer",
    icon: Layers,
    description: "Create a more dimensional/3D-style promotional flyer.",
    color: "border-purple-400 bg-purple-400/10 text-purple-400",
    inactive: "border-border/50 bg-card text-muted-foreground",
  },
  {
    id: "video",
    label: "Video Flyer",
    icon: Video,
    description: "Create a short animated/video flyer for promotion.",
    color: "border-accent bg-accent/10 text-accent",
    inactive: "border-border/50 bg-card text-muted-foreground",
  },
];

function buildFlyerPrompt(event, artistDetails, flyerType, customInstruction, videoStyleSuffix = "") {
  const artists = artistDetails?.filter(a => a.name).map(a => a.name).join(", ") || "Various Artists";
  const date = event.date ? format(new Date(event.date), "MMMM d, yyyy 'at' h:mm a") : "";
  const genre = (event.genre || "electronic").replace(/_/g, " ");
  const location = [event.venue_name, event.city, event.country].filter(Boolean).join(", ");
  const age = event.age_restriction && event.age_restriction !== "all_ages" ? `${event.age_restriction} only` : "All Ages";

  const genreStyle = {
    hip_hop: "hip-hop urban streetwear aesthetic, bold graffiti-style text, gold and black tones, gritty urban photography",
    techno: "dark industrial techno aesthetic, neon laser beams, black background, futuristic cyber fonts",
    house: "vibrant house music vibe, colorful gradients, disco balls, warm amber and gold tones",
    drum_and_bass: "dark rave aesthetic, fast energy, bass speakers visual, jungle-inspired colors",
    trance: "euphoric trance visual, cosmic starfields, purple and blue gradient, pulsing light trails",
    rnb: "smooth R&B mood, luxury soft lighting, velvet textures, rose gold and purple tones",
    pop: "bright pop aesthetic, bold colors, confetti, modern clean typography",
    rock: "rock concert aesthetic, dark gritty stage lighting, electric guitars, red and black",
    electronic: "electronic music nightclub, LED lights, crowd silhouette, deep blue and pink neon",
    latin: "vibrant latin fiesta, warm reds and oranges, tropical flowers, festive energy",
    reggaeton: "reggaeton urban style, neon green and yellow, street art, high energy",
    afrobeats: "afrobeats celebration, rich warm colors, African patterns, joyful crowd energy",
    jazz: "jazz lounge elegance, smoky atmosphere, dark wood tones, vintage trumpet silhouette",
  };
  const styleHint = genreStyle[event.genre] || "modern nightlife event, premium club aesthetic";

  const threeDSuffix = flyerType === "3d_image"
    ? "Render this as a highly realistic 3D dimensional promotional flyer — use dramatic depth-of-field, floating 3D text with emboss/bevel effects, layered geometric shapes with perspective, volumetric light shafts, reflective surfaces, and a strong sense of three-dimensional depth. The text and design elements should appear to pop out of the composition."
    : "";

  const typeLabel = flyerType === "video" ? "video flyer" : "flyer";
  const base = customInstruction
    ? `${customInstruction}. The flyer is for "${event.title}", a ${genre} event.${threeDSuffix ? " " + threeDSuffix : ""}`
    : `Create a professional event ${typeLabel} for "${event.title}". Style: ${styleHint}. ${threeDSuffix} ${videoStyleSuffix}`;

  return `${base} Details: Date: ${date}. Venue: ${location}. Artists: ${artists}. Age: ${age}. ${event.description ? `Event vibe: ${event.description.slice(0, 120)}` : ""}. Make it eye-catching, high quality, suitable for social media promotion. Include the event name "${event.title}" prominently in the design.`;
}

export default function AIFlyerCreator({ event, artistDetails, onFlyerSaved, onSkip, mode = "create", previewOnly = false, userRole }) {
  const isAdmin = userRole === "admin";
  const [flyerType, setFlyerType] = useState("image");
  const [generated, setGenerated] = useState([]);
  const [selected, setSelected] = useState(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState("setup");
  const [videoDuration, setVideoDuration] = useState(6);
  // audioConfig: { mode: "preset"|"upload"|"none", presetValue: string, uploadedUrl: string, fileName: string }
  const [audioConfig, setAudioConfig] = useState({ mode: "preset", presetValue: "auto_music" });

  // Credit / session state
  const [creditStatus, setCreditStatus] = useState(null);
  const [creditLoading, setCreditLoading] = useState(true);

  // Charge confirmation modal
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [pendingInstruction, setPendingInstruction] = useState("");
  const [pendingActionType, setPendingActionType] = useState("generation");

  const loadCreditStatus = useCallback(async () => {
    // Admins bypass all credit/billing checks
    if (isAdmin) {
      setCreditStatus({ free_used: false, is_admin: true });
      setCreditLoading(false);
      return;
    }
    setCreditLoading(true);
    try {
      const res = await base44.functions.invoke("aiFlyerPayment", { action: "check_credit", eventId: event?.id || "" });
      setCreditStatus(res.data);
    } finally {
      setCreditLoading(false);
    }
  }, [event?.id, isAdmin]);

  useEffect(() => { loadCreditStatus(); }, [loadCreditStatus]);

  // Organizer-level free tracking + global pending
  const canGenerateFree = creditStatus ? !creditStatus.free_used : null; // null = still loading
  const globalPendingAmount = creditStatus?.global_pending_amount || 0;
  const globalPendingCount = creditStatus?.global_pending_count || 0;
  // Cross-event block: only block if there's unpaid balance from a DIFFERENT event
  const crossEventPendingAmount = creditStatus?.cross_event_pending_amount || 0;
  const crossEventPendingCount = creditStatus?.cross_event_pending_count || 0;
  const hasUnpaidBalance = crossEventPendingAmount > 0;

  // ── Core generate logic ──
  // creditRecordId: passed in from modal for paid generations (already charged)
  const doGenerate = async (instruction = "", creditRecordId = null) => {
    setGenerating(true);
    setSelected(null);

    const usingFree = canGenerateFree === true;
    const currentEventId = event?.id || "";
    let generationSucceeded = false;

    try {
      // ── 1. Run the actual AI generation ──
      let generatedItems = [];
      if (flyerType === "video") {
        // Build music hint for the AI prompt
        const audioMode = audioConfig?.mode || "preset";
        const presetVal = audioConfig?.presetValue || "auto_music";
        let musicPrompt = "";
        if (audioMode === "none" || presetVal === "no_music") {
          musicPrompt = "NO MUSIC - silent video";
        } else if (audioMode === "upload") {
          musicPrompt = ""; // custom audio applied post-generation
        } else if (presetVal && presetVal !== "auto_music") {
          const labelMap = { edm_house: "EDM / House", hip_hop: "Hip Hop / Rap", latin: "Latin / Reggaeton", rock: "Rock / Alternative", calm: "Calm / Cinematic" };
          musicPrompt = `Music style: ${labelMap[presetVal] || presetVal}`;
        }

        const results = await Promise.all(
          VIDEO_STYLE_DESCRIPTORS.map(style => {
            const prompt = buildFlyerPrompt(event, artistDetails, "video", instruction, style.description)
              + (musicPrompt ? ` ${musicPrompt}` : "");
            return base44.integrations.Core.GenerateVideo({ prompt, duration: videoDuration, aspect_ratio: "9:16" });
          })
        );
        // Attach audio metadata for custom uploads — stored on the item for future post-processing
        generatedItems = results.map((r, i) => ({
          url: r.url,
          type: "video",
          optionNumber: i + 1,
          customAudioUrl: audioMode === "upload" ? (audioConfig?.uploadedUrl || null) : null,
          customAudioName: audioMode === "upload" ? (audioConfig?.fileName || null) : null,
        }));
      } else if (flyerType === "3d_image") {
        const prompt = buildFlyerPrompt(event, artistDetails, "3d_image", instruction);
        const [r1, r2, r3] = await Promise.all([
          base44.integrations.Core.GenerateImage({ prompt }),
          base44.integrations.Core.GenerateImage({ prompt: prompt + " Variation 2, different 3D perspective and lighting angle." }),
          base44.integrations.Core.GenerateImage({ prompt: prompt + " Variation 3, alternative 3D color scheme and depth composition." }),
        ]);
        generatedItems = [
          { url: r1.url, type: "image", optionNumber: 1 },
          { url: r2.url, type: "image", optionNumber: 2 },
          { url: r3.url, type: "image", optionNumber: 3 },
        ];
      } else {
        const prompt = buildFlyerPrompt(event, artistDetails, "image", instruction);
        const [r1, r2, r3] = await Promise.all([
          base44.integrations.Core.GenerateImage({ prompt }),
          base44.integrations.Core.GenerateImage({ prompt: prompt + " Variation 2, different layout." }),
          base44.integrations.Core.GenerateImage({ prompt: prompt + " Variation 3, alternative color scheme." }),
        ]);
        generatedItems = [
          { url: r1.url, type: "image", optionNumber: 1 },
          { url: r2.url, type: "image", optionNumber: 2 },
          { url: r3.url, type: "image", optionNumber: 3 },
        ];
      }

      // Generation images/videos came back — mark succeeded before billing
      generationSucceeded = true;

      // ── 1b. Record storage usage for each generated asset (fire-and-forget) ──
      const category = flyerType === "video" ? "ai_flyer_generated_video" : "ai_flyer_generated_image";
      generatedItems.forEach(item => {
        recordStorageUsage({
          file_url: item.url,
          file_size_bytes: 0,
          mime_type: flyerType === "video" ? "video/mp4" : "image/jpeg",
          file_category: category,
          entity_type: "event",
          entity_id: currentEventId,
        }).catch(() => {});
      });

      // ── 2. Persist billing record ──
      if (usingFree) {
        // Free: record usage
        base44.functions.invoke("aiFlyerPayment", { action: "use_free", eventId: currentEventId }).catch(console.warn);
      } else if (creditRecordId) {
        // Paid: payment was already charged in the modal — just mark generation as succeeded
        base44.functions.invoke("aiFlyerPayment", {
          action: "mark_generation_succeeded",
          eventId: currentEventId,
          creditRecordId,
        }).catch(console.warn);
      }

      // ── 3. Show results immediately ──
      setGenerated(generatedItems);
      setPhase("results");
      toast.success("AI flyer generated successfully.");

      // ── 4. Refresh billing state from backend (non-blocking) ──
      loadCreditStatus();

    } catch (err) {
      // If generation failed after a paid credit was charged — mark gen as failed so they can retry
      if (!generationSucceeded && creditRecordId) {
        base44.functions.invoke("aiFlyerPayment", {
          action: "mark_generation_failed",
          eventId: currentEventId,
          creditRecordId,
        }).catch(() => {});
      }
      if (!generationSucceeded) {
        loadCreditStatus();
      }

      let userMessage = "We could not generate the flyer right now. Please review your event information and try again.";
      try {
        const raw = err?.message || err?.detail || "";
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
        const detail = parsed?.detail || parsed?.message || raw;
        if (detail) {
          const lower = detail.toLowerCase();
          if (/provide.*name|event name|date|venue|give me those|missing field/i.test(lower)) {
            userMessage = "Please complete the event name, date, and venue/city fields before generating a flyer.";
          } else if (/credit|balance|payment|unpaid/i.test(lower)) {
            userMessage = "Generation blocked due to an unpaid balance. Please settle it from your payouts page.";
          } else if (/timeout|timed out/i.test(lower)) {
            userMessage = "Generation timed out. Please try again — it usually completes within 2 minutes.";
          } else if (detail.length < 200) {
            userMessage = detail.replace(/^Image generation failed:\s*/i, "").trim() || userMessage;
          }
        }
        // Log the actual error for debugging
        console.error("[AIFlyerCreator] Generation failed:", detail || raw);
      } catch { /* use default */ }

      toast.error(userMessage, { duration: 7000 });
    } finally {
      setGenerating(false);
    }
  };

  // ── Handle generate button click ──
  const handleGenerateClick = async (instruction = "", actionType = "generation") => {
    if (creditLoading || generating) return;

    // Hard guard: show toast and abort if required fields missing
    if (!hasRequiredFields) {
      toast.error(`Please fill in: ${missingFields.join(", ")} before generating a flyer.`, { duration: 5000 });
      return;
    }

    // Admins bypass all payment/credit restrictions — generate directly
    if (isAdmin) {
      await doGenerate(instruction, null);
      return;
    }

    // If there's a global unpaid balance from a previous event, block generation
    if (hasUnpaidBalance && !canGenerateFree) {
      toast.error("AI flyer generation is blocked due to an unpaid balance from a previous event.");
      return;
    }

    if (canGenerateFree) {
      await doGenerate(instruction, null);
      return;
    }

    // Needs charge confirmation — show charge modal (payment happens inside modal)
    setPendingInstruction(instruction);
    setPendingActionType(actionType);
    setShowChargeModal(true);
  };

  // ── After charge confirmed + payment succeeded in modal ──
  // creditRecordId is the already-charged AIFlyerCredit record
  const handleChargeConfirmed = async (creditRecordId) => {
    setShowChargeModal(false);
    await doGenerate(pendingInstruction, creditRecordId);
  };

  const handleSave = async () => {
    if (!selected) return toast.error("Please select a flyer first.");
    if (previewOnly) {
      onFlyerSaved(selected.url, selected.type);
      return;
    }
    setSaving(true);
    await base44.entities.Event.update(event.id, {
      cover_image: selected.url,
      gallery_images: [selected.url, ...(event.gallery_images || []).filter(u => u !== selected.url)],
    });
    toast.success("Flyer saved to your event successfully.");
    onFlyerSaved(selected.url, selected.type);
    setSaving(false);
  };

  const handleManualUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const folder = event?.organizer_id
      ? `flyers/${event.organizer_id}`
      : "flyers/general";
    const { file_url, file_size_bytes } = await uploadToSpaces(file, folder);
    // Track storage usage (fire-and-forget)
    recordStorageUsage({
      file_url,
      file_size_bytes,
      mime_type: file.type || "image/jpeg",
      file_category: "ai_flyer_upload",
      entity_type: "event",
      entity_id: event?.id || "",
    }).catch(() => {});
    if (!previewOnly) {
      await base44.entities.Event.update(event.id, {
        cover_image: file_url,
        gallery_images: [file_url, ...(event.gallery_images || [])],
      });
    }
    toast.success("Flyer uploaded!");
    onFlyerSaved(file_url, "image");
    e.target.value = "";
  };

  // Required field validation
  const missingFields = [
    !event?.title?.trim() && "event name",
    !event?.date && "event date",
    !(event?.venue_name?.trim() || event?.city?.trim()) && "venue / location",
  ].filter(Boolean);
  const hasRequiredFields = missingFields.length === 0;

  const genre = (event.genre || "").replace(/_/g, " ");
  const artists = artistDetails?.filter(a => a.name).map(a => a.name).join(", ") || "—";

  const creditBadge = creditLoading
    ? null
    : hasUnpaidBalance && !canGenerateFree
    ? { text: `AI flyer generation blocked · ${crossEventPendingCount} unpaid change${crossEventPendingCount !== 1 ? "s" : ""} · $${crossEventPendingAmount.toFixed(2)} pending from a previous event`, color: "text-destructive bg-destructive/10 border-destructive/30" }
    : canGenerateFree
    ? { text: "First flyer design is free. Any other changes after that is $1 per change.", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" }
    : { text: "Your free flyer design has been used. Any other changes after that is $1 per change.", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" };

  if (detectIsIOS()) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="font-display font-black text-2xl tracking-tight">Create Your Event Flyer</h2>
        <p className="text-sm text-muted-foreground mt-1">Enter all the necessary event information below, then come back here to generate a flyer using the details you chose.</p>
      </div>

      {/* Credit status badge — hidden for admins */}
      {!isAdmin && creditBadge && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono font-bold w-fit ${creditBadge.color}`}>
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          {creditBadge.text}
        </div>
      )}

      {/* Free generation available badge — hidden for admins */}
      {!isAdmin && !creditLoading && canGenerateFree === true && !generating && phase === "setup" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-400/30 bg-green-400/10 text-green-400 text-xs font-mono font-bold w-fit">
          <Check className="w-3.5 h-3.5 shrink-0" />
          1 free generation available
        </div>
      )}

      {/* Blocked banner — hidden for admins */}
      {!isAdmin && !creditLoading && hasUnpaidBalance && !canGenerateFree && (
        <AIFlyerBlockedBanner pendingAmount={crossEventPendingAmount} pendingCount={crossEventPendingCount} />
      )}

      {/* Organizer-level pending AI flyer bill — hidden for admins */}
      {!isAdmin && !creditLoading && globalPendingCount > 0 && (
        <div className="p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/20 flex items-start gap-2">
          <DollarSign className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-muted-foreground">
            <span className="text-yellow-400 font-bold">Pending AI flyer charges: {globalPendingCount} change{globalPendingCount !== 1 ? "s" : ""} · Total ${globalPendingAmount.toFixed(2)}</span> — will be deducted from your event payout automatically.
          </p>
        </div>
      )}

      {/* Event info preview */}
      <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">AI will use these details</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div><span className="text-muted-foreground text-xs">Event:</span> <span className="font-bold">{event.title}</span></div>
          <div><span className="text-muted-foreground text-xs">Genre:</span> <span className="font-bold capitalize">{genre}</span></div>
          <div><span className="text-muted-foreground text-xs">Venue:</span> <span className="font-bold">{event.venue_name || "—"}</span></div>
          <div><span className="text-muted-foreground text-xs">City:</span> <span className="font-bold">{event.city || "—"}</span></div>
          <div><span className="text-muted-foreground text-xs">Date:</span> <span className="font-bold">{event.date ? format(new Date(event.date), "MMM d, yyyy") : "—"}</span></div>
          <div><span className="text-muted-foreground text-xs">Age:</span> <span className="font-bold">{event.age_restriction || "18+"}</span></div>
          {artists && artists !== "—" && (
            <div className="col-span-2"><span className="text-muted-foreground text-xs">Artists:</span> <span className="font-bold">{artists}</span></div>
          )}
        </div>
      </div>

      {/* Flyer type selector */}
      <div className="space-y-2">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Flyer Type</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {FLYER_TYPES.map(ft => {
            const Icon = ft.icon;
            const isActive = flyerType === ft.id;
            return (
              <button
                key={ft.id}
                onClick={() => setFlyerType(ft.id)}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all text-left ${isActive ? ft.color : ft.inactive}`}
              >
                <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-sm leading-tight">{ft.label}</p>
                  <p className="text-[10px] font-mono opacity-70 mt-0.5 leading-snug">{ft.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Video generation options — only for video type */}
      {flyerType === "video" && phase === "setup" && (
        <div className="space-y-4 p-4 rounded-xl bg-accent/5 border border-accent/20">
          <p className="font-mono text-xs text-accent uppercase tracking-wider font-bold">Video Generation Settings</p>
          <div>
            <label className="text-xs text-muted-foreground font-mono block mb-1">Video Duration</label>
            <select
              value={videoDuration}
              onChange={e => setVideoDuration(Number(e.target.value))}
              className="w-full h-9 rounded-md border border-white/25 bg-secondary text-foreground px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary appearance-none cursor-pointer"
            >
              {DURATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <AIFlyerAudioPicker
            value={audioConfig}
            onChange={setAudioConfig}
            organizerId={event?.organizer_id}
            eventId={event?.id}
          />
        </div>
      )}

      {/* Refine with AI (results phase) */}
      {phase === "results" && (
        <div className="space-y-2">
          <Label className="text-xs font-mono uppercase tracking-wider">Refine with AI</Label>
          <div className="space-y-2">
            <textarea
              value={customInstruction}
              onChange={e => setCustomInstruction(e.target.value)}
              placeholder="e.g. Make it darker, add spotlight effect, make text bigger..."
              className="w-full h-24 rounded-md border border-white/25 bg-card px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring transition-colors resize-none"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                disabled={generating || !customInstruction.trim() || creditLoading}
                onClick={() => handleGenerateClick(customInstruction, "change")}
                className="w-full h-10 gap-1.5 font-display font-bold glow-lime"
              >
                <Wand2 className="w-4 h-4" /> Regenerate with Changes
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCustomInstruction("")} className="w-full sm:w-auto px-4">
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generate button (setup phase) */}
      {phase === "setup" && (
        <div className="space-y-2">
          {!hasRequiredFields && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
              <Wand2 className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs font-mono text-yellow-400">
                To generate a flyer, please fill in: <strong>{missingFields.join(", ")}</strong>
              </p>
            </div>
          )}
          <Button
            onClick={() => handleGenerateClick("")}
            disabled={generating || creditLoading || !hasRequiredFields || (!isAdmin && hasUnpaidBalance && !canGenerateFree)}
            className="w-full min-h-12 h-auto py-3 font-display font-bold text-base glow-lime gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
          >
            {generating ? (
              <span className="flex flex-col items-center gap-1">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  Generating {flyerType === "video" ? "3 video options" : flyerType === "3d_image" ? "3D flyers" : "flyers"}...
                </span>
                <span className="text-xs font-mono font-normal opacity-80">(may take up to 2 minutes)</span>
              </span>
            ) : creditLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
            ) : isAdmin ? (
              <><Wand2 className="w-4 h-4" /> Generate {flyerType === "video" ? "3 Video Options" : flyerType === "3d_image" ? "3D Flyer Options" : "3 Flyer Options"}</>
            ) : canGenerateFree ? (
              <><Wand2 className="w-4 h-4" /> Generate {flyerType === "video" ? "3 Video Options" : flyerType === "3d_image" ? "3D Flyer Options" : "3 Flyer Options"} — Free</>
            ) : (
              <><Wand2 className="w-4 h-4" /> Generate {flyerType === "video" ? "3 Video Options" : flyerType === "3d_image" ? "3D Flyer Options" : "3 Flyer Options"} — $1</>
            )}
          </Button>
        </div>
      )}

      {/* Loading overlay */}
      {generating && (
        <div className="p-4 sm:p-8 rounded-xl bg-card border border-border/50 flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p className="font-display font-bold text-base sm:text-lg">
            AI is creating your {flyerType === "video" ? "3 video options" : flyerType === "3d_image" ? "3D flyers" : "flyers"}...
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {flyerType === "video"
              ? "Generating 3 different styles in parallel. This may take up to 2 minutes."
              : flyerType === "3d_image"
              ? "Generating 3 dimensional flyer options. This may take up to 2 minutes."
              : "This may take up to 2 minutes. Using your event details."}
          </p>
        </div>
      )}

      {/* Results */}
      {phase === "results" && !generating && generated.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Choose a {flyerType === "video" ? "video" : flyerType === "3d_image" ? "3D flyer" : "flyer"} option
            </p>
            <button
              onClick={() => handleGenerateClick(customInstruction, "change")}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Generate More Options
            </button>
          </div>

          {flyerType !== "video" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {generated.map((item, i) => {
                const isSelected = selected?.url === item.url;
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(isSelected ? null : item)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-[3/4] ${isSelected ? "border-primary shadow-lg shadow-primary/20" : "border-border/50"}`}
                  >
                    <img src={item.url} alt={`Flyer option ${i + 1}`} className="w-full h-full object-cover" />
                    <div className={`absolute top-2 right-2 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "bg-primary border-primary" : "bg-black/40 border-white/60"}`}>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-white text-[10px] font-mono font-bold">{isSelected ? "✓ Selected" : `Option ${i + 1}`}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {generated.map((item, i) => {
                const isSelected = selected?.url === item.url;
                return (
                  <div key={i} className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-[9/16] ${isSelected ? "border-primary shadow-lg shadow-primary/20" : "border-border/50"}`}>
                    <video src={item.url} muted playsInline controls className="w-full h-full object-cover bg-black" />
                    <div
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full border-2 flex items-center justify-center z-10 cursor-pointer ${isSelected ? "bg-primary border-primary" : "bg-black/40 border-white/60"}`}
                      onClick={() => setSelected(isSelected ? null : item)}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                      <p className="text-white text-[10px] font-mono font-bold">{isSelected ? "✓ Selected" : `Option ${item.optionNumber || i + 1}`}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selected ? (
            <div className="space-y-3">
              {selected.customAudioUrl && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20 text-xs font-mono text-accent">
                  <Music className="w-3.5 h-3.5 shrink-0" />
                  Custom audio attached: <span className="font-bold truncate">{selected.customAudioName || "uploaded file"}</span>
                </div>
              )}
              <FlyerPreviewActions url={selected.url} type={selected.type} onEdit={() => setSelected(null)} onDelete={() => setSelected(null)} />
              <Button onClick={handleSave} disabled={saving} className="w-full h-12 font-display font-bold glow-lime gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save Flyer to Event</>}
              </Button>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-center">
              <p className="text-xs font-mono text-muted-foreground">Tap an option above to select it</p>
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => handleGenerateClick(customInstruction, "change")}
            disabled={generating}
            className="w-full gap-2 font-display font-bold"
          >
            <RefreshCw className="w-4 h-4" /> Generate New Options
          </Button>
        </div>
      )}

      {/* Skip */}
      <button
        onClick={onSkip}
        className="w-full text-center text-xs font-mono text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        {mode === "edit" ? "Keep Existing Flyer — Close" : "Skip — I'll add a flyer later"}
        <ChevronRight className="w-3 h-3 inline ml-1" />
      </button>

      {/* Charge Confirmation Modal — never shown to admins */}
      {showChargeModal && !isAdmin && (
        <AIFlyerChargeModal
          eventId={event?.id}
          actionType={pendingActionType}
          onConfirmed={handleChargeConfirmed}
          onCancel={() => setShowChargeModal(false)}
        />
      )}
    </div>
  );
}