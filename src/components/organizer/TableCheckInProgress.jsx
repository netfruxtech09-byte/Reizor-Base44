import { useState, useEffect } from "react";
import { Users, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function TableCheckInProgress({ eventId }) {
  const [reservations, setReservations] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.TableReservation.filter({ event_id: eventId }, "table_name", 200),
      base44.entities.Table.filter({ event_id: eventId }, "sort_order", 50),
    ]).then(([res, tbls]) => {
      setReservations(res);
      setTables(tbls);
      setLoading(false);
    });
  }, [eventId]);

  if (loading) return null;
  if (reservations.length === 0) return null;

  // Group reservations by table_name
  const grouped = reservations.reduce((acc, res) => {
    const key = res.table_name || "Unknown Table";
    if (!acc[key]) acc[key] = { total: 0, checkedIn: 0, reservations: [] };
    acc[key].total++;
    if (res.status === "checked_in") acc[key].checkedIn++;
    acc[key].reservations.push(res);
    return acc;
  }, {});

  const totalReservations = reservations.length;
  const totalCheckedIn = reservations.filter((r) => r.status === "checked_in").length;
  const overallPct = totalReservations > 0 ? Math.round((totalCheckedIn / totalReservations) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-lg">TABLE CHECK-IN PROGRESS</h2>
        <span className="font-mono text-sm font-bold text-primary">{totalCheckedIn}/{totalReservations} checked in</span>
      </div>

      {/* Overall bar */}
      <div className="mb-5 p-4 rounded-xl bg-card border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Overall Progress</span>
          <span className={`font-mono text-sm font-bold ${overallPct === 100 ? "text-green-400" : "text-primary"}`}>{overallPct}%</span>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${overallPct === 100 ? "bg-green-400" : "bg-primary"}`}
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Per-table breakdown */}
      <div className="space-y-3">
        {Object.entries(grouped).map(([tableName, data]) => {
          const pct = data.total > 0 ? Math.round((data.checkedIn / data.total) * 100) : 0;
          const guestNames = data.reservations.map((r) => r.buyer_name).filter(Boolean);
          return (
            <div key={tableName} className="p-4 rounded-lg bg-card border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-display font-bold text-sm">{tableName}</span>
                  {data.checkedIn === data.total && data.total > 0 && (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  )}
                </div>
                <span className={`font-mono text-xs font-bold ${pct === 100 ? "text-green-400" : "text-muted-foreground"}`}>
                  {data.checkedIn}/{data.total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-green-400" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {guestNames.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {data.reservations.map((r, i) => (
                    <span
                      key={i}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        r.status === "checked_in"
                          ? "text-green-400 bg-green-400/10 border-green-400/20"
                          : "text-muted-foreground bg-secondary border-border/30"
                      }`}
                    >
                      {r.buyer_name || "Guest"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}