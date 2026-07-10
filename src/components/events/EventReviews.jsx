import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

function StarRow({ value, onChange, size = 20 }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={`cursor-pointer transition-colors ${
            s <= (hover || value) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
          }`}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(s)}
        />
      ))}
    </div>
  );
}

export default function EventReviews({ eventId, eventTitle, organizerId, organizerName }) {
  const [reviews, setReviews] = useState([]);
  const [user, setUser] = useState(null);
  const [canReview, setCanReview] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [existing, setExisting] = useState(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(null);

  useEffect(() => {
    // Prevent duplicate loads from React strict mode or parent re-renders
    if (loadedRef.current === eventId) return;
    loadedRef.current = eventId;

    (async () => {
    try {
      const [revs, me] = await Promise.all([
        base44.entities.Review.filter({ event_id: eventId }, "-created_date", 100),
        base44.auth.me().catch(() => null),
      ]);
      setReviews(revs);
      setUser(me);
      if (me) {
        setIsOrganizer(me.id === organizerId || me.role === "admin" || me.role === "organizer");
        // Allow review if fan has ANY purchased ticket (active or scanned)
        const tickets = await base44.entities.Ticket.filter(
          { event_id: eventId, owner_email: me.email },
          null, 1
        );
        setCanReview(tickets.length > 0);
        const mine = revs.find((r) => r.reviewer_email === me.email);
        if (mine) { setExisting(mine); setRating(mine.rating); setBody(mine.body || ""); }
      }
    } catch (err) {
      // Rate limit or transient error — retry once after short delay
      if (err?.message?.includes("Rate limit")) {
        setTimeout(async () => {
          try {
            const [revs, me] = await Promise.all([
              base44.entities.Review.filter({ event_id: eventId }, "-created_date", 100),
              base44.auth.me().catch(() => null),
            ]);
            setReviews(revs);
            setUser(me);
            if (me) {
              setIsOrganizer(me.id === organizerId || me.role === "admin" || me.role === "organizer");
              const tickets = await base44.entities.Ticket.filter(
                { event_id: eventId, owner_email: me.email },
                null, 1
              );
              setCanReview(tickets.length > 0);
              const mine = revs.find((r) => r.reviewer_email === me.email);
              if (mine) { setExisting(mine); setRating(mine.rating); setBody(mine.body || ""); }
            }
          } catch (_) {}
          setLoading(false);
        }, 1500);
        return;
      }
    }
    setLoading(false);
    })();
  }, [eventId]);

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const handleSubmit = async () => {
    if (!rating) return toast.error("Please select a rating");
    setSubmitting(true);
    const data = { review_target: "event", event_id: eventId, event_title: eventTitle, organizer_id: organizerId, organizer_name: organizerName, reviewer_email: user.email, reviewer_name: user.full_name, rating, body };
    if (existing) {
      const updated = await base44.entities.Review.update(existing.id, { rating, body });
      setReviews((rs) => rs.map((r) => (r.id === existing.id ? updated : r)));
      setExisting(updated);
    } else {
      const created = await base44.entities.Review.create(data);
      setReviews((rs) => [created, ...rs]);
      setExisting(created);
      if (organizerId) {
        base44.functions.invoke("awardLoyaltyPoints", {
          action_type: "review", owner_type: "organizer", owner_id: organizerId, owner_name: organizerName, source_id: eventId,
        }).catch((err) => {
          if (err?.response?.data?.error === "follow_required") {
            toast.info(err.response.data.message || `Follow ${organizerName || "the organizer"} to earn points.`);
          }
        });
      }
    }
    toast.success(existing ? "Review updated!" : "Review submitted!");
    setSubmitting(false);
  };

  const handleReply = async (review) => {
    if (!replyText.trim()) return;
    setReplySubmitting(true);
    const updated = await base44.entities.Review.update(review.id, {
      organizer_reply: replyText.trim(),
      organizer_reply_at: new Date().toISOString(),
    });
    setReviews((rs) => rs.map((r) => (r.id === review.id ? updated : r)));
    setReplyingTo(null);
    setReplyText("");
    toast.success("Reply posted!");
    setReplySubmitting(false);
  };

  if (loading) return null;

  // Don't show the section when there are no reviews and user can't write one
  if (reviews.length === 0 && !canReview) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h3 className="font-display font-bold text-lg">REVIEWS</h3>
        {avgRating && (
          <div className="flex items-center gap-1.5">
            <StarRow value={Math.round(Number(avgRating))} size={14} />
            <span className="font-mono text-sm font-bold text-yellow-400">{avgRating}</span>
            <span className="text-xs text-muted-foreground font-mono">({reviews.length})</span>
          </div>
        )}
      </div>

      {/* Write / edit review */}
      {canReview && !isOrganizer && (
        <div className="p-4 rounded-xl bg-card border border-border/50 mb-6">
          <p className="font-mono text-xs text-primary uppercase tracking-widest mb-3">
            {existing ? "Edit your review" : "Leave a review"}
          </p>
          <StarRow value={rating} onChange={setRating} size={22} />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Share your experience..."
            className="mt-3 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm resize-none"
          />
          <Button onClick={handleSubmit} disabled={submitting || !rating} size="sm" className="mt-2 glow-lime font-display font-bold">
            {submitting ? "Saving..." : existing ? "Update Review" : "Submit Review"}
          </Button>
        </div>
      )}

      {/* Review list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No reviews yet. Be the first after attending!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="p-4 rounded-xl bg-card border border-border/50">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm">{r.reviewer_name || r.reviewer_email}</span>
                  {r.reviewer_email === user?.email && (
                    <span className="font-mono text-[9px] text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded">You</span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {format(new Date(r.created_date), "MMM d, yyyy")}
                </span>
              </div>
              <StarRow value={r.rating} size={13} />
              {r.body && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{r.body}</p>}

              {/* Organizer reply */}
              {r.organizer_reply && (
                <div className="mt-3 pl-3 border-l-2 border-primary/40">
                  <p className="font-mono text-[10px] text-primary uppercase tracking-widest mb-1">Organizer reply</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.organizer_reply}</p>
                  {r.organizer_reply_at && (
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">{format(new Date(r.organizer_reply_at), "MMM d, yyyy")}</p>
                  )}
                </div>
              )}

              {/* Reply form for organizer */}
              {isOrganizer && !r.organizer_reply && replyingTo !== r.id && (
                <button
                  onClick={() => { setReplyingTo(r.id); setReplyText(""); }}
                  className="mt-2 text-xs font-mono text-primary hover:underline"
                >
                  Reply
                </button>
              )}
              {isOrganizer && replyingTo === r.id && (
                <div className="mt-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={2}
                    placeholder="Write your reply..."
                    className="w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm resize-none"
                  />
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" disabled={replySubmitting || !replyText.trim()} onClick={() => handleReply(r)} className="font-display font-bold">
                      {replySubmitting ? "Posting..." : "Post Reply"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}