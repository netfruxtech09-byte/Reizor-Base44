/**
 * Global Email Template System — Reizor
 *
 * Single reusable HTML template for ALL outgoing emails.
 * Usage:
 *   import { buildEmailBody } from '@/utils/emailTemplate';
 *   const html = buildEmailBody({ title, greeting, message, ctaText, ctaUrl, infoBox, extraLines });
 *
 * Then pass `html` as `body` to `sendEmail()` from utils/emailService.js
 */

/**
 * @param {object} opts
 * @param {string}  opts.title        - Bold heading inside email (e.g. "Tickets Confirmed! 🎟️")
 * @param {string}  [opts.greeting]   - "Hi Alice," line. Pass null to omit.
 * @param {string}  opts.message      - Main paragraph text (HTML allowed)
 * @param {string}  [opts.ctaText]    - Button label (e.g. "View My Tickets")
 * @param {string}  [opts.ctaUrl]     - Button URL
 * @param {object}  [opts.infoBox]    - { rows: [{label, value}], highlight? } — key-value detail block
 * @param {string[]} [opts.extraLines] - Additional paragraphs below the info box
 * @param {string}  [opts.footerNote] - Small note above footer (e.g. "This link expires in 48 hours")
 * @returns {string} Full HTML email string
 */
export function buildEmailBody({
  title,
  greeting = null,
  message,
  ctaText,
  ctaUrl,
  infoBox,
  extraLines = [],
  footerNote,
}) {
  const greetingHtml = greeting
    ? `<p style="margin:0 0 12px 0;font-size:15px;color:#d0d4e8;">${greeting}</p>`
    : '';

  const infoBoxHtml = infoBox && infoBox.rows && infoBox.rows.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${infoBox.highlight ? 'rgba(255,27,141,0.08)' : '#131929'};border:1px solid ${infoBox.highlight ? 'rgba(255,27,141,0.25)' : '#232b4a'};border-radius:10px;margin:20px 0;">
        ${infoBox.rows.map(({ label, value }) => `
          <tr>
            <td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap;width:40%;">${label}</td>
            <td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.04);">${value}</td>
          </tr>`).join('')}
      </table>`
    : '';

  const extraHtml = extraLines.map(l => `<p style="margin:8px 0;font-size:14px;color:#b0b8d4;line-height:1.6;">${l}</p>`).join('');

  const ctaHtml = ctaText && ctaUrl
    ? `<div style="text-align:center;margin:28px 0 8px;">
        <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#ff1b8d,#d4006e);color:#ffffff;font-size:15px;font-weight:800;font-family:'Helvetica Neue',Arial,sans-serif;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.4px;">${ctaText}</a>
      </div>`
    : '';

  const footerNoteHtml = footerNote
    ? `<p style="margin:16px 0 0;font-size:11px;color:#5a647a;text-align:center;">${footerNote}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#07091a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07091a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1024;border-radius:14px;border:1px solid #1e2545;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:24px 32px 18px;border-bottom:1px solid #1a2040;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;">REIZOR</span>
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff1b8d;margin-left:3px;vertical-align:middle;"></span>
                  </td>
                  <td align="right">
                    <span style="font-size:10px;color:#5a647a;font-family:monospace;text-transform:uppercase;letter-spacing:2px;">Notification</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 24px;">
              <!-- Title -->
              <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:900;color:#ffffff;line-height:1.2;">${title}</h1>

              ${greetingHtml}

              <!-- Message -->
              <p style="margin:0 0 4px 0;font-size:14px;color:#b0b8d4;line-height:1.7;">${message}</p>

              ${infoBoxHtml}
              ${extraHtml}
              ${ctaHtml}
              ${footerNoteHtml}
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #1a2040;background:#09102a;">
              <p style="margin:0;font-size:11px;color:#4a5470;text-align:center;line-height:1.6;">
                Questions? Reply to this email or visit <a href="https://reizor.com" style="color:#ff1b8d;text-decoration:none;">reizor.com</a><br/>
                You received this because you have an account on Reizor.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:14px 32px;border-top:1px solid #131929;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:10px;color:#2e3650;font-family:monospace;">© ${new Date().getFullYear()} Reizor · All rights reserved</span>
                  </td>
                  <td align="right">
                    <span style="font-size:10px;color:#2e3650;font-family:monospace;">reizor.com</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}