import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Hook that fetches the real follower count for a single artist
 * from ArtistFollow records (source of truth).
 * Returns { count, loading } and also persists the count back to the Artist record if it differs.
 */
export function useArtistFollowerCount(artistId, cachedCount) {
  const [count, setCount] = useState(cachedCount ?? 0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artistId) { setLoading(false); return; }
    base44.entities.ArtistFollow.filter({ artist_id: artistId }, null, 5000)
      .then(follows => {
        const realCount = follows.length;
        setCount(realCount);
        // Persist back to Artist record so other views stay in sync
        if (cachedCount !== realCount) {
          base44.entities.Artist.update(artistId, { follower_count: realCount }).catch(() => {});
        }
      })
      .catch(() => setCount(cachedCount ?? 0))
      .finally(() => setLoading(false));
  }, [artistId]);

  return { count, loading };
}

/**
 * Fetches real follower counts for a list of artists in one batch query.
 * Returns a Map<artistId, count>.
 */
export async function fetchBatchFollowerCounts(artistIds) {
  if (!artistIds || artistIds.length === 0) return new Map();
  // Fetch all follow records for all these artists in one call
  const allFollows = await base44.entities.ArtistFollow.list(null, 10000).catch(() => []);
  const map = new Map();
  for (const id of artistIds) map.set(id, 0);
  for (const f of allFollows) {
    if (map.has(f.artist_id)) {
      map.set(f.artist_id, map.get(f.artist_id) + 1);
    }
  }
  return map;
}