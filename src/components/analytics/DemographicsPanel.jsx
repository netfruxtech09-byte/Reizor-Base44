import { useMemo } from "react";
import { Users, MapPin, Globe } from "lucide-react";

function BreakdownList({ title, data, color = "bg-primary" }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (data.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{title}</h4>
      {data.slice(0, 8).map(({ label, count }) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-xs mb-0.5">
              <span className="truncate font-medium">{label}</span>
              <span className="font-mono text-muted-foreground ml-2 shrink-0">{count}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.round((count / total) * 100)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function groupBy(arr, keyFn) {
  const map = {};
  arr.forEach(item => {
    const key = keyFn(item) || "Unknown";
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export default function DemographicsPanel({ tickets, events, filterEventId = "all" }) {
  const buyers = useMemo(() => {
    // Get unique buyer emails from filtered tickets
    const filtered = filterEventId === "all"
      ? tickets
      : tickets.filter(t => t.event_id === filterEventId);
    return filtered;
  }, [tickets, filterEventId]);

  // We use ticket owner data (city/country fields on User are not directly on tickets)
  // So we group by what's available on ticket records + event data
  const byCity = useMemo(() => groupBy(buyers.filter(t => t.owner_city), t => t.owner_city), [buyers]);
  const byCountry = useMemo(() => groupBy(buyers.filter(t => t.owner_country), t => t.owner_country), [buyers]);
  const byState = useMemo(() => groupBy(buyers.filter(t => t.owner_state), t => t.owner_state), [buyers]);

  // Event-based demographics: attendees per event city
  const filteredEvents = filterEventId === "all" ? events : events.filter(e => e.id === filterEventId);
  const byEventCity = useMemo(() => groupBy(filteredEvents, e => e.city), [filteredEvents]);
  const byEventCountry = useMemo(() => groupBy(filteredEvents, e => e.country), [filteredEvents]);

  // Ticket type breakdown
  const byTicketType = useMemo(() => groupBy(buyers, t => t.ticket_type_name), [buyers]);

  const uniqueBuyers = useMemo(() => new Set(buyers.map(t => t.owner_email)).size, [buyers]);

  const hasUserGeo = byCity.length > 0 || byCountry.length > 0 || byState.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
          <Users className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="font-mono font-bold text-xl text-primary">{buyers.length}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Tickets Sold</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
          <Users className="w-4 h-4 text-accent mx-auto mb-1" />
          <p className="font-mono font-bold text-xl">{uniqueBuyers}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Unique Buyers</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
          <Globe className="w-4 h-4 text-green-400 mx-auto mb-1" />
          <p className="font-mono font-bold text-xl">{filteredEvents.length}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Events</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {hasUserGeo ? (
          <>
            {byCity.length > 0 && (
              <div className="p-5 rounded-xl bg-card border border-border/50">
                <BreakdownList title="Attendees by City" data={byCity} color="bg-primary" />
              </div>
            )}
            {byCountry.length > 0 && (
              <div className="p-5 rounded-xl bg-card border border-border/50">
                <BreakdownList title="Attendees by Country" data={byCountry} color="bg-accent" />
              </div>
            )}
            {byState.length > 0 && (
              <div className="p-5 rounded-xl bg-card border border-border/50">
                <BreakdownList title="Attendees by State" data={byState} color="bg-green-500" />
              </div>
            )}
          </>
        ) : (
          <div className="p-5 rounded-xl bg-card border border-border/50 sm:col-span-2">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-3">Audience Location</p>
            <p className="text-sm text-muted-foreground">Detailed attendee location data is not yet available. Location data is collected as attendees update their profiles.</p>
          </div>
        )}

        {byTicketType.length > 0 && (
          <div className="p-5 rounded-xl bg-card border border-border/50">
            <BreakdownList title="Tickets by Type" data={byTicketType} color="bg-purple-500" />
          </div>
        )}

        {byEventCity.length > 0 && (
          <div className="p-5 rounded-xl bg-card border border-border/50">
            <BreakdownList title="Events by City" data={byEventCity} color="bg-yellow-500" />
          </div>
        )}

        {byEventCountry.length > 0 && (
          <div className="p-5 rounded-xl bg-card border border-border/50">
            <BreakdownList title="Events by Country" data={byEventCountry} color="bg-cyan-500" />
          </div>
        )}
      </div>
    </div>
  );
}