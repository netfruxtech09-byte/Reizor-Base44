import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function OrganizerFollowButton({ organizerId, organizerName, organizerProfile, isOwner, onFollowChange }) {
  const [following, setFollowing] = useState(false);
  const [followRecord, setFollowRecord] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await base44.auth.me().catch(() => null);
      if (cancelled) return;
      setUser(me);
      if (me && organizerId) {
        const follows = await base44.entities.OrganizerFollow.filter(
          { organizer_id: organizerId, follower_email: me.email },
          null,
          1
        ).catch(() => []);
        if (cancelled) return;
        if (follows[0]) {
          setFollowing(true);
          setFollowRecord(follows[0]);
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [organizerId]);

  const handleFollow = async () => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.pathname + window.location.search);
      return;
    }
    if (pending) return;

    const wasFollowing = following;
    const prevRecord = followRecord;

    // Optimistic UI — update instantly
    setPending(true);
    setFollowing(!wasFollowing);
    setFollowRecord(null);
    const optimisticCount = Math.max(0, (organizerProfile?.follower_count || 0) + (wasFollowing ? -1 : 1));
    if (onFollowChange) onFollowChange(optimisticCount);

    try {
      if (wasFollowing) {
        if (prevRecord) {
          await base44.entities.OrganizerFollow.delete(prevRecord.id);
        }
        if (organizerProfile?.id) {
          base44.entities.OrganizerProfile.update(organizerProfile.id, { follower_count: optimisticCount }).catch(() => {});
        }
        toast.success("You have unfollowed this organizer.");
      } else {
        const existing = await base44.entities.OrganizerFollow.filter(
          { organizer_id: organizerId, follower_email: user.email },
          null,
          1
        ).catch(() => []);
        let rec = existing[0];
        if (!rec) {
          rec = await base44.entities.OrganizerFollow.create({
            organizer_id: organizerId,
            organizer_name: organizerName,
            follower_email: user.email,
            follower_name: user.full_name,
          });
        }
        setFollowRecord(rec);
        if (organizerProfile?.id) {
          base44.entities.OrganizerProfile.update(organizerProfile.id, { follower_count: optimisticCount }).catch(() => {});
        }
        toast.success("You are now following this organizer.");
      }
    } catch (err) {
      // Rollback on failure
      setFollowing(wasFollowing);
      setFollowRecord(prevRecord);
      if (onFollowChange) onFollowChange(organizerProfile?.follower_count || 0);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  // Owner never sees a follow button.
  if (isOwner) return null;

  // Skeleton placeholder while follow status loads — reserves the button's
  // space so the action row layout never jumps.
  if (loading) {
    return (
      <div className="h-10 w-28 rounded-md bg-muted/60 animate-pulse shrink-0" aria-hidden="true" />
    );
  }

  return (
    <Button
      onClick={handleFollow}
      disabled={pending}
      variant={following ? "outline" : "default"}
      className={`font-display font-bold text-sm shrink-0 ${following ? "" : "glow-lime"} ${pending ? "opacity-80" : ""}`}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}