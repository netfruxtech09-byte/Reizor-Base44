import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { campaign_id } = body;

    if (!campaign_id) {
      return Response.json({ error: 'campaign_id required' }, { status: 400 });
    }

    const campaign = await base44.entities.EmailCampaign.filter({ id: campaign_id }, null, 1).catch(() => null);
    if (!campaign || campaign.length === 0) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const c = campaign[0];
    if (!c.is_active) {
      return Response.json({ error: 'Campaign is inactive' }, { status: 400 });
    }

    // Get recipients based on campaign type
    let recipients = [];
    if (c.campaign_type === 'cart_abandonment') {
      // Find users with abandoned carts
      const cartData = await base44.entities.Order.filter(
        { status: 'pending', event_id: c.event_id },
        '-created_date',
        500
      ).catch(() => []);
      recipients = cartData.map(o => ({
        email: o.customer_email,
        name: o.customer_name || 'there',
        reason: 'cart_abandoned'
      }));
    } else if (c.campaign_type === 'post_event_thank_you') {
      // Find ticket holders
      const tickets = await base44.entities.Ticket.filter(
        { event_id: c.event_id, status: 'active' },
        null,
        500
      ).catch(() => []);
      const uniqueEmails = new Map();
      tickets.forEach(t => {
        if (t.owner_email && !uniqueEmails.has(t.owner_email)) {
          uniqueEmails.set(t.owner_email, { email: t.owner_email, name: t.owner_name || 'there' });
        }
      });
      recipients = Array.from(uniqueEmails.values());
    } else if (c.campaign_type === 'upcoming_event_reminder') {
      // Find ticket holders for upcoming event
      const tickets = await base44.entities.Ticket.filter(
        { event_id: c.event_id, status: 'active' },
        null,
        500
      ).catch(() => []);
      const uniqueEmails = new Map();
      tickets.forEach(t => {
        if (t.owner_email && !uniqueEmails.has(t.owner_email)) {
          uniqueEmails.set(t.owner_email, { email: t.owner_email, name: t.owner_name || 'there' });
        }
      });
      recipients = Array.from(uniqueEmails.values());
    } else if (c.campaign_type === 're_engagement') {
      // Find previous attendees
      const pastOrders = await base44.entities.Order.filter(
        { organizer_id: c.organizer_id, status: 'completed' },
        '-created_date',
        500
      ).catch(() => []);
      const uniqueEmails = new Map();
      pastOrders.forEach(o => {
        if (o.customer_email && !uniqueEmails.has(o.customer_email)) {
          uniqueEmails.set(o.customer_email, { email: o.customer_email, name: o.customer_name || 'there' });
        }
      });
      recipients = Array.from(uniqueEmails.values());
    } else if (c.campaign_type === 'new_event_announcement') {
      // Fetch all platform users
      const allUsers = await base44.asServiceRole.entities.User.list(null, 2000).catch(() => []);

      // Apply location filters if set
      const countryFilter = (c.target_country || '').trim().toLowerCase();
      const stateFilter = (c.target_state || '').trim().toLowerCase();
      const cityFilter = (c.target_city || '').trim().toLowerCase();

      const hasLocationFilter = countryFilter || stateFilter || cityFilter;

      let filteredUsers = allUsers;
      if (hasLocationFilter) {
        // Fetch all organizer profiles for location data
        const profiles = await base44.asServiceRole.entities.OrganizerProfile.list(null, 2000).catch(() => []);
        const profileMap = new Map(profiles.map(p => [p.organizer_email, p]));

        filteredUsers = allUsers.filter(u => {
          const profile = profileMap.get(u.email);
          // Also check user-level city/country fields stored on the user object
          const userCity = (profile?.city || u.city || '').toLowerCase();
          const userState = (profile?.state || u.state || '').toLowerCase();
          const userCountry = (profile?.country || u.country || '').toLowerCase();

          if (countryFilter && !userCountry.includes(countryFilter)) return false;
          if (stateFilter && !userState.includes(stateFilter)) return false;
          if (cityFilter && !userCity.includes(cityFilter)) return false;
          return true;
        });
      }

      recipients = filteredUsers
        .filter(u => u.email)
        .map(u => ({ email: u.email, name: u.full_name || 'there' }));
    }

    // Send emails and track
    let sentCount = 0;
    const recipientRecords = [];
    for (const recipient of recipients) {
      try {
        // Build a proper HTML email body with the branded template
        const flyerHtml = c.flyer_url
          ? `<div style="text-align:center;margin-bottom:20px"><img src="${c.flyer_url}" style="max-width:100%;border-radius:8px" alt="Event Flyer" /></div>`
          : '';
        
        // Convert plain-text body to HTML (preserve line breaks, escape HTML)
        const bodyHtml = (c.email_body || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');

        const fullBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#07091a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07091a;min-height:100vh;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1024;border-radius:14px;border:1px solid #1e2545;overflow:hidden;">
        <tr><td style="padding:24px 32px 18px;border-bottom:1px solid #1a2040;">
          <span style="font-size:20px;font-weight:900;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;">REIZOR</span>
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff1b8d;margin-left:3px;vertical-align:middle;"></span>
        </td></tr>
        <tr><td style="padding:28px 32px 24px;">
          ${flyerHtml}
          <p style="margin:0;font-size:14px;color:#b0b8d4;line-height:1.7;">${bodyHtml}</p>
        </td></tr>
        <tr><td style="padding:14px 32px;border-top:1px solid #131929;background:#09102a;">
          <p style="margin:0;font-size:11px;color:#4a5470;text-align:center;">You received this because you have an account on Reizor.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

        await base44.functions.invoke('emailService', {
          _source: 'triggerEmailCampaign',
          to: recipient.email,
          subject: c.subject_line,
          body: fullBody,
          vars: {
            event_name: c.event_title || 'your event',
            attendee_name: recipient.name || 'there',
            organizer_name: c.organizer_email || 'Organizer',
            city: c.target_city || '',
          },
        });

        // Log recipient
        recipientRecords.push({
          campaign_id: c.id,
          campaign_type: c.campaign_type,
          organizer_id: c.organizer_id,
          event_id: c.event_id,
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          status: 'sent',
          sent_at: new Date().toISOString()
        });

        sentCount++;
      } catch (e) {
        recipientRecords.push({
          campaign_id: c.id,
          campaign_type: c.campaign_type,
          organizer_id: c.organizer_id,
          event_id: c.event_id,
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          status: 'bounced',
          sent_at: new Date().toISOString()
        });
      }
    }

    // Bulk create recipient records
    if (recipientRecords.length > 0) {
      await base44.entities.EmailRecipient.bulkCreate(recipientRecords);
    }

    // Update campaign
    await base44.entities.EmailCampaign.update(c.id, {
      recipient_count: sentCount,
      sent_at: new Date().toISOString(),
      last_triggered: new Date().toISOString()
    });

    return Response.json({
      success: true,
      campaign_id: c.id,
      emails_sent: sentCount,
      recipients: recipientRecords.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});