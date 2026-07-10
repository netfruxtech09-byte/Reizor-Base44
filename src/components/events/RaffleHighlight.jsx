import { useEffect, useState } from "react";
import { Trophy, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import RaffleWinShare from "./RaffleWinShare";

export default function RaffleHighlight({ eventId, event, compact = false }) {
  const [raffles, setRaffles] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.entities.EventRaffle.filter({ event_id: eventId }, "-created_date", 10).then(setRaffles);
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, [eventId]);

  if (raffles.length === 0) {
    return null;
  }

  if (compact) {
    const raffle = raffles[0];
    return (
      <div className="flex flex-col h-full">
        <Trophy className="w-4 h-4 text-yellow-400 mb-2" />
        <p className="font-mono text-xs text-muted-foreground">Raffle</p>
        <p className="font-display font-bold text-sm mt-0.5">
          {raffle.status === "drawn" ? "🏆 Drawn" : raffle.status === "active" ? "🎟 Active" : "🎲 Upcoming"}
        </p>
        {raffle.credit_amount > 0 && (
          <p className="font-mono text-xs text-yellow-400 mt-0.5">${raffle.credit_amount} prize</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-400" /> RAFFLES
      </h3>
      <div className="space-y-3">
        {raffles.map((raffle) => (
          <div
            key={raffle.id}
            className="p-4 rounded-xl border bg-card relative overflow-hidden"
            style={{ borderColor: raffle.status === "drawn" ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.1)" }}
          >
            {/* Glow accent */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-yellow-400/10 blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between gap-3 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    raffle.status === "drawn"
                      ? "text-yellow-400 bg-yellow-400/15"
                      : "text-primary bg-primary/10"
                  }`}>
                    {raffle.status === "drawn" ? "🏆 Winners Drawn" : "🎟 Raffle Active"}
                  </span>
                </div>

                {raffle.description && (
                  <p className="text-sm font-medium mb-2">{raffle.description}</p>
                )}

                <p className="text-xs text-muted-foreground font-mono">
                  <span className="text-yellow-400 font-bold">{raffle.num_winners}</span> winner{raffle.num_winners > 1 ? "s" : ""} ·{" "}
                  <span className="text-yellow-400 font-bold">${raffle.credit_amount}</span> credit for next event
                </p>
              </div>
            </div>

            {raffle.status === "drawn" && raffle.winner_names?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-yellow-400/20 space-y-1.5">
                <p className="font-mono text-[10px] text-yellow-400 uppercase tracking-wider">🏆 Winners</p>
                {raffle.winner_names.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    <span className="font-bold">{name}</span>
                  </div>
                ))}
                {/* Show share button only to the winner */}
                {currentUser && raffle.winner_emails?.includes(currentUser.email) && (
                  <RaffleWinShare raffle={raffle} event={event} userName={currentUser.full_name} />
                )}
              </div>
            )}

            {raffle.status === "upcoming" && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  🎲 Buy a ticket to be entered in the raffle — winners chosen randomly from all purchasers!
                </p>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-border/30">
              <Link
                to={`/raffle/${raffle.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-yellow-400 hover:text-yellow-300 transition-colors font-bold"
              >
                <ExternalLink className="w-3 h-3" /> View Raffle Details
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}