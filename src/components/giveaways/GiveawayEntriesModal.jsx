import { useState, useEffect } from "react";
import OrganizerPrizeAnalytics from "@/components/giveaways/OrganizerPrizeAnalytics";
import { X, Users, CheckCircle2, Clock, XCircle, Trophy, Shuffle, Loader2, Eye, ThumbsUp, ThumbsDown, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { sendEmail } from "@/utils/emailService";
import { buildEmailBody } from "@/utils/emailTemplate";

const ENTRY_STATUS_COLORS = {
  submitted:     "text-muted-foreground bg-muted",
  under_review:  "text-yellow-400 bg-yellow-400/10",
  approved:      "text-green-400 bg-green-400/10",
  rejected:      "text-destructive bg-destructive/10",
  winner:        "text-yellow-400 bg-yellow-400/20",
  not_selected:  "text-muted-foreground bg-muted",
};

const PRIZE_STATUS_OPTIONS = [
  "won", "claim_required", "address_required", "processing", "shipped", "completed"
];

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function GiveawayEntriesModal({ giveaway, onClose, onUpdated }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [drawing, setDrawing] = useState(false);
  const [proofEntry, setProofEntry] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [updatingPrize, setUpdatingPrize] = useState(null);
  const [trackingInput, setTrackingInput] = useState("");

  const load = async () => {
    const all = await base44.entities.GiveawayEntry.filter({ giveaway_id: giveaway.id }, "-created_date", 500).catch(() => []);
    setEntries(all);

    // Update counters on giveaway
    const pending = all.filter(e => e.status === "under_review").length;
    const approved = all.filter(e => e.status === "approved" || e.status === "winner").length;
    await base44.entities.Giveaway.update(giveaway.id, {
      total_entries: all.length,
      approved_entries: approved,
      pending_proof_reviews: pending,
    }).catch(() => {});

    setLoading(false);
  };

  useEffect(() => { load(); }, [giveaway.id]);

  const filtered = entries.filter(e => {
    if (tab === "all") return true;
    if (tab === "pending") return e.status === "under_review";
    if (tab === "approved") return e.status === "approved";
    if (tab === "winners") return e.is_winner;
    return true;
  });

  const handleApprove = async (entry) => {
    await base44.entities.GiveawayEntry.update(entry.id, { status: "approved", reviewed_at: new Date().toISOString() });
    toast.success("Entry approved");
    load();
    onUpdated();
  };

  const handleReject = async (entry) => {
    await base44.entities.GiveawayEntry.update(entry.id, {
      status: "rejected",
      rejection_reason: rejectionReason,
      reviewed_at: new Date().toISOString(),
    });
    toast.success("Entry rejected");
    setProofEntry(null);
    setRejectionReason("");
    load();
    onUpdated();
  };

  const handleDrawWinners = async () => {
    const pool = entries.filter(e => e.status === "approved");
    if (pool.length === 0) {
      toast.error("No approved entries to draw from. Approve some entries first.");
      return;
    }
    const needed = giveaway.num_winners || 1;
    if (pool.length < needed) {
      toast(`⚠️ Only ${pool.length} approved entries, but ${needed} winners needed. Drawing all approved.`);
    }
    setDrawing(true);
    const shuffled = shuffleArray(pool);
    const winnerEntries = shuffled.slice(0, needed);
    const notWinners = shuffled.slice(needed);

    // Mark winners
    await Promise.all([
      ...winnerEntries.map(e => base44.entities.GiveawayEntry.update(e.id, {
        status: "winner",
        is_winner: true,
        prize_status: giveaway.prize_type === "physical_item" ? "address_required" : "won",
        notified_at: new Date().toISOString(),
      })),
      ...notWinners.map(e => base44.entities.GiveawayEntry.update(e.id, { status: "not_selected" })),
    ]);

    // Update giveaway
    await base44.entities.Giveaway.update(giveaway.id, {
      winners_selected: true,
      winner_emails: winnerEntries.map(e => e.user_email),
      winner_names: winnerEntries.map(e => e.user_name || e.user_email),
      drawn_at: new Date().toISOString(),
      status: "ended",
    });

    // Use backend function to create prizes with duplicate detection
    await base44.functions.invoke('giveawaySelectWinnersAndCreatePrizes', {
      giveaway_id: giveaway.id,
      selected_winner_ids: winnerEntries.map(e => e.user_id || ""),
    }).catch(err => console.warn("Prize creation via backend failed, continuing with inline creation:", err));

    // Fallback: if backend function didn't create prizes, do it inline (for backwards compatibility)
    await Promise.all(winnerEntries.map(async e => {
      // Check if prize already exists for this user
      const existing = await base44.entities.PrizeWallet.filter(
        { giveaway_id: giveaway.id, user_email: e.user_email },
        null,
        1
      ).catch(() => []);

      if (existing.length > 0) return; // Skip if already created

      // Create PrizeWallet entry with QR code and unique redemption code
      try {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        const redemptionCode = `PRIZE-${timestamp.toUpperCase()}${random.toUpperCase()}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(redemptionCode)}`;
        const expiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

        await base44.entities.PrizeWallet.create({
         user_id: e.user_id || "",
         user_email: e.user_email,
         user_name: e.user_name || e.user_email,
         giveaway_id: giveaway.id,
         giveaway_title: giveaway.title,
         event_id: giveaway.linked_event_id || null,
         event_title: giveaway.linked_event_title || null,
         organizer_id: giveaway.owner_id || "",
         organizer_name: giveaway.owner_name || "",
         prize_title: giveaway.prize_name || giveaway.prize_description,
         prize_description: giveaway.prize_description,
         prize_type: giveaway.prize_type || "custom",
         redemption_code: redemptionCode,
         qr_code_url: qrUrl,
         status: "unclaimed",
         redemption_instructions: giveaway.terms_and_conditions || "Show this QR code to claim your prize.",
         expiry_date: expiryDate,
        });
      } catch (prizeErr) {
        console.warn("Failed to create prize wallet:", prizeErr);
      }

      await base44.entities.Notification.create({
        user_email: e.user_email,
        title: `🎉 You won a prize: ${giveaway.prize_description}!`,
        message: `Open My Prizes to view your QR code and claim instructions.`,
        type: "prize_won",
        link: "/my-prizes",
      }).catch(() => {});

      await sendEmail({
        _source: "GiveawayEntriesModal/draw",
        to: e.user_email,
        subject: `🎉 You won: ${giveaway.title}!`,
        body: buildEmailBody({
          title: "🎉 You're a Giveaway Winner!",
          greeting: `Hi ${e.user_name || e.user_email},`,
          message: `Congratulations! You've been selected as a winner in <strong>${giveaway.title}</strong>.`,
          infoBox: {
            highlight: true,
            rows: [
              { label: "Prize", value: giveaway.prize_description },
              { label: "Giveaway", value: giveaway.title },
            ],
          },
          ctaText: "View My Prizes →",
          ctaUrl: `${window.location.origin}/my-prizes`,
        }),
      }).catch(() => {});
    }));

    toast.success(`${winnerEntries.length} winner${winnerEntries.length !== 1 ? "s" : ""} selected and notified!`);
    setDrawing(false);
    load();
    onUpdated();
  };

  const handleUpdatePrizeStatus = async (entryId, status, tracking) => {
    setUpdatingPrize(entryId);
    const payload = { prize_status: status };
    if (tracking) payload.prize_tracking = tracking;
    await base44.entities.GiveawayEntry.update(entryId, payload);
    toast.success("Prize status updated");
    setUpdatingPrize(null);
    setTrackingInput("");
    load();
  };

  const TABS = [
    { key: "all", label: `All (${entries.length})` },
    { key: "pending", label: `Pending (${entries.filter(e => e.status === "under_review").length})` },
    { key: "approved", label: `Approved (${entries.filter(e => e.status === "approved").length})` },
    { key: "winners", label: `Winners (${entries.filter(e => e.is_winner).length})` },
    { key: "prizes", label: `Prize Claims` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto">
      <div className="w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div>
            <h2 className="font-display font-black text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Entries: {giveaway.title}
            </h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{entries.length} total · {giveaway.num_winners || 1} winner(s)</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {/* Draw Winners button */}
        {!giveaway.winners_selected && entries.filter(e => e.status === "approved").length > 0 && (
          <div className="px-6 pt-4">
            <Button onClick={handleDrawWinners} disabled={drawing} className="w-full gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold">
              {drawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
              {drawing ? "Drawing Winners..." : `🎲 Draw ${giveaway.num_winners || 1} Winner${giveaway.num_winners !== 1 ? "s" : ""} (Random)`}
            </Button>
          </div>
        )}

        {giveaway.winners_selected && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-400/10 border border-green-400/20">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <p className="text-sm font-bold text-green-400">Winners already drawn — {entries.filter(e => e.is_winner).length} winners selected</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-3 mx-6 mt-4 bg-muted rounded-lg overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold whitespace-nowrap transition-colors ${tab === t.key ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Prize Analytics Tab */}
        {tab === "prizes" && (
          <div className="p-6">
            <OrganizerPrizeAnalytics giveaway={giveaway} />
          </div>
        )}

        {/* Entries list */}
         {tab !== "prizes" && <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No entries in this category</p>
          ) : filtered.map(entry => (
            <div key={entry.id} className="p-4 rounded-xl bg-secondary border border-border/30 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-sm">{entry.user_name || entry.user_email}</p>
                  <p className="text-xs font-mono text-muted-foreground">{entry.user_email}</p>
                  {entry.created_date && (
                    <p className="text-xs font-mono text-muted-foreground">{format(new Date(entry.created_date), "MMM d, yyyy h:mm a")}</p>
                  )}
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase shrink-0 ${ENTRY_STATUS_COLORS[entry.status]}`}>
                  {entry.status.replace(/_/g, " ")}
                </span>
              </div>

              {/* Proof submission */}
              {(entry.proof_image_url || entry.proof_link || entry.proof_note) && (
                <div className="p-3 rounded-lg bg-card border border-border/50 space-y-2">
                  <p className="text-xs font-mono font-bold text-muted-foreground uppercase">Proof Submitted</p>
                  {entry.proof_image_url && (
                    <img src={entry.proof_image_url} alt="Proof" className="w-full max-h-40 object-cover rounded-lg border border-border/50" />
                  )}
                  {entry.proof_link && (
                    <a href={entry.proof_link} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline font-mono block">
                      🔗 {entry.proof_link}
                    </a>
                  )}
                  {entry.proof_note && <p className="text-xs text-muted-foreground">{entry.proof_note}</p>}
                </div>
              )}

              {/* Approve/Reject for pending */}
              {entry.status === "submitted" || entry.status === "under_review" ? (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-green-400/30 text-green-400 hover:bg-green-400/10"
                    onClick={() => handleApprove(entry)}>
                    <ThumbsUp className="w-3 h-3" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => setProofEntry(entry)}>
                    <ThumbsDown className="w-3 h-3" /> Reject
                  </Button>
                </div>
              ) : null}

              {/* Rejection form */}
              {proofEntry?.id === entry.id && (
                <div className="space-y-2">
                  <Input value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Rejection reason (optional)" className="text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => handleReject(entry)}>Confirm Reject</Button>
                    <Button size="sm" variant="ghost" onClick={() => setProofEntry(null)}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Prize fulfillment for winners */}
              {entry.is_winner && (
                <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-mono font-bold text-yellow-400">🏆 WINNER · Prize Status</p>
                    <select
                      value={entry.prize_status || "won"}
                      onChange={e => handleUpdatePrizeStatus(entry.id, e.target.value, null)}
                      disabled={updatingPrize === entry.id}
                      className="text-xs px-2 py-1 rounded bg-card border border-border/50 text-foreground">
                      {PRIZE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  {entry.delivery_address && (
                    <div className="text-xs text-muted-foreground font-mono">
                      <p className="font-bold text-foreground">Delivery: {entry.delivery_name}</p>
                      <p>{entry.delivery_address}</p>
                    </div>
                  )}
                  {entry.prize_status === "shipped" && (
                    <div className="flex gap-2">
                      <Input value={trackingInput} onChange={e => setTrackingInput(e.target.value)} placeholder="Tracking number" className="text-xs h-7" />
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleUpdatePrizeStatus(entry.id, "shipped", trackingInput)}>
                        <Truck className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>}
        </div>
        </div>
        );
        }