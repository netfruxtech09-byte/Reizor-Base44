import { useState } from "react";
import { Star, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

function StarRating({ value, onChange, readonly = false, size = "w-5 h-5" }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(s)}
          onMouseEnter={() => !readonly && setHover(s)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`transition-colors ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
        >
          <Star
            className={`${size} ${(hover || value) >= s ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
          />
        </button>
      ))}
    </div>
  );
}

export { StarRating };

export default function BookingReviewCard({ review, currentUserEmail, onReplySubmitted }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canReply = currentUserEmail === review.reviewee_email && !review.reply;

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    const now = new Date().toISOString();
    await base44.entities.BookingReview.update(review.id, { reply: replyText.trim(), reply_at: now });
    toast.success("Reply posted");
    onReplySubmitted?.({ ...review, reply: replyText.trim(), reply_at: now });
    setReplyOpen(false);
    setSubmitting(false);
  };

  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm shrink-0">
            {review.reviewer_name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="font-bold text-sm">{review.reviewer_name}</p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              {review.reviewer_role === "organizer" ? "Organizer" : "Artist"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <StarRating value={review.rating} readonly size="w-4 h-4" />
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {review.created_date ? format(new Date(review.created_date), "MMM dd, yyyy") : ""}
          </p>
        </div>
      </div>

      {review.event_name && (
        <p className="text-[10px] font-mono text-muted-foreground">📅 {review.event_name}</p>
      )}

      {review.body && <p className="text-sm text-muted-foreground leading-relaxed">"{review.body}"</p>}

      {/* Reply */}
      {review.reply && (
        <div className="ml-4 pl-3 border-l-2 border-accent/30 space-y-1">
          <p className="text-[10px] font-mono text-accent uppercase tracking-widest">Response · {review.reply_at ? format(new Date(review.reply_at), "MMM dd, yyyy") : ""}</p>
          <p className="text-sm text-muted-foreground">"{review.reply}"</p>
        </div>
      )}

      {canReply && (
        <div>
          {!replyOpen ? (
            <button onClick={() => setReplyOpen(true)} className="flex items-center gap-1.5 text-xs font-mono text-accent hover:text-accent/80 transition-colors">
              <MessageSquare className="w-3.5 h-3.5" /> Respond to this review
            </button>
          ) : (
            <div className="space-y-2 pt-1 border-t border-border/30">
              <p className="text-xs font-mono text-muted-foreground">Your one-time response:</p>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={3}
                placeholder="Write your response..."
                className="w-full rounded-lg bg-secondary border border-border/50 px-3 py-2 text-sm resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleReply} disabled={submitting || !replyText.trim()} className="font-display font-bold gap-1.5">
                  {submitting ? "Posting..." : "Post Response"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReplyOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}