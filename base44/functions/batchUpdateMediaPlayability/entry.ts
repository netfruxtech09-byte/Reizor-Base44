/**
 * Backend function — Batch Update Media Playability (Global).
 *
 * Evaluates ALL media posts across all roles (Organizer, Artist, White-Label/Community)
 * and marks each as is_playable = true/false based on the owner's storage AND streaming limits.
 *
 * Runs as a scheduled automation (every 15 minutes).
 * Images and non-video content are always marked as playable.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date().toISOString();
    const monthKey = now.slice(0, 7);

    // ── Load all entities in parallel ──
    const [
      allUsers, allStorageRecords, allSettings, allWatchLogs, allPlans,
      orgPosts, artistPosts, artistAlbums, communityPosts
    ] = await Promise.all([
      base44.asServiceRole.entities.User.filter({}, null, 2000).catch(() => []),
      base44.asServiceRole.entities.OrganizerStorageRecord.filter({ deleted: false }, null, 5000).catch(() => []),
      base44.asServiceRole.entities.AppSettings.filter({}, null, 50).catch(() => []),
      base44.asServiceRole.entities.VideoWatchLog.filter({}, '-created_date', 5000).catch(() => []),
      base44.asServiceRole.entities.VideoMinutePlan.filter({ status: 'active' }, null, 500).catch(() => []),
      base44.asServiceRole.entities.OrganizerMediaPost.filter({ status: 'active', approval_status: 'approved' }, '-created_date', 2000).catch(() => []),
      base44.asServiceRole.entities.ArtistPost.filter({ approval_status: 'approved' }, '-created_date', 1000).catch(() => []),
      base44.asServiceRole.entities.ArtistAlbum.filter({ approval_status: 'approved', is_public: true }, '-created_date', 1000).catch(() => []),
      base44.asServiceRole.entities.CommunityPost.filter({ media_approval_status: 'approved' }, '-created_date', 500).catch(() => []),
    ]);

    // ── Settings ──
    const settingsMap = {};
    allSettings.forEach(s => { settingsMap[s.setting_key] = s.setting_value; });
    const freeGbPerMonth = parseFloat(settingsMap['storage_free_gb_per_month'] || '10');
    const freeMinutesPerUser = parseFloat(settingsMap['video_usage_free_minutes_per_user_monthly'] || '500');

    // ── User map ──
    const userMap = {};
    allUsers.forEach(u => { userMap[u.id] = u; });

    // ── Compute state for ALL user IDs ──
    const allUserIds = new Set();
    orgPosts.forEach(p => p.organizer_id && allUserIds.add(p.organizer_id));
    artistPosts.forEach(p => p.artist_id && allUserIds.add(p.artist_id));
    artistAlbums.forEach(p => p.artist_id && allUserIds.add(p.artist_id));
    communityPosts.forEach(p => p.author_email && allUserIds.add(p.author_email)); // Community uses email

    const userState = {};
    allUserIds.forEach(uid => {
      const user = userMap[uid];
      const isAdmin = user?.role === 'admin';

      // Storage
      const userStorageBytes = allStorageRecords
        .filter(r => r.organizer_id === uid || r.artist_id === uid)
        .reduce((s, r) => s + (r.file_size_bytes || 0), 0);
      const userStorageGb = userStorageBytes / 1073741824;
      const storageExhausted = !isAdmin && userStorageGb >= freeGbPerMonth;

      // Streaming
      const userLogs = allWatchLogs.filter(l =>
        l.organizer_id === uid ||
        l.owner_user_id === uid ||
        l.organizer_email === uid
      );
      const monthLogs = userLogs.filter(l => l.created_date?.startsWith(monthKey));
      const freeUsed = monthLogs.filter(l => l.is_free).reduce((s, l) => s + (l.minutes_watched || 0), 0);
      const freeRemaining = Math.max(0, freeMinutesPerUser - freeUsed);

      const userPlans = allPlans.filter(p =>
        p.organizer_id === uid ||
        p.owner_user_id === uid ||
        p.organizer_email === uid
      );
      const billableRemaining = userPlans.reduce((s, p) => s + (p.remaining_minutes || 0), 0);
      const streamingExhausted = !isAdmin && (freeRemaining + billableRemaining) <= 0;

      userState[uid] = { isAdmin, storageExhausted, streamingExhausted };
    });

    // ── Helper: determine if should be playable ──
    const computePlayable = (state, isVideo) => {
      if (!isVideo) return true; // images/text always playable
      if (!state) return true; // unknown user, allow
      if (state.isAdmin) return true;
      return !state.storageExhausted && !state.streamingExhausted;
    };

    const computeReason = (state, isVideo) => {
      if (!isVideo || !state || state.isAdmin) return null;
      const reasons = [];
      if (state.storageExhausted) reasons.push('storage_exhausted');
      if (state.streamingExhausted) reasons.push('streaming_exhausted');
      return reasons.length > 0 ? reasons.join('+') : null;
    };

    // ── Update helper ──
    let stats = { checked: 0, blocked: 0, unblocked: 0, skipped: 0 };

    const updateEntity = async (entity, post, ownerId, records) => {
      stats.checked++;
      const hasVideo = entity === 'OrganizerMediaPost'
        ? post.media_type === 'video'
        : (post.media_types || []).some(t => t === 'video' || t === 'video360') ||
          (post.media_type === 'video' && post.type === 'photo');

      const state = userState[ownerId] || null;
      const shouldBePlayable = computePlayable(state, hasVideo);
      const reason = computeReason(state, hasVideo);

      if (post.is_playable !== shouldBePlayable) {
        await base44.asServiceRole.entities[entity].update(post.id, {
          is_playable: shouldBePlayable,
          playability_checked_at: now,
          playability_block_reason: shouldBePlayable ? null : reason,
        }).catch(() => {});
        if (!shouldBePlayable) stats.blocked++;
        else stats.unblocked++;
      } else {
        stats.skipped++;
      }
    };

    // ── Process all entities ──
    // Organizer posts
    for (const post of orgPosts) {
      await updateEntity('OrganizerMediaPost', post, post.organizer_id);
    }

    // Artist posts
    for (const post of artistPosts) {
      await updateEntity('ArtistPost', post, post.artist_id);
    }

    // Artist albums — treat as playable if ANY video media and limits ok, else mark as not
    for (const album of artistAlbums) {
      stats.checked++;
      const hasVideo = (album.media_types || []).some(t => t === 'video' || t === 'video360');
      const state = userState[album.artist_id] || null;
      const shouldBePlayable = computePlayable(state, hasVideo);
      const reason = computeReason(state, hasVideo);

      if (album.is_playable !== shouldBePlayable) {
        await base44.asServiceRole.entities.ArtistAlbum.update(album.id, {
          is_playable: shouldBePlayable,
          playability_checked_at: now,
          playability_block_reason: shouldBePlayable ? null : reason,
        }).catch(() => {});
        if (!shouldBePlayable) stats.blocked++;
        else stats.unblocked++;
      } else {
        stats.skipped++;
      }
    }

    // Community posts — use author_email for owner lookup
    for (const post of communityPosts) {
      const ownerId = post.author_email; // Community posts use email as key
      stats.checked++;
      const isVideo = post.media_type === 'video' || post.media_type === 'video360';
      const state = userState[ownerId] || null;
      const shouldBePlayable = computePlayable(state, isVideo);
      const reason = computeReason(state, isVideo);

      if (post.is_playable !== shouldBePlayable) {
        await base44.asServiceRole.entities.CommunityPost.update(post.id, {
          is_playable: shouldBePlayable,
          playability_checked_at: now,
          playability_block_reason: shouldBePlayable ? null : reason,
        }).catch(() => {});
        if (!shouldBePlayable) stats.blocked++;
        else stats.unblocked++;
      } else {
        stats.skipped++;
      }
    }

    return Response.json({
      success: true,
      ...stats,
      entities_processed: ['OrganizerMediaPost', 'ArtistPost', 'ArtistAlbum', 'CommunityPost'],
      timestamp: now,
    });
  } catch (err) {
    return Response.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
});