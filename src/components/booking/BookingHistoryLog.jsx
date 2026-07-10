import { useState, useEffect } from "react";
import { History, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

const ACTION_COLORS = {
  "Artist assigned":    "text-accent bg-accent/10",
  "Status changed":     "text-yellow-400 bg-yellow-400/10",
  "Payment updated":    "text-green-400 bg-green-400/10",
  "Booking cancelled":  "text-destructive bg-destructive/10",
  "Note added":         "text-muted-foreground bg-muted",
  "Contract created":   "text-primary bg-primary/10",
  "Contract signed":    "text-green-400 bg-green-400/10",
};

function getColor(action) {
  for (const key of Object.keys(ACTION_COLORS)) {
    if (action?.startsWith(key)) return ACTION_COLORS[key];
  }
  return "text-muted-foreground bg-muted";
}

export default function BookingHistoryLog({ bookingId, refreshTrigger }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    base44.entities.BookingHistory.filter({ booking_id: bookingId }, "-created_date", 200)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [bookingId, refreshTrigger]);

  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      <div className="p-4 border-b border-border/30 flex items-center gap-2">
        <History className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold">Event History</h2>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
          Audit Log
        </span>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-6">No history yet</p>
        ) : (
          <div className="relative pl-4 border-l border-border/40 space-y-4">
            {history.map((entry) => (
              <div key={entry.id} className="relative">
                {/* Dot */}
                <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-border border-2 border-background" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${getColor(entry.action)}`}>
                      {entry.action}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {entry.created_date ? format(new Date(entry.created_date), "MMM dd, yyyy · h:mm a") : ""}
                    </span>
                  </div>
                  {entry.detail && (
                    <p className="text-xs text-muted-foreground">{entry.detail}</p>
                  )}
                  <p className="text-[10px] font-mono text-muted-foreground/60">by {entry.actor_name || entry.actor_email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}