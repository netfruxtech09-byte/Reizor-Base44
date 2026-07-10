import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Invite a user to the platform with a custom Reizor-branded email.
 * Replaces the default Base44 invitation email that shows the sender's email address.
 *
 * Payload:
 * {
 *   email: string,     // required — recipient email
 *   role: string,      // required — "user", "admin", or "organizer"
 *   joinUrl?: string,  // optional — custom join link (defaults to app origin)
 *   customMessage?: string  // optional — extra message to include
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { email, role = 'user', joinUrl, customMessage } = await req.json();

    if (!email) {
      return Response.json({ error: 'email is required' }, { status: 400 });
    }

    // 1. Build and send custom Reizor-branded email (no platform invite — avoids double email)
    const origin = joinUrl || 'https://reizor.com';
    const year = new Date().getFullYear();

    const roleLabel = {
      user: 'Fan / Member',
      admin: 'Admin',
      organizer: 'Event Organizer',
      artist: 'Artist',
      manager: 'Ticket Seller',
      vendor: 'Vendor',
    }[role] || role;

    const inviterName = customMessage || 'Reizor';

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="padding:28px 36px 22px;border-bottom:1px solid #f0f2f8;background:#fff;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#0d1024;font-family:'Helvetica Neue',Arial,sans-serif;">REIZOR</span>
                    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff1b8d;margin-left:3px;vertical-align:middle;"></span>
                  </td>
                  <td align="right">
                    <span style="font-size:10px;color:#94a3b8;font-family:monospace;text-transform:uppercase;letter-spacing:2px;">Exclusive Invite</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px 28px;">
              <h1 style="margin:0 0 18px 0;font-size:24px;font-weight:900;color:#0d1024;line-height:1.2;">You're invited to join as ${roleLabel} 🎉</h1>

              <p style="margin:0 0 20px 0;font-size:15px;color:#475569;line-height:1.75;">
                You have been invited by <strong style="color:#0d1024;">${inviterName}</strong> to be part of the <strong style="color:#ff1b8d;">Reizor</strong> platform as a <strong style="color:#0d1024;">${roleLabel}</strong>.
              </p>

              <p style="margin:0 0 28px 0;font-size:14px;color:#64748b;line-height:1.7;">
                Reizor is the all-in-one platform for live events — discover parties, buy tickets, follow artists, and connect with a global community of music lovers. Click the button below to accept your invitation and get started.
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:0 0 8px;">
                <a href="https://reizor.com/login?next=${encodeURIComponent(origin)}" style="display:inline-block;background:linear-gradient(135deg,#ff1b8d,#d4006e);color:#ffffff;font-size:16px;font-weight:800;font-family:'Helvetica Neue',Arial,sans-serif;text-decoration:none;padding:15px 40px;border-radius:10px;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(255,27,141,0.35);">Accept Invitation →</a>
              </div>

              <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
                Or copy this link: <a href="https://reizor.com/login?next=${encodeURIComponent(origin)}" style="color:#ff1b8d;text-decoration:none;word-break:break-all;">reizor.com/login</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 36px;border-top:1px solid #f0f2f8;background:#f8fafc;">
              <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.7;">
                Questions? Visit <a href="https://reizor.com" style="color:#ff1b8d;text-decoration:none;">reizor.com</a><br/>
                You received this because someone invited you to join Reizor. <a href="https://reizor.com" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>
              </p>
              <p style="margin:10px 0 0;font-size:10px;color:#cbd5e1;text-align:center;font-family:monospace;">© ${year} Reizor · All rights reserved</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send via Gmail using the authorized connector
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const profileRes = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/profile',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const profile = await profileRes.json();
    const senderEmail = profile.emailAddress || 'noreply@reizor.com';

    // Build MIME message
    const toHeader = email;
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@reizor.com>`;
    const dateStr = new Date().toUTCString();

    const rawLines = [
      `From: Reizor <${senderEmail}>`,
      `To: ${toHeader}`,
      `Subject: =?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode("Exclusive Invite — You're invited to join Reizor")))}?=`,
      `Date: ${dateStr}`,
      `Message-ID: ${messageId}`,
      `X-Mailer: Reizor/1.0`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      '',
      html,
    ];

    const raw = rawLines.join('\r\n');
    const bytes = new TextEncoder().encode(raw);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const sendRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: encoded }),
      }
    );

    if (!sendRes.ok) {
      const errBody = await sendRes.text();
      console.error('[inviteWithCustomEmail] Gmail error:', errBody);
      return Response.json({ success: false, email_sent: false, error: 'Gmail API error' });
    }

    const sent = await sendRes.json();
    console.log(`[inviteWithCustomEmail] ✅ Email sent to ${email} as ${role} — id: ${sent.id}`);

    return Response.json({ success: true, email_sent: true, messageId: sent.id });
  } catch (error) {
    console.error('[inviteWithCustomEmail] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});