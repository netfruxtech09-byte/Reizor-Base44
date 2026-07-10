import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function isNeedsReview(businessName, contactName) {
  const b = (businessName || '').trim();
  if (!b) return true;
  if (b.length < 3) return true;
  if (/^\d+$/.test(b)) return true;
  if (contactName && b.toLowerCase() === contactName.trim().toLowerCase()) return true;
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only upgrade if user is a plain "user" role — don't downgrade admins/organizers
    if (user.role !== 'user' && user.role) {
      return Response.json({ success: true, role: user.role });
    }

    const body = await req.json().catch(() => ({}));
    const businessName = (body.business_name || '').trim();
    const contactName = (body.contact_name || user.full_name || '').trim();

    await base44.asServiceRole.entities.User.update(user.id, { role: 'organizer' });

    // Create/complete OrganizerProfile — public business_name is NEVER auto-filled from the contact name.
    const existingProfile = await base44.asServiceRole.entities.OrganizerProfile.filter(
      { organizer_id: user.id }, null, 1
    ).catch(() => []);

    const needsReview = isNeedsReview(businessName, contactName);
    const profileData = {
      organizer_id: user.id,
      organizer_email: user.email,
      full_name: contactName,
      business_name: businessName,
      needs_name_review: needsReview,
      phone: body.phone || undefined,
      city: body.city || undefined,
      state: body.state || undefined,
      country: body.country || undefined,
      website: body.website || undefined,
    };
    // Strip undefined keys
    Object.keys(profileData).forEach((k) => profileData[k] === undefined && delete profileData[k]);

    let profile;
    if (existingProfile[0]) {
      await base44.asServiceRole.entities.OrganizerProfile.update(existingProfile[0].id, profileData).catch(() => {});
      profile = existingProfile[0];
    } else {
      profile = await base44.asServiceRole.entities.OrganizerProfile.create(profileData).catch(() => null);
    }

    const publicName = businessName || 'Pending Organizer Name';

    // Notify all admins
    const allUsers = await base44.asServiceRole.entities.User.list(null, 500).catch(() => []);
    const admins = allUsers.filter(u => u.role === 'admin');
    const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://reizor.com';
    const now = new Date().toISOString();

    const organizerType = body.organizer_type || '';
    const bio = body.bio || '';
    const instagram = body.instagram || '';
    const preferredContactMethod = body.preferred_contact_method || '';
    const venueAddress = body.venue_address || '';
    const serviceArea = body.service_area || '';

    const eventCount = await base44.asServiceRole.entities.Event.filter({ organizer_id: user.id }, null, 500)
      .then(list => list.length).catch(() => 0);

    // Profile completion — based on fields relevant to a review-ready organizer profile
    const completionFields = [businessName, contactName, user.email, body.phone, body.city, body.state, body.country, body.website];
    const completionPct = Math.round((completionFields.filter(f => (f || '').toString().trim()).length / completionFields.length) * 100);

    const missingRequired = [];
    if (!businessName) missingRequired.push('Public Organizer Name');
    if (!body.phone) missingRequired.push('Phone number');
    if (!body.city || !body.country) missingRequired.push('Location');

    // Build a "label: value" row, omitted entirely when value is empty
    const row = (label, value) => value
      ? `<tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap;width:42%;">${label}</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.04);">${value}</td></tr>`
      : '';

    const sectionTitle = (text) => `<h3 style="margin:24px 0 8px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#ff1b8d;">${text}</h3>`;

    const publicProfileUrl = businessName ? `${appUrl}/organizers/${user.id}` : '';

    const publicDetailsRows = [
      row('Public Organizer Name', publicName),
      row('Organizer Type', organizerType),
      row('Bio / Description', bio),
      row('Website', body.website),
      row('Instagram / Social', instagram),
      row('Public Profile URL', publicProfileUrl ? `<a href="${publicProfileUrl}" style="color:#ff1b8d;">${publicProfileUrl}</a>` : ''),
    ].filter(Boolean).join('');

    const contactDetailsRows = [
      row('Primary Contact Name', contactName),
      row('Contact Email', user.email),
      row('Phone', body.phone),
      row('Preferred Contact Method', preferredContactMethod),
    ].filter(Boolean).join('');

    const locationRows = [
      row('Country', body.country),
      row('State / Region', body.state),
      row('City', body.city),
      row('Venue Address', venueAddress),
      row('Event / Service Area', serviceArea),
    ].filter(Boolean).join('');

    const reviewRows = [
      row('Signup Date & Time', new Date(now).toLocaleString()),
      row('Account Status', 'Active'),
      row('Profile Completion', `${completionPct}%`),
      row('Events Created', String(eventCount)),
      row('Missing Required Info', missingRequired.length ? missingRequired.join(', ') : ''),
      row('Public Name Needs Review', needsReview ? 'Yes' : 'No'),
    ].filter(Boolean).join('');

    const warningHtml = needsReview
      ? `<div style="margin:20px 0;padding:14px 16px;background:rgba(255,176,32,0.08);border:1px solid rgba(255,176,32,0.3);border-radius:8px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#ffb020;">⚠️ Public Organizer Name Needs Review</p>
          <p style="margin:0;font-size:12px;color:#d0d4e8;line-height:1.6;">The public Organizer Name appears on the Organizer profile, event pages, search, Feed, and Fan-facing areas. Please review and correct it if needed.</p>
        </div>`
      : '';

    const editLink = `${appUrl}/admin/organizers?edit=${user.id}`;

    const actionButtons = `
      <div style="text-align:center;margin:28px 0 8px;">
        ${publicProfileUrl ? `<a href="${publicProfileUrl}" style="display:inline-block;margin:4px;background:#1a2040;color:#eef0fa;font-size:13px;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:8px;">View Organizer Profile</a>` : ''}
        <a href="${editLink}" style="display:inline-block;margin:4px;background:linear-gradient(135deg,#ff1b8d,#d4006e);color:#fff;font-size:13px;font-weight:800;text-decoration:none;padding:11px 20px;border-radius:8px;">View Organizer Details</a>
        <a href="${editLink}" style="display:inline-block;margin:4px;background:#1a2040;color:#eef0fa;font-size:13px;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:8px;">Edit Organizer Details</a>
      </div>`;

    await Promise.all(admins.map(async (admin) => {
      // Duplicate check
      const existing = await base44.asServiceRole.entities.Notification.filter(
        { user_email: admin.email, title: `🏢 New Organizer: ${publicName}` },
        null, 1
      ).catch(() => []);
      if (existing.length > 0) return;

      await base44.asServiceRole.entities.Notification.create({
        user_email: admin.email,
        title: `🏢 New Organizer: ${publicName}`,
        message: `${publicName} (contact: ${contactName || user.email}, ${user.email}) just became an organizer. Their account is active — view in Admin → Organizers.`,
        type: 'general',
        link: '/admin/organizers',
        is_read: false,
      }).catch(() => {});

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: `New Organizer Signup: ${publicName}`,
        body: `
          <div style="font-family:Arial,sans-serif;background:#07091a;padding:32px 16px;color:#c8d0e8;">
            <div style="max-width:560px;margin:0 auto;background:#0d1024;border-radius:14px;border:1px solid #1e2545;padding:28px 28px 20px;">
              <span style="font-size:18px;font-weight:900;color:#fff;">REIZOR</span>
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff1b8d;margin-left:3px;vertical-align:middle;"></span>
              <h2 style="color:#fff;margin:16px 0 4px;font-size:20px;">New Organizer Signup</h2>
              <p style="margin:0;font-size:13px;color:#8893b0;">A user just upgraded to organizer on Reizor. Their account is active immediately — review the details below.</p>

              ${warningHtml}

              ${sectionTitle('Public Organizer Details')}
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#131929;border:1px solid #232b4a;border-radius:10px;">${publicDetailsRows}</table>

              ${sectionTitle('Primary Contact Details')}
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#131929;border:1px solid #232b4a;border-radius:10px;">${contactDetailsRows}</table>

              ${locationRows ? `${sectionTitle('Location Details')}<table width="100%" cellpadding="0" cellspacing="0" style="background:#131929;border:1px solid #232b4a;border-radius:10px;">${locationRows}</table>` : ''}

              ${sectionTitle('Account Details')}
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#131929;border:1px solid #232b4a;border-radius:10px;">${reviewRows}</table>

              <p style="font-size:11px;color:#5a647a;line-height:1.6;margin:16px 0 0;">The Public Organizer Name is shown to Fans. The Primary Contact Name is for internal communication only and is never shown publicly.</p>

              ${actionButtons}
            </div>
          </div>
        `,
      }).catch(() => {});
    }));

    return Response.json({ success: true, role: 'organizer', profile_id: profile?.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});