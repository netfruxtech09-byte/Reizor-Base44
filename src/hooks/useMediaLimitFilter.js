import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * useMediaLimitFilter — filters media arrays by checking storage + streaming limits
 * for non-admin owners. Admin-owned videos always pass.
 *
 * Usage:
 *   const { filtered, blockedIds, loading } = useMediaLimitFilter(mediaItems);
 *   // Only show `filtered` items in the UI
 *
 * Each media item must have: id, organizer_id
 */
export default function useMediaLimitFilter(mediaItems = []) {
  const [blockedIds, setBlockedIds] = useState(null); // null = haven't checked yet, avoid flash of unfiltered items
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mediaItems || mediaItems.length === 0) {
      setBlockedIds(new Set());
      setLoading(false);
      return;
    }

    // Build items list for batch check
    const items = mediaItems
      .filter(m => m?.id && m?.organizer_id)
      .map(m => ({ video_id: m.id, organizer_id: m.organizer_id }));

    if (items.length === 0) {
      setBlockedIds(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    base44.functions
      .invoke("videoMinuteBilling", {
        action: "check_playable_batch",
        items,
      })
      .then((res) => {
        const results = res.data?.results || {};
        const blocked = new Set();
        Object.entries(results).forEach(([vid, status]) => {
          if (status.playable === false) blocked.add(vid);
        });
        setBlockedIds(blocked);
        setLoading(false);
      })
      .catch(() => {
        // On error, allow all — don't block videos due to API failure
        setBlockedIds(new Set());
        setLoading(false);
      });
  }, [mediaItems]);

  // Optimistic: show ALL items immediately while the playability check is
  // pending, so the gallery never flashes "No media uploaded yet" for media
  // that genuinely exists. Blocked items are removed once the check resolves.
  const filtered = blockedIds === null ? mediaItems : mediaItems.filter((m) => !blockedIds.has(m.id));

  return { filtered, blockedIds, loading };
}