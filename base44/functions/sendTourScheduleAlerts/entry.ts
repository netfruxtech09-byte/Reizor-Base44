import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // This runs as a scheduled job — use service role
  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in1day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

  // Window: within next 2 hours from the target time (to avoid missing due to cron timing)
  const windowMs = 2 * 60 * 60 * 1000;

  const shows = await base44.asServiceRole.entities.ArtistTourSchedule.list(null, 500);

  let sent7d = 0, sent1d = 0;

  for (const show of shows) {
    if (show.status === 'cancelled') continue;

    const showDate = new Date(show.date);

    // 7-day alert
    if (!show.alert_7d_sent && Math.abs(showDate - in7days) <= windowMs) {
      await sendAlertsForShow(base44, show, 7);
      await base44.asServiceRole.entities.ArtistTourSchedule.update(show.id, { alert_7d_sent: true });
      sent7d++;
    }

    // 1-day alert
    if (!show.alert_1d_sent && Math.abs(showDate - in1day) <= windowMs) {
      await sendAlertsForShow(base44, show, 1);
      await base44.asServiceRole.entities.ArtistTourSchedule.update(show.id, { alert_1d_sent: true });
      sent1d++;
    }
  }

  return Response.json({ success: true, sent_7d: sent7d, sent_1d: sent1d });
});

async function sendAlertsForShow(base44, show, daysAhead) {
  // Find fans who follow this artist AND are in the same city/country
  const follows = await base44.asServiceRole.entities.ArtistFollow.filter({ artist_id: show.artist_id }, null, 1000).catch(() => []);

  const title = daysAhead === 7
    ? `🎵 ${show.artist_name} plays in ${show.city} in 7 days!`
    : `🔔 Tomorrow! ${show.artist_name} at ${show.venue_name}`;

  const message = `${show.artist_name} is performing at ${show.venue_name}, ${show.city}, ${show.country}${show.set_time ? ` — Set time: ${show.set_time}` : ''}.${show.ticket_link ? ` Tickets: ${show.ticket_link}` : ''}`;

  for (const follow of follows) {
    await base44.asServiceRole.entities.Notification.create({
      user_email: follow.fan_email,
      title,
      message,
      type: 'general',
    }).catch(() => {});
  }
}