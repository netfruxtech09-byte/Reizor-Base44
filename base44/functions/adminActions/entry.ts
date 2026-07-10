import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * adminActions — a service-role proxy for privileged admin operations.
 * All writes use asServiceRole so they bypass RLS regardless of when
 * the caller's JWT was issued (solves invited-admin permission mismatch).
 *
 * Payload: { action, ...params }
 *
 * Supported actions:
 *   deleteArtist      { artist_id }
 *   updateArtist      { artist_id, data }
 *   deleteUser        { user_id }
 *   updateUser        { user_id, data }
 *   deleteEvent       { event_id }
 *   updateEvent       { event_id, data }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'deleteArtist': {
        const { artist_id } = body;
        if (!artist_id) return Response.json({ error: 'artist_id required' }, { status: 400 });

        // Cascade delete: remove all related data before deleting the artist

        // 1. ArtistPosts (media gallery items / spotlight content)
        const posts = await base44.asServiceRole.entities.ArtistPost.filter({ artist_id }, null, 500).catch(() => []);
        for (const post of posts) {
          await base44.asServiceRole.entities.ArtistPost.delete(post.id).catch(() => {});
        }

        // 2. MediaItems referencing this artist (used in homepage Media/Spotlight sections)
        const mediaItems = await base44.asServiceRole.entities.MediaItem.filter({ artist_id }, null, 500).catch(() => []);
        for (const item of mediaItems) {
          await base44.asServiceRole.entities.MediaItem.delete(item.id).catch(() => {});
        }

        // 3. OrganizerMediaPosts linked to artist
        const mediaPosts = await base44.asServiceRole.entities.OrganizerMediaPost.filter({ organizer_id: artist_id }, null, 500).catch(() => []);
        for (const mp of mediaPosts) {
          await base44.asServiceRole.entities.OrganizerMediaPost.delete(mp.id).catch(() => {});
        }

        // 4. ArtistTourSchedule entries
        const tourEntries = await base44.asServiceRole.entities.ArtistTourSchedule.filter({ artist_id }, null, 500).catch(() => []);
        for (const entry of tourEntries) {
          await base44.asServiceRole.entities.ArtistTourSchedule.delete(entry.id).catch(() => {});
        }

        // 5. ArtistFollow records
        const follows = await base44.asServiceRole.entities.ArtistFollow.filter({ artist_id }, null, 500).catch(() => []);
        for (const follow of follows) {
          await base44.asServiceRole.entities.ArtistFollow.delete(follow.id).catch(() => {});
        }

        // Finally delete the artist
        await base44.asServiceRole.entities.Artist.delete(artist_id);
        return Response.json({ success: true });
      }

      case 'updateArtist': {
        const { artist_id, data } = body;
        if (!artist_id || !data) return Response.json({ error: 'artist_id and data required' }, { status: 400 });
        const updated = await base44.asServiceRole.entities.Artist.update(artist_id, data);
        return Response.json({ success: true, data: updated });
      }

      case 'deleteUser': {
        const { user_id } = body;
        if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 });
        // Block deletion of admin accounts — even at API level
        const targetUser = await base44.asServiceRole.entities.User.get(user_id).catch(() => null);
        if (targetUser && targetUser.role === 'admin') {
          return Response.json({ error: 'Admin accounts cannot be deleted' }, { status: 403 });
        }
        await base44.asServiceRole.entities.User.delete(user_id);
        return Response.json({ success: true });
      }

      case 'updateUser': {
        const { user_id, data } = body;
        if (!user_id || !data) return Response.json({ error: 'user_id and data required' }, { status: 400 });
        const updated = await base44.asServiceRole.entities.User.update(user_id, data);
        return Response.json({ success: true, data: updated });
      }

      case 'deleteEvent': {
        const { event_id } = body;
        if (!event_id) return Response.json({ error: 'event_id required' }, { status: 400 });
        await base44.asServiceRole.entities.Event.delete(event_id);
        return Response.json({ success: true });
      }

      case 'updateEvent': {
        const { event_id, data } = body;
        if (!event_id || !data) return Response.json({ error: 'event_id and data required' }, { status: 400 });
        const updated = await base44.asServiceRole.entities.Event.update(event_id, data);
        return Response.json({ success: true, data: updated });
      }

      case 'getOrganizerEmail': {
        const { organizer_id } = body;
        if (!organizer_id) return Response.json({ error: 'organizer_id required' }, { status: 400 });
        // Use service role to bypass User RLS — only admins can reach this action
        const users = await base44.asServiceRole.entities.User.list(null, 1000);
        const organizer = users.find(u => u.id === organizer_id);
        return Response.json({ email: organizer?.email || null, full_name: organizer?.full_name || null });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});