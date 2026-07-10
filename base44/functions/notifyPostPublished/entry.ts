import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { post_id, organizer_id, organizer_name, media_type, content_type } = body;

    if (!organizer_id) return Response.json({ error: 'organizer_id required' }, { status: 400 });

    // Fetch all followers of this organizer
    const followers = await base44.asServiceRole.entities.OrganizerFollow.filter(
      { organizer_id },
      null,
      500
    ).catch(() => []);

    if (followers.length === 0) return Response.json({ notified: 0 });

    const typeLabel = content_type === 'media'
      ? (media_type === 'video' ? 'a new video' : 'new media')
      : 'a new post';

    const deepLink = post_id
      ? `/organizers/${organizer_id}?section=posts&post=${post_id}`
      : `/organizers/${organizer_id}?section=posts`;

    // Create notifications for each follower (batch)
    const notifications = followers.map(f => ({
      user_email: f.follower_email,
      title: `${organizer_name} published ${typeLabel}`,
      message: `Tap to view the latest update from ${organizer_name}`,
      type: 'post_published',
      link: deepLink,
    }));

    await base44.asServiceRole.entities.Notification.bulkCreate(notifications);

    return Response.json({
      success: true,
      notified: followers.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});