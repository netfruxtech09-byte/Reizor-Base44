import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CalendarCheck, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import BackButton from "../components/shared/BackButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { sendEmail } from '@/utils/emailService';
import { buildEmailBody } from '@/utils/emailTemplate';

const phoneRegex = /^[+\d][\d\s\-().]{6,19}$/;

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1 font-mono">{msg}</p>;
}

export default function BookArtist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    booker_name: "",
    booker_email: "",
    booker_phone: "",
    event_name: "",
    event_date: "",
    venue: "",
    city: "",
    budget: "",
    message: "",
  });
  const [errors, setErrors] = useState({});

  // Refs declared individually at top level (rules of hooks)
  const refName = useRef(null);
  const refEmail = useRef(null);
  const refPhone = useRef(null);
  const refEventName = useRef(null);
  const refEventDate = useRef(null);
  const refBudget = useRef(null);
  const refVenue = useRef(null);
  const refCity = useRef(null);
  const refMessage = useRef(null);

  const refsMap = {
    booker_name: refName,
    booker_email: refEmail,
    booker_phone: refPhone,
    event_name: refEventName,
    event_date: refEventDate,
    budget: refBudget,
    venue: refVenue,
    city: refCity,
    message: refMessage,
  };

  useEffect(() => {
    base44.entities.Artist.filter({ id }, null, 1).then(([a]) => {
      setArtist(a || null);
      setLoading(false);
    });
    base44.auth.me().catch(() => null).then(user => {
      if (user) setForm(f => ({ ...f, booker_name: user.full_name || "", booker_email: user.email || "" }));
    });
  }, [id]);

  const setField = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateForm = (f) => {
    const e = {};
    if (!f.booker_name.trim()) e.booker_name = "Your name is required";
    if (!f.booker_email.trim()) e.booker_email = "Email is required";
    if (!f.booker_phone.trim()) e.booker_phone = "Phone number is required";
    else if (!phoneRegex.test(f.booker_phone.trim())) e.booker_phone = "Enter a valid phone number";
    if (!f.event_name.trim()) e.event_name = "Event name is required";
    if (!f.event_date) e.event_date = "Event date is required";
    if (!f.budget || Number(f.budget) <= 0) e.budget = "Enter a valid budget greater than 0";
    if (!f.venue.trim()) e.venue = "Venue is required";
    if (!f.city.trim()) e.city = "City is required";
    if (!f.message.trim()) e.message = "Message to artist is required";
    return e;
  };

  const handleSubmit = async () => {
    const newErrors = validateForm(form);
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const order = ["booker_name", "booker_email", "booker_phone", "event_name", "event_date", "budget", "venue", "city", "message"];
      const firstKey = order.find(k => newErrors[k]);
      if (firstKey && refsMap[firstKey]?.current) {
        refsMap[firstKey].current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setSubmitting(true);
    await base44.entities.ArtistBooking.create({
      artist_id: artist.id,
      artist_name: artist.display_name,
      artist_email: artist.user_email,
      ...form,
      budget: parseFloat(form.budget),
      event_date: new Date(form.event_date).toISOString(),
    });

    const bookingEmail = artist.contact_email || artist.user_email;
    await base44.entities.Notification.create({
      user_email: artist.user_email,
      title: `📅 New Booking Request — ${form.event_name}`,
      message: `${form.booker_name} (${form.booker_email}) wants to book you for "${form.event_name}" on ${new Date(form.event_date).toLocaleDateString()} in ${form.city}.`,
      type: "general",
    }).catch(() => {});

    await sendEmail({
      _source: 'BookArtist/bookingRequest',
      to: bookingEmail,
      subject: `📅 New Booking Request — ${form.event_name}`,
      body: buildEmailBody({
        title: 'New Booking Request 📅',
        greeting: `Hi ${artist.display_name},`,
        message: 'You have a new booking request from the following organizer.',
        infoBox: { rows: [
          { label: 'Event', value: form.event_name },
          { label: 'From', value: `${form.booker_name} (${form.booker_email})` },
          { label: 'Date', value: new Date(form.event_date).toLocaleDateString() },
          { label: 'Location', value: `${form.city}, ${form.venue}` },
          { label: 'Budget', value: `$${form.budget}` },
          { label: 'Message', value: `"${form.message}"` },
        ]},
        ctaText: 'Manage in Artist Studio →',
        ctaUrl: `${window.location.origin}/artist/bookings`,
      }),
    }).catch(() => {});

    setSubmitting(false);
    setSubmitted(true);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!artist || artist.approval_status !== "approved") return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-center px-4">
      <div className="space-y-2">
        <p className="font-display font-bold text-lg">Booking Unavailable</p>
        <p className="text-sm">This artist's booking page is not available.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
          <CalendarCheck className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-display font-black text-2xl">Request Sent!</h1>
        <p className="text-muted-foreground text-sm">{artist.display_name} will get back to you at <span className="text-foreground font-bold">{form.booker_email}</span>.</p>
        <BackButton to={`/artists/${artist.id}`} label="View Artist Profile" />
      </div>
    </div>
  );

  const err = (key) => errors[key] ? "border-destructive focus-visible:ring-destructive" : "border-border/50";

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Artist header */}
        <div className="flex items-center gap-4">
          {artist.profile_image ? (
            <img src={artist.profile_image} alt={artist.display_name} className="w-14 h-14 rounded-full object-cover border-2 border-primary/30" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
              <Music className="w-6 h-6 text-primary" />
            </div>
          )}
          <div>
            <h1 className="font-display font-black text-2xl tracking-tight">{artist.display_name}</h1>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{artist.genre?.replace(/_/g, " ")}</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
          <div>
            <h2 className="font-display font-bold text-lg">Send a Booking Request</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">All fields are required. {artist.display_name} will get back to you.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Your Name */}
            <div className="col-span-2">
              <Label className="text-xs font-mono text-muted-foreground">Your Name *</Label>
              <Input ref={refName} value={form.booker_name} onChange={e => setField("booker_name", e.target.value)}
                placeholder="Full name" className={`mt-1 bg-secondary ${err("booker_name")}`} />
              <FieldError msg={errors.booker_name} />
            </div>

            {/* Email */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Email *</Label>
              <Input ref={refEmail} type="email" value={form.booker_email} onChange={e => setField("booker_email", e.target.value)}
                placeholder="your@email.com" className={`mt-1 bg-secondary ${err("booker_email")}`} />
              <FieldError msg={errors.booker_email} />
            </div>

            {/* Phone */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Phone *</Label>
              <Input ref={refPhone} value={form.booker_phone} onChange={e => setField("booker_phone", e.target.value)}
                placeholder="+1 555..." className={`mt-1 bg-secondary ${err("booker_phone")}`} />
              <FieldError msg={errors.booker_phone} />
            </div>

            {/* Event Name */}
            <div className="col-span-2">
              <Label className="text-xs font-mono text-muted-foreground">Event Name *</Label>
              <Input ref={refEventName} value={form.event_name} onChange={e => setField("event_name", e.target.value)}
                placeholder="e.g. Club Night, Festival, Private Party" className={`mt-1 bg-secondary ${err("event_name")}`} />
              <FieldError msg={errors.event_name} />
            </div>

            {/* Event Date */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Event Date *</Label>
              <Input ref={refEventDate} type="date" value={form.event_date} onChange={e => setField("event_date", e.target.value)}
                className={`mt-1 bg-secondary ${err("event_date")}`} />
              <FieldError msg={errors.event_date} />
            </div>

            {/* Budget */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Budget ($) *</Label>
              <Input ref={refBudget} type="number" value={form.budget} onChange={e => setField("budget", e.target.value)}
                placeholder="e.g. 500" className={`mt-1 bg-secondary ${err("budget")}`} />
              <FieldError msg={errors.budget} />
            </div>

            {/* City */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground">City *</Label>
              <Input ref={refCity} value={form.city} onChange={e => setField("city", e.target.value)}
                placeholder="City" className={`mt-1 bg-secondary ${err("city")}`} />
              <FieldError msg={errors.city} />
            </div>

            {/* Venue */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Venue *</Label>
              <Input ref={refVenue} value={form.venue} onChange={e => setField("venue", e.target.value)}
                placeholder="Venue name" className={`mt-1 bg-secondary ${err("venue")}`} />
              <FieldError msg={errors.venue} />
            </div>

            {/* Message */}
            <div className="col-span-2">
              <Label className="text-xs font-mono text-muted-foreground">Message to Artist *</Label>
              <textarea ref={refMessage} value={form.message} onChange={e => setField("message", e.target.value)}
                placeholder="Tell the artist about the event, set requirements, expectations..." rows={3}
                className={`mt-1 w-full rounded-md bg-secondary border px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-ring ${errors.message ? "border-destructive" : "border-border/50"}`} />
              <FieldError msg={errors.message} />
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full glow-lime font-display font-bold gap-2 h-11">
            <CalendarCheck className="w-4 h-4" />
            {submitting ? "Sending..." : "Send Booking Request"}
          </Button>
        </div>
      </div>
    </div>
  );
}