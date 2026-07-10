import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { event, data } = body;

    // Only act on booking status becoming 'accepted'
    if (!data || data.status !== 'accepted') {
      return Response.json({ skipped: true, reason: 'Not an accepted booking' });
    }

    const booking = data;
    const artistId = booking.artist_id;
    // Use dedicated country field first, fall back to city for backwards-compat
    const bookingCountry = (booking.country || booking.city || '').toLowerCase().trim();
    const bookingCity = (booking.city || '').toLowerCase().trim();
    const eventDate = booking.event_date;

    if (!bookingCountry) {
      return Response.json({ skipped: true, reason: 'No location on booking' });
    }

    // Fetch artist info for genre matching
    const artists = await base44.asServiceRole.entities.Artist.filter({ id: artistId }, null, 1).catch(() => []);
    const artist = artists[0];
    // Artist genre may be a single string (enum value), not comma-separated
    const artistGenres = artist?.genre
      ? [artist.genre.trim().toLowerCase()]
      : [];

    // Fetch all organizer profiles with notifications enabled
    const allProfiles = await base44.asServiceRole.entities.OrganizerProfile.filter(
      { booking_notifications_enabled: true }, null, 500
    ).catch(() => []);

    if (!allProfiles.length) {
      return Response.json({ success: true, notified: 0, reason: 'No eligible organizers' });
    }

    // Filter organizers by COUNTRY match (primary), with city as secondary fallback
    const eligible = allProfiles.filter(profile => {
      const profileCountry = (profile.country || '').toLowerCase().trim();
      const profileCity = (profile.city || '').toLowerCase().trim();

      // Primary: country-to-country match
      const countryMatch = profileCountry && bookingCountry &&
        (profileCountry === bookingCountry ||
          profileCountry.includes(bookingCountry) ||
          bookingCountry.includes(profileCountry));

      // Secondary: city match (if no country stored on profile)
      const cityMatch = !profileCountry && profileCity && bookingCity &&
        (profileCity === bookingCity ||
          profileCity.includes(bookingCity) ||
          bookingCity.includes(profileCity));

      if (!countryMatch && !cityMatch) return false;

      // Genre match: if organizer has preferred genres, at least one must match
      if (profile.preferred_genres && profile.preferred_genres.length > 0 && artistGenres.length > 0) {
        const orgGenres = profile.preferred_genres.map(g => g.toLowerCase());
        const hasMatch = artistGenres.some(ag => orgGenres.includes(ag));
        if (!hasMatch) return false;
      }

      return true;
    });

    if (!eligible.length) {
      return Response.json({ success: true, notified: 0, reason: 'No organizers matched location/genre' });
    }

    const artistName = booking.artist_name || artist?.display_name || 'An artist';
    const locationDisplay = [booking.city, booking.country].filter(Boolean).join(', ') || booking.venue || 'your region';
    const dateDisplay = eventDate
      ? new Date(eventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'an upcoming date';

    let notified = 0;

    await Promise.all(eligible.map(async (profile) => {
      const artistUrl = `${Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com'}/artists/${artistId}`;

      // In-app notification
      await base44.asServiceRole.entities.Notification.create({
        user_email: profile.organizer_email,
        title: `🎵 ${artistName} is booked in your region`,
        message: `${artistName} has been booked in ${locationDisplay} on ${dateDisplay}. They may be available for additional bookings during their stay!`,
        type: 'general',
        link: `/artists/${artistId}`,
      }).catch(() => {});

      // Email notification
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: profile.organizer_email,
        subject: `🎵 Artist Opportunity: ${artistName} is coming to ${locationDisplay}`,
        body: `Hi ${profile.full_name || profile.business_name || 'there'},

${artistName} has just been booked in ${locationDisplay} on ${dateDisplay}.

Since you're organizing events in the same region, this could be a great opportunity to book this artist during their stay — potentially at a reduced travel cost!

Artist: ${artistName}
Location: ${locationDisplay}
Event Date: ${dateDisplay}${artistGenres.length ? `\nGenre(s): ${artistGenres.join(', ')}` : ''}

👉 View Artist Profile: ${artistUrl}

---
You're receiving this because you have artist availability notifications enabled.
To opt out, go to your Organizer Profile → Notification Preferences and disable "Receive artist availability notifications".`,
      }).catch(() => {});

      notified++;
    }));

    return Response.json({ success: true, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});