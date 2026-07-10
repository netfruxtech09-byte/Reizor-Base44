import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Scheduled content moderation scan (runs every 60 seconds)
 * Scans all pending content across Media Library, Artist Posts, Artist Albums, Organizer Posts, Community Feed
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    // Admin-only check (service role is allowed for scheduled tasks)
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Prevent overlapping scans using a lock in AppSettings
    const locks = await base44.asServiceRole.entities.AppSettings.filter(
      { setting_key: 'moderation_scan_lock' },
      null,
      1
    ).catch(() => []);

    const lock = locks[0];
    const now = new Date().toISOString();
    const LOCK_TIMEOUT_MS = 55000; // 55 seconds (less than 60-second interval)

    // Check if scan is already running
    if (lock) {
      const lockTime = new Date(lock.setting_value);
      const elapsed = Date.now() - lockTime.getTime();
      if (elapsed < LOCK_TIMEOUT_MS) {
        return Response.json({
          status: 'skipped',
          reason: 'Scan already in progress',
          elapsed_ms: elapsed,
        });
      }
      // Lock expired, proceed
    }

    // Acquire lock
    if (lock) {
      await base44.asServiceRole.entities.AppSettings.update(lock.id, { setting_value: now });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({
        setting_key: 'moderation_scan_lock',
        setting_value: now,
      });
    }

    // Collect pending items across all content types
    const pendingItems = [];

    // 1. Media Library (OrganizerMediaPost with media_moderation_status)
    const mediaLibrary = await base44.asServiceRole.entities.OrganizerMediaPost.filter(
      {
        $or: [
          { media_moderation_status: null },
          { media_moderation_status: 'pending_review' },
          { media_moderation_status: 'scanning' },
        ],
      },
      '-created_date',
      500
    ).catch(() => []);

    mediaLibrary.forEach(item => {
      pendingItems.push({
        type: 'media_library',
        id: item.id,
        data: item,
        entity_name: 'OrganizerMediaPost',
      });
    });

    // 2. Artist Posts (ArtistPost with post_moderation_status)
    const artistPosts = await base44.asServiceRole.entities.ArtistPost.filter(
      {
        $or: [
          { post_moderation_status: null },
          { post_moderation_status: 'pending_review' },
          { post_moderation_status: 'scanning' },
        ],
      },
      '-created_date',
      500
    ).catch(() => []);

    artistPosts.forEach(item => {
      pendingItems.push({
        type: 'artist_posts',
        id: item.id,
        data: item,
        entity_name: 'ArtistPost',
      });
    });

    // 3. Artist Albums (ArtistAlbum with moderation_status)
    const artistAlbums = await base44.asServiceRole.entities.ArtistAlbum.filter(
      {
        $or: [
          { moderation_status: null },
          { moderation_status: 'pending_review' },
          { moderation_status: 'scanning' },
        ],
      },
      '-created_date',
      500
    ).catch(() => []);

    artistAlbums.forEach(item => {
      pendingItems.push({
        type: 'artist_albums',
        id: item.id,
        data: item,
        entity_name: 'ArtistAlbum',
      });
    });

    // 4. Organizer Posts (OrganizerMediaPost with post_moderation_status)
    // Exclude ones already captured as media_library
    const organizerPosts = await base44.asServiceRole.entities.OrganizerMediaPost.filter(
      {
        $or: [
          { post_moderation_status: null },
          { post_moderation_status: 'pending_review' },
          { post_moderation_status: 'scanning' },
        ],
      },
      '-created_date',
      500
    ).catch(() => []);

    organizerPosts.forEach(item => {
      // Skip if already captured as media_library
      if (!pendingItems.find(p => p.id === item.id)) {
        pendingItems.push({
          type: 'organizer_posts',
          id: item.id,
          data: item,
          entity_name: 'OrganizerMediaPost',
        });
      }
    });

    // 5. Community Feed (CommunityPost with moderation_status)
    const communityPosts = await base44.asServiceRole.entities.CommunityPost.filter(
      {
        $or: [
          { moderation_status: null },
          { moderation_status: 'pending_review' },
          { moderation_status: 'scanning' },
        ],
      },
      '-created_date',
      500
    ).catch(() => []);

    communityPosts.forEach(item => {
      pendingItems.push({
        type: 'community_feed',
        id: item.id,
        data: item,
        entity_name: 'CommunityPost',
      });
    });

    console.log(`[ModerationScan] Found ${pendingItems.length} pending items to process`);

    // Process items in batches of 5 to avoid overload
    const BATCH_SIZE = 5;
    const stats = {
      processed: 0,
      approved: 0,
      rejected: 0,
      blocked: 0,
      pending_manual: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
      const batch = pendingItems.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(item => processModeration(base44, item))
      );

      results.forEach((result, idx) => {
        const item = batch[idx];
        if (result.status === 'fulfilled') {
          const outcome = result.value;
          stats.processed++;
          stats[outcome.status]++;
          if (outcome.error) {
            stats.errors.push(`${item.id}: ${outcome.error}`);
            stats.failed++;
          }
        } else {
          stats.processed++;
          stats.failed++;
          stats.errors.push(`${item.id}: ${result.reason?.message || 'Unknown error'}`);
        }
      });
    }

    // Log scan results to AppSettings for admin visibility
    const scanLog = {
      timestamp: now,
      ...stats,
    };

    const logs = await base44.asServiceRole.entities.AppSettings.filter(
      { setting_key: 'moderation_scan_log' },
      null,
      1
    ).catch(() => []);

    if (logs[0]) {
      await base44.asServiceRole.entities.AppSettings.update(logs[0].id, {
        setting_value: JSON.stringify(scanLog),
      });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({
        setting_key: 'moderation_scan_log',
        setting_value: JSON.stringify(scanLog),
      });
    }

    // Release lock
    if (lock) {
      await base44.asServiceRole.entities.AppSettings.update(lock.id, {
        setting_value: new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString(),
      });
    }

    console.log(`[ModerationScan] Completed:`, stats);

    return Response.json({
      status: 'completed',
      ...stats,
    });
  } catch (error) {
    console.error('[ModerationScan] Error:', error);
    return Response.json({
      status: 'completed',
      error: error.message,
      processed: 0,
      approved: 0,
      rejected: 0,
      blocked: 0,
      failed: 0,
    });
  }
});

