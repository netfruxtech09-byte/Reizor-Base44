import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { external_event_id, event_title, affiliate_source, commission_rate } = body;

    const user = await base44.auth.me().catch(() => null);

    // Record the click
    await base44.asServiceRole.entities.AffiliateEarning.create({
      external_event_id,
      event_title,
      affiliate_source,
      click_user_email: user?.email || 'anonymous',
      click_user_name: user?.full_name || 'Anonymous',
      action: 'click',
      amount: 0,
      commission_rate,
      status: 'pending',
    });

    // Update click count on the event
    const events = await base44.asServiceRole.entities.ExternalEvent.filter({ id: external_event_id }, null, 1);
    if (events.length > 0) {
      await base44.asServiceRole.entities.ExternalEvent.update(external_event_id, {
        click_count: (events[0].click_count || 0) + 1,
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});