import { useState } from "react";
import { X, AlertTriangle, RefreshCw, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function CancelEventModal({ event, tickets, orders, mode, onClose, onDone }) {
  // mode: "cancel" | "delete"
  const [resolution, setResolution] = useState(null); // "refund" | "credit" | null
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const affectedOrders = orders.filter(o => o.status === "completed");
  const affectedTickets = tickets.filter(t => t.status === "active");
  // All users who ever had a ticket (active OR scanned) must be notified
  const allTicketHolders = [...new Set(tickets.filter(t => ["active","scanned"].includes(t.status)).map(t => t.owner_email))];
  const hasTickets = affectedTickets.length > 0;

  const sendCancellationNotifications = async (emailsToNotify, message) => {
    console.log('[CancelEvent] Sending notifications to:', emailsToNotify);
    await Promise.all(emailsToNotify.map(async (email) => {
      const subject = `Event Cancelled: ${event.title}`;
      const body = `We regret to inform you that the event "${event.title}" has been cancelled by the organizer.${note ? `\n\nNote from organizer: ${note}` : ""}\n\nPlease log in to your account for available options and any next steps regarding your ticket purchase.\n\nThank you for your understanding.\n\n— Reizor\n\nTo unsubscribe from Reizor notifications, visit your account settings.`;
      try {
        await Promise.all([
          base44.integrations.Core.SendEmail({ to: email, subject, body }),
          base44.entities.Notification.create({
            user_email: email,
            title: `Event Cancelled: ${event.title}`,
                message: `The event "${event.title}" has been cancelled by the organizer. Please log in to your account for next steps.${note ? ` Note: ${note}` : ""}`,
            type: "event_update",
            event_id: event.id,
            event_title: event.title,
          }),
        ]);
        console.log('[CancelEvent] NOTIFIED USER:', email);
      } catch (err) {
        console.error('[CancelEvent] Failed for:', email, err.message);
        try { await base44.integrations.Core.SendEmail({ to: email, subject, body }); } catch (e) { console.error('[CancelEvent] Retry failed:', e.message); }
      }
    }));
  };

  const handleConfirm = async () => {
    if (hasTickets && !resolution) {
      toast.error("Please choose how to handle existing ticket holders");
      return;
    }
    setProcessing(true);
    console.log('[CancelEvent] EVENT CANCEL TRIGGERED — event:', event.title, '| mode:', mode, '| resolution:', resolution, '| affected holders:', allTicketHolders.length);
    console.log('[CancelEvent] AFFECTED USERS:', allTicketHolders);

    if (hasTickets) {
      if (resolution === "refund") {
        await Promise.all([
          ...affectedTickets.map(t => base44.entities.Ticket.update(t.id, { status: "refunded" })),
          ...affectedOrders.map(o => base44.entities.Order.update(o.id, { status: "refunded" })),
        ]);
        await sendCancellationNotifications(allTicketHolders, `Your ticket(s) have been refunded. The amount will appear on your statement within 5-10 business days.`);
      } else if (resolution === "credit") {
        const byEmail = {};
        affectedTickets.forEach(t => {
          if (!byEmail[t.owner_email]) byEmail[t.owner_email] = { name: t.owner_name, total: 0 };
          byEmail[t.owner_email].total += (t.price_paid || 0);
        });
        await Promise.all([
          ...Object.entries(byEmail).map(([email, data]) =>
            base44.entities.OrganizerCredit.create({
              user_email: email,
              organizer_id: event.organizer_id,
              organizer_name: event.organizer_name || "Organizer",
              amount: data.total,
              source_event_id: event.id,
              source_event_title: event.title,
              note: `Credit for cancelled event: ${event.title}`,
            })
          ),
          ...affectedTickets.map(t => base44.entities.Ticket.update(t.id, { status: "cancelled" })),
        ]);
        // Notify each with their specific credit amount
        await Promise.all(allTicketHolders.map(async (email) => {
          const creditAmt = byEmail[email]?.total;
          const message = creditAmt
            ? `You have been issued $${creditAmt.toFixed(2)} in store credit with ${event.organizer_name || "the organizer"}, valid for their future events.`
            : `Please check your account for next steps.`;
          const subject = `Event Cancelled: ${event.title}`;
          const body = `We regret to inform you that the event "${event.title}" has been cancelled by the organizer.${note ? `\n\nNote from organizer: ${note}` : ""}\n\n${message}\n\nPlease log in to your account for available options and any next steps regarding your ticket purchase.\n\nThank you for your understanding.\n\n— Reizor\n\nTo unsubscribe from Reizor notifications, visit your account settings.`;
          try {
            await Promise.all([
              base44.integrations.Core.SendEmail({ to: email, subject, body }),
              base44.entities.Notification.create({
                user_email: email,
                title: `Event Cancelled: ${event.title}`,
                message: `The event "${event.title}" has been cancelled by the organizer. ${message}`,
                type: "event_update",
                event_id: event.id,
                event_title: event.title,
              }),
            ]);
            console.log('[CancelEvent] NOTIFIED USER:', email);
          } catch (err) {
            console.error('[CancelEvent] Failed for:', email, err.message);
            try { await base44.integrations.Core.SendEmail({ to: email, subject, body }); } catch (e) { console.error('[CancelEvent] Retry failed:', e.message); }
          }
        }));
      }
    } else if (allTicketHolders.length > 0) {
      // Scanned-only ticket holders still need to be notified
      await sendCancellationNotifications(allTicketHolders, `Please check your account for any next steps.`);
    } else {
      console.log('[CancelEvent] No ticket holders to notify.');
    }

    if (mode === "delete") {
      // Also notify on delete if there were any ticket holders
      if (allTicketHolders.length > 0) {
        await sendCancellationNotifications(allTicketHolders, `Please check your account for any next steps.`);
      }
      await base44.entities.Event.delete(event.id);
      console.log('[CancelEvent] Event deleted:', event.id);
      toast.success("Event deleted");
    } else {
      await base44.entities.Event.update(event.id, {
        status: "cancelled",
        cancellation_note: note,
      });
      console.log('[CancelEvent] Event marked cancelled:', event.id);
      toast.success("Event cancelled — ticket holders notified");
    }

    setProcessing(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md space-y-5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="font-display font-bold text-lg">
              {mode === "delete" ? "Delete Event" : "Cancel Event"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          {mode === "delete"
            ? `Are you sure you want to permanently delete "${event.title}"? This cannot be undone.`
            : `Are you sure you want to cancel "${event.title}"? Ticket holders will be notified.`}
        </p>

        {/* Note */}
        <div>
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Message to ticket holders (optional)
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Due to unforeseen circumstances..."
            className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm resize-none"
          />
        </div>

        {/* Ticket resolution */}
        {hasTickets && (
          <div>
            <p className="text-sm font-bold mb-1">
              {affectedTickets.length} active ticket{affectedTickets.length > 1 ? "s" : ""} need resolution:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setResolution("refund")}
                className={`p-4 rounded-lg border text-left transition-all ${
                  resolution === "refund"
                    ? "border-green-500/60 bg-green-500/10"
                    : "border-border/50 bg-secondary hover:border-green-500/30"
                }`}
              >
                <RefreshCw className={`w-4 h-4 mb-2 ${resolution === "refund" ? "text-green-400" : "text-muted-foreground"}`} />
                <p className="font-display font-bold text-sm">Refund</p>
                <p className="text-xs text-muted-foreground mt-0.5">Full money back to buyers</p>
              </button>
              <button
                onClick={() => setResolution("credit")}
                className={`p-4 rounded-lg border text-left transition-all ${
                  resolution === "credit"
                    ? "border-accent/60 bg-accent/10"
                    : "border-border/50 bg-secondary hover:border-accent/30"
                }`}
              >
                <CreditCard className={`w-4 h-4 mb-2 ${resolution === "credit" ? "text-accent" : "text-muted-foreground"}`} />
                <p className="font-display font-bold text-sm">Store Credit</p>
                <p className="text-xs text-muted-foreground mt-0.5">Credit for your next event</p>
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Keep Event
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={processing || (hasTickets && !resolution)}
            className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {processing ? "Processing..." : mode === "delete" ? "Delete" : "Cancel Event"}
          </Button>
        </div>
      </div>
    </div>
  );
}