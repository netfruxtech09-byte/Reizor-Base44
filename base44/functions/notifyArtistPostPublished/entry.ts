import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { post_id, artist_id, artist_name, media_type, content_type } = body;

    if (!artist_id) return Response.json({ error: 'artist_id required' }, { status: 400 });

    // Fetch all followers of this artist
    const followers = await base44.asServiceRole.entities.ArtistFollow.filter(
      { artist_id },
      null,
      500
    ).catch(() => []);

    if (followers.length === 0) return Response.json({ notified: 0 });

    const typeLabel = content_type === 'media'
      ? (media_type === 'video' ? 'a new video' : 'new media')
      : 'a new post';

    const deepLink = post_id
      ? `/artists/${artist_id}?section=posts&post=${post_id}`
      : `/artists/${artist_id}`;

    const notifications = followers.map(f => ({
      user_email: f.follower_email,
      title: `${artist_name} published ${typeLabel}`,
      message: `Tap to see the latest from ${artist_name}`,
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