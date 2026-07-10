import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const eventId = body.event_id;

    if (!eventId) {
      return Response.json({ error: 'event_id is required' }, { status: 400 });
    }

    // Count unique EventLike records for this event
    const eventLikes = await base44.asServiceRole.entities.EventLike.filter(
      { event_id: eventId },
      null,
      5000
    );

    const count = eventLikes.length;

    // Update the Event's likes_count
    await base44.asServiceRole.entities.Event.update(eventId, { likes_count: count });

    return Response.json({ event_id: eventId, likes_count: count, success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});