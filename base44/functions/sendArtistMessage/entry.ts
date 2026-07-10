import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { artist_id, body } = await req.json();
    const text = (body || '').trim();
    if (!artist_id) return Response.json({ error: 'artist_id is required' }, { status: 400 });
    if (!text) return Response.json({ error: 'Message body is required' }, { status: 400 });
    if (text.length > 5000) return Response.json({ error: 'Message too long (max 5000 chars)' }, { status: 400 });

    // Load the artist
    const artists = await base44.asServiceRole.entities.Artist.filter({ id: artist_id }, null, 1);
    const artist = artists[0];
    if (!artist) return Response.json({ error: 'Artist not found' }, { status: 404 });
    if (artist.user_email === user.email) return Response.json({ error: 'You cannot message yourself' }, { status: 400 });

    // Deterministic thread id prevents duplicate conversations between the same user and artist
    const threadId = `${artist_id}_${user.email}`;

    // Prevent a brand-new message if a thread already exists — still allow sending (it appends to the same thread)
    const msg = await base44.asServiceRole.entities.Message.create({
      thread_id: threadId,
      artist_id: artist.id,
      artist_name: artist.display_name,
      artist_email: artist.user_email,
      fan_email: user.email,
      fan_name: user.full_name || user.email,
      sender_email: user.email,
      sender_name: user.full_name || user.email,
      body: text,
      read: false,
    });

    const snippet = text.length > 80 ? text.slice(0, 80) + '…' : text;
    const appUrl = Deno.env.get('BASE44_APP_URL') || '';
    const link = `/messages?thread=${encodeURIComponent(threadId)}`;

    // In-app notification for the artist
    await base44.asServiceRole.entities.Notification.create({
      user_email: artist.user_email,
      title: `New message from ${user.full_name || user.email}`,
      message: snippet,
      type: 'message',
      link,
    }).catch(() => {});

    // Email notification for the artist
    if (artist.user_email) {
      await base44.integrations.Core.SendEmail({
        to: artist.user_email,
        subject: `New message from ${user.full_name || user.email}`,
        body: `You received a new message from ${user.full_name || user.email}:\n\n${text}\n\nReply here: ${appUrl}${link}`,
      }).catch(() => {});
    }

    return Response.json({ success: true, message: msg, thread_id: threadId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});