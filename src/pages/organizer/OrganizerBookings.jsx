import { useState, useEffect } from "react";
import { Search, Send, CalendarCheck, Clock, CheckCircle2, XCircle, DollarSign, MapPin, ChevronDown, ChevronUp, FileText, Star, X, Info } from "lucide-react";
import ArtistBookingLink from "@/components/artist/ArtistBookingLink";
import LeaveReviewForm from "../../components/booking/LeaveReviewForm";
import BookingReviewCard from "../../components/booking/BookingReviewCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "text-yellow-400 bg-yellow-400/10" },
  accepted:  { label: "Accepted",  color: "text-green-400 bg-green-400/10" },
  declined:  { label: "Declined",  color: "text-destructive bg-destructive/10" },
  cancelled: { label: "Cancelled", color: "text-muted-foreground bg-muted" },
};

export default function OrganizerBookings() {
  const [user, setUser] = useState(null);
  const [artists, setArtists] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [filteredArtists, setFilteredArtists] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [existingReviews, setExistingReviews] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [form, setForm] = useState({
    event_name: "", event_date: "", venue: "", city: "", budget: "", message: "",
    booker_phone: "",
  });

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const [a, b, reviewList] = await Promise.all([
        base44.entities.Artist.filter({ status: "active" }, "-follower_count", 100),
        base44.entities.ArtistBooking.filter({ booker_email: u.email }, "-created_date", 100),
        base44.entities.BookingReview.filter({ reviewer_email: u.email, reviewer_role: "organizer" }, null, 200),
      ]);
      setArtists(a);
      setFilteredArtists(a.slice(0, 10));
      setMyBookings(b);
      const map = {};
      reviewList.forEach(r => { map[r.booking_id] = r; });
      setExistingReviews(map);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFilteredArtists(artists.slice(0, 10)); return; }
    const q = search.toLowerCase();
    setFilteredArtists(artists.filter(a =>
      a.display_name.toLowerCase().includes(q) || a.genre?.toLowerCase().includes(q) || a.location?.toLowerCase().includes(q)
    ).slice(0, 20));
  }, [search, artists]);

  const validateBookingForm = () => {
    const e = {};
    if (!form.event_name.trim()) e.event_name = "Event name is required";
    if (!form.event_date) e.event_date = "Event date is required";
    if (!form.venue.trim()) e.venue = "Venue is required";
    if (!form.city.trim()) e.city = "City is required";
    if (!form.budget || Number(form.budget) <= 0) e.budget = "Enter a valid budget greater than 0";
    if (!form.message.trim()) e.message = "Message to artist is required";
    return e;
  };

  const handleSend = async () => {
    if (!selectedArtist) {
      toast.error("Please select an artist first");
      return;
    }
    const errors = validateBookingForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSending(true);
    const booking = await base44.entities.ArtistBooking.create({
      artist_id: selectedArtist.id,
      artist_name: selectedArtist.display_name,
      artist_email: selectedArtist.user_email,
      booker_name: user.full_name,
      booker_email: user.email,
      booker_phone: form.booker_phone,
      event_name: form.event_name,
      event_date: new Date(form.event_date).toISOString(),
      venue: form.venue,
      city: form.city,
      budget: form.budget ? Number(form.budget) : undefined,
      message: form.message,
      status: "pending",
    });

    // Notify artist
    await base44.integrations.Core.SendEmail({
      to: selectedArtist.user_email,
      subject: `🎤 New Booking Request — ${form.event_name}`,
      body: `Hi ${selectedArtist.display_name},\n\nYou have a new booking request from ${user.full_name}.\n\nEvent: ${form.event_name}\nDate: ${format(new Date(form.event_date), "EEE, MMM dd, yyyy")}\nVenue: ${form.venue || "TBD"}${form.city ? `, ${form.city}` : ""}\nBudget: ${form.budget ? "$" + Number(form.budget).toLocaleString() : "TBD"}\n\n${form.message ? `Message: "${form.message}"` : ""}\n\nLog in to your Artist Studio to respond:\n${window.location.origin}/artist/bookings`,
    }).catch(() => {});

    setMyBookings(prev => [booking, ...prev]);
    setSelectedArtist(null);
    setForm({ event_name: "", event_date: "", venue: "", city: "", budget: "", message: "", booker_phone: "" });
    setFormErrors({});
    toast.success("Booking request sent!");
    setSending(false);
  };

  const handleCancel = async (id) => {
    await base44.entities.ArtistBooking.update(id, { status: "cancelled" });
    setMyBookings(prev => prev.map(b => b.id === id ? { ...b, status: "cancelled" } : b));
    toast.success("Booking cancelled");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
         <div className="min-w-0 flex-1">
           <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight break-words">BOOK AN ARTIST</h1>
           <p className="text-xs sm:text-sm text-muted-foreground mt-1">Send booking requests directly to artists on the platform</p>
         </div>
        <Link to="/booking-calendar" state={{ from: "/organizer/bookings" }}>
          <Button variant="outline" className="gap-2 font-display font-bold">
            <CalendarCheck className="w-4 h-4" /> Booking Calendar
          </Button>
        </Link>
      </div>

      {/* How It Works note */}
      <div className="flex gap-3 p-4 rounded-xl bg-card border border-border/50">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-display font-bold text-sm">How It Works</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Select an artist and submit your booking request with the event details. The artist or their team will review the request and respond with approval, availability, or any additional requirements. You can track all submitted requests in the <span className="text-foreground font-semibold">Sent Requests</span> section below.
          </p>
        </div>
      </div>

      {/* Artist Search & Request Form */}
      <div className="p-4 sm:p-6 rounded-xl bg-card border border-border/50 space-y-4 sm:space-y-5">
        <h2 className="font-display font-bold text-base sm:text-lg">New Booking Request</h2>

        {/* Artist selector */}
        {!selectedArtist ? (
          <div>
            <Label className="text-xs font-mono text-muted-foreground">Search Artist</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, genre, location..."
                className="pl-9 bg-secondary border-border/50" />
            </div>
            <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
              {filteredArtists.map(a => (
                <button key={a.id} onClick={() => setSelectedArtist(a)}
                  className="w-full flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-secondary hover:bg-muted border border-border/30 transition-colors text-left">
                  {a.profile_image ? (
                    <img src={a.profile_image} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold">
                      {a.display_name[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{a.display_name}</p>
                    <p className="text-xs font-mono text-muted-foreground truncate">{a.genre?.replace(/_/g," ")}{a.location ? ` · ${a.location}` : ""}</p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground shrink-0 self-start sm:self-center mt-1 sm:mt-0">
                    {(a.follower_count || 0).toLocaleString()} followers
                  </span>
                  <span onClick={e => e.stopPropagation()} className="shrink-0">
                    <ArtistBookingLink artist={a} variant="icon" />
                  </span>
                </button>
              ))}
              {filteredArtists.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No artists found</p>}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 mb-4">
              {selectedArtist.profile_image ? (
                <img src={selectedArtist.profile_image} className="w-10 h-10 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold">{selectedArtist.display_name[0]}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold">{selectedArtist.display_name}</p>
                <p className="text-xs font-mono text-muted-foreground">{selectedArtist.genre?.replace(/_/g," ")}</p>
              </div>
              <button onClick={() => setSelectedArtist(null)} className="p-1.5 rounded-lg hover:bg-primary/20 text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Deselect artist">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form — using flex layout to prevent grid from swallowing error <p> nodes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Event Name */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#888", fontFamily: "monospace", marginBottom: 4 }}>Event Name *</label>
                <input value={form.event_name} onChange={e => { setForm({...form, event_name: e.target.value}); if (formErrors.event_name) setFormErrors(p => ({...p, event_name: ""})); }}
                  placeholder="e.g. Summer Rave 2026"
                  style={{ display: "block", width: "100%", borderRadius: 6, border: formErrors.event_name ? "1.5px solid #ef4444" : "1px solid rgba(255,255,255,0.15)", background: formErrors.event_name ? "rgba(239,68,68,0.07)" : "hsl(var(--secondary))", color: "white", padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                {formErrors.event_name && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4, fontWeight: 500 }}>{formErrors.event_name}</p>}
              </div>

              {/* Event Date + Budget */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#888", fontFamily: "monospace", marginBottom: 4 }}>Event Date *</label>
                  <input type="datetime-local" value={form.event_date} onChange={e => { setForm({...form, event_date: e.target.value}); if (formErrors.event_date) setFormErrors(p => ({...p, event_date: ""})); }}
                    style={{ display: "block", width: "100%", borderRadius: 6, border: formErrors.event_date ? "1.5px solid #ef4444" : "1px solid rgba(255,255,255,0.15)", background: formErrors.event_date ? "rgba(239,68,68,0.07)" : "hsl(var(--secondary))", color: "white", padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  {formErrors.event_date && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4, fontWeight: 500 }}>{formErrors.event_date}</p>}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#888", fontFamily: "monospace", marginBottom: 4 }}>Budget ($) *</label>
                  <input type="number" value={form.budget} onChange={e => { setForm({...form, budget: e.target.value}); if (formErrors.budget) setFormErrors(p => ({...p, budget: ""})); }}
                    placeholder="Offer amount"
                    style={{ display: "block", width: "100%", borderRadius: 6, border: formErrors.budget ? "1.5px solid #ef4444" : "1px solid rgba(255,255,255,0.15)", background: formErrors.budget ? "rgba(239,68,68,0.07)" : "hsl(var(--secondary))", color: "white", padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  {formErrors.budget && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4, fontWeight: 500 }}>{formErrors.budget}</p>}
                </div>
              </div>

              {/* Venue + City */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#888", fontFamily: "monospace", marginBottom: 4 }}>Venue *</label>
                  <input value={form.venue} onChange={e => { setForm({...form, venue: e.target.value}); if (formErrors.venue) setFormErrors(p => ({...p, venue: ""})); }}
                    placeholder="Venue name"
                    style={{ display: "block", width: "100%", borderRadius: 6, border: formErrors.venue ? "1.5px solid #ef4444" : "1px solid rgba(255,255,255,0.15)", background: formErrors.venue ? "rgba(239,68,68,0.07)" : "hsl(var(--secondary))", color: "white", padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  {formErrors.venue && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4, fontWeight: 500 }}>{formErrors.venue}</p>}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#888", fontFamily: "monospace", marginBottom: 4 }}>City *</label>
                  <input value={form.city} onChange={e => { setForm({...form, city: e.target.value}); if (formErrors.city) setFormErrors(p => ({...p, city: ""})); }}
                    placeholder="City"
                    style={{ display: "block", width: "100%", borderRadius: 6, border: formErrors.city ? "1.5px solid #ef4444" : "1px solid rgba(255,255,255,0.15)", background: formErrors.city ? "rgba(239,68,68,0.07)" : "hsl(var(--secondary))", color: "white", padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  {formErrors.city && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4, fontWeight: 500 }}>{formErrors.city}</p>}
                </div>
              </div>

              {/* Phone (optional) */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#888", fontFamily: "monospace", marginBottom: 4 }}>Your Phone (optional)</label>
                <input value={form.booker_phone} onChange={e => setForm({...form, booker_phone: e.target.value})}
                  placeholder="+1 234 567 8900"
                  style={{ display: "block", width: "100%", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "hsl(var(--secondary))", color: "white", padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>

              {/* Message */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#888", fontFamily: "monospace", marginBottom: 4 }}>Message to Artist *</label>
                <textarea value={form.message} onChange={e => { setForm({...form, message: e.target.value}); if (formErrors.message) setFormErrors(p => ({...p, message: ""})); }}
                  rows={3} placeholder="Tell the artist about the event, set requirements, expectations..."
                  style={{ display: "block", width: "100%", borderRadius: 6, border: formErrors.message ? "1.5px solid #ef4444" : "1px solid rgba(255,255,255,0.15)", background: formErrors.message ? "rgba(239,68,68,0.07)" : "hsl(var(--secondary))", color: "white", padding: "8px 12px", fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box" }} />
                {formErrors.message && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4, fontWeight: 500 }}>{formErrors.message}</p>}
              </div>
            </div>

            <Button onClick={handleSend} disabled={sending} className="mt-4 w-full glow-lime font-display font-bold gap-2">
              <Send className="w-4 h-4" /> {sending ? "Sending..." : `Send Request to ${selectedArtist.display_name}`}
            </Button>
          </div>
        )}
      </div>

      {/* My Sent Requests */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-lg">Sent Requests</h2>
        {myBookings.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border/50">
            <CalendarCheck className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No requests sent yet</p>
          </div>
        ) : (
          myBookings.map(b => {
            const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
            const isOpen = expanded === b.id;
            const existingReview = existingReviews[b.id];
            const canReview = b.status === 'accepted' && !existingReview;
            return (
              <div key={b.id} className="rounded-xl bg-card border border-border/50 overflow-hidden">
                <div className="p-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : b.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="font-display font-bold truncate">{b.event_name}</p>
                      <p className="text-sm font-bold text-primary">{b.artist_name}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {b.event_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(b.event_date), "MMM dd, yyyy")}</span>}
                        {b.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.city}{b.venue ? ` · ${b.venue}` : ""}</span>}
                        {b.budget && <span className="flex items-center gap-1 text-green-400 font-bold"><DollarSign className="w-3 h-3" />${b.budget.toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono text-[10px] font-bold uppercase px-2 py-1 rounded ${cfg.color}`}>{cfg.label}</span>
                      <Link to={`/booking/contract/${b.id}`} onClick={e => e.stopPropagation()}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="View Contract">
                        <FileText className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-border/30 p-4 space-y-3">
                    {b.message && (
                      <div className="p-3 rounded-lg bg-muted text-sm">
                        <p className="text-xs font-mono text-muted-foreground mb-1">Your message:</p>
                        <p>"{b.message}"</p>
                      </div>
                    )}
                    {b.artist_response && (
                      <div className={`p-3 rounded-lg text-sm border ${b.status === "accepted" ? "bg-green-400/10 border-green-400/20" : "bg-destructive/10 border-destructive/20"}`}>
                        <p className="text-xs font-mono mb-1" style={{ color: b.status === "accepted" ? "#4ade80" : "hsl(var(--destructive))" }}>
                          {b.status === "accepted" ? "✅" : "❌"} Artist's response:
                        </p>
                        <p>"{b.artist_response}"</p>
                      </div>
                    )}
                    {b.status === "pending" && (
                      <Button variant="outline" size="sm" onClick={() => handleCancel(b.id)}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 font-mono text-xs">
                        Cancel Request
                      </Button>
                    )}
                    {(b.technical_rider_url || b.artist_rider_url) && (
                      <div className="pt-2 border-t border-border/20 space-y-2">
                        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">📎 Attachments from Artist</p>
                        {b.technical_rider_url && (
                          <a href={b.technical_rider_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted border border-border/40 hover:border-primary/40 transition-colors">
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-xs font-mono flex-1">Technical Rider</span>
                            <span className="text-[10px] font-mono text-primary">Download ↗</span>
                          </a>
                        )}
                        {b.artist_rider_url && (
                          <a href={b.artist_rider_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted border border-border/40 hover:border-accent/40 transition-colors">
                            <FileText className="w-4 h-4 text-accent shrink-0" />
                            <span className="text-xs font-mono flex-1">Artist Rider</span>
                            <span className="text-[10px] font-mono text-accent">Download ↗</span>
                          </a>
                        )}
                      </div>
                    )}
                    {existingReview && (
                      <div className="pt-2 border-t border-border/20">
                        <p className="text-xs font-mono text-muted-foreground mb-2 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-yellow-400" /> Your review</p>
                        <BookingReviewCard review={existingReview} currentUserEmail={user?.email} />
                      </div>
                    )}
                    {canReview && (
                      <div className="pt-2 border-t border-border/20">
                        <p className="text-xs font-mono text-muted-foreground mb-2 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-yellow-400" /> Rate the artist</p>
                        <LeaveReviewForm
                          booking={b}
                          currentUser={user}
                          reviewerRole="organizer"
                          onSubmitted={r => setExistingReviews(prev => ({ ...prev, [r.booking_id]: r }))}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}