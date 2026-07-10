import { useState, useEffect } from "react";
import { UserPlus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Gates a loyalty-earning action behind a Follow requirement for organizer/artist owners.
 * Platform-owned activities always pass through with no follow requirement.
 */
export default function FollowGateButton({ ownerType, ownerId, ownerName, userEmail, userName, children, onFollowed }) {
  const [following, setFollowing] = useState(ownerType === "platform");
  const [loading, setLoading] = useState(ownerType !== "platform");
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (ownerType === "platform" || !userEmail || !ownerId) { setLoading(false); return; }
    const entity = ownerType === "artist" ? base44.entities.ArtistFollow : base44.entities.OrganizerFollow;
    const query = ownerType === "artist"
      ? { follower_email: userEmail, artist_id: ownerId }
      : { follower_email: userEmail, organizer_id: ownerId };
    entity.filter(query, null, 1).then(res => setFollowing(res.length > 0)).finally(() => setLoading(false));
  }, [ownerType, ownerId, userEmail]);

  const handleFollow = async () => {
    setFollowBusy(true);
    try {
      if (ownerType === "artist") {
        await base44.entities.ArtistFollow.create({ artist_id: ownerId, artist_name: ownerName, follower_email: userEmail, follower_name: userName });
      } else {
        await base44.entities.OrganizerFollow.create({ organizer_id: ownerId, organizer_name: ownerName, follower_email: userEmail, follower_name: userName });
      }
      setFollowing(true);
      toast.success(`You're now following ${ownerName}!`);
      onFollowed?.();
    } catch {
      toast.error("Couldn't follow right now. Please try again.");
    }
    setFollowBusy(false);
  };

  if (loading) return <div className="h-9 w-full rounded-lg bg-muted/40 animate-pulse" />;

  if (!following) {
    return (
      <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30 space-y-2 text-center">
        <p className="text-sm text-yellow-400 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Follow {ownerName} to participate and earn points.
        </p>
        <Button size="sm" onClick={handleFollow} disabled={followBusy} className="gap-1.5 glow-lime font-display font-bold">
          <UserPlus className="w-3.5 h-3.5" /> {followBusy ? "Following..." : `Follow ${ownerName}`}
        </Button>
      </div>
    );
  }

  return children;
}