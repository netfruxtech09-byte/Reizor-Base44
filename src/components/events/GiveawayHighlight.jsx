import { useState, useEffect } from "react";
import { Gift, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Public-facing giveaway banner for an event.
 * Shows only if there's an active (not drawn/closed) giveaway for the event.
 */
export default function GiveawayHighlight({ eventId }) {
  const [giveaway, setGiveaway] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) { setLoading(false); return; }
    base44.entities.EventGiveaway
      .filter({ event_id: eventId, status: "active" }, "-created_date", 1)
      .then(data => { setGiveaway(data[0] || null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [eventId]);

  if (loading || !giveaway) return null;

  const totalPrizes = (giveaway.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const itemNames = (giveaway.items || []).map(i => i.subject).filter(Boolean);

  return (
    <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <Gift className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">🎁 Active Giveaway</p>
          <p className="font-display font-bold text-sm leading-tight">
            {totalPrizes} Prize{totalPrizes !== 1 ? "s" : ""} to be Won!
          </p>
        </div>
      </div>

      {itemNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {itemNames.map((name, i) => (
            <span key={i} className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
              {name}
            </span>
          ))}
        </div>
      )}

      <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-amber-300">Ticket Holders Only</p>
          <p className="text-[11px] text-amber-200/80 leading-relaxed mt-0.5">
            This giveaway is available only to users who have purchased a ticket for this event.
          </p>
        </div>
      </div>
    </div>
  );
}