import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import BookingReviewCard from "../booking/BookingReviewCard";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

function StarRow({ value, onChange, size = 18 }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <Star key={s} size={size}
          className={`transition-colors ${onChange ? "cursor-pointer" : ""} ${s <= (hover || value) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(s)}
        />
      ))}
    </div>
  );
}

export default function ArtistReviewsSection({ artist, currentUserEmail }) {
  const [bookingReviews, setBookingReviews] = useState([]);
  const [fanReviews, setFanReviews] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [existingFanReview, setExistingFanReview] = useState(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artist?.id) return;
    Promise.all([
      base44.entities.BookingReview.filter({ artist_id: artist.id, reviewee_role: "artist" }, "-created_date", 50),
      base44.entities.Review.filter({ artist_id: artist.id, review_target: "artist" }, "-created_date", 50),
      base44.auth.me().catch(() => null),
    ]).then(async ([br, fr, me]) => {
      setBookingReviews(br);
      setFanReviews(fr);
      if (me && me.email !== artist.user_email) {
        // Check if fan has any scanned ticket (verified platform attendee)
        const tickets = await base44.entities.Ticket.filter({ owner_email: me.email, status: "scanned" }, null, 1);
        setCanReview(tickets.length > 0);
        const mine = fr.find(r => r.reviewer_email === me.email);
        if (mine) { setExistingFanReview(mine); setRating(mine.rating); setBody(mine.body || ""); }
      }
      setLoading(false);
    });
  }, [artist?.id]);

  const handleSubmitFanReview = async () => {
    if (!rating) return toast.error("Please select a rating");
    setSubmitting(true);
    const data = { review_target: "artist", artist_id: artist.id, artist_name: artist.display_name, reviewer_email: currentUserEmail, reviewer_name: "", rating, body };
    if (existingFanReview) {
      const updated = await base44.entities.Review.update(existingFanReview.id, { rating, body });
      setFanReviews(prev => prev.map(r => r.id === existingFanReview.id ? updated : r));
      setExistingFanReview(updated);
    } else {
      const created = await base44.entities.Review.create(data);
      setFanReviews(prev => [created, ...prev]);
      setExistingFanReview(created);
    }
    toast.success(existingFanReview ? "Review updated!" : "Review submitted!");
    setSubmitting(false);
  };

  const handleReplyUpdate = (updated) => {
    setBookingReviews(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  if (loading) return null;

  const allRatings = [...bookingReviews, ...fanReviews];
  if (allRatings.length === 0 && !canReview) return null;
  const avg = allRatings.length ? (allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length).toFixed(1) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="font-display font-bold text-lg">REVIEWS</h2>
        {avg && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            <span className="font-mono text-sm font-bold text-yellow-400">{avg}</span>
            <span className="font-mono text-[10px] text-muted-foreground">({allRatings.length})</span>
          </div>
        )}
      </div>

      {/* Fan write-a-review form */}
      {canReview && (
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
          <p className="font-mono text-xs text-primary uppercase tracking-widest">
            {existingFanReview ? "Edit your review" : "Leave a fan review"}
          </p>
          <StarRow value={rating} onChange={setRating} size={22} />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={3}
            placeholder="Share your experience with this artist..."
            className="w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm resize-none"
          />
          <Button onClick={handleSubmitFanReview} disabled={submitting || !rating} size="sm" className="glow-lime font-display font-bold">
            {submitting ? "Saving..." : existingFanReview ? "Update Review" : "Submit Review"}
          </Button>
        </div>
      )}

      {/* Fan reviews */}
      {fanReviews.map(r => (
        <div key={r.id} className="p-4 rounded-xl bg-card border border-border/50">
          <div className="flex items-center justify-between mb-1">
            <span className="font-display font-bold text-sm">{r.reviewer_name || r.reviewer_email}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{format(new Date(r.created_date), "MMM d, yyyy")}</span>
          </div>
          <StarRow value={r.rating} size={13} />
          {r.body && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{r.body}</p>}
        </div>
      ))}

      {/* Booking reviews (organizer ↔ artist) */}
      {bookingReviews.length > 0 && (
        <>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest pt-1">From Bookers</p>
          {bookingReviews.map(r => (
            <BookingReviewCard key={r.id} review={r} currentUserEmail={currentUserEmail} onReplySubmitted={handleReplyUpdate} />
          ))}
        </>
      )}
    </div>
  );
}