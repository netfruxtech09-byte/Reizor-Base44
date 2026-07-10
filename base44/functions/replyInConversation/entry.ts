import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { thread_id, body } = await req.json();
    const text = (body || '').trim();
    if (!thread_id) return Response.json({ error: 'thread_id is required' }, { status: 400 });
    if (!text) return Response.json({ error: 'Reply body is required' }, { status: 400 });
    if (text.length > 5000) return Response.json({ error: 'Message too long (max 5000 chars)' }, { status: 400 });

    // Load the thread to verify participation and reuse participant metadata
    const existing = await base44.asServiceRole.entities.Message.filter({ thread_id }, null, 500);
    if (existing.length === 0) return Response.json({ error: 'Conversation not found' }, { status: 404 });

    const sample = existing[0];
    const artistEmail = sample.artist_email;
    const fanEmail = sample.fan_email;

    const isArtist = user.email === artistEmail;
    const isFan = user.email === fanEmail;
    if (!isArtist && !isFan) {
      return Response.json({ error: 'Forbidden: you are not a participant in this conversation' }, { status: 403 });
    }

    const msg = await base44.asServiceRole.entities.Message.create({
      thread_id,
      artist_id: sample.artist_id,
      artist_name: sample.artist_name,
      artist_email: artistEmail,
      fan_email: fanEmail,
      fan_name: sample.fan_name,
      sender_email: user.email,
      sender_name: user.full_name || user.email,
      body: text,
      read: false,
    });

    // Notify the other participant
    const recipientEmail = isArtist ? fanEmail : artistEmail;
    const snippet = text.length > 80 ? text.slice(0, 80) + '…' : text;
    const appUrl = Deno.env.get('BASE44_APP_URL') || '';
    const link = `/messages?thread=${encodeURIComponent(thread_id)}`;
    const senderLabel = user.full_name || user.email;

    if (recipientEmail) {
      await base44.asServiceRole.entities.Notification.create({
        user_email: recipientEmail,
        title: `New message from ${senderLabel}`,
        message: snippet,
        type: 'message',
        link,
      }).catch(() => {});

      await base44.integrations.Core.SendEmail({
        to: recipientEmail,
        subject: `New message from ${senderLabel}`,
        body: `You received a new message from ${senderLabel}:\n\n${text}\n\nReply here: ${appUrl}${link}`,
      }).catch(() => {});
    }

    return Response.json({ success: true, message: msg, thread_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});