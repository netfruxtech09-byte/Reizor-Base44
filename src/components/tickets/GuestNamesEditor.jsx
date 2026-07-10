import { useState, useEffect } from "react";
import { Users, Edit2, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function GuestNamesEditor({ userEmail }) {
  const [reservations, setReservations] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userEmail) return;
    base44.entities.TableReservation.filter({ buyer_email: userEmail }, "-created_date", 50)
      .then((res) => { setReservations(res); setLoading(false); });
  }, [userEmail]);

  const startEdit = (res) => {
    setEditingId(res.id);
    setEditName(res.buyer_name || "");
  };

  const saveEdit = async (id) => {
    await base44.entities.TableReservation.update(id, { buyer_name: editName });
    setReservations((prev) => prev.map((r) => r.id === id ? { ...r, buyer_name: editName } : r));
    setEditingId(null);
    toast.success("Guest name updated");
  };

  if (loading || reservations.length === 0) return null;

  return (
    <div className="mb-6 p-4 rounded-xl bg-card border border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="font-display font-bold text-sm">TABLE RESERVATIONS</h3>
        <span className="font-mono text-[10px] text-muted-foreground">— assign guest names to your tables</span>
      </div>
      <div className="space-y-3">
        {reservations.map((res) => (
          <div key={res.id} className="p-3 rounded-lg bg-secondary/50 border border-border/30 space-y-3">
            {/* Header row: table name + status badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-mono font-bold text-sm text-primary truncate">{res.table_name || "Table"}</span>
              </div>
              <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded shrink-0 ${
                res.status === "checked_in" ? "text-green-400 bg-green-400/10" :
                res.status === "cancelled" ? "text-destructive bg-destructive/10" :
                "text-primary bg-primary/10"
              }`}>
                {{ reserved: "Reserved", checked_in: "Checked In", cancelled: "Cancelled" }[res.status] || res.status}
              </span>
            </div>

            {/* Event title */}
            {res.event_title && (
              <p className="text-xs text-muted-foreground font-mono truncate">📅 {res.event_title}</p>
            )}

            {/* Guest name row */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Guest Name</p>
                {editingId === res.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(res.id); if (e.key === "Escape") setEditingId(null); }}
                      placeholder="e.g. Smith Party"
                      className="flex h-8 w-44 rounded-md border border-primary/50 bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(res.id)} className="text-green-400 hover:text-green-300 transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium capitalize ${!res.buyer_name ? "text-muted-foreground italic" : ""}`}>
                      {res.buyer_name || "Not assigned"}
                    </span>
                    <button onClick={() => startEdit(res)} className="text-muted-foreground hover:text-primary transition-colors" title="Edit guest name">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}