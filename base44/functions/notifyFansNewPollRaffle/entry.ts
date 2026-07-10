import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { poll_id, raffle_id } = await req.json();

    let item, itemType, title, organizerId, organizerName, itemUrl;
    const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://reizor.com';

    if (poll_id) {
      const polls = await base44.asServiceRole.entities.EventPoll.filter({ id: poll_id }, null, 1).catch(() => []);
      item = polls[0];
      if (!item) return Response.json({ error: 'Poll not found' }, { status: 404 });
      // Guard: only notify if status is active
      if (item.status !== 'active') return Response.json({ skipped: true, reason: 'not_active' });
      // Guard: already notified — prevent duplicate sends
      if (item.notified_at) return Response.json({ skipped: true, reason: 'already_notified' });
      itemType = 'poll';
      title = item.question || 'New Poll';
      organizerId = item.organizer_id;
      organizerName = item.organizer_name || 'An organizer';
      itemUrl = `${appUrl}/poll/${item.id}`;
      // Mark as notified immediately to prevent race condition duplicates
      await base44.asServiceRole.entities.EventPoll.update(item.id, { notified_at: new Date().toISOString() }).catch(() => {});
    } else if (raffle_id) {
      const raffles = await base44.asServiceRole.entities.EventRaffle.filter({ id: raffle_id }, null, 1).catch(() => []);
      item = raffles[0];
      if (!item) return Response.json({ error: 'Raffle not found' }, { status: 404 });
      // Guard: only notify if status is active
      if (item.status !== 'active') return Response.json({ skipped: true, reason: 'not_active' });
      // Guard: already notified — prevent duplicate sends
      if (item.notified_at) return Response.json({ skipped: true, reason: 'already_notified' });
      itemType = 'raffle';
      title = item.name || 'New Raffle';
      organizerId = item.organizer_id;
      organizerName = item.organizer_name || 'An organizer';
      itemUrl = `${appUrl}/raffle/${item.id}`;
      // Mark as notified immediately to prevent race condition duplicates
      await base44.asServiceRole.entities.EventRaffle.update(item.id, { notified_at: new Date().toISOString() }).catch(() => {});
    } else {
      return Response.json({ error: 'poll_id or raffle_id required' }, { status: 400 });
    }

    if (!organizerId) return Response.json({ error: 'No organizer_id on item' }, { status: 400 });

    // Get followers of this organizer (OrganizerFollow entity)
    const follows = await base44.asServiceRole.entities.OrganizerFollow.filter(
      { organizer_id: organizerId }, null, 2000
    ).catch(() => []);

    const followerEmails = [...new Set(follows.map(f => f.follower_email).filter(Boolean))];
    if (followerEmails.length === 0) return Response.json({ success: true, notified: 0 });

    // Compose email
    const subject = itemType === 'raffle'
      ? `🎉 New Live Raffle from ${organizerName}`
      : `📊 New Live Poll from ${organizerName}`;

    const actionLabel = itemType === 'raffle' ? 'Enter Raffle' : 'Vote Now';
    const itemLabel = itemType === 'raffle' ? 'raffle' : 'poll';

    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0f1a; color: #f0f0f0; padding: 32px; border-radius: 12px;">
        <h1 style="color: #ff1b8d; font-size: 24px; margin-bottom: 8px;">
          ${itemType === 'raffle' ? '🎉' : '📊'} New Live ${itemType === 'raffle' ? 'Raffle' : 'Poll'}
        </h1>
        <p style="color: #aaa; margin-bottom: 24px;">from <strong style="color: #fff;">${organizerName}</strong></p>
        <div style="background: #1a1d2e; border: 1px solid #2a2d3e; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <p style="font-size: 18px; font-weight: bold; color: #fff; margin: 0 0 8px 0;">${title}</p>
          <p style="color: #aaa; margin: 0; font-size: 14px;">
            ${organizerName} has launched a new live ${itemLabel}. Tap below to view and participate before it ends.
          </p>
        </div>
        <a href="${itemUrl}" style="display: inline-block; padding: 14px 28px; background: #ff1b8d; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          ${actionLabel} →
        </a>
        <p style="color: #555; font-size: 12px; margin-top: 32px;">
          You received this because you follow ${organizerName} on Reizor.
        </p>
      </div>
    `;

    let emailsSent = 0;
    let notificationsSent = 0;

    // Look up follower user IDs for in-app notifications
    const followerUsers = await base44.asServiceRole.entities.User.filter(
      { role: 'user' }, null, 2000
    ).catch(() => []);
    const emailToUser = {};
    for (const u of followerUsers) {
      if (u.email) emailToUser[u.email] = u;
    }

    for (const email of followerEmails) {
      // Send email
      await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body })
        .then(() => emailsSent++)
        .catch(err => console.error(`Email failed for ${email}:`, err.message));

      // In-app notification
      const fanUser = emailToUser[email];
      if (fanUser) {
        await base44.asServiceRole.entities.Notification.create({
          user_email: email,
          title: subject,
          message: `${organizerName} launched a new live ${itemLabel}: "${title}". Tap to participate!`,
          type: 'general',
          link: itemUrl,
        }).then(() => notificationsSent++)
          .catch(() => {});
      }
    }

    return Response.json({ success: true, notified: emailsSent, inAppNotifications: notificationsSent });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});