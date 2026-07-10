import { useState } from "react";
import { StarRating } from "./BookingReviewCard";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function LeaveReviewForm({ booking, currentUser, reviewerRole, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const revieweeName = reviewerRole === "organizer" ? booking.artist_name : booking.booker_name;
  const revieweeEmail = reviewerRole === "organizer" ? booking.artist_email : booking.booker_email;
  const revieweeRole = reviewerRole === "organizer" ? "artist" : "organizer";

  const handleSubmit = async () => {
    if (rating === 0) { toast.error("Please select a rating"); return; }
    setSubmitting(true);
    const review = await base44.entities.BookingReview.create({
      booking_id: booking.id,
      event_name: booking.event_name,
      reviewer_email: currentUser.email,
      reviewer_name: currentUser.full_name || currentUser.email,
      reviewer_role: reviewerRole,
      reviewee_email: revieweeEmail,
      reviewee_name: revieweeName,
      reviewee_role: revieweeRole,
      artist_id: booking.artist_id,
      artist_name: booking.artist_name,
      artist_email: booking.artist_email,
      organizer_email: booking.booker_email,
      organizer_name: booking.booker_name,
      rating,
      body: body.trim(),
    });
    await base44.entities.Notification.create({
      user_email: revieweeEmail,
      title: `⭐ New review from ${currentUser.full_name || "someone"}`,
      message: `You received a ${rating}-star review for "${booking.event_name}". ${body ? `"${body.slice(0, 80)}${body.length > 80 ? '...' : ''}"` : ""}`,
      type: "general",
    });
    toast.success("Review submitted!");
    onSubmitted?.(review);
    setSubmitting(false);
  };

  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
      <p className="font-display font-bold text-sm">Rate your experience with {revieweeName}</p>
      <div className="flex items-center gap-3">
        <StarRating value={rating} onChange={setRating} size="w-6 h-6" />
        {rating > 0 && <span className="text-xs font-mono text-muted-foreground">{["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}</span>}
      </div>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={3}
        placeholder="Share your experience (optional)..."
        className="w-full rounded-lg bg-secondary border border-border/50 px-3 py-2 text-sm resize-none"
      />
      <Button onClick={handleSubmit} disabled={submitting || rating === 0} className="glow-lime font-display font-bold gap-1.5 w-full">
        {submitting ? "Submitting..." : "Submit Review"}
      </Button>
    </div>
  );
}