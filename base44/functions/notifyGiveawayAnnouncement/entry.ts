import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { giveaway_id } = await req.json();
    if (!giveaway_id) return Response.json({ error: 'giveaway_id required' }, { status: 400 });

    // Fetch giveaway (service role to bypass RLS for reads)
    const giveaway = await base44.asServiceRole.entities.Giveaway.get(giveaway_id);
    if (!giveaway) return Response.json({ error: 'Giveaway not found' }, { status: 404 });

    // Only notify for active giveaways
    if (giveaway.status !== 'active') {
      return Response.json({ skipped: true, reason: 'not_active' });
    }

    // Idempotency: skip if already sent
    if (giveaway.announcement_sent_at) {
      return Response.json({ skipped: true, reason: 'already_sent', sent_at: giveaway.announcement_sent_at });
    }

    // Mark as sent immediately to prevent race conditions
    const sentAt = new Date().toISOString();
    await base44.asServiceRole.entities.Giveaway.update(giveaway_id, { announcement_sent_at: sentAt });

    // Fetch all fan users (role = "user") in batches
    const allUsers = await base44.asServiceRole.entities.User.list(null, 500).catch(() => []);
    const fans = allUsers.filter(u => u.role === 'user' && u.email);

    const endDateStr = giveaway.end_date
      ? new Date(giveaway.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'TBD';

    const ownerLabel = giveaway.owner_name ? ` by ${giveaway.owner_name}` : '';
    const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://reizor.com';
    const giveawayUrl = `${appUrl}/giveaways`;

    const notifTitle = `🎁 New Giveaway: ${giveaway.title}`;
    const notifMessage = `Enter for a chance to win: ${giveaway.prize_description || giveaway.title}${ownerLabel}. Ends: ${endDateStr}`;

    // Create in-app notifications in batches of 50
    const notifRecords = fans.map(fan => ({
      user_email: fan.email,
      title: notifTitle,
      message: notifMessage,
      type: 'general',
      link: giveawayUrl,
    }));

    // Bulk create notifications (process in chunks to avoid timeout)
    const CHUNK = 50;
    for (let i = 0; i < notifRecords.length; i += CHUNK) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifRecords.slice(i, i + CHUNK)).catch(() => {});
    }

    // Send emails to fans (use Core.SendEmail via integrations)
    const emailSubject = `🎁 New Giveaway on Reizor: ${giveaway.title}`;
    const eligibilityNote = (giveaway.eligibility_rules || []).includes('open_to_all')
      ? 'Open to all fans!'
      : (giveaway.eligibility_rules || []).includes('ticket_holders')
        ? 'Ticket holders only.'
        : 'Check eligibility requirements.';

    const emailBody = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0d1117; color: #f0f0f0; padding: 32px; border-radius: 12px;">
  <h2 style="color: #ff1b8d; margin-bottom: 8px;">🎁 New Giveaway Available!</h2>
  <h3 style="font-size: 20px; margin-bottom: 4px;">${giveaway.title}</h3>
  ${giveaway.description ? `<p style="color: #aaa; margin-bottom: 16px;">${giveaway.description}</p>` : ''}
  <div style="background: #1a1f2e; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
    <p style="margin: 0 0 8px 0;"><strong>🏆 Prize:</strong> ${giveaway.prize_description || 'See details'}</p>
    <p style="margin: 0 0 8px 0;"><strong>🗓️ Ends:</strong> ${endDateStr}</p>
    <p style="margin: 0 0 8px 0;"><strong>🎯 Winners:</strong> ${giveaway.num_winners || 1}</p>
    <p style="margin: 0;"><strong>📋 Eligibility:</strong> ${eligibilityNote}</p>
  </div>
  ${ownerLabel ? `<p style="color: #aaa; font-size: 13px; margin-bottom: 16px;">Giveaway${ownerLabel}</p>` : ''}
  <a href="${giveawayUrl}" style="display: inline-block; background: #ff1b8d; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">Enter Giveaway →</a>
  <p style="color: #666; font-size: 12px; margin-top: 24px;">You're receiving this because you're a Reizor fan. Visit Reizor to manage your notifications.</p>
</div>`;

    // Send emails in small batches to avoid rate limits — fire-and-forget
    const EMAIL_CHUNK = 10;
    for (let i = 0; i < fans.length; i += EMAIL_CHUNK) {
      const batch = fans.slice(i, i + EMAIL_CHUNK);
      await Promise.all(batch.map(fan =>
        base44.asServiceRole.integrations.Core.SendEmail({
          to: fan.email,
          subject: emailSubject,
          body: emailBody,
          from_name: 'Reizor',
        }).catch(() => {})
      ));
    }

    return Response.json({
      success: true,
      notified: fans.length,
      sent_at: sentAt,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});