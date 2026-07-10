import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Activity, TrendingUp } from "lucide-react";

export default function StaffActivityLog({ organizerId }) {
  const [scans, setScans] = useState([]);
  const [staffStats, setStaffStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);

  useEffect(() => {
    loadActivity();
    
    // Subscribe to real-time scan updates
    const unsubscribe = base44.entities.Scan.subscribe((event) => {
      if (event.type === 'create') {
        // Add new scan to the top and update stats
        setScans(prev => [event.data, ...prev]);
        setStaffStats(prev => {
          const updated = { ...prev };
          const email = event.data.scanned_by_email;
          if (!updated[email]) {
            updated[email] = { total: 0, valid: 0, invalid: 0, duplicate: 0 };
          }
          updated[email].total++;
          updated[email][event.data.result]++;
          return updated;
        });
      }
    });
    
    return unsubscribe;
  }, [organizerId]);

  const loadActivity = async () => {
    setLoading(true);
    // Get organizer's events
    const events = await base44.entities.Event.filter({ organizer_id: organizerId }, null, 100);
    const eventIds = events.map(e => e.id);

    // Get scans for all events
    if (eventIds.length > 0) {
      const allScans = await base44.entities.Scan.filter({ event_id: { $in: eventIds } }, "-created_date", 500);
      setScans(allScans);

      // Calculate stats per staff member
      const stats = {};
      allScans.forEach(scan => {
        if (!stats[scan.scanned_by_email]) {
          stats[scan.scanned_by_email] = { total: 0, valid: 0, invalid: 0, duplicate: 0 };
        }
        stats[scan.scanned_by_email].total++;
        stats[scan.scanned_by_email][scan.result]++;
      });
      setStaffStats(stats);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-3 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const filteredScans = selectedStaff ? scans.filter(s => s.scanned_by_email === selectedStaff) : scans;
  const staffEmails = Object.keys(staffStats).sort((a, b) => staffStats[b].total - staffStats[a].total);

  return (
    <div className="space-y-4">
      {/* Staff stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
        {staffEmails.length === 0 ? (
          <div className="col-span-full p-4 text-center text-muted-foreground text-sm">
            No scan activity yet
          </div>
        ) : (
          staffEmails.map(email => {
            const stats = staffStats[email];
            const isSelected = selectedStaff === email;
            return (
              <button
                key={email}
                onClick={() => setSelectedStaff(isSelected ? null : email)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "bg-primary/10 border-primary/30"
                    : "bg-card border-border/50 hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground truncate">{email}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-400" />
                        <span className="font-mono text-sm font-bold text-green-400">{stats.valid}</span>
                      </span>
                      <span className="text-muted-foreground font-mono text-[10px]">valid</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-bold text-lg">{stats.total}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">scans</p>
                  </div>
                </div>
                {(stats.invalid > 0 || stats.duplicate > 0) && (
                  <div className="flex gap-1.5 text-[10px] mt-2">
                    {stats.invalid > 0 && (
                      <span className="font-mono text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                        {stats.invalid} invalid
                      </span>
                    )}
                    {stats.duplicate > 0 && (
                      <span className="font-mono text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                        {stats.duplicate} dup
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Activity log */}
      {filteredScans.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              {selectedStaff ? `Activity for ${selectedStaff}` : "Recent Activity"} ({filteredScans.length})
            </h3>
          </div>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border/50 bg-card divide-y divide-border/30">
            {filteredScans.slice(0, 50).map((scan, i) => (
              <div key={i} className="p-3 text-sm hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-muted-foreground">{scan.ticket_code}</span>
                      <span
                        className={`font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          scan.result === "valid"
                            ? "text-green-400 bg-green-400/10"
                            : scan.result === "duplicate"
                            ? "text-yellow-400 bg-yellow-400/10"
                            : "text-destructive bg-destructive/10"
                        }`}
                      >
                        {scan.result}
                      </span>
                    </div>
                    {!selectedStaff && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-1">{scan.scanned_by_email}</p>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono shrink-0 text-right">
                    {format(new Date(scan.created_date), "MMM d, h:mm a")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}