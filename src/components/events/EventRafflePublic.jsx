import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import FollowGateButton from "@/components/loyalty/FollowGateButton";

const ELIGIBILITY_LABELS = {
  ticket_purchase: "Purchase a ticket",
  repost_share: "Repost / share this event",
  follow_organizer: "Follow the organizer",
  other: "See eligibility notes below",
};

const STATUS_BADGE = {
  upcoming: { label: "Starting Soon", cls: "text-yellow-400 bg-yellow-400/10" },
  active: { label: "Active — Enter Now", cls: "text-green-400 bg-green-400/10" },
  closed: { label: "Entries Closed", cls: "text-muted-foreground bg-muted/30" },
  drawn: { label: "Winners Selected", cls: "text-primary bg-primary/10" },
  cancelled: { label: "Cancelled", cls: "text-destructive bg-destructive/10" },
};

export default function EventRafflePublic({ eventId }) {
  const [raffles, setRaffles] = useState([]);
  const [user, setUser] = useState(null);
  const [enteredIds, setEnteredIds] = useState(new Set());
  const [entering, setEntering] = useState(null);
  const [proofNotes, setProofNotes] = useState({});
  const [organizerNames, setOrganizerNames] = useState({});

  useEffect(() => {
    base44.entities.EventRaffleSetup.filter({ event_id: eventId }, null, 10).then(async r => {
      const active = r.filter(x => !["cancelled"].includes(x.status));
      setRaffles(active);
      const orgIds = [...new Set(active.map(x => x.organizer_id).filter(Boolean))];
      const names = {};
      await Promise.all(orgIds.map(async id => {
        const u = await base44.entities.User.get(id).catch(() => null);
        names[id] = u?.full_name || u?.email || "the organizer";
      }));
      setOrganizerNames(names);
    }).catch(() => {});
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.email) {
        base44.entities.EventRaffleEntry.filter({ event_id: eventId, user_email: u.email }, null, 20)
          .then(entries => setEnteredIds(new Set(entries.map(e => e.raffle_id))))
          .catch(() => {});
      }
    }).catch(() => {});
  }, [eventId]);

  if (!raffles.length) return null;

  const handleEnter = async (raffle) => {
    if (!user) { toast.error("Please sign in to enter the raffle."); return; }
    if (user.role !== "user") { toast.error("Only fan accounts can enter raffles."); return; }
    if (enteredIds.has(raffle.id)) { toast.info("You are already entered in this raffle."); return; }
    if (!["active"].includes(raffle.status)) { toast.error("This raffle is not currently accepting entries."); return; }
    setEntering(raffle.id);
    await base44.entities.EventRaffleEntry.create({
      raffle_id: raffle.id,
      event_id: eventId,
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name || user.email,
      eligibility_action: raffle.eligibility_action,
      proof_note: proofNotes[raffle.id] || "",
      status: "entered",
    });
    setEnteredIds(prev => new Set([...prev, raffle.id]));
    toast.success("You're entered in the raffle! Winners drawn randomly after entries close.");
    if (raffle.organizer_id) {
      base44.functions.invoke("awardLoyaltyPoints", {
        action_type: "raffle", owner_type: "organizer", owner_id: raffle.organizer_id, source_id: raffle.id,
      }).catch(() => {});
    }
    setEntering(null);
  };

  return (
    <div className="space-y-3">
      {raffles.map(raffle => {
        const badge = STATUS_BADGE[raffle.status] || STATUS_BADGE.upcoming;
        const isEntered = enteredIds.has(raffle.id);
        const isFan = user?.role === "user";
        const canEnter = raffle.status === "active" && !isEntered && isFan;
        const needsProof = raffle.eligibility_action === "repost_share";

        return (
          <div key={raffle.id} className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/30">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎲</span>
                <div>
                  <p className="font-display font-bold text-sm">RAFFLE</p>
                  <p className="font-display font-bold text-base">{raffle.title}</p>
                </div>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>{badge.label}</span>
            </div>

            <div className="space-y-2 text-xs font-mono text-muted-foreground">
              <p><span className="text-foreground font-bold">Prize:</span> {raffle.prize_name}</p>
              {raffle.prize_description && <p>{raffle.prize_description}</p>}
              <p><span className="text-foreground font-bold">Winners:</span> {raffle.num_winners} selected randomly</p>
              <p><span className="text-foreground font-bold">To enter:</span> {ELIGIBILITY_LABELS[raffle.eligibility_action] || raffle.eligibility_action}</p>
              {raffle.eligibility_notes && <p className="italic">{raffle.eligibility_notes}</p>}
              {raffle.close_datetime && <p><span className="text-foreground font-bold">Entries close:</span> {format(new Date(raffle.close_datetime), "MMM d, yyyy h:mm a")}</p>}
              {raffle.draw_datetime && <p><span className="text-foreground font-bold">Draw:</span> {format(new Date(raffle.draw_datetime), "MMM d, yyyy h:mm a")}</p>}
              {raffle.total_entries > 0 && <p><span className="text-foreground font-bold">Entries so far:</span> {raffle.total_entries}</p>}
            </div>

            {raffle.status === "drawn" && raffle.winner_names?.length > 0 && (
              <div className="mt-3 p-2 rounded-lg bg-primary/10 border border-primary/20 text-xs font-mono text-primary">
                🏆 Winners: {raffle.winner_names.join(", ")}
              </div>
            )}

            {canEnter && (
              <FollowGateButton
                ownerType="organizer"
                ownerId={raffle.organizer_id}
                ownerName={organizerNames[raffle.organizer_id] || "the organizer"}
                userEmail={user?.email}
                userName={user?.full_name}
              >
                <div className="mt-3 space-y-2">
                  {needsProof && (
                    <input
                      type="text"
                      placeholder="Paste your repost link here"
                      value={proofNotes[raffle.id] || ""}
                      onChange={e => setProofNotes(p => ({ ...p, [raffle.id]: e.target.value }))}
                      className="w-full rounded-md border border-orange-500/30 bg-card px-3 py-2 text-xs"
                    />
                  )}
                  <button
                    onClick={() => handleEnter(raffle)}
                    disabled={entering === raffle.id}
                    className="w-full py-2.5 rounded-lg bg-orange-500 text-white font-display font-bold text-sm hover:bg-orange-600 transition-colors disabled:opacity-60"
                  >
                    {entering === raffle.id ? "Entering…" : "Enter Raffle"}
                  </button>
                  <p className="text-[10px] text-muted-foreground font-mono text-center">
                    One entry per person. Winners selected randomly after entries close.
                  </p>
                </div>
              </FollowGateButton>
            )}

            {isEntered && (
              <div className="mt-3 p-2 rounded-lg bg-green-400/10 border border-green-400/20 text-xs font-mono text-green-400 text-center">
                ✓ You're in the draw! Winners announced after {raffle.close_datetime ? format(new Date(raffle.close_datetime), "MMM d") : "entries close"}.
              </div>
            )}

            {raffle.prize_collection_instructions && (
              <p className="mt-2 text-[10px] text-muted-foreground font-mono italic">Collection: {raffle.prize_collection_instructions}</p>
            )}

            {user && !isFan && !isEntered && raffle.status === "active" && (
              <p className="mt-2 text-[10px] text-muted-foreground font-mono">Only fan accounts can enter this raffle.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}