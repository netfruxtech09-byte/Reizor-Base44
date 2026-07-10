import { useState } from "react";
import { CalendarCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import ModalPortal from "@/components/shared/ModalPortal";

export default function BookingForm({ artist, user, onClose }) {
  const [form, setForm] = useState({
    booker_name: user?.full_name || "",
    booker_email: user?.email || "",
    booker_phone: "",
    event_name: "",
    event_date: "",
    venue: "",
    city: "",
    budget: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.booker_name || !form.booker_email || !form.event_name) {
      toast.error("Please fill in your name, email and event name");
      return;
    }
    setSubmitting(true);
    await base44.entities.ArtistBooking.create({
      artist_id: artist.id,
      artist_name: artist.display_name,
      artist_email: artist.user_email,
      ...form,
      budget: form.budget ? parseFloat(form.budget) : undefined,
      event_date: form.event_date ? new Date(form.event_date).toISOString() : undefined,
    });
    // Notify artist
    if (artist.user_email) {
      await base44.integrations.Core.SendEmail({
        to: artist.user_email,
        subject: `📅 New Booking Request — ${form.event_name}`,
        body: `Hi ${artist.display_name},\n\nYou have a new booking request!\n\nEvent: ${form.event_name}\nFrom: ${form.booker_name} (${form.booker_email})\n${form.event_date ? `Date: ${new Date(form.event_date).toLocaleDateString()}\n` : ""}${form.city ? `City: ${form.city}${form.venue ? `, ${form.venue}` : ""}\n` : ""}${form.budget ? `Budget: $${form.budget}\n` : ""}${form.message ? `\nMessage: "${form.message}"` : ""}\n\nManage this booking in your Artist Studio.`,
      }).catch(() => {});
    }
    toast.success("Booking request sent! The artist will get back to you.");
    setSubmitting(false);
    onClose();
  };

  if (!artist) return null;

  return (
    <ModalPortal open={true} onBackdropClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border/50 rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-black text-xl">BOOK {(artist.display_name || "ARTIST").toUpperCase()}</h2>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">Send a booking request</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs font-mono text-muted-foreground">Your Name *</Label>
            <Input value={form.booker_name} onChange={e => setForm({ ...form, booker_name: e.target.value })}
              placeholder="Full name" className="mt-1 bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Email *</Label>
            <Input type="email" value={form.booker_email} onChange={e => setForm({ ...form, booker_email: e.target.value })}
              placeholder="your@email.com" className="mt-1 bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Phone</Label>
            <Input value={form.booker_phone} onChange={e => setForm({ ...form, booker_phone: e.target.value })}
              placeholder="+1 555..." className="mt-1 bg-secondary border-border/50" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-mono text-muted-foreground">Event Name *</Label>
            <Input value={form.event_name} onChange={e => setForm({ ...form, event_name: e.target.value })}
              placeholder="e.g. Club Night, Festival, Private Party" className="mt-1 bg-secondary border-border/50" />
          </div>
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs font-mono text-muted-foreground">Event Date</Label>
              {form.event_date && (
                <button type="button" onClick={() => setForm({ ...form, event_date: "" })}
                  className="text-[10px] font-mono text-muted-foreground hover:text-destructive transition-colors">
                  Reset date
                </button>
              )}
            </div>
            <Input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })}
              className="bg-secondary border-border/50" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-mono text-muted-foreground">Budget ($)</Label>
            <Input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
              placeholder="e.g. 500" className="mt-1 bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground">City</Label>
            <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
              placeholder="City" className="mt-1 bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Venue</Label>
            <Input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })}
              placeholder="Venue name" className="mt-1 bg-secondary border-border/50" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-mono text-muted-foreground">Message</Label>
            <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
              placeholder="Tell the artist more about your event..." rows={3}
              className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm resize-none" />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button onClick={handleSubmit} disabled={submitting} className="flex-1 glow-lime font-display font-bold gap-2">
            <CalendarCheck className="w-4 h-4" />
            {submitting ? "Sending..." : "Send Booking Request"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </ModalPortal>
  );
}