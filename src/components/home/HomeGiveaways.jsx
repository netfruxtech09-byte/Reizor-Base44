import { Link } from "react-router-dom";
import { Gift, Clock, Trophy, Users, ArrowRight, ChevronRight } from "lucide-react";
import { formatGiveawayEndDate } from "@/utils/giveawayUtils";
import SeeAllButton from "./SeeAllButton";

const ELIGIBILITY_LABELS = {
  open_to_all: { label: "Open to All Fans", color: "text-green-400 bg-green-400/10 border-green-400/30" },
  ticket_holders: { label: "Ticket Holders Only", color: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  followers: { label: "Followers Only", color: "text-accent bg-accent/10 border-accent/30" },
  social_action: { label: "Social Action Required", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  manual_approval: { label: "Approval Required", color: "text-orange-400 bg-orange-400/10 border-orange-400/30" },
};

function getEligibilityBadge(rules) {
  if (!rules || rules.length === 0) return null;
  const key = rules[0];
  return ELIGIBILITY_LABELS[key] || null;
}

function GiveawayCard({ giveaway }) {
  const badge = getEligibilityBadge(giveaway.eligibility_rules);
  const endDateStr = formatGiveawayEndDate(giveaway.end_date);
  const endStr = endDateStr ? `Ends: ${endDateStr}` : null;
  const winners = giveaway.num_winners || 1;

  return (
    <Link to={`/giveaways/${giveaway.id}`} className="group block min-w-0">
      <article className="relative overflow-hidden rounded-xl bg-card border border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 flex flex-col">
        {/* Cover image — matches event card ratio */}
        <div className="relative overflow-hidden h-28 sm:h-40 shrink-0">
          {giveaway.cover_image ? (
            <img src={giveaway.cover_image} alt={giveaway.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Gift className="w-10 h-10 text-primary/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          <span className="absolute top-2 right-2 text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/90 text-white border border-primary/50">
            🎁 LIVE
          </span>
        </div>

        {/* Content */}
        <div className="px-3 py-2.5 flex flex-col flex-1">
          <h3 className="font-display font-black text-sm tracking-tight leading-tight text-foreground group-hover:text-primary transition-colors truncate">
            {giveaway.title}
          </h3>

          {giveaway.prize_description && (
            <p className="font-mono text-[11px] text-muted-foreground truncate mt-0.5">
              🏆 {giveaway.prize_description}
            </p>
          )}

          {badge && (
            <span className={`self-start mt-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border ${badge.color}`}>
              {badge.label}
            </span>
          )}

          <div className="flex items-center gap-1 mt-1 font-mono text-[11px] text-muted-foreground">
            <Trophy className="w-3 h-3 text-yellow-400 shrink-0" />
            <span>{winners} winner{winners > 1 ? "s" : ""}</span>
          </div>

          {endStr && (
            <p className="flex items-center gap-1 mt-0.5 font-mono text-[11px] text-muted-foreground truncate">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="truncate">{endStr}</span>
            </p>
          )}

          <div className="mt-2 flex items-center gap-1 font-mono text-[11px] font-bold text-primary">
            Enter Now <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function HomeGiveaways({ giveaways, loading }) {
  const activeGiveaways = (giveaways || [])
    .filter(g => g.status === "active")
    .slice(0, 6);

  if (!loading && activeGiveaways.length === 0) return null;

  return (
    <section className="px-4 py-5 sm:py-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-3 sm:mb-6">
        <div>
          <h2 className="font-display font-black text-xl sm:text-3xl tracking-tight">
            🎁 Giveaways
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1">
            Enter for a chance to win exclusive prizes
          </p>
        </div>
        <SeeAllButton to="/giveaways" />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 rounded-xl bg-card border border-border/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {activeGiveaways.map(g => (
            <GiveawayCard key={g.id} giveaway={g} />
          ))}
        </div>
      )}
    </section>
  );
}