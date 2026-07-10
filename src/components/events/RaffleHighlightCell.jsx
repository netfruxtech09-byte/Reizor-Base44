import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

// Renders the raffle meta-grid cell — hidden completely when no raffle exists
export default function RaffleHighlightCell({ eventId }) {
  const [raffle, setRaffle] = useState(undefined); // undefined = loading

  useEffect(() => {
    base44.entities.EventRaffle.filter({ event_id: eventId }, "-created_date", 1)
      .then(res => setRaffle(res[0] || null))
      .catch(() => setRaffle(null));
  }, [eventId]);

  // Hide while loading or when no raffle
  if (!raffle) return null;

  return (
    <Link
      to={`/raffle/${raffle.id}`}
      className="p-4 rounded-lg bg-card border border-border/50 flex flex-col h-full hover:border-yellow-400/50 transition-colors group"
    >
      <Trophy className="w-4 h-4 text-yellow-400 mb-2" />
      <p className="font-mono text-xs text-muted-foreground">Raffle</p>
      <p className="font-display font-bold text-sm mt-0.5">
        {raffle.status === "drawn" ? "🏆 Drawn" : raffle.status === "active" ? "🎟 Active" : "🎲 Upcoming"}
      </p>
      {raffle.credit_amount > 0 && (
        <p className="font-mono text-xs text-yellow-400 mt-0.5">${raffle.credit_amount} prize</p>
      )}
      <p className="font-mono text-[10px] text-muted-foreground group-hover:text-yellow-400 transition-colors mt-auto pt-1.5">
        View details →
      </p>
    </Link>
  );
}