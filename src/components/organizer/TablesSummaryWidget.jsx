import { useState, useEffect } from "react";
import { UtensilsCrossed, CheckCircle2, DollarSign } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function TablesSummaryWidget({ eventIds }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!eventIds || eventIds.length === 0) return;
    // Only fetch for the first 5 events to limit API calls
    const relevantIds = eventIds.slice(0, 5);
    Promise.all(
      relevantIds.map(eid =>
        Promise.all([
          base44.entities.TableReservation.filter({ event_id: eid }, null, 100).catch(() => []),
          base44.entities.Table.filter({ event_id: eid }, null, 50).catch(() => []),
        ])
      )
    ).then(results => {
      const reservations = results.flatMap(([r]) => r);
      const tables = results.flatMap(([, t]) => t);
      const totalExpected = reservations.length;
      const totalCheckedIn = reservations.filter(r => r.status === "checked_in").length;
      const totalTableRevenue = tables.reduce((sum, t) => sum + (t.price || 0) * (t.quantity_sold || 0), 0);
      setStats({ totalExpected, totalCheckedIn, totalTableRevenue });
    });
  }, [JSON.stringify(eventIds.slice(0, 5))]);

  if (!stats || stats.totalExpected === 0) return null;

  const pct = stats.totalExpected > 0 ? Math.round((stats.totalCheckedIn / stats.totalExpected) * 100) : 0;

  return (
    <div className="p-5 rounded-xl bg-card border border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <UtensilsCrossed className="w-4 h-4 text-primary" />
        <h3 className="font-display font-bold text-sm tracking-wide">TABLE RESERVATIONS</h3>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Checked In</p>
          <p className="font-display font-black text-2xl text-green-400">{stats.totalCheckedIn}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Expected</p>
          <p className="font-display font-black text-2xl">{stats.totalExpected}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Table Revenue</p>
          <p className="font-display font-black text-2xl text-accent">${stats.totalTableRevenue.toLocaleString()}</p>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[10px] text-muted-foreground">Check-in progress</span>
          <span className={`font-mono text-xs font-bold ${pct === 100 ? "text-green-400" : "text-primary"}`}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? "bg-green-400" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}