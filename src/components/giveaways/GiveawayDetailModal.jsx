import { useState, useEffect } from "react";
import { X, Gift, Trophy, Clock, Users, CheckCircle2, Upload, Link2, Loader2, AlertCircle, Info, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { formatGiveawayEndDate } from "@/utils/giveawayUtils";

const PRIZE_LABELS = {
  free_ticket:   "🎟️ Free Ticket",
  physical_item: "📦 Physical Item",
  wallet_credit: "💳 Wallet Credit",
  custom:        "🎁 Prize",
};

const ELIGIBILITY_LABELS = {
  open_to_all:     "Open to all fans",
  ticket_holders:  "Ticket holders only",
  followers:       "Followers only",
  paid_members:    "Paid members only",
  social_action:   "Social/community action required",
  manual_approval: "Manual approval required",
};

const ENTRY_STATUS_META = {
  submitted:     { label: "Submitted", color: "text-muted-foreground" },
  under_review:  { label: "Under Review", color: "text-yellow-400" },
  approved:      { label: "Approved ✓", color: "text-green-400" },
  rejected:      { label: "Rejected ✗", color: "text-destructive" },
  winner:        { label: "🏆 Winner!", color: "text-yellow-400" },
  not_selected:  { label: "Not Selected", color: "text-muted-foreground" },
};

export default function GiveawayDetailModal({ giveaway, user, myEntry, onClose, onEntered }) {
  const [proofImage, setProofImage] = useState(null);
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ineligibleReason, setIneligibleReason] = useState("");

  const isEnded = giveaway.end_date && isPast(new Date(giveaway.end_date));
  const requiresProof = giveaway.requires_proof || (giveaway.eligibility_rules || []).includes("social_action");
  const isFan = user?.role === "user";
  const canEnter = !myEntry && !isEnded && user && isFan && giveaway.status === "active" && !ineligibleReason;

  // Best-effort client-side pre-check so users see the eligibility reason before attempting to enter.
  // Actual enforcement happens server-side in the submitGiveawayEntry backend function.
  useEffect(() => {
    if (!user || myEntry) { setIneligibleReason(""); return; }
    const rules = giveaway.eligibility_rules || ["open_to_all"];
    const check = async () => {
      if (rules.includes("ticket_holders") && giveaway.linked_event_id) {
        const tickets = await base44.entities.Ticket.filter({ event_id: giveaway.linked_event_id, owner_email: user.email }, null, 50).catch(() => []);
        const hasValid = tickets.some(t => t.status === "active" || t.status === "scanned");
        if (!hasValid) { setIneligibleReason("Only ticket holders for the linked event can enter this giveaway."); return; }
      }
      if (rules.includes("followers") && giveaway.owner_id) {
        if (giveaway.owner_type === "artist") {
          const follows = await base44.entities.ArtistFollow.filter({ follower_email: user.email, artist_id: giveaway.owner_id }, null, 1).catch(() => []);
          if (follows.length === 0) { setIneligibleReason(`Only followers of ${giveaway.owner_name || "the creator"} can enter this giveaway.`); return; }
        } else {
          const follows = await base44.entities.OrganizerFollow.filter({ follower_email: user.email, organizer_id: giveaway.owner_id }, null, 1).catch(() => []);
          if (follows.length === 0) { setIneligibleReason(`Only followers of ${giveaway.owner_name || "the creator"} can enter this giveaway.`); return; }
        }
      }
      if (rules.includes("paid_members") && giveaway.owner_id) {
        const subs = await base44.entities.FanSubscription.filter({ fan_email: user.email, artist_id: giveaway.owner_id, status: "active" }, null, 1).catch(() => []);
        if (subs.length === 0) { setIneligibleReason(`Only paid members of ${giveaway.owner_name || "the creator"} can enter this giveaway.`); return; }
      }
      setIneligibleReason("");
    };
    check();
  }, [user?.email, giveaway.id]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProofImageUrl(file_url);
    setProofImage(file_url);
    setUploading(false);
  };

  const handleEnter = async () => {
    if (!user) { toast.error("Please log in to enter"); return; }
    if (requiresProof && !proofImageUrl && !proofLink && !proofNote) {
      toast.error("Please submit your proof to enter this giveaway");
      return;
    }

    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("submitGiveawayEntry", {
        giveaway_id: giveaway.id,
        proof_image_url: proofImageUrl || null,
        proof_link: proofLink || null,
        proof_note: proofNote || null,
      });
      toast.success(res.data.requiresProof ? "Entry submitted! The organizer will review your proof." : "You've entered the giveaway! Good luck! 🎉");
      onEntered();
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not submit your entry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto">
      <div className="w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-2xl my-8">
        {/* Cover */}
        {giveaway.cover_image && (
          <div className="relative">
            <img src={giveaway.cover_image} alt={giveaway.title} className="w-full h-48 object-cover rounded-t-2xl" />
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-6 space-y-5">
          {!user && (
            <div className="flex flex-col items-center gap-3 p-5 rounded-xl bg-primary/10 border border-primary/30 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
                <LogIn className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-base text-foreground">Login Required</p>
                <p className="text-xs text-muted-foreground mt-1">You must be logged in to enter this giveaway.</p>
              </div>
              <Button
                onClick={() => base44.auth.redirectToLogin(`/giveaways/${giveaway.id}`)}
                className="w-full glow-lime font-display font-bold h-11 gap-2"
              >
                <LogIn className="w-4 h-4" /> Login / Sign Up
              </Button>
            </div>
          )}

          {!giveaway.cover_image && (
            <div className="flex items-center justify-between">
              <Gift className="w-8 h-8 text-primary" />
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
          )}

          {/* Title & type */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
                {giveaway.giveaway_type === "event_linked" ? "Event Giveaway" : "Community Giveaway"}
              </span>
              {isEnded && <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">Ended</span>}
            </div>
            <h2 className="font-display font-black text-2xl">{giveaway.title}</h2>
            {giveaway.linked_event_title && <p className="text-sm text-muted-foreground mt-1">📅 {giveaway.linked_event_title}</p>}
          </div>

          {/* Description */}
          {giveaway.description && <p className="text-sm text-muted-foreground leading-relaxed">{giveaway.description}</p>}

          {/* Key details — stacked vertically on all screen sizes for readability */}
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5 tracking-wide">Prize</p>
              <p className="text-sm font-bold leading-snug">{giveaway.prize_description || PRIZE_LABELS[giveaway.prize_type] || "🎁 Prize"}</p>
              {giveaway.prize_details && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{giveaway.prize_details}</p>}
              {giveaway.prize_value && <p className="text-xs text-primary font-mono mt-1">Value: ${giveaway.prize_value}</p>}
            </div>
            <div className="p-4 rounded-lg bg-yellow-400/5 border border-yellow-400/20">
              <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5 tracking-wide">Winners</p>
              <p className="text-xl font-black text-yellow-400 leading-none">{giveaway.num_winners || 1}</p>
              <p className="text-xs text-muted-foreground mt-1.5">{giveaway.winner_selection === "random" ? "Random draw" : "Manual selection"}</p>
            </div>
            <div className="p-4 rounded-lg bg-accent/5 border border-accent/20 space-y-1.5">
              <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5 tracking-wide">Timeline</p>
              {giveaway.end_date ? (
                <p className="text-xs text-foreground flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-accent" />
                  {isEnded ? "Ended" : "Ends"}: {formatGiveawayEndDate(giveaway.end_date)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-muted-foreground" /> No end date
                </p>
              )}
              {giveaway.winner_announcement_date && (
                <p className="text-xs text-foreground flex items-center gap-1.5">
                  <Trophy className="w-3 h-3 text-yellow-400" />
                  Winners: {format(new Date(giveaway.winner_announcement_date), "MMM d, yyyy")}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{giveaway.total_entries || 0} entered</span>
          </div>

          {/* Who Can Participate */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border/30 space-y-1">
            <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase">Who Can Participate</p>
            {(giveaway.eligibility_rules || ["open_to_all"]).map(r => (
              <p key={r} className="text-xs text-foreground flex items-center gap-1.5">
                <span className="text-primary">✓</span> {ELIGIBILITY_LABELS[r] || r}
              </p>
            ))}
          </div>

          {/* Ineligibility notice — shown before the user attempts to enter */}
          {ineligibleReason && !myEntry && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {ineligibleReason}
            </div>
          )}

          {giveaway.redemption_instructions && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
              <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase">Redemption</p>
              <p className="text-xs text-muted-foreground">{giveaway.redemption_instructions}</p>
            </div>
          )}

          {/* Entry instructions */}
          {giveaway.entry_instructions && (
            <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 space-y-1">
              <p className="text-[10px] font-mono font-bold text-accent uppercase flex items-center gap-1"><Info className="w-3 h-3" /> How to Enter</p>
              <p className="text-sm text-muted-foreground">{giveaway.entry_instructions}</p>
            </div>
          )}

          {/* My entry status */}
          {myEntry && (
            <div className="p-4 rounded-xl bg-card border border-border/50 space-y-1">
              <p className="text-xs font-mono text-muted-foreground uppercase">Your Entry</p>
              <p className={`text-base font-bold ${ENTRY_STATUS_META[myEntry.status]?.color || "text-foreground"}`}>
                {ENTRY_STATUS_META[myEntry.status]?.label || myEntry.status}
              </p>
              {myEntry.rejection_reason && (
                <p className="text-xs text-destructive font-mono mt-1">Reason: {myEntry.rejection_reason}</p>
              )}
              {myEntry.is_winner && (
                <div className="mt-2 p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                  <p className="text-sm font-bold text-yellow-400">🎉 Congratulations! You've won!</p>
                  <p className="text-xs text-muted-foreground mt-1">Check My Prizes to claim your reward.</p>
                  <Button size="sm" className="mt-2" onClick={() => window.location.href = "/my-prizes"}>
                    Go to My Prizes →
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Proof submission form */}
          {canEnter && requiresProof && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
              <p className="text-sm font-bold flex items-center gap-2"><Upload className="w-4 h-4 text-primary" /> Submit Your Proof</p>
              <p className="text-xs text-muted-foreground">Complete the required action outside Reizor, then upload proof below.</p>

              <div>
                <p className="text-xs font-mono text-muted-foreground mb-1">Screenshot / Image</p>
                <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 text-sm hover:border-primary/40 transition-colors w-fit">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Uploading..." : proofImageUrl ? "Image uploaded ✓" : "Upload proof image"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>

              <div>
                <p className="text-xs font-mono text-muted-foreground mb-1">Social Link (optional)</p>
                <Input value={proofLink} onChange={e => setProofLink(e.target.value)} placeholder="https://..." />
              </div>

              <div>
                <p className="text-xs font-mono text-muted-foreground mb-1">Note (optional)</p>
                <Input value={proofNote} onChange={e => setProofNote(e.target.value)} placeholder="Any notes for the organizer..." />
              </div>
            </div>
          )}

          {/* Terms */}
          {giveaway.terms_and_conditions && (
            <p className="text-[11px] text-muted-foreground font-mono leading-relaxed border-t border-border/30 pt-3">
              Terms: {giveaway.terms_and_conditions}
            </p>
          )}

          {/* CTA */}
          {!myEntry && (
            <div>
              {user && !isFan && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/30 text-xs text-muted-foreground">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Only fan accounts can enter giveaways.
                </div>
              )}
              {isEnded && <p className="text-center text-sm text-muted-foreground">This giveaway has ended.</p>}
              {canEnter && (
                <Button onClick={handleEnter} disabled={submitting} className="w-full glow-lime font-display font-bold h-11 gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                  {submitting ? "Entering..." : requiresProof ? "Submit & Enter Giveaway" : "Enter Giveaway 🎉"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}