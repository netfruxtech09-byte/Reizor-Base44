import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { query, days_ahead = 30 } = await req.json();

    if (!query) {
      return Response.json({ error: 'Missing query parameter' }, { status: 400 });
    }

    // Call LLM with web search to discover music events
    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Find upcoming music events from web search. Query: "${query}". 
      
Return a JSON array of events with:
- event_name
- event_date (ISO format)
- venue_name
- city
- country
- genre
- organizer_name
- organizer_email
- organizer_phone
- organizer_website
- discovered_url
- estimated_capacity
- estimated_price_range
- confidence_score (0-100, how confident this is a real event)
- event_description
- cover_image_url

Only return high-confidence music events (score > 70). Maximum 10 results.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                event_name: { type: "string" },
                event_date: { type: "string" },
                venue_name: { type: "string" },
                city: { type: "string" },
                country: { type: "string" },
                genre: { type: "string" },
                organizer_name: { type: "string" },
                organizer_email: { type: "string" },
                organizer_phone: { type: "string" },
                organizer_website: { type: "string" },
                discovered_url: { type: "string" },
                estimated_capacity: { type: "number" },
                estimated_price_range: { type: "string" },
                confidence_score: { type: "number" },
                event_description: { type: "string" },
                cover_image_url: { type: "string" }
              }
            }
          }
        }
      },
    });

    const discoveredEvents = response.events || [];
    const created = [];

    // Save discovered events
    for (const event of discoveredEvents) {
      if (event.confidence_score < 70) continue;

      try {
        const discovery = await base44.asServiceRole.entities.EventDiscovery.create({
          event_name: event.event_name,
          event_date: event.event_date,
          venue_name: event.venue_name,
          city: event.city,
          country: event.country || 'USA',
          genre: event.genre,
          discovered_url: event.discovered_url,
          discovered_source: 'web_search',
          organizer_name: event.organizer_name,
          organizer_email: event.organizer_email,
          organizer_phone: event.organizer_phone,
          organizer_website: event.organizer_website,
          estimated_capacity: event.estimated_capacity,
          estimated_price_range: event.estimated_price_range,
          confidence_score: event.confidence_score,
          event_description: event.event_description,
          cover_image_url: event.cover_image_url,
          status: 'discovered',
        });

        created.push({
          id: discovery.id,
          event_name: event.event_name,
          city: event.city,
          score: event.confidence_score,
        });
      } catch (e) {
        console.error(`Failed to create discovery for ${event.event_name}:`, e.message);
      }
    }

    // Notify admin
    if (created.length > 0) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: 'support@reizor.com',
        subject: `🎵 ${created.length} Music Events Discovered`,
        body: `Auto-discovery found ${created.length} new events:\n\n${created.map(e => `• ${e.event_name} in ${e.city} (confidence: ${e.score}%)`).join('\n')}\n\nReview and approve in admin dashboard.`,
      }).catch(() => {});
    }

    return Response.json({
      success: true,
      discovered_count: created.length,
      events: created,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});