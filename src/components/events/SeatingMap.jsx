import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import SeatMapViewer from "./SeatMapViewer";

// Fan-facing seat selector: loads the event's SeatMap and lets users pick seats.
// Falls back to the old table-tier card grid if no SeatMap exists.

export default function SeatingMap({ eventId, tableTiers, onTableSelect, selectedTableId, onSeatsSelected }) {
  const [seatMap, setSeatMap] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [maps, reserved] = await Promise.all([
        base44.entities.SeatMap.filter({ event_id: eventId }, null, 1).catch(() => []),
        base44.entities.TableReservation.filter({ event_id: eventId, status: "reserved" }, null, 500).catch(() => []),
      ]);
      setSeatMap(maps[0] || null);
      setReservations(reserved);
      setLoading(false);
    })();
  }, [eventId]);

  const handleSeatToggle = ({ seatId, sectionId, row, col, price, tierName, proximity }) => {
    setSelectedSeats(prev => {
      const next = prev.includes(seatId) ? prev.filter(s => s !== seatId) : [...prev, seatId];
      onSeatsSelected?.({ seats: next, price: next.length * price, tierName, proximity });
      return next;
    });
  };

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  // Interactive SVG seat map
  if (seatMap && seatMap.sections?.length > 0) {
    const takenSeats = seatMap.taken_seats || [];
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-display font-bold text-lg mb-1">SELECT YOUR SEAT</h3>
          <p className="text-sm text-muted-foreground">Click individual seats on the map. Row letters and section tiers shown.</p>
        </div>
        <SeatMapViewer
          seatMap={seatMap}
          takenSeats={takenSeats}
          selectedSeats={selectedSeats}
          onSeatToggle={handleSeatToggle}
          maxSelectable={10}
        />
        {selectedSeats.length > 0 && (
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
            <p className="font-mono text-sm font-bold text-primary">{selectedSeats.length} seat{selectedSeats.length > 1 ? "s" : ""} selected</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedSeats.join(", ")}</p>
          </div>
        )}
      </div>
    );
  }

  // Fallback: table tier card grid
  if (!tableTiers || tableTiers.length === 0) return null;

  const reservedByName = {};
  reservations.forEach(r => {
    reservedByName[r.table_name] = (reservedByName[r.table_name] || 0) + 1;
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Click a table below to reserve it.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tableTiers.map(tier => {
          const available = (tier.quantity_total || 0) - (reservedByName[tier.name] || 0);
          const isSelected = selectedTableId === tier.id;
          const isSoldOut = available <= 0;
          return (
            <button key={tier.id}
              onClick={() => !isSoldOut && onTableSelect(tier.id, tier)}
              disabled={isSoldOut}
              className={`relative p-4 sm:p-5 rounded-xl border-2 transition-all text-left touch-manipulation ${
                isSelected ? "border-primary/80 bg-primary/10" :
                isSoldOut ? "border-border/30 bg-muted/30 cursor-not-allowed opacity-50" :
                "border-border/50 bg-card hover:border-primary/50"
              }`}
              aria-pressed={isSelected}
            >
              {/* Header: Name + Status */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-display font-bold text-sm sm:text-base leading-tight">{tier.name}</p>
                  {tier.description && (
                    <p className="text-xs text-muted-foreground mt-1">{tier.description}</p>
                  )}
                </div>
                {isSelected && (
                  <span className="inline-block shrink-0 bg-primary text-primary-foreground text-xs font-mono font-bold px-2.5 py-1 rounded">✓</span>
                )}
                {isSoldOut && (
                  <span className="inline-block shrink-0 bg-destructive/10 text-destructive text-xs font-mono font-bold px-2.5 py-1 rounded">SOLD OUT</span>
                )}
              </div>

              {/* Details: Guests + Price */}
              <div className="space-y-2 border-t border-border/30 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">👥 Capacity:</span>
                  <span className="text-xs font-mono font-bold">{tier.guests_per_table} guests</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">💰 Price:</span>
                  <span className="font-mono font-bold text-primary text-sm">${tier.price?.toFixed(2)}</span>
                </div>
                {!isSoldOut && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">📍 Available:</span>
                    <span className="text-xs font-mono font-bold">{available} table{available > 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-col sm:flex-row gap-3 text-xs text-muted-foreground font-mono pt-2 border-t border-border/30">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border border-primary bg-primary/20" />
          <span>Selected / Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border border-border/50 bg-muted/30" />
          <span>Sold Out</span>
        </div>
      </div>
    </div>
  );
}