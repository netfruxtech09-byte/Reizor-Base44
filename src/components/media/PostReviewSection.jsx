import { useState, useEffect } from "react";
import { Star, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

export default function PostReviewSection({ postId, organizerId, currentUser, isOwner, onCountChange }) {
  const [reviews, setReviews] = useState([]);
  const [myReview, setMyReview] = useState(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadReviews = async () => {
    const all = await base44.entities.PostReview.filter(
      { post_id: postId, status: "active" },
      "-created_date",
      100
    );
    onCountChange?.(all.length);
    setReviews(all);
    if (currentUser) {
      const mine = all.find((r) => r.fan_email === currentUser.email);
      setMyReview(mine || null);
      if (mine) {
        setRating(mine.rating);
        setText(mine.review_text || "");
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadReviews(); }, [postId]);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (rating < 1 || rating > 5) return;
    const trimmed = text.trim();
    if (trimmed.length > 1000) return;
    setSubmitting(true);

    if (myReview) {
      await base44.entities.PostReview.update(myReview.id, {
        rating,
        review_text: trimmed || "",
      });
      toast.success("Review updated");
    } else {
      await base44.entities.PostReview.create({
        post_id: postId,
        organizer_id: organizerId,
        fan_email: currentUser.email,
        fan_name: currentUser.full_name || currentUser.email,
        rating,
        review_text: trimmed || "",
      });
      toast.success("Review submitted");
    }
    setShowForm(false);
    setSubmitting(false);
    await loadReviews();
  };

  const handleDelete = async (review) => {
    await base44.entities.PostReview.update(review.id, { status: "hidden" });
    setReviews((prev) => prev.filter((r) => r.id !== review.id));
    if (myReview?.id === review.id) setMyReview(null);
    toast.success("Review removed");
  };

  if (!currentUser) {
    return (
      <div className="py-4 text-center">
        <p className="text-xs text-muted-foreground">
          <button
            onClick={() => base44.auth.redirectToLogin(window.location.href)}
            className="text-primary hover:underline font-bold"
          >
            Sign in
          </button>
          {" "}to leave a review
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex justify-center py-3">
          <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {avgRating && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${s <= Math.round(parseFloat(avgRating)) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <span className="text-sm font-bold">{avgRating}</span>
              <span className="text-xs text-muted-foreground">({reviews.length} review{reviews.length !== 1 ? "s" : ""})</span>
            </div>
          )}

          {!myReview && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs text-primary hover:underline font-bold"
            >
              Write a review
            </button>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-2 p-3 rounded-lg bg-secondary/30 border border-border/30">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-5 h-5 ${s <= (hoverRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share your thoughts... (optional)"
                maxLength={1000}
                rows={2}
                className="w-full bg-transparent border border-border/50 rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setRating(0); setText(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rating < 1 || submitting}
                  className="text-xs bg-primary text-white px-3 py-1 rounded font-bold disabled:opacity-40"
                >
                  {myReview ? "Update" : "Submit"}
                </button>
              </div>
            </form>
          )}

          {myReview && !showForm && (
            <div className="p-2.5 rounded-lg bg-secondary/20 border border-border/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${s <= myReview.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowForm(true)} className="text-[10px] text-primary hover:underline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(myReview)} className="text-[10px] text-destructive hover:underline">
                    Delete
                  </button>
                </div>
              </div>
              {myReview.review_text && (
                <p className="text-xs text-muted-foreground mt-1">{myReview.review_text}</p>
              )}
            </div>
          )}

          {reviews.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {reviews.filter(r => !myReview || r.id !== myReview.id).map((r) => (
                <div key={r.id} className="flex gap-2 group">
                  <div className="w-6 h-6 rounded-full bg-yellow-400/10 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-yellow-400">
                      {r.fan_name?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate">{r.fan_name}</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`w-2.5 h-2.5 ${s <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                    </div>
                    {r.review_text && <p className="text-xs text-muted-foreground leading-snug">{r.review_text}</p>}
                  </div>
                  {(currentUser.email === r.fan_email || isOwner || currentUser.role === "admin") && (
                    <button onClick={() => handleDelete(r)} className="shrink-0 opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}