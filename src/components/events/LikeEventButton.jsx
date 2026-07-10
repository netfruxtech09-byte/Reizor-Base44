import { useState, useEffect } from "react";
import { Heart, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useAuthGate } from "@/hooks/useAuthGate";
import { hapticSuccess, hapticLight } from "@/lib/haptics";
import { compactNumber, fullNumber } from "@/utils/formatNumber";

export default function LikeEventButton({ event, showCount = false }) {
  const [status, setStatus] = useState("idle"); // idle | liked | loading
  const [entry, setEntry] = useState(null);
  const [checked, setChecked] = useState(false);
  const [likesCount, setLikesCount] = useState(event?.likes_count ?? 0);
  const [countLoaded, setCountLoaded] = useState(false);
  const { requireAuth } = useAuthGate();

  // Fetch count from backend on mount when showCount is true
  useEffect(() => {
    if (!event || !showCount || countLoaded) return;
    let cancelled = false;
    (async () => {
      const likes = await base44.entities.EventLike.filter(
        { event_id: event.id }, null, 5000
      ).catch(() => []);
      if (!cancelled) {
        setLikesCount(likes.length);
        setCountLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [event?.id, showCount]);

  if (!event) return null;

  const checkLikedStatus = async () => {
    if (checked) return;
    setChecked(true);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return;
    const likes = await base44.entities.EventLike.filter(
      { event_id: event.id, user_email: user.email }, null, 1
    ).catch(() => []);
    if (likes[0]) { setEntry(likes[0]); setStatus("liked"); }
  };

  const toggle = async () => {
    const authed = await requireAuth("Sign in to like events.");
    if (!authed) return;
    if (!checked) await checkLikedStatus();
    const user = await base44.auth.me().catch(() => null);
    if (!user) return;
    setStatus("loading");
    if (entry) {
      hapticLight();
      const prevEntry = entry;
      setEntry(null);
      setStatus("idle");
      setLikesCount(prev => Math.max(0, prev - 1));
      base44.entities.EventLike.delete(prevEntry.id).catch(() => {
        setEntry(prevEntry);
        setStatus("liked");
        setLikesCount(prev => prev + 1);
        toast.error("Failed to unlike — please try again");
      });
    } else {
      hapticSuccess();
      const created = await base44.entities.EventLike.create({
        event_id: event.id,
        event_title: event.title,
        user_email: user.email,
      }).catch(() => null);
      if (created) {
        setEntry(created);
        setStatus("liked");
        setLikesCount(prev => prev + 1);
        toast.success("Event liked!");
        if (event.organizer_id) {
          base44.functions.invoke("awardLoyaltyPoints", {
            action_type: "like", owner_type: "organizer",
            owner_id: event.organizer_id, owner_name: event.organizer_name, source_id: event.id,
          }).catch((err) => {
            if (err?.response?.data?.error === "follow_required") {
              toast.info(err.response.data.message || `Follow ${event.organizer_name || "the organizer"} to earn points.`);
            }
          });
        }
      } else {
        setStatus("idle");
        toast.error("Failed to like — please try again");
      }
    }
  };

  const countDisplay = showCount && likesCount > 0 ? (
    <span title={fullNumber(likesCount)} className="text-xs font-mono font-bold text-white/70 ml-1" style={{ minWidth: "1.5ch" }}>
      {compactNumber(likesCount)}
    </span>
  ) : null;

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={toggle}
        onMouseEnter={checkLikedStatus}
        onFocus={checkLikedStatus}
        disabled={status === "loading"}
        title={status === "liked" ? "Unlike" : "Like event"}
        className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all touch-manipulation ${
          status === "liked"
            ? "bg-red-500/90 text-white"
            : "bg-black/50 backdrop-blur-sm text-white/80 hover:bg-black/70"
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {status === "loading" ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Heart className={`w-5 h-5 transition-all ${status === "liked" ? "fill-white" : ""}`} />
        )}
      </button>
      {countDisplay}
    </div>
  );
}

// Export a hook version for other components (e.g., posts, raffles)
export function useLikeButton(entityId, entityType = "event") {
  const [status, setStatus] = useState("idle");
  const [entry, setEntry] = useState(null);
  const [checked, setChecked] = useState(false);
  const { requireAuth } = useAuthGate();

  const checkLikedStatus = async () => {
    if (checked) return;
    setChecked(true);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return;
    const query = { [entityType === "event" ? "event_id" : "post_id"]: entityId, user_email: user.email };
    const entity = entityType === "event" ? "EventLike" : "PostLike";
    const likes = await base44.entities[entity].filter(query, null, 1).catch(() => []);
    if (likes[0]) { setEntry(likes[0]); setStatus("liked"); }
  };

  const toggle = async () => {
    const authed = await requireAuth("Sign in to like.");
    if (!authed) return;
    if (!checked) await checkLikedStatus();
    if (status === "loading") return;
    setStatus("loading");
    const user = await base44.auth.me().catch(() => null);
    if (!user) { setStatus("idle"); return; }
    const entity = entityType === "event" ? "EventLike" : "PostLike";
    try {
      if (entry) {
        await base44.entities[entity].delete(entry.id);
        hapticLight();
        setEntry(null);
        setStatus("idle");
      } else {
        const created = await base44.entities[entity].create({
          [entityType === "event" ? "event_id" : "post_id"]: entityId,
          user_email: user.email,
        });
        hapticSuccess();
        setEntry(created);
        setStatus("liked");
      }
    } catch (err) {
      setStatus(entry ? "liked" : "idle");
      console.error("Like toggle error:", err);
    }
  };

  return { status, checked, toggle, entry, checkLikedStatus };
}