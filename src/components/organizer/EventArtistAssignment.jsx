import { useState, useEffect } from "react";
import { Music, Search, CheckCircle2, XCircle, Clock, Loader2, UserPlus, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const ASSIGNMENT_STATUS = {
  assigned:  { label: "Assigned",  color: "text-accent bg-accent/10" },
  confirmed: { label: "Confirmed", color: "text-green-400 bg-green-400/10" },
  completed: { label: "Completed", color: "text-primary bg-primary/10" },
};

const BOOKING_STATUS = {
  pending:   { label: "Pending",   color: "text-yellow-400 bg-yellow-400/10", icon: Clock },
  accepted:  { label: "Accepted",  color: "text-green-400 bg-green-400/10",   icon: CheckCircle2 },
  declined:  { label: "Declined",  color: "text-destructive bg-destructive/10", icon: XCircle },
  cancelled: { label: "Cancelled", color: "text-muted-foreground bg-muted",   icon: XCircle },
};

export default function EventArtistAssignment({ event, user }) {
  const [bookings, setBookings] = useState([]);
  const [artists, setArtists] = useState([]);
  const [search, setSearch] = useState("");
  const [filteredArtists, setFilteredArtists] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ArtistBooking.filter({ event_name: event.title }, "-created_date", 50).catch(() => []),
      base44.entities.Artist.filter({ status: "active", approval_status: "approved" }, "-follower_count", 100).catch(() => []),
    ]).then(([b, a]) => {
      setBookings(b);
      setArtists(a);
      setFilteredArtists(a.slice(0, 8));
      setLoading(false);
    });
  }, [event.title]);

  useEffect(() => {
    if (!search.trim()) { setFilteredArtists(artists.slice(0, 8)); return; }
    const q = search.toLowerCase();
    setFilteredArtists(artists.filter(a =>
      a.display_name?.toLowerCase().includes(q) || a.genre?.toLowerCase().includes(q)
    ).slice(0, 20));
  }, [search, artists]);

  const handleAssign = async () => {
    if (!selectedArtist) return;
    setSending(true);
    const booking = await base44.entities.ArtistBooking.create({
      artist_id: selectedArtist.id,
      artist_name: selectedArtist.display_name,
      artist_email: selectedArtist.user_email,
      booker_name: user.full_name || user.email,
      booker_email: user.email,
      event_name: event.title,
      event_date: event.date,
      venue: event.venue_name,
      city: event.city,
      country: event.country || "",
      status: "pending",
      assignment_status: "assigned",
      payment_status: "pending",
    });

    // Notify artist
    await base44.integrations.Core.SendEmail({
      to: selectedArtist.user_email,
      subject: `🎤 Artist Assignment — ${event.title}`,
      body: `Hi ${selectedArtist.display_name},\n\nYou have been assigned to perform at "${event.title}".\n\nEvent: ${event.title}\nVenue: ${event.venue_name}, ${event.city}\nDate: ${event.date ? format(new Date(event.date), "MMM dd, yyyy") : "TBA"}\n\nPlease log in to your Artist Studio to confirm this booking.\n${window.location.origin}/artist/bookings`,
    }).catch(() => {});

    await base44.entities.Notification.create({
      user_email: selectedArtist.user_email,
      title: `🎤 You've been assigned to ${event.title}`,
      message: `${event.venue_name}, ${event.city} — ${event.date ? format(new Date(event.date), "MMM dd, yyyy") : "TBA"}. Check your bookings to confirm.`,
      type: "general",
      link: "/artist/bookings",
    }).catch(() => {});

    // Log history
    await base44.entities.BookingHistory.create({
      booking_id: booking.id,
      action: "Artist assigned",
      detail: `${selectedArtist.display_name} assigned to ${event.title}`,
      actor_email: user.email,
      actor_name: user.full_name || user.email,
    }).catch(() => {});

    setBookings(prev => [booking, ...prev]);
    setSelectedArtist(null);
    setShowSearch(false);
    toast.success(`${selectedArtist.display_name} assigned!`);
    setSending(false);
  };

  const updateAssignmentStatus = async (bookingId, newStatus) => {
    setUpdatingStatus(bookingId);
    await base44.entities.ArtistBooking.update(bookingId, { assignment_status: newStatus });

    await base44.entities.BookingHistory.create({
      booking_id: bookingId,
      action: "Status changed",
      detail: `Assignment status → ${ASSIGNMENT_STATUS[newStatus]?.label}`,
      actor_email: user.email,
      actor_name: user.full_name || user.email,
    }).catch(() => {});

    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, assignment_status: newStatus } : b));
    setUpdatingStatus(null);
    toast.success("Status updated");
  };

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" /> ARTIST ASSIGNMENT
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {bookings.filter(b => b.status !== "cancelled").length} artist{bookings.filter(b => b.status !== "cancelled").length !== 1 ? "s" : ""} assigned
          </p>
        </div>
        <Button size="sm" onClick={() => setShowSearch(v => !v)} className="gap-1.5 font-display font-bold">
          <UserPlus className="w-3.5 h-3.5" /> {showSearch ? "Cancel" : "Assign Artist"}
        </Button>
      </div>

      {/* Artist search + assign */}
      {showSearch && (
        <div className="p-4 rounded-xl bg-secondary border border-border/50 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search approved artists..."
              className="pl-9 bg-card border-border/50"
            />
          </div>

          <div className="space-y-1 max-h-52 overflow-y-auto">
            {filteredArtists.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedArtist(prev => prev?.id === a.id ? null : a)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  selectedArtist?.id === a.id
                    ? "border-primary bg-primary/10"
                    : "border-border/30 bg-card hover:border-primary/30"
                }`}
              >
                {a.profile_image ? (
                  <img src={a.profile_image} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold">
                    {a.display_name?.[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{a.display_name}</p>
                  <p className="text-xs font-mono text-muted-foreground truncate">{a.genre?.replace(/_/g, " ")}</p>
                </div>
                {selectedArtist?.id === a.id && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>

          {selectedArtist && (
            <Button
              onClick={handleAssign}
              disabled={sending}
              className="w-full glow-lime font-display font-bold gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
              {sending ? "Assigning..." : `Assign ${selectedArtist.display_name} to this event`}
            </Button>
          )}
        </div>
      )}

      {/* Assigned bookings */}
      {bookings.length === 0 ? (
        <p className="text-xs text-muted-foreground font-mono py-1">No artists assigned yet.</p>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => {
            const bCfg = BOOKING_STATUS[b.status] || BOOKING_STATUS.pending;
            const aCfg = b.assignment_status ? ASSIGNMENT_STATUS[b.assignment_status] : null;
            const BookingIcon = bCfg.icon;
            return (
              <div key={b.id} className={`p-4 rounded-xl border ${b.status === "cancelled" ? "opacity-50 border-border/30 bg-muted/30" : "bg-card border-border/50"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <p className="font-display font-bold">{b.artist_name}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded flex items-center gap-1 ${bCfg.color}`}>
                        <BookingIcon className="w-3 h-3" /> {bCfg.label}
                      </span>
                      {aCfg && (
                        <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${aCfg.color}`}>
                          {aCfg.label}
                        </span>
                      )}
                      {b.payment_status && (
                        <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          b.payment_status === "paid" ? "text-green-400 bg-green-400/10" :
                          b.payment_status === "partially_paid" ? "text-yellow-400 bg-yellow-400/10" :
                          "text-muted-foreground bg-muted"
                        }`}>
                          {b.payment_status.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    {b.budget && <p className="text-xs text-muted-foreground font-mono">Fee: ${b.budget.toLocaleString()}</p>}
                  </div>

                  {b.status !== "cancelled" && (
                    <div className="flex gap-1.5 flex-wrap">
                      {["assigned", "confirmed", "completed"].map(s => (
                        <button
                          key={s}
                          disabled={b.assignment_status === s || updatingStatus === b.id}
                          onClick={() => updateAssignmentStatus(b.id, s)}
                          className={`text-[10px] font-mono font-bold px-2 py-1 rounded border transition-all ${
                            b.assignment_status === s
                              ? `${ASSIGNMENT_STATUS[s].color} border-current`
                              : "border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          {updatingStatus === b.id ? "..." : ASSIGNMENT_STATUS[s].label}
                        </button>
                      ))}
                      <Link
                        to={`/booking/contract/${b.id}`}
                        className="text-[10px] font-mono font-bold px-2 py-1 rounded border border-border/40 text-muted-foreground hover:border-accent/40 hover:text-accent transition-all"
                      >
                        Contract →
                      </Link>
                    </div>
                  )}
                </div>
                {b.status === "cancelled" && b.cancellation_reason && (
                  <p className="text-xs text-destructive mt-2 font-mono">Cancelled: {b.cancellation_reason}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}