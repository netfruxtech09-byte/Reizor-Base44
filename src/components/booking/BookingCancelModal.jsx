import { useState } from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function BookingCancelModal({ booking, currentUser, onClose, onCancelled }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await base44.entities.ArtistBooking.update(booking.id, {
      status: "cancelled",
      cancellation_reason: reason.trim() || "No reason provided",
      cancelled_by: currentUser.email,
    });

    // Log to history
    await base44.entities.BookingHistory.create({
      booking_id: booking.id,
      action: "Booking cancelled",
      detail: reason.trim() || "No reason provided",
      actor_email: currentUser.email,
      actor_name: currentUser.full_name || currentUser.email,
    }).catch(() => {});

    toast.success("Booking cancelled");
    onCancelled?.({ status: "cancelled", cancellation_reason: reason.trim(), cancelled_by: currentUser.email });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <h2 className="font-display font-bold text-lg">Cancel Booking</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
            <p className="font-bold text-destructive mb-1">This action cannot be undone.</p>
            <p className="text-muted-foreground">
              You are cancelling the booking for <span className="font-bold text-foreground">{booking.artist_name}</span> at{" "}
              <span className="font-bold text-foreground">{booking.event_name}</span>.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Reason for cancellation (optional)
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Artist unavailable, event postponed, budget change..."
              className="w-full rounded-lg bg-secondary border border-border/50 px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-destructive"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 pt-0">
          <Button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 bg-destructive hover:bg-destructive/90 text-white font-display font-bold gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            {saving ? "Cancelling..." : "Confirm Cancellation"}
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1 font-display font-bold">
            Keep Booking
          </Button>
        </div>
      </div>
    </div>
  );
}