import { useState, useEffect, useRef } from "react";
import { X, MessageCircle, Star } from "lucide-react";
import PostCommentsSection from "@/components/media/PostCommentsSection";
import PostReviewSection from "@/components/media/PostReviewSection";
import { base44 } from "@/api/base44Client";

/**
 * PostInteractionsSheet — slide-up sheet for comments + reviews.
 *
 * Adds "sheet-open" class to body while open (hides FloatingChatButton).
 * Calls onClose(updatedCounts) so parent can sync counts back to PostInteractionBar.
 */
export default function PostInteractionsSheet({ post, currentUser, isOwner, open, onClose, mode = "both" }) {
  const [tab, setTab] = useState(mode === "reviews" ? "reviews" : "comments");
  const [commentCount, setCommentCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [avgRating, setAvgRating] = useState(null);
  const ref = useRef(null);

  const showCommentsTab = mode === "comments" || mode === "both";
  const showReviewsTab = mode === "reviews" || mode === "both";

  useEffect(() => {
    if (!open || !post?.id) return;
    // Set initial tab based on mode
    if (mode === "reviews") setTab("reviews");
    else setTab("comments");

    const load = async () => {
      const [comms, revs] = await Promise.all([
        showCommentsTab ? base44.entities.PostComment.filter({ post_id: post.id, status: "active" }, null, 100) : Promise.resolve([]),
        showReviewsTab ? base44.entities.PostReview.filter({ post_id: post.id, status: "active" }, null, 100) : Promise.resolve([]),
      ]);
      setCommentCount(comms.length);
      setReviewCount(revs.length);
      if (revs.length > 0) {
        setAvgRating((revs.reduce((s, r) => s + r.rating, 0) / revs.length).toFixed(1));
      }
    };
    load();
  }, [open, post?.id, mode]);

  // Add/remove "sheet-open" class on body to hide FloatingChatButton
  useEffect(() => {
    if (open) {
      document.body.classList.add("sheet-open");
    } else {
      document.body.classList.remove("sheet-open");
    }
    return () => document.body.classList.remove("sheet-open");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClose = () => {
    onClose?.({ commentCount, reviewCount, avgRating });
  };

  if (!open || !post) return null;

  // If only one tab is available, skip the tab bar entirely
  const singleTab = !showCommentsTab ? "reviews" : !showReviewsTab ? "comments" : null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div
        ref={ref}
        className="w-full sm:max-w-lg max-h-[85vh] bg-card border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "calc(85vh - env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Header */}
        {singleTab ? (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0">
            <div className="flex items-center gap-2">
              {singleTab === "comments" ? (
                <>
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <span className="text-sm font-bold text-primary">Comments</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary">{commentCount}</span>
                </>
              ) : (
                <>
                  <Star className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm font-bold text-yellow-400">Reviews</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400">{reviewCount}</span>
                </>
              )}
            </div>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0">
            <div className="flex gap-5">
              <button
                onClick={() => setTab("comments")}
                className={`flex items-center gap-2 text-sm font-bold transition-colors ${
                  tab === "comments" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageCircle className="w-5 h-5" />
                <span>Comments</span>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${tab === "comments" ? "bg-primary/20 text-primary" : "bg-muted"}`}>
                  {commentCount}
                </span>
              </button>
              <button
                onClick={() => setTab("reviews")}
                className={`flex items-center gap-2 text-sm font-bold transition-colors ${
                  tab === "reviews" ? "text-yellow-400" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Star className="w-5 h-5" />
                <span>Reviews</span>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${tab === "reviews" ? "bg-yellow-400/20 text-yellow-400" : "bg-muted"}`}>
                  {reviewCount}
                </span>
              </button>
            </div>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {tab === "comments" ? (
            <PostCommentsSection
              postId={post.id}
              organizerId={post.organizer_id}
              currentUser={currentUser}
              isOwner={isOwner}
              onCountChange={(c) => setCommentCount(c)}
            />
          ) : (
            <PostReviewSection
              postId={post.id}
              organizerId={post.organizer_id}
              currentUser={currentUser}
              isOwner={isOwner}
              onCountChange={(c) => setReviewCount(c)}
            />
          )}
        </div>
      </div>
    </div>
  );
}