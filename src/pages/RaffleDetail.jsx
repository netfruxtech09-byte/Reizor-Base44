import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Trophy, Calendar, Clock, ArrowLeft, ExternalLink, CheckCircle2, Star, X, Users } from "lucide-react";
import ShareSaveBar from "@/components/shared/ShareSaveBar";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";
import { toast } from "sonner";
import MembershipSection from "@/components/loyalty/MembershipSection";
import PrizeGuideModal from "@/components/onboarding/PrizeGuideModal";
import { maybeTriggerPrizeGuide } from "@/lib/onboardingGuides";

function StatusBadge({ status }) {
  const config = {
    upcoming: { label: "⏳ Upcoming", classes: "bg-yellow-400/10 text-yellow-400 border border-yellow-400/30" },
    active:   { label: "🎟 Active",   classes: "bg-green-400/10 text-green-400 border border-green-400/30" },
    ended:    { label: "🔒 Ended",    classes: "bg-muted text-muted-foreground border border-border" },
    drawn:    { label: "🏆 Winners Drawn", classes: "bg-yellow-400/20 text-yellow-400 border border-yellow-400/40" },
    cancelled:{ label: "✗ Cancelled", classes: "bg-destructive/10 text-destructive border border-destructive/30" },
  };
  const c = config[status] || config.ended;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full font-mono text-xs font-bold ${c.classes}`}>
      {c.label}
    </span>
  );
}

function Countdown({ targetDate, label, participants }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const update = () => setRemaining(formatDistanceToNow(new Date(targetDate), { addSuffix: true }));
    update();
    const iv = setInterval(update, 30000);
    return () => clearInterval(iv);
  }, [targetDate]);
  return (
    <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-center">
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">{label}</p>
      <p className="font-display font-bold text-sm text-accent">{remaining}</p>
      {participants > 0 && (
        <div className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-accent/20">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground">
            {participants} participant{participants !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

export default function RaffleDetail() {
  const { raffleId } = useParams();
  const navigate = useNavigate();
  const [raffle, setRaffle] = useState(null);
  const [event, setEvent]   = useState(null);
  const [user, setUser]     = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [entry, setEntry]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [entering, setEntering] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showPrizeGuide, setShowPrizeGuide] = useState(false);

  const load = useCallback(async () => {
    const [me, raffles] = await Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.EventRaffle.filter({ id: raffleId }, null, 1),
    ]);
    setUser(me);
    const r = raffles[0] || null;
    setRaffle(r);

    if (r?.event_id) {
      base44.entities.Event.filter({ id: r.event_id }, null, 1).then(evs => setEvent(evs[0] || null));
    }

    if (me && r) {
      const [loyAccs, entries] = await Promise.all([
        base44.entities.LoyaltyAccount.filter({ user_email: me.email }, null, 1).catch(() => []),
        base44.entities.RaffleEntry.filter({ raffle_id: r.id, user_email: me.email }, null, 1).catch(() => []),
      ]);
      setLoyalty(loyAccs[0] || null);
      setEntry(entries[0] || null);
    }
    setLoading(false);
  }, [raffleId]);

  useEffect(() => { load(); }, [load]);

  const handleEnter = async () => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }
    setEntering(true);
    await base44.entities.RaffleEntry.create({
      raffle_id: raffle.id,
      event_id: raffle.event_id,
      user_email: user.email,
      user_name: user.full_name || user.email,
      num_entries: 1,
      is_winner: false,
    });
    await base44.entities.EventRaffle.update(raffle.id, {
      total_entries: (raffle.total_entries || 0) + 1,
    });
    toast.success("🎉 You're entered in the raffle!");
    setEntering(false);
    await load();
    maybeTriggerPrizeGuide(user, setShowPrizeGuide);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!raffle) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="font-display font-bold text-xl">Raffle not found</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  const hasActiveMembership = loyalty?.membership_status === "active";
  const isActive   = raffle.status === "active";
  const isUpcoming = raffle.status === "upcoming";
  const isEnded    = ["ended", "drawn", "cancelled"].includes(raffle.status);
  const isFan      = user?.role === "user";
  const canEnter   = isActive && user && isFan && hasActiveMembership && !entry;
  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/40 safe-top-header" data-safe-top>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 font-display font-bold text-base truncate">🎟 Raffle Details</h1>
          {raffle.event_id && (
            <Link
              to={`/events/${raffle.event_id}`}
              className="flex items-center gap-1.5 text-xs font-mono text-accent border border-accent/30 px-3 py-1.5 rounded-lg hover:bg-accent/10 transition-colors shrink-0"
            >
              <ExternalLink className="w-3 h-3" /> View Event
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-5">
        {/* Title + Status */}
        <div className="space-y-2">
          {raffle.status !== "active" && (
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={raffle.status} />
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-yellow-400 shrink-0" />
            <h2 className="font-display font-black text-3xl tracking-tight flex-1">{raffle.name}</h2>
          </div>
          {/* Share + Save — moved beside the title, large touch-friendly targets */}
          <ShareSaveBar
            activityType="raffle"
            activityId={raffle.id}
            activityTitle={raffle.name}
            eventId={raffle.event_id}
            eventTitle={raffle.event_title}
            shareUrl={window.location.href}
            shareText={raffle.description || raffle.prize_description || "Enter for a chance to win!"}
            size="lg"
          />
          {raffle.event_title && (
            <p className="text-sm text-muted-foreground font-mono">Event: <span className="text-foreground font-semibold">{raffle.event_title}</span></p>
          )}
          {raffle.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{raffle.description}</p>
          )}
        </div>

        {/* Prize */}
        <div className="p-5 rounded-2xl bg-yellow-400/10 border border-yellow-400/30 space-y-2">
          <p className="font-mono text-[10px] text-yellow-400 uppercase tracking-widest">🏆 Prize</p>
          {raffle.credit_amount > 0 && (
            <p className="font-display font-black text-4xl text-yellow-400">${raffle.credit_amount}</p>
          )}
          {raffle.prize_description ? (
            <p className="text-sm text-foreground">{raffle.prize_description}</p>
          ) : raffle.credit_amount > 0 ? (
            <p className="text-sm text-muted-foreground">Credit toward a future event ticket</p>
          ) : null}
          <p className="font-mono text-xs text-yellow-400/70">
            {raffle.num_winners || 1} winner{(raffle.num_winners || 1) > 1 ? "s" : ""} selected · {raffle.winner_selection === "manual" ? "Manually chosen" : "Random draw"}
          </p>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          {raffle.start_datetime && (
            <div className="p-4 rounded-xl bg-card border border-border/50">
              <Calendar className="w-4 h-4 text-primary mb-1.5" />
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Starts</p>
              <p className="font-display font-bold text-sm mt-0.5">
                {format(new Date(raffle.start_datetime), "MMM d, yyyy")}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {format(new Date(raffle.start_datetime), "h:mm a")}
              </p>
            </div>
          )}
          {raffle.end_datetime && (
            <div className="p-4 rounded-xl bg-card border border-border/50">
              <Clock className="w-4 h-4 text-destructive mb-1.5" />
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Ends</p>
              <p className="font-display font-bold text-sm mt-0.5">
                {format(new Date(raffle.end_datetime), "MMM d, yyyy")}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {format(new Date(raffle.end_datetime), "h:mm a")}
              </p>
            </div>
          )}
        </div>

        {/* Countdown */}
        {raffle.start_datetime && isUpcoming && isFuture(new Date(raffle.start_datetime)) && (
          <Countdown targetDate={raffle.start_datetime} label="Raffle opens" participants={raffle.total_entries || 0} />
        )}
        {raffle.end_datetime && isActive && isFuture(new Date(raffle.end_datetime)) && (
          <Countdown targetDate={raffle.end_datetime} label="Raffle closes" participants={raffle.total_entries || 0} />
        )}

        {/* Upgrade Membership button — shown immediately after countdown for non-members */}
        {user && isFan && !hasActiveMembership && !isEnded && (
          <Button
            onClick={() => setShowMembershipModal(true)}
            className="w-full glow-lime font-display font-bold gap-2"
          >
            <Star className="w-4 h-4" /> Upgrade Membership to Participate
          </Button>
        )}

        {/* Winners section */}
        {raffle.status === "drawn" && raffle.winner_names?.length > 0 && (
          <div className="p-4 rounded-2xl bg-yellow-400/10 border border-yellow-400/30 space-y-3">
            <p className="font-mono text-[10px] text-yellow-400 uppercase tracking-wider font-bold">🏆 Winners</p>
            {raffle.winner_names.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
                <span className="font-bold text-sm">{name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Membership requirement notice */}
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-primary shrink-0" />
            <p className="font-display font-bold text-sm">Membership Required</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Only members with an <span className="font-bold text-foreground">active membership</span> can participate in this raffle.
          </p>
          {hasActiveMembership && (
            <div className="flex items-center gap-1.5 text-xs text-green-400 font-mono font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Your membership is active
            </div>
          )}
        </div>

        {/* ── CTA block ── */}
        <div className="space-y-3 pb-4">
          {/* Not logged in */}
          {!user && (
            <div className="p-4 rounded-xl bg-card border border-border/50 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Please log in or create an account to participate in this raffle.</p>
              <Button
                onClick={() => base44.auth.redirectToLogin(window.location.pathname)}
                className="w-full glow-lime font-display font-bold"
              >
                Log In / Sign Up
              </Button>
            </div>
          )}

          {/* Non-fan accounts cannot participate */}
          {user && !isFan && (
            <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
              <p className="text-sm text-muted-foreground">Only fan accounts can enter raffles.</p>
            </div>
          )}

          {/* Already entered */}
          {user && isFan && hasActiveMembership && entry && (
            <div className="p-4 rounded-xl bg-green-400/10 border border-green-400/30 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="font-display font-bold text-sm text-green-400">You are already entered in this raffle!</p>
                <p className="text-xs text-muted-foreground">Good luck — winners are announced after the draw.</p>
              </div>
            </div>
          )}

          {/* Can enter */}
          {canEnter && (
            <Button
              onClick={handleEnter}
              disabled={entering}
              className="w-full h-14 glow-lime font-display font-bold text-base gap-2"
            >
              {entering ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Entering...</>
              ) : (
                <>🎟 Enter Raffle — Free to Join</>
              )}
            </Button>
          )}

          {/* Upcoming — not started */}
          {isUpcoming && (
            <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-center">
              <p className="text-xs font-mono text-muted-foreground">Raffle hasn't started yet. Check back when it opens!</p>
            </div>
          )}

          {/* Ended */}
          {isEnded && raffle.status !== "drawn" && (
            <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-center">
              <p className="text-xs font-mono text-muted-foreground">This raffle has ended. No more entries accepted.</p>
            </div>
          )}

          {/* View event button */}
          {raffle.event_id && (
            <Button
              variant="outline"
              onClick={() => navigate(`/events/${raffle.event_id}`)}
              className="w-full font-display font-bold gap-2"
            >
              <ExternalLink className="w-4 h-4" /> View Event
            </Button>
          )}
        </div>
      </div>

      {/* Membership upgrade modal */}
      {showMembershipModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-background border border-border/60 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
              <div>
                <h2 className="font-display font-bold text-base">Choose a Membership Plan</h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">Unlock raffle entry after subscribing</p>
              </div>
              <button
                onClick={() => setShowMembershipModal(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-4">
              <MembershipSection
                loyalty={loyalty}
                onUpdate={(updated) => {
                  setLoyalty(updated);
                  setShowMembershipModal(false);
                  toast.success("🎉 Membership active! You can now enter the raffle.");
                  load();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showPrizeGuide && <PrizeGuideModal onClose={() => setShowPrizeGuide(false)} />}
    </div>
  );
}