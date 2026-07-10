import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, event_id } = body;

    // Support both direct call and entity automation payload
    let targetEvent = event;
    if (!targetEvent && event_id) {
      const events = await base44.asServiceRole.entities.Event.filter({ id: event_id }, null, 1);
      targetEvent = events[0];
    }
    // Entity automation format: data field
    if (!targetEvent && body.data) {
      targetEvent = body.data;
    }

    if (!targetEvent || targetEvent.status !== 'published') {
      return Response.json({ skipped: true, reason: 'Event not published or not found' });
    }

    const eventGenre = targetEvent.genre;
    // Use event location first, fallback to organizer location
    const eventCity = (targetEvent.city || targetEvent.organizer_city || '').toLowerCase();
    const eventState = (targetEvent.state || targetEvent.organizer_state || '').toLowerCase();

    // Get all users
    const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
    
    // Get organizer followers
    const followers = await base44.asServiceRole.entities.ArtistFollow.filter(
      { following_organizer_id: targetEvent.organizer_id },
      null,
      1000
    ).catch(() => []);
    const followerEmails = new Set(followers.map(f => f.user_email?.toLowerCase()));

    let notified = 0;
    for (const user of users) {
      if (!user.email) continue;

      const preferredGenres = user.preferred_genres || [];
      const userCity = (user.city || '').toLowerCase();
      const userState = (user.state || '').toLowerCase();
      
      // Check if user follows organizer
      const isFollower = followerEmails.has(user.email.toLowerCase());

      // Check genre match
      const genreMatch = preferredGenres.length === 0 || preferredGenres.includes(eventGenre);
      
      // Check location match (city, state, or proximity)
      const cityMatch = !userCity || !eventCity || eventCity.includes(userCity) || userCity.includes(eventCity);
      const stateMatch = !userState || !eventState || eventState === userState;
      const locationMatch = (cityMatch && stateMatch) || (userCity && userState && eventCity && eventState && userCity === eventCity && userState === eventState);

      // Notify if: follower OR (genre match AND location match)
      if (!isFollower && (!genreMatch || !locationMatch)) continue;

      const key = `new-event-${targetEvent.id}-${user.email}`;

      // Check not already notified
      const existing = await base44.asServiceRole.entities.Notification.filter(
        { user_email: user.email }, '-created_date', 50
      );
      const alreadySent = existing.some(n => n.message?.includes(key));
      if (alreadySent) continue;

      const genreLabel = (eventGenre || 'event').replace(/_/g, ' ').toUpperCase();
      const isNearby = locationMatch && userCity;
      const titlePrefix = isFollower
        ? `📢 ${targetEvent.organizer_name} just posted`
        : isNearby
          ? `🔥 New ${genreLabel} event near you`
          : `🎵 New ${genreLabel} event`;

      await base44.asServiceRole.entities.Notification.create({
        user_email: user.email,
        type: 'recommendation',
        title: `${titlePrefix}: ${targetEvent.title}`,
        message: `${targetEvent.organizer_name} • ${targetEvent.venue_name || 'TBA'}, ${targetEvent.city || 'TBA'} — ${targetEvent.date ? new Date(targetEvent.date).toLocaleDateString() : 'Date TBA'}. [ref:${key}]`,
        event_id: targetEvent.id,
        event_title: targetEvent.title,
        link: `/events/${targetEvent.id}`,
      });

      notified++;
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});