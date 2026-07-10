import { useState, useEffect } from "react";
import { Users, Edit2, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function TableReservationManager({ eventId }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    base44.entities.TableReservation.filter({ event_id: eventId }, "-created_date", 200)
      .then((res) => { setReservations(res); setLoading(false); });
  }, [eventId]);

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

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (reservations.length === 0) return (
    <div className="text-center py-10 text-sm text-muted-foreground bg-card rounded-lg border border-border/50">
      No table reservations yet
    </div>
  );

  return (
    <div className="bg-card rounded-lg border border-border/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Table</th>
              <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Guest Name</th>
              <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {reservations.map((res) => (
              <tr key={res.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-mono font-bold text-sm">{res.table_name || "—"}</span>
                  </div>
                </td>
                <td className="p-3">
                  {editingId === res.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(res.id); if (e.key === "Escape") setEditingId(null); }}
                        className="flex h-8 w-40 rounded-md border border-primary/50 bg-secondary px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                    <span className="font-medium">{res.buyer_name || <span className="text-muted-foreground italic">Unassigned</span>}</span>
                  )}
                </td>
                <td className="p-3 text-xs text-muted-foreground font-mono">{res.buyer_email || "—"}</td>
                <td className="p-3">
                  <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded ${
                    res.status === "checked_in" ? "text-green-400 bg-green-400/10" :
                    res.status === "cancelled" ? "text-destructive bg-destructive/10" :
                    "text-primary bg-primary/10"
                  }`}>
                    {res.status}
                  </span>
                </td>
                <td className="p-3">
                  {editingId !== res.id && (
                    <button onClick={() => startEdit(res)} className="text-muted-foreground hover:text-primary transition-colors" title="Edit guest name">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}