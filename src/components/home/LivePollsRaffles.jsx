import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Trophy, BarChart3, ArrowRight, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import useInView from "@/hooks/useInView";

export default function LivePollsRaffles({ raffles: propRaffles, polls: propPolls, loading: propLoading }) {
  const raffles = propRaffles || null;
  const polls = propPolls || null;
  const loading = propLoading ?? false;
  const fetched = !propLoading && propRaffles !== undefined;

  const [containerRef] = useInView();

  const now = new Date().toISOString();

  // Trust the backend "active" status (kept accurate by admin edits and the
  // periodic sync job). Only extra check: hide it if its end date already
  // passed but the status update hasn't landed yet (defensive safety net).
  // Missing start/end dates must NOT hide an otherwise-active raffle/poll.
  const liveRaffles = useMemo(() =>
    (raffles || []).filter((r) =>
      r.status === "active" &&
      (!r.end_datetime || r.end_datetime >= now)
    ).slice(0, 6),
    [raffles, now]
  );

  const livePolls = useMemo(() =>
    (polls || []).filter((p) =>
      p.status === "active" &&
      (!p.end_datetime || p.end_datetime >= now)
    ).slice(0, 6),
    [polls, now]
  );

  if (liveRaffles.length === 0 && livePolls.length === 0) return null;

  return (
    <section ref={containerRef} className="px-4 py-5 sm:py-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-3 sm:mb-6">
        <div>
          <h2 className="font-display font-black text-xl sm:text-3xl tracking-tight">
            🔥 Live Polls & Raffles
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1">Participate in active giveaways and community votes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {liveRaffles.map((raffle) => (
          <Link key={raffle.id} to={`/raffle/${raffle.id}`}
            className="group bg-card border border-border/50 rounded-xl sm:rounded-2xl p-3 sm:p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
            <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
              <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl bg-yellow-400/10 flex items-center justify-center shrink-0">
                <Trophy className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-400" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-green-400/10 text-green-400 border border-green-400/30">🟢 LIVE</span>
            </div>
            <h3 className="font-display font-bold text-sm sm:text-base leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-2">{raffle.name}</h3>
            {raffle.prize_description && <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-2">🏆 {raffle.prize_description}</p>}
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground gap-1">
              <span className="truncate">{raffle.total_entries || 0} entries</span>
              {raffle.end_datetime && (
                <span className="flex items-center gap-0.5 shrink-0"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(raffle.end_datetime), { addSuffix: true })}</span>
              )}
            </div>
            <div className="mt-2 sm:mt-3 flex items-center gap-1 text-xs font-mono text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Enter Raffle <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        ))}

        {livePolls.map((poll) => (
          <Link key={poll.id} to={`/poll/${poll.id}`}
            className="group bg-card border border-border/50 rounded-xl sm:rounded-2xl p-3 sm:p-5 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all">
            <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
              <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 sm:w-5 h-4 sm:h-5 text-accent" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-green-400/10 text-green-400 border border-green-400/30">🟢 LIVE</span>
            </div>
            <h3 className="font-display font-bold text-sm sm:text-base leading-tight mb-1 group-hover:text-accent transition-colors line-clamp-2">{poll.question}</h3>
            {poll.options?.length > 0 && (
              <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-1">
                {poll.options.slice(0, 3).join(" · ")}{poll.options.length > 3 ? "…" : ""}
              </p>
            )}
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground gap-1">
              <span className="truncate">{poll.total_votes || 0} votes</span>
              {poll.end_datetime && (
                <span className="flex items-center gap-0.5 shrink-0"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(poll.end_datetime), { addSuffix: true })}</span>
              )}
            </div>
            <div className="mt-2 sm:mt-3 flex items-center gap-1 text-xs font-mono text-accent opacity-0 group-hover:opacity-100 transition-opacity">
              Vote Now <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}