import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { artist_id, action, rejection_reason } = await req.json();

    if (!artist_id || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Get artist record
    const artists = await base44.asServiceRole.entities.Artist.filter({ id: artist_id }, null, 1);
    const artist = artists[0];
    if (!artist) {
      return Response.json({ error: 'Artist not found' }, { status: 404 });
    }

    if (action === 'approve') {
      await base44.asServiceRole.entities.Artist.update(artist_id, {
        approval_status: 'approved',
        status: 'active',
      });

      const users = await base44.asServiceRole.entities.User.filter({ email: artist.user_email }, null, 1);
      if (users[0]) {
        await base44.asServiceRole.entities.User.update(users[0].id, {
          artist_approval_status: 'approved',
        });
      }

      const studioUrl = `${Deno.env.get('BASE44_APP_URL') || 'https://onyx-ticket-pulse.base44.app'}/artist`;
      const approvalBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0d1a;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0d1a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f1529;border-radius:16px;border:1px solid #1e2a45;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1a0a2e,#0f1529);padding:32px 40px;text-align:center;border-bottom:1px solid #1e2a45;">
          <div style="font-size:28px;font-weight:900;letter-spacing:-1px;color:#fff;"><span style="color:#ff1b8d;">REIZ</span><span style="color:#1e64ff;">OR</span></div>
          <p style="color:#6b7db3;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:8px 0 0;">Artist Application Update</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="color:#c8d0e8;font-size:15px;margin:0 0 16px;">Hi <strong style="color:#fff;">${artist.display_name}</strong>,</p>
          <p style="color:#c8d0e8;font-size:15px;line-height:1.6;margin:0 0 24px;">🎉 Great news! Your artist profile on <strong style="color:#fff;">Reizor</strong> has been <strong style="color:#ff1b8d;">approved</strong>.</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
            <tr><td style="background:#ff1b8d;border-radius:8px;padding:14px 28px;">
              <a href="${studioUrl}" style="color:#fff;font-size:14px;font-weight:700;text-decoration:none;">Go to Artist Studio →</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#080c1a;padding:24px 40px;text-align:center;border-top:1px solid #1e2a45;">
          <p style="color:#ffffff;font-size:12px;margin:0;">© ${new Date().getFullYear()} Reizor · The Music Event Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: artist.user_email,
        subject: '🎉 Your Artist Profile is Approved — Welcome to Reizor!',
        body: approvalBody,
      });

      // Duplicate protection: only notify once
      const existingApproval = await base44.asServiceRole.entities.Notification.filter({
        user_email: artist.user_email,
      }, null, 50).catch(() => []);
      const alreadyApproved = existingApproval.some(n => n.title === 'Artist Approved');
      if (!alreadyApproved) {
        await base44.asServiceRole.entities.Notification.create({
          user_email: artist.user_email,
          title: 'Artist Approved',
          message: 'Your artist profile has been approved. Welcome to your Studio!',
          type: 'general',
          link: '/artist',
        });
      }

    } else {
      await base44.asServiceRole.entities.Artist.update(artist_id, {
        approval_status: 'rejected',
        status: 'suspended',
        rejection_reason: rejection_reason || '',
      });

      const users = await base44.asServiceRole.entities.User.filter({ email: artist.user_email }, null, 1);
      if (users[0]) {
        await base44.asServiceRole.entities.User.update(users[0].id, { artist_approval_status: 'rejected' });
      }

      const reapplyUrl = `${Deno.env.get('BASE44_APP_URL') || 'https://onyx-ticket-pulse.base44.app'}/artist/signup`;
      const rejectionBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0d1a;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0d1a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f1529;border-radius:16px;border:1px solid #1e2a45;overflow:hidden;">
        <tr><td style="padding:32px 40px;text-align:center;border-bottom:1px solid #1e2a45;">
          <div style="font-size:28px;font-weight:900;color:#fff;"><span style="color:#ff1b8d;">REIZ</span><span style="color:#1e64ff;">OR</span></div>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="color:#c8d0e8;font-size:15px;">Hi <strong style="color:#fff;">${artist.display_name}</strong>,</p>
          <p style="color:#c8d0e8;font-size:15px;line-height:1.6;">After reviewing your application, we're unable to approve it at this time.</p>
          ${rejection_reason ? `<div style="background:#1a0a2e;border-left:3px solid #ff1b8d;border-radius:8px;padding:16px 20px;margin:16px 0;"><p style="color:#e0e6f8;font-size:14px;margin:0;">${rejection_reason}</p></div>` : ''}
          <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
            <tr><td style="background:#ff1b8d;border-radius:8px;padding:14px 28px;">
              <a href="${reapplyUrl}" style="color:#fff;font-size:14px;font-weight:700;text-decoration:none;">Reapply Now →</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: artist.user_email,
        subject: 'Your Reizor Artist Application — Update',
        body: rejectionBody,
      });

      // Duplicate protection: only notify once per rejection cycle
      const existingRej = await base44.asServiceRole.entities.Notification.filter({
        user_email: artist.user_email,
      }, null, 50).catch(() => []);
      const alreadyRejected = existingRej.some(n => n.title === 'Artist Application Rejected');
      if (!alreadyRejected) {
        await base44.asServiceRole.entities.Notification.create({
          user_email: artist.user_email,
          title: 'Artist Application Rejected',
          message: rejection_reason
            ? `Your artist application was rejected: ${rejection_reason}. Please contact support for more information.`
            : 'Your artist application was rejected. Please contact support for more information.',
          type: 'general',
          link: '/artist/signup',
        });
      }
    }

    return Response.json({ success: true, action });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});