import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function generateSecureToken(email) {
  const timestamp = Date.now().toString();
  const appId = Deno.env.get('BASE44_APP_ID') || 'reizor';
  const combined = email + timestamp + appId;
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  return btoa(combined).substring(0, 32);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { recommendation_id } = await req.json();

    if (!recommendation_id) {
      return Response.json({ error: 'Missing recommendation_id' }, { status: 400 });
    }

    // Get the recommendation
    const recommendations = await base44.asServiceRole.entities.EventRecommendation.filter(
      { id: recommendation_id },
      null,
      1
    );

    if (recommendations.length === 0) {
      return Response.json({ error: 'Recommendation not found' }, { status: 404 });
    }

    const rec = recommendations[0];

    // Build integration URL for organizer API
    const integrationUrl = `https://api.reizor.com/v1/organizers/integrate?token=${generateSecureToken(rec.organizer_email)}`;

    // Send outreach email to organizer via central emailService
    await base44.asServiceRole.functions.invoke('emailService', {
      _source: 'outreachToEventOrganizer',
      to: rec.organizer_email,
      subject: `List Your Event on Reizor — Free Ticketing Platform`,
      body: `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#07091a;font-family:'Helvetica Neue',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#07091a;"><tr><td align="center" style="padding:32px 16px;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1024;border-radius:14px;border:1px solid #1e2545;overflow:hidden;"><tr><td style="padding:24px 32px 18px;border-bottom:1px solid #1a2040;"><span style="font-size:20px;font-weight:900;color:#fff;">REIZOR</span></td></tr><tr><td style="padding:28px 32px 24px;"><h1 style="margin:0 0 16px;font-size:22px;font-weight:900;color:#fff;">List Your Event on Reizor 🎟️</h1><p style="color:#d0d4e8;">Hi ${rec.organizer_name || 'Event Organizer'},</p><p style="color:#b0b8d4;">We'd love to help you sell tickets for <strong style="color:#fff;">"${rec.event_name}"</strong> on Reizor's platform!</p><p style="color:#b0b8d4;">One of our users recommended your event. Here's what you get:</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#131929;border:1px solid #232b4a;border-radius:10px;margin:16px 0;"><tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.04);">Revenue Share</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.04);">You keep 95%</td></tr><tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.04);">Setup</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.04);">Automatic event sync</td></tr><tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;">Cost</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;">Free to list</td></tr></table><div style="text-align:center;margin:24px 0;"><a href="${integrationUrl}" style="display:inline-block;background:linear-gradient(135deg,#ff1b8d,#d4006e);color:#fff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 36px;border-radius:8px;">Get Started →</a></div></td></tr><tr><td style="padding:16px 32px;border-top:1px solid #1a2040;background:#09102a;"><p style="margin:0;font-size:11px;color:#4a5470;text-align:center;">Questions? Reply to this email — Reizor Team</p></td></tr></table></td></tr></table></body></html>`,
    }).catch(() => {});

    // Update recommendation status
    await base44.asServiceRole.entities.EventRecommendation.update(recommendation_id, {
      status: 'outreach_sent',
      outreach_attempts: (rec.outreach_attempts || 0) + 1,
      last_outreach_at: new Date().toISOString(),
      api_integration_url: integrationUrl,
    });

    return Response.json({
      success: true,
      message: 'Outreach sent to organizer',
      integration_url: integrationUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});