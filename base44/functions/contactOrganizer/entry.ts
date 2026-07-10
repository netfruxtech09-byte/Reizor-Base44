import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Encode a header value using RFC 2047 if it contains non-ASCII characters
function encodeHeaderValue(text) {
  if (/^[\x00-\x7F]*$/.test(text)) return text;
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function base64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function buildMimeMessage({ from, to, replyTo, subject, body }) {
  const boundary = `====${Date.now()}.${Math.random().toString(36).slice(2)}====`;
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@reizor.com>`;
  const dateStr = new Date().toUTCString();

  // Encode body to base64 with 76-char line wrapping per RFC
  const encodedBody = base64Encode(body).match(/.{1,76}/g).join('\r\n');

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeHeaderValue(subject)}`,
    `Date: ${dateStr}`,
    `Message-ID: ${messageId}`,
    `X-Mailer: Reizor/1.0`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody,
    '',
    `--${boundary}--`,
  ];
  const raw = lines.join('\r\n');
  const bytes = new TextEncoder().encode(raw);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function wrapInTemplate(plainText) {
  const safe = plainText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  const year = new Date().getFullYear();
  return '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>\n<body style="margin:0;padding:0;background:#07091a;font-family:\'Helvetica Neue\',Arial,sans-serif;">\n  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07091a;min-height:100vh;">\n    <tr>\n      <td align="center" style="padding:32px 16px;">\n        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1024;border-radius:14px;border:1px solid #1e2545;overflow:hidden;">\n        <tr>\n            <td style="padding:24px 32px 18px;border-bottom:1px solid #1a2040;">\n              <span style="font-size:20px;font-weight:900;color:#ffffff;font-family:\'Helvetica Neue\',Arial,sans-serif;">REIZOR</span>\n              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff1b8d;margin-left:3px;vertical-align:middle;"></span>\n            </td>\n          </tr>\n          <tr>\n            <td style="padding:28px 32px 24px;">\n              <p style="margin:0;font-size:14px;color:#b0b8d4;line-height:1.7;">'
    + safe
    + '</p>\n            </td>\n          </tr>\n          <tr>\n            <td style="padding:16px 32px;border-top:1px solid #1a2040;background:#09102a;">\n              <p style="margin:0;font-size:11px;color:#4a5470;text-align:center;line-height:1.6;">'
    + 'Questions? Visit <a href="https://reizor.com" style="color:#ff1b8d;text-decoration:none;">reizor.com</a><br/>'
    + 'You received this because you have an account on Reizor.'
    + '</p>\n            </td>\n          </tr>\n          <tr>\n            <td style="padding:14px 32px;border-top:1px solid #131929;">\n'
    + `              <span style="font-size:10px;color:#2e3650;font-family:monospace;">© ${year} Reizor · All rights reserved</span>\n`
    + '            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>';
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const { organizerEmail, organizerName, fanEmail, subject, message } = body || {};

        // Validate required fields
        if (!organizerEmail || !fanEmail || !subject || !message) {
            return Response.json({ error: 'All fields are required.' }, { status: 400 });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(organizerEmail) || !emailRegex.test(fanEmail)) {
            return Response.json({ error: 'Invalid email address.' }, { status: 400 });
        }

        // Sanitize inputs
        const sanitize = (str, maxLen) => {
            return str.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().substring(0, maxLen);
        };
        const cleanSubject = sanitize(subject, 200);
        const cleanMessage = sanitize(message, 5000);

        if (!cleanSubject || !cleanMessage) {
            return Response.json({ error: 'Subject and message must contain valid text.' }, { status: 400 });
        }

        // Compose plain-text body with line breaks for readable email
        const emailText = [
            `You received a new message on Reizor.`,
            ``,
            `From: ${fanEmail}`,
            ``,
            `Subject: ${cleanSubject}`,
            ``,
            `Message:`,
            `${cleanMessage}`,
            ``,
            `---`,
            `Reply directly to this email or write to ${fanEmail} to respond.`,
        ].join('\n');

        // Wrap in branded template
        const htmlBody = wrapInTemplate(emailText);

        // Get Gmail access token and send directly (avoids nested function invoke 403)
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

        // Get sender address from Gmail profile
        const profileRes = await fetch(
            'https://www.googleapis.com/gmail/v1/users/me/profile',
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const profile = await profileRes.json();
        const senderEmail = profile.emailAddress || 'noreply@reizor.com';
        const from = `Reizor <${senderEmail}>`;

        // Build & send MIME message
        const raw = buildMimeMessage({
            from,
            to: organizerEmail,
            replyTo: fanEmail,
            subject: `Reizor: ${cleanSubject}`,
            body: htmlBody,
        });

        const sendRes = await fetch(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ raw }),
            }
        );

        if (!sendRes.ok) {
            const errBody = await sendRes.text();
            return Response.json({ error: 'Failed to send message. Please try again later.' }, { status: 500 });
        }

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: 'Failed to send message. Please try again later.' }, { status: 500 });
    }
});