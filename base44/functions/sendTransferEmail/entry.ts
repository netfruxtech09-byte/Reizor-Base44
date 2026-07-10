import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function buildEmailBody({ title, greeting, message, infoBox, ctaText, ctaUrl, footerNote }) {
  const greetingHtml = greeting ? `<p style="margin:0 0 12px 0;font-size:15px;color:#d0d4e8;">${greeting}</p>` : '';
  const infoBoxHtml = infoBox && infoBox.rows && infoBox.rows.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${infoBox.highlight ? 'rgba(255,27,141,0.08)' : '#131929'};border:1px solid ${infoBox.highlight ? 'rgba(255,27,141,0.25)' : '#232b4a'};border-radius:10px;margin:20px 0;">
        ${infoBox.rows.map(r => `<tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap;width:40%;">${r.label}</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.04);">${r.value}</td></tr>`).join('')}
      </table>` : '';
  const ctaHtml = ctaText && ctaUrl ? `<div style="text-align:center;margin:28px 0 8px;"><a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#ff1b8d,#d4006e);color:#ffffff;font-size:15px;font-weight:800;font-family:'Helvetica Neue',Arial,sans-serif;text-decoration:none;padding:14px 36px;border-radius:8px;">${ctaText}</a></div>` : '';
  const footerNoteHtml = footerNote ? `<p style="margin:16px 0 0;font-size:11px;color:#5a647a;text-align:center;">${footerNote}</p>` : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#07091a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07091a;min-height:100vh;"><tr><td align="center" style="padding:32px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1024;border-radius:14px;border:1px solid #1e2545;overflow:hidden;">
      <tr><td style="padding:24px 32px 18px;border-bottom:1px solid #1a2040;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><span style="font-size:20px;font-weight:900;color:#fff;">REIZOR</span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff1b8d;margin-left:3px;vertical-align:middle;"></span></td>
          <td align="right"><span style="font-size:10px;color:#5a647a;font-family:monospace;text-transform:uppercase;letter-spacing:2px;">Notification</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 32px 24px;">
        <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:900;color:#fff;line-height:1.2;">${title}</h1>
        ${greetingHtml}
        <p style="margin:0 0 4px 0;font-size:14px;color:#b0b8d4;line-height:1.7;">${message}</p>
        ${infoBoxHtml}${ctaHtml}${footerNoteHtml}
      </td></tr>
      <tr><td style="padding:16px 32px;border-top:1px solid #1a2040;background:#09102a;">
        <p style="margin:0;font-size:11px;color:#4a5470;text-align:center;">Questions? Reply to this email or visit <a href="https://reizor.com" style="color:#ff1b8d;text-decoration:none;">reizor.com</a></p>
      </td></tr>
      <tr><td style="padding:14px 32px;border-top:1px solid #131929;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><span style="font-size:10px;color:#2e3650;font-family:monospace;">© ${new Date().getFullYear()} Reizor</span></td>
          <td align="right"><span style="font-size:10px;color:#2e3650;font-family:monospace;">reizor.com</span></td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { to_email, from_name, event_title, ticket_type_name, token } = await req.json();
    const redeemUrl = `${req.headers.get('origin') || 'https://app.base44.com'}/redeem-transfer?token=${token}`;

    await base44.functions.invoke('emailService', {
      _source: 'sendTransferEmail',
      to: to_email,
      subject: `🎟 ${from_name} sent you a ticket to ${event_title}`,
      body: buildEmailBody({
        title: "You've got a ticket! 🎉",
        greeting: 'Hi there,',
        message: `<strong>${from_name}</strong> has transferred a ticket to you.`,
        infoBox: { highlight: true, rows: [
          { label: 'Event', value: event_title },
          { label: 'Ticket Type', value: ticket_type_name },
        ]},
        ctaText: 'Claim Your Ticket →',
        ctaUrl: redeemUrl,
        footerNote: 'This link expires in 48 hours. A new unique QR code will be generated for you — the sender\'s original code will be permanently invalidated.',
      }),
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});