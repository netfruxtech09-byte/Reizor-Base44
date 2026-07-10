/**
 * sendWLInvite — Backend function to send White Label and Sub White Label invite emails.
 *
 * This runs as service role so it always has access to the Gmail connector
 * regardless of whether the calling user is a WL admin or Reizor admin.
 *
 * Payload:
 *   to         — string, recipient email
 *   name       — string, recipient name (optional)
 *   link       — string, setup invite link
 *   senderName — string, name of the inviting party (brand name or "Reizor")
 *   role       — string, "white_label" | "sub_white_label" | "artist" | "organizer"
 *   _source    — string, caller label for logs
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function base64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildEmail({ from, to, subject, html }) {
  const boundary = `====reizor.${Date.now()}====`;
  const encodedHtml = btoa(unescape(encodeURIComponent(html))).match(/.{1,76}/g).join('\r\n');
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodedHtml,
    '',
    `--${boundary}--`,
  ];
  const raw = lines.join('\r\n');
  const bytes = new TextEncoder().encode(raw);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildInviteHtml({ name, senderName, link, role }) {
  const displayName = name || 'there';
  const roleLabel =
    role === 'white_label' ? 'White Label Partner' :
    role === 'sub_white_label' ? 'Sub-White-Label Partner' :
    role === 'artist' ? 'Artist' :
    role === 'organizer' ? 'Organizer' :
    'Partner';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:32px 16px;background:#07091a;font-family:Arial,sans-serif;color:#d0d4e8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#0d1024;border-radius:12px;border:1px solid #1e2545;padding:32px;">
    <tr><td>
      <p style="margin:0 0 4px 0;font-size:20px;font-weight:900;color:#ffffff;">${senderName}</p>
      <p style="margin:0 0 16px 0;font-size:11px;color:#4a5470;">Powered by Reizor</p>
      <hr style="border:none;border-top:1px solid #1e2545;margin:16px 0;"/>
      <h2 style="margin:0 0 16px 0;font-size:20px;color:#ffffff;">You're invited as a ${roleLabel}</h2>
      <p style="margin:0 0 12px 0;font-size:15px;">Hi ${displayName},</p>
      <p style="margin:0 0 20px 0;font-size:14px;line-height:1.7;">
        <strong>${senderName}</strong> has invited you to join as a <strong>${roleLabel}</strong>.
        You'll have your own branded platform and admin dashboard.
        Click below to complete your setup.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${link}" style="display:inline-block;background:#ff1b8d;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">Complete Your Setup</a>
      </div>
      <p style="margin:16px 0 4px 0;font-size:13px;color:#8893b0;">If the button doesn't work, copy and paste this link:</p>
      <p style="margin:0 0 24px 0;font-size:12px;word-break:break-all;color:#ff1b8d;">${link}</p>
      <hr style="border:none;border-top:1px solid #1e2545;margin:16px 0;"/>
      <p style="margin:0;font-size:12px;color:#4a5470;text-align:center;">
        Powered by <a href="https://reizor.com" style="color:#ff1b8d;text-decoration:none;">Reizor</a>
      </p>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verify caller is authenticated (any role allowed — WL admins can send invites too)
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, name, link, senderName, role, _source = 'sendWLInvite' } = await req.json();

    if (!to || !link) {
      return Response.json({ error: 'to and link are required' }, { status: 400 });
    }

    // Role-based permission check: only admin or white_label/sub_white_label can send WL invites
    const allowedRoles = ['admin', 'white_label', 'sub_white_label'];
    if (!allowedRoles.includes(user.role)) {
      return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
    }

    // Get Gmail token via service role — works regardless of calling user's role
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Get sender address from Gmail profile
    const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();
    const senderEmail = profile.emailAddress || 'noreply@reizor.com';
    const from = `${senderName || 'Reizor'} <${senderEmail}>`;

    const subject = `You're invited to join ${senderName || 'Reizor'} as a ${
      role === 'white_label' ? 'White Label Partner' :
      role === 'sub_white_label' ? 'Sub-White-Label Partner' :
      role === 'artist' ? 'Artist' :
      role === 'organizer' ? 'Organizer' : 'Partner'
    }`;

    const html = buildInviteHtml({ name, senderName: senderName || 'Reizor', link, role });
    const raw = buildEmail({ from, to, subject, html });

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!sendRes.ok) {
      const errBody = await sendRes.text();
      console.error(`[sendWLInvite] Gmail send failed (${_source}):`, errBody);
      return Response.json({ error: 'Gmail API error', detail: errBody }, { status: 500 });
    }

    const sent = await sendRes.json();
    console.log(`[sendWLInvite] ✅ Sent to ${to} (role: ${role}, source: ${_source}) → id: ${sent.id}`);

    return Response.json({ success: true, messageId: sent.id });
  } catch (error) {
    console.error('[sendWLInvite] ❌ Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});