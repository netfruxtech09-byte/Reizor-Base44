import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { BarChart3, Calendar, Clock, ArrowLeft, ExternalLink, CheckCircle2 } from "lucide-react";
import ShareSaveBar from "@/components/shared/ShareSaveBar";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format, formatDistanceToNow, isFuture } from "date-fns";
import { toast } from "sonner";
import PrizeGuideModal from "@/components/onboarding/PrizeGuideModal";
import { maybeTriggerPrizeGuide } from "@/lib/onboardingGuides";
import FollowGateButton from "@/components/loyalty/FollowGateButton";
import PollOptions from "@/components/loyalty/PollOptions";

function StatusBadge({ status }) {
  const config = {
    upcoming: { label: "⏳ Upcoming", classes: "bg-yellow-400/10 text-yellow-400 border border-yellow-400/30" },
    active:   { label: "🟢 Live",     classes: "bg-green-400/10 text-green-400 border border-green-400/30" },
    ended:    { label: "🔒 Ended",    classes: "bg-muted text-muted-foreground border border-border" },
  };
  const c = config[status] || config.ended;
  return <span className={`inline-flex items-center px-3 py-1 rounded-full font-mono text-xs font-bold ${c.classes}`}>{c.label}</span>;
}

export default function PollDetail() {
  const { pollId } = useParams();
  const navigate = useNavigate();
  const [poll, setPoll] = useState(null);
  const [user, setUser] = useState(null);
  const [myVotes, setMyVotes] = useState([]);
  const [voting, setVoting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localVoteCounts, setLocalVoteCounts] = useState([]);
  const [showPrizeGuide, setShowPrizeGuide] = useState(false);
  const [organizerName, setOrganizerName] = useState("");

  const load = useCallback(async () => {
    const [me, polls] = await Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.EventPoll.filter({ id: pollId }, null, 1),
    ]);
    setUser(me);
    const p = polls[0] || null;
    setPoll(p);
    if (p && !p.created_by_admin && p.organizer_id) {
      const organizer = await base44.entities.User.get(p.organizer_id).catch(() => null);
      setOrganizerName(organizer?.full_name || organizer?.email || "the organizer");
    }
    if (p) {
      const counts = p.vote_counts?.length === p.options?.length
        ? p.vote_counts
        : (p.options || []).map((_, i) => i === 0 ? (p.votes_a || 0) : i === 1 ? (p.votes_b || 0) : 0);
      setLocalVoteCounts(counts);
    }
    if (me && p) {
      const existing = await base44.entities.PollVote.filter({ poll_id: p.id, voter_email: me.email }, null, 10).catch(() => []);
      setMyVotes(existing.map(v => v.choice));
    }
    setLoading(false);
  }, [pollId]);

  useEffect(() => { load(); }, [load]);

  const handleVote = async (optionIndex) => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }
    if (myVotes.includes(String(optionIndex))) return;
    if (poll.status !== "active") return;
    setVoting(true);
    try {
      await base44.entities.PollVote.create({
        poll_id: poll.id,
        event_id: poll.event_id || "",
        voter_email: user.email,
        choice: String(optionIndex),
      });
      const newCounts = [...localVoteCounts];
      newCounts[optionIndex] = (newCounts[optionIndex] || 0) + 1;
      setLocalVoteCounts(newCounts);
      const totalVotes = (poll.total_votes || 0) + 1;
      const updateData = { total_votes: totalVotes, vote_counts: newCounts };
      if (optionIndex === 0) updateData.votes_a = (poll.votes_a || 0) + 1;
      if (optionIndex === 1) updateData.votes_b = (poll.votes_b || 0) + 1;
      await base44.entities.EventPoll.update(poll.id, updateData);
      setMyVotes(prev => [...prev, String(optionIndex)]);
      setPoll(prev => ({ ...prev, ...updateData }));
      toast.success("Vote recorded!");
      const isOrganizerOwned = !poll.created_by_admin && poll.organizer_id;
      base44.functions.invoke("awardLoyaltyPoints", {
        action_type: "poll",
        owner_type: isOrganizerOwned ? "organizer" : "platform",
        owner_id: isOrganizerOwned ? poll.organizer_id : "platform",
        owner_name: isOrganizerOwned ? organizerName : "Reizor Community",
        source_id: poll.id,
      }).catch(() => {});
      maybeTriggerPrizeGuide(user, setShowPrizeGuide);
    } catch {
      toast.error("Failed to record vote");
    }
    setVoting(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!poll) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="font-display font-bold text-xl">Poll not found</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
      </div>
    </div>
  );

  const now = new Date();
  const hasStarted = poll.start_datetime && new Date(poll.start_datetime) <= now;
  const hasExpired = poll.end_datetime && new Date(poll.end_datetime) <= now;
  const isActive = hasStarted && !hasExpired;
  const isUpcoming = !hasStarted;
  const isEnded = hasExpired;
  const hasVoted = myVotes.length > 0;
  const showResults = poll.show_results_immediately || hasVoted || isEnded;
  const totalVotes = localVoteCounts.reduce((s, c) => s + (c || 0), 0);
  const options = poll.options || [poll.option_a, poll.option_b].filter(Boolean);

  // Calculate display status based on actual time
  let displayStatus = poll.status;
  if (isUpcoming) displayStatus = "upcoming";
  else if (isActive) displayStatus = "active";
  else if (isEnded) displayStatus = "ended";

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/40 safe-top-header" data-safe-top>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 font-display font-bold text-base truncate">📊 Poll</h1>
          <ShareSaveBar
            activityType="poll"
            activityId={poll.id}
            activityTitle={poll.question}
            eventId={poll.event_id}
            eventTitle={poll.event_title}
            shareUrl={window.location.href}
            shareText={poll.question}
          />
          {poll.event_id && (
            <Link to={`/events/${poll.event_id}`}
              className="flex items-center gap-1.5 text-xs font-mono text-accent border border-accent/30 px-3 py-1.5 rounded-lg hover:bg-accent/10 transition-colors shrink-0">
              <ExternalLink className="w-3 h-3" /> View Event
            </Link>
          )}
        </div>
      </div>

      {/* Hero */}
      <div className="relative h-32 bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
        <BarChart3 className="w-14 h-14 text-accent opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 relative z-10 space-y-5">
        {/* Status + question */}
         <div className="space-y-2">
           <div className="flex items-center gap-2 flex-wrap">
             <StatusBadge status={displayStatus} />
            {(!poll.event_id) && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">Standalone Poll</span>
            )}
          </div>
          <h2 className="font-display font-black text-3xl tracking-tight leading-tight">{poll.question}</h2>
          {poll.event_title && (
            <p className="text-sm text-muted-foreground font-mono">Event: <span className="text-foreground font-semibold">{poll.event_title}</span></p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          {poll.start_datetime && (
            <div className="p-3 rounded-xl bg-card border border-border/50">
              <Calendar className="w-4 h-4 text-primary mb-1" />
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Starts</p>
              <p className="font-display font-bold text-sm">{format(new Date(poll.start_datetime), "MMM d, yyyy")}</p>
            </div>
          )}
          {poll.end_datetime && (
            <div className="p-3 rounded-xl bg-card border border-border/50">
              <Clock className="w-4 h-4 text-destructive mb-1" />
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Ends</p>
              <p className="font-display font-bold text-sm">{format(new Date(poll.end_datetime), "MMM d, yyyy")}</p>
            </div>
          )}
        </div>

        {/* Countdown */}
         {poll.start_datetime && isUpcoming && (
           <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-center">
             <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Poll starts</p>
             <p className="font-display font-bold text-sm text-yellow-400">
               {formatDistanceToNow(new Date(poll.start_datetime), { addSuffix: true })}
             </p>
           </div>
         )}
         {poll.end_datetime && isActive && (
           <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-center">
             <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Poll closes</p>
             <p className="font-display font-bold text-sm text-accent">
               {formatDistanceToNow(new Date(poll.end_datetime), { addSuffix: true })}
             </p>
           </div>
         )}
         {isEnded && (
           <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-center">
             <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Poll ended</p>
             <p className="font-display font-bold text-sm text-muted-foreground">
               {poll.end_datetime ? formatDistanceToNow(new Date(poll.end_datetime), { addSuffix: true }) : "—"}
             </p>
           </div>
         )}

        {/* Vote options */}
        <div className="space-y-3">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            {isEnded ? "Final Results" : hasVoted ? "Results" : isActive ? "Cast your vote" : "Options"}
          </p>
          {!poll.created_by_admin && poll.organizer_id && user && isActive && !hasVoted ? (
            <FollowGateButton
              ownerType="organizer"
              ownerId={poll.organizer_id}
              ownerName={organizerName || "the organizer"}
              userEmail={user.email}
              userName={user.full_name}
            >
              <PollOptions options={options} localVoteCounts={localVoteCounts} showResults={showResults} totalVotes={totalVotes} myVotes={myVotes} hasVoted={hasVoted} isActive={isActive} voting={voting} user={user} handleVote={handleVote} />
            </FollowGateButton>
          ) : (
            <PollOptions options={options} localVoteCounts={localVoteCounts} showResults={showResults} totalVotes={totalVotes} myVotes={myVotes} hasVoted={hasVoted} isActive={isActive} voting={voting} user={user} handleVote={handleVote} />
          )}
          {totalVotes > 0 && (
            <p className="font-mono text-xs text-muted-foreground text-right">{totalVotes} total vote{totalVotes !== 1 ? "s" : ""}</p>
          )}
        </div>

        {/* Auth CTA */}
        {!user && isActive && (
          <div className="p-4 rounded-xl bg-card border border-border/50 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Sign in to cast your vote</p>
            <Button onClick={() => base44.auth.redirectToLogin(window.location.pathname)} className="w-full glow-lime font-display font-bold">
              Log In / Sign Up
            </Button>
          </div>
        )}


      </div>

      {showPrizeGuide && <PrizeGuideModal onClose={() => setShowPrizeGuide(false)} />}
    </div>
  );
}