import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useAuthGate } from "@/hooks/useAuthGate";

export default function WaitlistButton({ event }) {
  const [status, setStatus] = useState("idle"); // idle | joined | loading
  const [entry, setEntry] = useState(null);
  const { requireAuth } = useAuthGate();

  useEffect(() => {
    (async () => {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return;
      const entries = await base44.entities.WaitlistEntry.filter(
        { event_id: event.id, user_email: user.email }, null, 1
      );
      if (entries[0]) { setEntry(entries[0]); setStatus("joined"); }
    })();
  }, [event.id]);

  const toggle = async () => {
    const authed = await requireAuth("Sign in to join the waitlist for this event.");
    if (!authed) return;
    const user = await base44.auth.me().catch(() => null);
    if (!user) return;
    setStatus("loading");
    if (entry) {
      await base44.entities.WaitlistEntry.delete(entry.id);
      setEntry(null);
      setStatus("idle");
      toast.success("Removed from waitlist");
    } else {
      const created = await base44.entities.WaitlistEntry.create({
        event_id: event.id,
        event_title: event.title,
        user_email: user.email,
        user_name: user.full_name || "",
        notified: false,
      });
      setEntry(created);
      setStatus("joined");
      toast.success("You have joined the waitlist for this event. We'll notify you when tickets open up.");

      // Notify the organizer
      if (event.organizer_id) {
        const fanName = user.full_name || user.email;
        const joinedAt = new Date().toLocaleString();
        // Resolve organizer email from organizer_id if not on event object
        let organizerEmail = event.organizer_email || "";
        if (!organizerEmail) {
          const orgUsers = await base44.entities.User.filter({ id: event.organizer_id }, null, 1).catch(() => []);
          organizerEmail = orgUsers[0]?.email || "";
        }
        if (organizerEmail) {
          base44.entities.Notification.create({
            user_email: organizerEmail,
            title: `📋 New Waitlist Entry — ${event.title}`,
            message: `${fanName} joined the waitlist for "${event.title}" on ${joinedAt}.`,
            type: "general",
            event_id: event.id,
            event_title: event.title,
          }).catch(() => {});
        }
      }
    }
  };

  return (
    <Button
      onClick={toggle}
      disabled={status === "loading"}
      variant={status === "joined" ? "secondary" : "outline"}
      className="w-full gap-2"
    >
      {status === "loading" ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : status === "joined" ? (
        <BellOff className="w-4 h-4" />
      ) : (
        <Bell className="w-4 h-4" />
      )}
      {status === "joined" ? "Leave Waitlist" : "Join Waitlist"}
    </Button>
  );
}