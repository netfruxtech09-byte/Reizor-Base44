import { useState, useEffect } from "react";
import { MessageCircle, Star, Heart } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * PostInteractionBar — shows comment/review counts + like button.
 *
 * Props:
 *   mode — "comments" | "reviews" | "both" (default: "both")
 *   onCountsChange — callback with { commentCount, reviewCount, avgRating } when counts change
 */
export default function PostInteractionBar({ post, currentUser, onOpenSheet, mode = "both", onCountsChange }) {
  const [commentCount, setCommentCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [avgRating, setAvgRating] = useState(null);
  const [likeCount, setLikeCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCounts = async () => {
    if (!post?.id) return;
    const showComments = mode === "comments" || mode === "both";
    const showReviews = mode === "reviews" || mode === "both";

    // Fetch sequentially through the rate-limiter queue (avoids Promise.all burst)
    let comms = [];
    let revs = [];
    if (showComments) comms = await base44.entities.PostComment.filter({ post_id: post.id, status: "active" }, null, 200);
    if (showReviews) revs = await base44.entities.PostReview.filter({ post_id: post.id, status: "active" }, null, 200);
    const cc = comms.length;
    const rc = revs.length;
    const avg = revs.length > 0 ? (revs.reduce((s, r) => s + r.rating, 0) / revs.length).toFixed(1) : null;

    setCommentCount(cc);
    setReviewCount(rc);
    setAvgRating(avg);
    onCountsChange?.({ commentCount: cc, reviewCount: rc, avgRating: avg });

    // Load likes + check if current user already liked (one like per user)
    const likes = await base44.entities.CommunityPostLike.filter({ post_id: post.id }, null, 500);
    setLikeCount(likes.length);
    if (currentUser?.email) {
      setHasLiked(likes.some((l) => l.user_email === currentUser.email));
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    // Stagger requests to avoid rate limits when many instances mount at once
    const timer = setTimeout(() => loadCounts(), 150);
    return () => clearTimeout(timer);
  }, [post?.id, mode, currentUser?.email]);

  const toggleLike = async () => {
    // Block until initial load completes — prevents duplicate likes from double-tap
    if (!post?.id || !currentUser?.email || likeBusy || loading) return;
    setLikeBusy(true);
    const prevLiked = hasLiked;
    const prevCount = likeCount;
    try {
      // Optimistic update
      if (hasLiked) {
        setLikeCount((c) => c - 1);
        setHasLiked(false);
      } else {
        setLikeCount((c) => c + 1);
        setHasLiked(true);
      }
      // Backend handles duplicate prevention atomically
      const res = await base44.functions.invoke("togglePostLike", {
        post_id: post.id,
        action: prevLiked ? "unlike" : "like",
      });
      // Sync from backend response (authoritative count + state)
      if (res?.data) {
        setHasLiked(res.data.liked);
        if (typeof res.data.likeCount === "number") setLikeCount(res.data.likeCount);
      }
    } catch {
      // Revert optimistic update on failure
      setHasLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLikeBusy(false);
    }
  };

  const showComments = mode === "comments" || mode === "both";
  const showReviews = mode === "reviews" || mode === "both";

  // Shimmer placeholder while loading metrics
  if (loading) {
    return (
      <div className="flex items-center gap-4 pt-3 border-t border-border/20">
        {showComments && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-muted/60 animate-pulse" />
            <div className="w-5 h-3 rounded bg-muted/60 animate-pulse" />
          </div>
        )}
        {showReviews && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-muted/60 animate-pulse" />
            <div className="w-5 h-3 rounded bg-muted/60 animate-pulse" />
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-5 h-5 rounded-full bg-muted/60 animate-pulse" />
          <div className="w-5 h-3 rounded bg-muted/60 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 pt-3 border-t border-border/20">
      {/* Comments button */}
      {showComments && (
        <button
          onClick={onOpenSheet}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          <MessageCircle className="w-5 h-5 group-hover:text-foreground group-hover:scale-110 transition-all" />
          <span className="font-bold">{commentCount || 0}</span>
        </button>
      )}

      {/* Reviews button — only shown when mode includes reviews */}
      {showReviews && (
        <button
          onClick={onOpenSheet}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-yellow-400 transition-colors group"
        >
          <Star className="w-5 h-5 group-hover:text-yellow-400 group-hover:scale-110 transition-all" />
          {avgRating ? (
            <span className="font-bold text-yellow-400">{avgRating}</span>
          ) : (
            <span className="font-bold">{reviewCount || 0}</span>
          )}
        </button>
      )}

      {/* Like button — one like per user, toggles on click */}
      <button
        onClick={toggleLike}
        disabled={!currentUser?.email || likeBusy}
        className={`flex items-center gap-1.5 text-sm font-medium transition-colors group ml-auto ${hasLiked ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
      >
        <Heart className={`w-5 h-5 transition-all ${hasLiked ? "fill-primary text-primary" : "group-hover:text-primary group-hover:scale-110"}`} />
        <span className="font-bold">{likeCount || 0}</span>
      </button>
    </div>
  );
}