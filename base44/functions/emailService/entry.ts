/**
 * emailService — Global Gmail-based email service for Reizor
 *
 * Single source of truth for all outgoing emails. Uses the global branded template.
 *
 * Payload shape:
 * {
 *   to: string | string[],        // required
 *   subject: string,               // required
 *   body: string,                  // required — full HTML (use buildEmailBody from utils/emailTemplate)
 *   cc?: string | string[],
 *   bcc?: string | string[],
 *   replyTo?: string,
 *   vars?: Record<string, string>, // {{VAR_NAME}} substitution in subject+body
 *   _source?: string,              // caller label for logs
 * }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Encode a header value using RFC 2047 if it contains non-ASCII characters
function encodeHeaderValue(text) {
  // Quick check: if ASCII-only, return as-is
  if (/^[\x00-\x7F]*$/.test(text)) return text;
  // RFC 2047: =?charset?encoding?encoded_text?=
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return `=?UTF-8?B?${b64}?=`;
}

// Build a RFC 2822 MIME email message encoded as base64url for Gmail API
function base64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function buildMimeMessage({ from, to, cc, bcc, replyTo, subject, body }) {
  const toList = Array.isArray(to) ? to.join(', ') : to;
  const boundary = `====${Date.now()}.${Math.random().toString(36).slice(2)}====`;
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@reizor.com>`;
  const dateStr = new Date().toUTCString();

  // Encode body to base64 with 76-char line wrapping per RFC
  const encodedBody = base64Encode(body).match(/.{1,76}/g).join('\r\n');

  const lines = [];
  lines.push(`From: ${from}`);
  lines.push(`To: ${toList}`);
  if (cc) lines.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
  if (bcc) lines.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
  if (replyTo) lines.push(`Reply-To: ${replyTo}`);
  lines.push(`Subject: ${encodeHeaderValue(subject)}`);
  lines.push(`Date: ${dateStr}`);
  lines.push(`Message-ID: ${messageId}`);
  lines.push(`X-Mailer: Reizor/1.0`);
  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  lines.push('');
  lines.push(`--${boundary}`);
  lines.push('Content-Type: text/html; charset=UTF-8');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(encodedBody);
  lines.push('');
  lines.push(`--${boundary}--`);

  const raw = lines.join('\r\n');

  // Encode entire MIME message as base64url for Gmail API
  const bytes = new TextEncoder().encode(raw);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Replace {{VAR}} placeholders in a string
function applyVars(str, vars = {}) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// Detect if body is already HTML or just plain text
function isHtml(str) {
  return /<(html|body|div|table|p|h[1-6]|a\s|br|img|span|li|ol|ul|td|tr|th|section|header|footer)[\s>]/i.test(str);
}

// Wrap plain text in the branded Reizor email template
function wrapInTemplate(plainText) {
  // Escape HTML entities in plain text, then convert line breaks to <br>
  const safe = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const year = new Date().getFullYear();

  return '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>\n<body style="margin:0;padding:0;background:#07091a;font-family:\'Helvetica Neue\',Arial,sans-serif;">\n  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07091a;min-height:100vh;">\n    <tr>\n      <td align="center" style="padding:32px 16px;">\n        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1024;border-radius:14px;border:1px solid #1e2545;overflow:hidden;">\n'
+ '        <tr>\n            <td style="padding:24px 32px 18px;border-bottom:1px solid #1a2040;">\n'
+ '              <span style="font-size:20px;font-weight:900;color:#ffffff;font-family:\'Helvetica Neue\',Arial,sans-serif;">REIZOR</span>\n'
+ '              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff1b8d;margin-left:3px;vertical-align:middle;"></span>\n'
+ '            </td>\n          </tr>\n'
+ '          <tr>\n            <td style="padding:28px 32px 24px;">\n'
+ '              <p style="margin:0;font-size:14px;color:#b0b8d4;line-height:1.7;">'
+ safe
+ '</p>\n            </td>\n          </tr>\n'
+ '          <tr>\n            <td style="padding:16px 32px;border-top:1px solid #1a2040;background:#09102a;">\n'
+ '              <p style="margin:0;font-size:11px;color:#4a5470;text-align:center;line-height:1.6;">'
+ 'Questions? Visit <a href="https://reizor.com" style="color:#ff1b8d;text-decoration:none;">reizor.com</a><br/>'
+ 'You received this because you have an account on Reizor.'
+ '</p>\n            </td>\n          </tr>\n'
+ '          <tr>\n            <td style="padding:14px 32px;border-top:1px solid #131929;">\n'
+ `              <span style="font-size:10px;color:#2e3650;font-family:monospace;">© ${year} Reizor · All rights reserved</span>\n`
+ '            </td>\n          </tr>\n'
+ '        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>';
}

Deno.serve(async (req) => {
  const source = '?'; // will be overwritten per-request
  try {
    const base44 = createClientFromRequest(req);

    const {
      to,
      subject,
      body,
      cc,
      bcc,
      replyTo,
      vars = {},
      _source = 'unknown',
    } = await req.json();

    // --- Validation ---
    if (!to || !subject || !body) {
      return Response.json({ error: 'to, subject, and body are required' }, { status: 400 });
    }

    // --- Variable substitution ---
    const finalSubject = applyVars(subject, vars);
    let finalBody      = applyVars(body, vars);

    // --- Auto-wrap plain text in branded template ---
    if (!isHtml(finalBody)) {
      finalBody = wrapInTemplate(finalBody);
    }

    // --- Get Gmail access token ---
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // --- Determine sender address from Gmail profile ---
    const profileRes = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/profile',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const profile = await profileRes.json();
    const senderEmail = profile.emailAddress || 'noreply@reizor.com';
    const from = `Reizor <${senderEmail}>`;

    // --- Build & send MIME message ---
    const raw = buildMimeMessage({ from, to, cc, bcc, replyTo, subject: finalSubject, body: finalBody });

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
      console.error(`[emailService] Gmail send failed (source: ${_source}):`, errBody);
      return Response.json({ error: 'Gmail API error', detail: errBody }, { status: 500 });
    }

    const sent = await sendRes.json();
    console.log(`[emailService] ✅ Email sent (source: ${_source}) → id: ${sent.id} | from: ${senderEmail} | to: ${Array.isArray(to) ? to.join(', ') : to}`);

    return Response.json({ success: true, messageId: sent.id });
  } catch (error) {
    console.error(`[emailService] ❌ Unexpected error:`, error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});