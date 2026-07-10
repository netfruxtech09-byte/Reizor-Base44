import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { query = 'music concerts', city = '', genre = '' } = body;

    // Try Ticketmaster API first if key is set
    const tmKey = Deno.env.get('TICKETMASTER_API_KEY');
    if (tmKey) {
      const params = new URLSearchParams({
        apikey: tmKey,
        classificationName: 'music',
        size: '20',
        sort: 'date,asc',
      });
      if (city) params.set('city', city);
      if (genre) params.set('keyword', genre);

      const tmRes = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
      const tmData = await tmRes.json();
      const events = (tmData._embedded?.events || []).map(e => ({
        title: e.name,
        date: e.dates?.start?.dateTime || e.dates?.start?.localDate,
        venue_name: e._embedded?.venues?.[0]?.name || '',
        city: e._embedded?.venues?.[0]?.city?.name || '',
        country: e._embedded?.venues?.[0]?.country?.name || '',
        genre: e.classifications?.[0]?.genre?.name || 'music',
        cover_image: e.images?.[0]?.url || '',
        artists: e._embedded?.attractions?.map(a => a.name) || [],
        affiliate_url: `${e.url}?camefrom=REIZOR`,
        affiliate_source: 'ticketmaster',
        min_price: e.priceRanges?.[0]?.min,
        max_price: e.priceRanges?.[0]?.max,
        external_id: e.id,
        commission_rate: 5,
        status: 'active',
      }));
      return Response.json({ events, source: 'ticketmaster' });
    }

    // Fallback: use AI to discover affiliate events
    const prompt = `Find 10 real upcoming music events (concerts, festivals, club nights) that are listed on Ticketmaster, Eventbrite, SeatGeek, or Viagogo. 
    ${city ? `Focus on events in or near: ${city}` : ''}
    ${genre ? `Genre preference: ${genre}` : 'Any music genre'}
    Query hint: ${query}
    
    For each event return realistic data. The affiliate_url should be a real search URL on one of the affiliate platforms. 
    Use commission_rate: 5 for ticketmaster, 8 for eventbrite, 6 for seatgeek.
    
    Return JSON array of events with fields: title, date (ISO), venue_name, city, country, genre, artists (array), affiliate_url, affiliate_source (ticketmaster/eventbrite/seatgeek/viagogo), external_id, min_price, max_price, commission_rate, cover_image (leave empty string)`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                date: { type: 'string' },
                venue_name: { type: 'string' },
                city: { type: 'string' },
                country: { type: 'string' },
                genre: { type: 'string' },
                artists: { type: 'array', items: { type: 'string' } },
                affiliate_url: { type: 'string' },
                affiliate_source: { type: 'string' },
                external_id: { type: 'string' },
                min_price: { type: 'number' },
                max_price: { type: 'number' },
                commission_rate: { type: 'number' },
                cover_image: { type: 'string' },
              }
            }
          }
        }
      },
      add_context_from_internet: true,
      model: 'gemini_3_flash',
    });

    const events = (result.events || []).map(e => ({ ...e, status: 'active' }));
    return Response.json({ events, source: 'ai_discovery' });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});