/**
 * Process a single moderation item
 */
async function processModeration(base44, item) {
  try {
    const { type, id, data, entity_name } = item;

    // Mark as scanning
    const statusField = getStatusField(type);
    const updateData = {};
    updateData[statusField] = 'scanning';
    updateData.moderation_scan_timestamp = new Date().toISOString();
    updateData.moderation_scan_source = 'automatic';

    await base44.asServiceRole.entities[entity_name].update(id, updateData);

    // Call AI moderation
    const moderationResult = await base44.asServiceRole.functions.invoke('aiModerateMedia', {
      item_id: id,
      item_type: type,
      content: getContentForModeration(data, type),
    });

    const { verdict, reason, notes } = moderationResult?.data || {};

    if (!verdict) {
      throw new Error('No moderation verdict returned');
    }

    // Update with result
    const finalStatusField = getStatusField(type);
    const finalData = {};
    finalData[finalStatusField] = verdict; // approved, rejected, blocked, or pending_review
    finalData.moderation_notes = notes || reason || '';
    finalData.moderation_scan_timestamp = new Date().toISOString();
    finalData.moderation_scan_source = 'automatic';

    await base44.asServiceRole.entities[entity_name].update(id, finalData);

    console.log(`[ModerationScan] ${type}/${id}: ${verdict}`);

    return {
      status: verdict,
      error: null,
    };
  } catch (error) {
    console.error(`[ModerationScan] Processing failed for ${item.id}:`, error);
    return {
      status: 'failed',
      error: error.message,
    };
  }
}

/**
 * Get the moderation status field name for each content type
 */
function getStatusField(type) {
  switch (type) {
    case 'media_library':
      return 'media_moderation_status';
    case 'artist_posts':
      return 'post_moderation_status';
    case 'artist_albums':
      return 'moderation_status';
    case 'organizer_posts':
      return 'post_moderation_status';
    case 'community_feed':
      return 'moderation_status';
    default:
      return 'moderation_status';
  }
}

/**
 * Extract content for moderation based on type
 */
function getContentForModeration(data, type) {
  switch (type) {
    case 'media_library':
    case 'organizer_posts':
      return {
        title: data.title || '',
        description: data.description || '',
        file_url: data.file_url || '',
        file_type: data.file_type || '',
      };
    case 'artist_posts':
      return {
        content: data.content || '',
        title: data.title || '',
      };
    case 'artist_albums':
      return {
        title: data.title || '',
        description: data.description || '',
      };
    case 'community_feed':
      return {
        content: data.content || '',
        title: data.title || '',
      };
    default:
      return data;
  }
}