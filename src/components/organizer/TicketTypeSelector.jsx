import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

export default function TicketTypeSelector({ eventId, value, onChange }) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) { setTypes([]); return; }
    setLoading(true);
    base44.entities.TicketType.filter({ event_id: eventId }, "sort_order", 50)
      .then(setTypes)
      .catch(() => setTypes([]))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (!eventId) {
    return (
      <div className="mt-1">
        <Select disabled>
          <SelectTrigger className="bg-card border-border/50">
            <SelectValue placeholder="Select event first" />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <Select
        value={value}
        onValueChange={(typeId) => {
          const t = types.find(tt => tt.id === typeId);
          onChange(typeId, t?.name || "");
        }}
      >
        <SelectTrigger className="bg-card border-border/50">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <SelectValue placeholder="Choose ticket type..." />
          )}
        </SelectTrigger>
        <SelectContent>
          {types.map(t => (
            <SelectItem key={t.id} value={t.id}>
              {t.name} {t.price > 0 ? `($${t.price})` : "(Free)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}