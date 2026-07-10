import { useState, useEffect } from "react";
import { CalendarCheck, Clock, CheckCircle2, XCircle, DollarSign, MapPin, FileText, Star, Upload, X, FileCheck, Ticket, Table2 } from "lucide-react";
import LeaveReviewForm from "../../components/booking/LeaveReviewForm";
import BookingReviewCard from "../../components/booking/BookingReviewCard";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import { sendEmail } from '@/utils/emailService';
import { buildEmailBody } from '@/utils/emailTemplate';
import { Link } from "react-router-dom";

const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "text-yellow-400 bg-yellow-400/10" },
  accepted:  { label: "Accepted",  color: "text-green-400 bg-green-400/10" },
  declined:  { label: "Declined",  color: "text-destructive bg-destructive/10" },
  cancelled: { label: "Cancelled", color: "text-muted-foreground bg-muted" },
};

export default function ArtistBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [artist, setArtist] = useState(null);
  const [user, setUser] = useState(null);
  const [responseText, setResponseText] = useState({});
  const [riderFiles, setRiderFiles] = useState({}); // { bookingId: { technical: File|null, artist: File|null } }
  const [uploading, setUploading] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [existingReviews, setExistingReviews] = useState({});
  const [eventSales, setEventSales] = useState({}); // { eventId: { tickets, tables } }

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const artists = await base44.entities.Artist.filter({ user_email: u.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      const a = artists[0];
      setArtist(a);
      const b = await base44.entities.ArtistBooking.filter({ artist_id: a.id }, "-created_date", 100);
      setBookings(b);
      const reviews = await base44.entities.BookingReview.filter({ reviewer_email: u.email, reviewer_role: "artist" }, null, 200);
      const map = {};
      reviews.forEach(r => { map[r.booking_id] = r; });
      setExistingReviews(map);

      // Fetch sales counts for accepted bookings that have an event_id
      const acceptedWithEvent = b.filter(bk => bk.status === "accepted" && bk.event_id);
      if (acceptedWithEvent.length > 0) {
        const eventIds = [...new Set(acceptedWithEvent.map(bk => bk.event_id))];
        const salesMap = {};
        await Promise.all(eventIds.map(async (eventId) => {
          const [events, tables] = await Promise.all([
            base44.entities.Event.filter({ id: eventId }, null, 1).catch(() => []),
            base44.entities.TableReservation.filter({ event_id: eventId, status: "confirmed" }, null, 500).catch(() => []),
          ]);
          salesMap[eventId] = {
            tickets: events[0]?.tickets_sold || 0,
            tables: tables.length,
          };
        }));
        setEventSales(salesMap);
      }

      setLoading(false);
    });
  }, []);

  const setRiderFile = (bookingId, type, file) => {
    setRiderFiles(prev => ({
      ...prev,
      [bookingId]: { ...(prev[bookingId] || {}), [type]: file }
    }));
  };

  const handleRespond = async (booking, status) => {
    const response = responseText[booking.id] || "";
    const files = riderFiles[booking.id] || {};

    // Optimistic update — flip status immediately for instant feedback
    setBookings(prev => prev.map(b => b.id === booking.id
      ? { ...b, status, artist_response: response }
      : b
    ));
    setExpanded(null);

    setUploading(prev => ({ ...prev, [booking.id]: true }));

    let technical_rider_url = booking.technical_rider_url || undefined;
    let artist_rider_url = booking.artist_rider_url || undefined;

    if (files.technical) {
      const res = await base44.integrations.Core.UploadFile({ file: files.technical });
      technical_rider_url = res.file_url;
    }
    if (files.artist) {
      const res = await base44.integrations.Core.UploadFile({ file: files.artist });
      artist_rider_url = res.file_url;
    }

    await base44.entities.ArtistBooking.update(booking.id, {
      status,
      artist_response: response,
      ...(technical_rider_url ? { technical_rider_url } : {}),
      ...(artist_rider_url ? { artist_rider_url } : {}),
    });

    // Sync any rider URLs after server confirms
    setBookings(prev => prev.map(b => b.id === booking.id
      ? { ...b, status, artist_response: response, technical_rider_url, artist_rider_url }
      : b
    ));

    // Notify organizers in same country when booking is accepted
    if (status === "accepted" && (booking.country || booking.city)) {
      base44.functions.invoke("notifyOrganizersArtistBooked", {
        artist_id: artist.id,
        artist_name: artist.display_name,
        event_name: booking.event_name,
        event_date: booking.event_date,
        city: booking.city || "",
        country: booking.country || booking.city || "",
      }).catch(() => {});
    }

    await sendEmail({
      _source: 'ArtistBookings/response',
      to: booking.booker_email,
      subject: `Booking ${status === "accepted" ? "Accepted ✅" : "Declined ❌"} — ${artist.display_name}`,
      body: buildEmailBody({
        title: status === 'accepted' ? 'Booking Accepted ✅' : 'Booking Update ❌',
        greeting: `Hi ${booking.booker_name},`,
        message: `Your booking request for <strong>${booking.event_name}</strong> has been <strong>${status}</strong> by ${artist.display_name}.`,
        infoBox: response ? { rows: [{ label: "Artist's message", value: `"${response}"` }] } : undefined,
        ctaText: 'View Booking →',
        ctaUrl: `${window.location.origin}/organizer/bookings`,
      }),
    }).catch(() => {});

    toast.success(`Booking ${status}`);
    setUploading(prev => ({ ...prev, [booking.id]: false }));
    setExpanded(null);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!artist) return <div className="text-center py-20 text-muted-foreground">No artist profile found.</div>;

  const pending = bookings.filter(b => b.status === "pending");
  const others = bookings.filter(b => b.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">BOOKINGS</h1>
        <div className="flex gap-2 text-xs font-mono">
          <span className="text-yellow-400 font-bold">{pending.length} pending</span>
          <span className="text-muted-foreground">· {bookings.length} total</span>
        </div>
      </div>

      {bookings.length === 0 && (
        <div className="text-center py-16 bg-card rounded-xl border border-border/50">
          <CalendarCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No booking requests yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Share your profile so fans and promoters can book you</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-base text-yellow-400 uppercase tracking-wider">Pending Requests</h2>
          {pending.map(b => (
            <BookingCard key={b.id} booking={b} expanded={expanded} setExpanded={setExpanded}
              responseText={responseText} setResponseText={setResponseText}
              riderFiles={riderFiles[b.id] || {}} setRiderFile={setRiderFile}
              onRespond={handleRespond} uploading={uploading[b.id]}
              user={user} existingReview={existingReviews[b.id]}
              salesData={b.event_id ? eventSales[b.event_id] : null}
              onReviewSubmitted={r => setExistingReviews(prev => ({ ...prev, [r.booking_id]: r }))} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-base uppercase tracking-wider text-muted-foreground">Past Requests</h2>
          {others.map(b => (
            <BookingCard key={b.id} booking={b} expanded={expanded} setExpanded={setExpanded}
              responseText={responseText} setResponseText={setResponseText}
              riderFiles={riderFiles[b.id] || {}} setRiderFile={setRiderFile}
              onRespond={handleRespond} uploading={uploading[b.id]}
              user={user} existingReview={existingReviews[b.id]}
              salesData={b.event_id ? eventSales[b.event_id] : null}
              onReviewSubmitted={r => setExistingReviews(prev => ({ ...prev, [r.booking_id]: r }))} />
          ))}
        </div>
      )}
    </div>
  );
}

function RiderUploadField({ label, file, existingUrl, onChange }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-mono text-muted-foreground">{label}</p>
      {existingUrl && !file && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-400/10 border border-green-400/20">
          <FileCheck className="w-4 h-4 text-green-400 shrink-0" />
          <a href={existingUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs font-mono text-green-400 hover:underline truncate flex-1">
            Attached — view / replace
          </a>
        </div>
      )}
      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border/60 hover:border-primary/50 cursor-pointer transition-colors bg-secondary/50 group">
        <Upload className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors truncate flex-1">
          {file ? file.name : "Choose PDF / DOC (optional)"}
        </span>
        {file && (
          <button type="button" onClick={e => { e.preventDefault(); onChange(null); }}
            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <input type="file" accept=".pdf,.doc,.docx" className="hidden"
          onChange={e => onChange(e.target.files[0] || null)} />
      </label>
    </div>
  );
}

function BookingCard({ booking, expanded, setExpanded, responseText, setResponseText, riderFiles, setRiderFile, onRespond, uploading, user, existingReview, salesData, onReviewSubmitted }) {
  const cfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const isOpen = expanded === booking.id;
  const canReview = booking.status === 'accepted' && user && !existingReview;

  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : booking.id)}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-display font-bold">{booking.event_name}</p>
            <p className="text-sm font-bold text-foreground">{booking.booker_name}</p>
            <p className="text-xs font-mono text-muted-foreground">{booking.booker_email}</p>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
              {booking.event_date && (
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(booking.event_date), "MMM dd, yyyy")}</span>
              )}
              {booking.city && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{booking.city}{booking.venue ? ` · ${booking.venue}` : ""}</span>
              )}
              {booking.budget && (
                <span className="flex items-center gap-1 text-green-400 font-bold"><DollarSign className="w-3 h-3" />${booking.budget.toLocaleString()}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded ${cfg.color}`}>{cfg.label}</span>
            <Link to={`/booking/contract/${booking.id}`} onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] font-mono text-accent hover:underline">
              <FileText className="w-3 h-3" /> Contract
            </Link>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-border/30 p-4 space-y-3">
          {/* Sales count — only for accepted bookings with event data */}
          {booking.status === "accepted" && salesData && (
            <div className="flex gap-3 p-3 rounded-lg bg-green-400/5 border border-green-400/20">
              <div className="flex items-center gap-2 flex-1">
                <Ticket className="w-4 h-4 text-green-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Tickets Sold</p>
                  <p className="font-display font-black text-lg text-green-400">{salesData.tickets ?? 0}</p>
                </div>
              </div>
              <div className="w-px bg-border/40" />
              <div className="flex items-center gap-2 flex-1">
                <Table2 className="w-4 h-4 text-accent shrink-0" />
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Tables Sold</p>
                  <p className="font-display font-black text-lg text-accent">{salesData.tables ?? 0}</p>
                </div>
              </div>
            </div>
          )}
          {booking.message && (
            <div className="p-3 rounded-lg bg-muted text-sm">
              <p className="text-xs font-mono text-muted-foreground mb-1">Message from booker:</p>
              <p>"{booking.message}"</p>
            </div>
          )}
          {booking.artist_response && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
              <p className="text-xs font-mono text-primary mb-1">Your response:</p>
              <p>"{booking.artist_response}"</p>
            </div>
          )}

          {/* Already attached riders (read-only view for non-pending) */}
          {booking.status !== "pending" && (booking.technical_rider_url || booking.artist_rider_url) && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Attached Riders</p>
              {booking.technical_rider_url && (
                <a href={booking.technical_rider_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted border border-border/40 hover:border-primary/40 transition-colors">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-mono flex-1">Technical Rider</span>
                  <span className="text-[10px] font-mono text-primary">Download ↗</span>
                </a>
              )}
              {booking.artist_rider_url && (
                <a href={booking.artist_rider_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted border border-border/40 hover:border-primary/40 transition-colors">
                  <FileText className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-xs font-mono flex-1">Artist Rider</span>
                  <span className="text-[10px] font-mono text-accent">Download ↗</span>
                </a>
              )}
            </div>
          )}

          {booking.status === "pending" && (
            <>
              <textarea
                value={responseText[booking.id] || ""}
                onChange={e => setResponseText(prev => ({ ...prev, [booking.id]: e.target.value }))}
                placeholder="Optional message to the booker..."
                rows={2}
                className="w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm resize-none"
              />

              {/* Rider uploads */}
              <div className="space-y-3 p-3 rounded-lg bg-secondary/50 border border-border/40">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Attach Riders (optional)</p>
                <RiderUploadField
                  label="📋 Technical Rider — sound, lighting, stage requirements"
                  file={riderFiles.technical || null}
                  existingUrl={booking.technical_rider_url}
                  onChange={file => setRiderFile(booking.id, "technical", file)}
                />
                <RiderUploadField
                  label="🏨 Artist Rider — hospitality, dressing room, transportation"
                  file={riderFiles.artist || null}
                  existingUrl={booking.artist_rider_url}
                  onChange={file => setRiderFile(booking.id, "artist", file)}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => onRespond(booking, "accepted")} disabled={uploading}
                  className="flex-1 glow-lime font-display font-bold gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {uploading ? "Sending..." : "Accept"}
                </Button>
                <Button variant="outline" onClick={() => onRespond(booking, "declined")} disabled={uploading}
                  className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 font-display font-bold gap-1.5">
                  <XCircle className="w-4 h-4" /> Decline
                </Button>
              </div>
            </>
          )}

          {existingReview && (
            <div className="pt-2 border-t border-border/20">
              <p className="text-xs font-mono text-muted-foreground mb-2 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-yellow-400" /> Your review</p>
              <BookingReviewCard review={existingReview} currentUserEmail={user?.email} />
            </div>
          )}
          {canReview && (
            <div className="pt-2 border-t border-border/20">
              <p className="text-xs font-mono text-muted-foreground mb-2 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-yellow-400" /> Leave a review for the organizer</p>
              <LeaveReviewForm booking={booking} currentUser={user} reviewerRole="artist" onSubmitted={onReviewSubmitted} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}