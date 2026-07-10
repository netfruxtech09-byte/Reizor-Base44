import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const { token, event_data } = await req.json();

    if (!token || !event_data) {
      return Response.json({ error: 'Missing token or event_data' }, { status: 400 });
    }

    // Verify token (in production, validate against stored organizer tokens)
    // For now, accept any token

    const base44 = createClientFromRequest(req);

    // Create event with organizer data
    const event = await base44.asServiceRole.entities.Event.create({
      title: event_data.event_name,
      description: event_data.description,
      date: event_data.event_date,
      venue_name: event_data.venue_name,
      city: event_data.city,
      country: event_data.country,
      genre: event_data.genre,
      organizer_name: event_data.organizer_name,
      organizer_email: event_data.organizer_email,
      cover_image: event_data.cover_image_url,
      status: 'published',
      cc_fee_on_buyer: true,
    });

    // Update discovery record
    const discoveries = await base44.asServiceRole.entities.EventDiscovery.filter(
      { api_integration_token: token },
      null,
      1
    );

    if (discoveries.length > 0) {
      await base44.asServiceRole.entities.EventDiscovery.update(discoveries[0].id, {
        status: 'listed',
        created_event_id: event.id,
      });
    }

    // Send confirmation email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: event_data.organizer_email,
      subject: `✅ Your Event is Live on Reizor!`,
      body: `Hi ${event_data.organizer_name},

Your event "${event_data.event_name}" is now live on Reizor!

🎟 Event Page: https://reizor.com/events/${event.id}
📊 Dashboard: https://reizor.com/organizer/events/${event.id}

Start selling tickets now. You earn 95% of all revenue (we take 5%).

Questions? Reply to this email.

Best,
Reizor Team`,
    }).catch(() => {});

    return Response.json({
      success: true,
      event_id: event.id,
      message: 'Event integrated successfully',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});