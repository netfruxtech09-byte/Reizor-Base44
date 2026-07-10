import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * triggerAiModeration — Entity automation handler
 * Called when a new media entity is created.
 * Invokes aiModerateMedia with the correct entity_type.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data } = body;
    if (!event || event.type !== 'create') {
      return Response.json({ skipped: true, reason: 'not_a_create_event' });
    }

    // Map entity name to moderateMedia entity_type
    const entityTypeMap = {
      MediaItem: 'MediaItem',
      ArtistPost: 'ArtistPost',
      ArtistAlbum: 'ArtistAlbum',
      OrganizerMediaPost: 'OrganizerMediaPost',
      CommunityPost: 'CommunityPost',
    };

    const entityType = entityTypeMap[event.entity_name];
    if (!entityType) {
      return Response.json({ skipped: true, reason: 'unknown_entity' });
    }

    // Skip if already approved (e.g. admin uploads set to approved by auto_approve_admin)
    const currentStatus = data?.approval_status || data?.media_approval_status;
    if (currentStatus === 'approved') {
      return Response.json({ skipped: true, reason: 'already_approved' });
    }

    // Skip if video is still encoding — moderation must wait until encoding completes.
    // pollMuxStatuses will trigger moderation after processing_status becomes "complete".
    if (data?.processing_status === 'processing') {
      return Response.json({ skipped: true, reason: 'video_still_encoding' });
    }

    // Call AI moderation
    const result = await base44.asServiceRole.functions.invoke('aiModerateMedia', {
      entity_type: entityType,
      entity_id: event.entity_id,
    });

    console.log(`AI moderation triggered for ${entityType}:${event.entity_id}`, result);
    return Response.json({ success: true, result });

  } catch (error) {
    console.error('triggerAiModeration error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});