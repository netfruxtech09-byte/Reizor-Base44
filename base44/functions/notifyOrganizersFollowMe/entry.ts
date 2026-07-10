/**
 * Follow Me — notify all organizers in the same country as the artist
 * that the artist is available and looking for bookings.
 *
 * Payload:
 *   { artist_id: string, country?: string }  (country is optional; we look it up from the Artist record)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { artist_id, country: payloadCountry } = await req.json();
  if (!artist_id) return Response.json({ error: 'artist_id required' }, { status: 400 });

  // Load artist record
  const artists = await base44.entities.Artist.filter({ id: artist_id }, null, 1).catch(() => []);
  const artist = artists[0];
  if (!artist) return Response.json({ error: 'Artist not found' }, { status: 404 });

  // Resolve country: payload > artist profile > fallback error
  const country = (payloadCountry || artist.country || artist.location_country || '').trim();
  if (!country) {
    return Response.json({ error: 'Artist country not available — please update your profile location.' }, { status: 400 });
  }

  const artistName = artist.display_name || artist.name || 'An artist';

  // Find all organizer users
  const allUsers = await base44.asServiceRole.entities.User.list(null, 500).catch(() => []);
  const organizers = allUsers.filter(u => u.role === 'organizer' || u.role === 'admin');

  // Also find organizer profiles that have country info
  const orgProfiles = await base44.asServiceRole.entities.OrganizerProfile.list(null, 500).catch(() => []);
  const profileByEmail = {};
  orgProfiles.forEach(p => { if (p.email) profileByEmail[p.email] = p; });

  // Filter organizers by country (case-insensitive, partial match)
  const countryLower = country.toLowerCase();
  const targeted = organizers.filter(u => {
    // Check organizer profile country
    const profile = profileByEmail[u.email];
    const orgCountry = (profile?.country || profile?.city || u.country || '').toLowerCase();
    return orgCountry.includes(countryLower) || countryLower.includes(orgCountry.split(',')[0]?.trim() || '___');
  });

  // If no profile country match found, notify ALL organizers as fallback
  const recipients = targeted.length > 0 ? targeted : organizers;

  const notifTitle = `📍 Artist Available: ${artistName} is in ${country}`;
  const notifMessage = `${artistName} has activated Follow Me from ${country}. They are actively seeking bookings — reach out now to book them for your next event!`;

  // Create notifications in parallel (batch of 20)
  const chunks = [];
  for (let i = 0; i < recipients.length; i += 20) chunks.push(recipients.slice(i, i + 20));

  let created = 0;
  for (const chunk of chunks) {
    await Promise.all(chunk.map(u =>
      base44.asServiceRole.entities.Notification.create({
        user_email: u.email,
        title: notifTitle,
        message: notifMessage,
        type: 'general',
        link: `/artists/${artist_id}`,
      }).catch(() => null)
    ));
    created += chunk.length;
  }

  return Response.json({ success: true, notified: created, country });
});