import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event_id } = await req.json();
    if (!event_id) {
      return Response.json({ error: 'event_id is required' }, { status: 400 });
    }

    // Authorization: this endpoint returns all attendee tickets (codes, QR data,
    // buyer emails, guest names) using the service role (bypassing RLS). Only
    // the event's organizer or an admin may access it. Everyone else gets 403.
    if (user.role !== 'admin') {
      const events = await base44.asServiceRole.entities.Event.filter(
        { id: event_id }, null, 1
      ).catch(() => []);
      const evt = events[0];
      const isOrganizer = evt && String(evt.organizer_id) === String(user.id);
      if (!isOrganizer) {
        return Response.json({ error: 'Forbidden: you are not authorized to view tickets for this event' }, { status: 403 });
      }
    }

    // Use service role to fetch all tickets for this event regardless of buyer
    const tickets = await base44.asServiceRole.entities.Ticket.filter(
      { event_id },
      null,
      500
    );

    return Response.json({ tickets: tickets || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});