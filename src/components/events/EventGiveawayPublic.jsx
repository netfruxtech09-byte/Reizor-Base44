import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

const ELIGIBILITY_LABELS = {
  ticket_purchase: "Purchase a ticket",
  repost_share: "Repost / share this event",
  follow_organizer: "Follow the organizer",
  other: "See eligibility notes below",
};

const STATUS_BADGE = {
  upcoming: { label: "Coming Soon", cls: "text-yellow-400 bg-yellow-400/10" },
  active: { label: "Active — Claim Now", cls: "text-green-400 bg-green-400/10" },
  claimed_out: { label: "All Claimed", cls: "text-muted-foreground bg-muted/30" },
  ended: { label: "Ended", cls: "text-muted-foreground bg-muted/30" },
  cancelled: { label: "Cancelled", cls: "text-destructive bg-destructive/10" },
};

export default function EventGiveawayPublic({ eventId }) {
  const [giveaways, setGiveaways] = useState([]);
  const [user, setUser] = useState(null);
  const [claimedIds, setClaimedIds] = useState(new Set());
  const [claiming, setClaiming] = useState(null);
  const [proofNotes, setProofNotes] = useState({});

  useEffect(() => {
    base44.entities.EventGiveawaySetup.filter({ event_id: eventId }, null, 10).then(g => {
      const active = g.filter(x => !["cancelled"].includes(x.status));
      setGiveaways(active);
    }).catch(() => {});
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.email) {
        base44.entities.EventGiveawayClaim.filter({ event_id: eventId, user_email: u.email }, null, 20)
          .then(claims => setClaimedIds(new Set(claims.map(c => c.giveaway_id))))
          .catch(() => {});
      }
    }).catch(() => {});
  }, [eventId]);

  if (!giveaways.length) return null;

  const handleClaim = async (giveaway) => {
    if (!user) { toast.error("Please sign in to claim this reward."); return; }
    if (user.role !== "user") { toast.error("Only fan accounts can claim giveaways."); return; }
    if (claimedIds.has(giveaway.id)) { toast.info("You have already claimed this reward."); return; }
    if (giveaway.status !== "active") { toast.error("This giveaway is not currently active."); return; }
    const remaining = giveaway.total_quantity - (giveaway.claimed_quantity || 0);
    if (remaining <= 0) { toast.error("Sorry, all rewards have been claimed."); return; }

    setClaiming(giveaway.id);
    // Create claim record
    await base44.entities.EventGiveawayClaim.create({
      giveaway_id: giveaway.id,
      event_id: eventId,
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name || user.email,
      eligibility_action: giveaway.eligibility_action,
      proof_note: proofNotes[giveaway.id] || "",
      reward_name: giveaway.reward_name,
      status: "claimed",
      claimed_at: new Date().toISOString(),
    });
    // Increment claimed_quantity
    const newClaimed = (giveaway.claimed_quantity || 0) + 1;
    const newStatus = newClaimed >= giveaway.total_quantity ? "claimed_out" : giveaway.status;
    await base44.entities.EventGiveawaySetup.update(giveaway.id, { claimed_quantity: newClaimed, status: newStatus });
    setClaimedIds(prev => new Set([...prev, giveaway.id]));
    setGiveaways(prev => prev.map(g => g.id === giveaway.id ? { ...g, claimed_quantity: newClaimed, status: newStatus } : g));
    toast.success("🎁 Reward claimed! Check your email for confirmation.");
    setClaiming(null);
  };

  return (
    <div className="space-y-3">
      {giveaways.map(giveaway => {
        const badge = STATUS_BADGE[giveaway.status] || STATUS_BADGE.upcoming;
        const remaining = giveaway.total_quantity - (giveaway.claimed_quantity || 0);
        const isClaimed = claimedIds.has(giveaway.id);
        const isFan = user?.role === "user";
        const canClaim = giveaway.status === "active" && !isClaimed && remaining > 0 && isFan;
        const needsProof = giveaway.eligibility_action === "repost_share";

        return (
          <div key={giveaway.id} className="p-4 rounded-xl bg-green-500/5 border border-green-500/30">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎁</span>
                <div>
                  <p className="font-display font-bold text-sm">GIVEAWAY</p>
                  <p className="font-display font-bold text-base">{giveaway.title}</p>
                </div>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>{badge.label}</span>
            </div>

            <div className="space-y-2 text-xs font-mono text-muted-foreground">
              <p><span className="text-foreground font-bold">Reward:</span> {giveaway.reward_name}</p>
              {giveaway.reward_description && <p>{giveaway.reward_description}</p>}
              {giveaway.status === "active" && (
                <p><span className="text-foreground font-bold">Remaining:</span> <span className={remaining <= 3 ? "text-destructive font-bold" : "text-green-400 font-bold"}>{remaining} of {giveaway.total_quantity}</span></p>
              )}
              {giveaway.status === "claimed_out" && <p className="text-destructive font-bold">All {giveaway.total_quantity} rewards have been claimed.</p>}
              <p><span className="text-foreground font-bold">How to claim:</span> {ELIGIBILITY_LABELS[giveaway.eligibility_action] || giveaway.eligibility_action}</p>
              {giveaway.eligibility_notes && <p className="italic">{giveaway.eligibility_notes}</p>}
              {giveaway.end_datetime && <p><span className="text-foreground font-bold">Ends:</span> {format(new Date(giveaway.end_datetime), "MMM d, yyyy h:mm a")}</p>}
            </div>

            {canClaim && (
              <div className="mt-3 space-y-2">
                {needsProof && (
                  <input
                    type="text"
                    placeholder="Paste your repost link here"
                    value={proofNotes[giveaway.id] || ""}
                    onChange={e => setProofNotes(p => ({ ...p, [giveaway.id]: e.target.value }))}
                    className="w-full rounded-md border border-green-500/30 bg-card px-3 py-2 text-xs"
                  />
                )}
                <button
                  onClick={() => handleClaim(giveaway)}
                  disabled={claiming === giveaway.id}
                  className="w-full py-2.5 rounded-lg bg-green-500 text-white font-display font-bold text-sm hover:bg-green-600 transition-colors disabled:opacity-60"
                >
                  {claiming === giveaway.id ? "Claiming…" : "Claim Reward"}
                </button>
                <p className="text-[10px] text-muted-foreground font-mono text-center">
                  First come, first served — only {remaining} left.
                </p>
              </div>
            )}

            {isClaimed && (
              <div className="mt-3 p-2 rounded-lg bg-green-400/10 border border-green-400/20 text-xs font-mono text-green-400 text-center">
                ✓ You've claimed this reward!{giveaway.collection_instructions ? " " + giveaway.collection_instructions : ""}
              </div>
            )}

            {giveaway.collection_instructions && !isClaimed && (
              <p className="mt-2 text-[10px] text-muted-foreground font-mono italic">Collection: {giveaway.collection_instructions}</p>
            )}

            {user && !isFan && !isClaimed && giveaway.status === "active" && (
              <p className="mt-2 text-[10px] text-muted-foreground font-mono">Only fan accounts can claim this reward.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}