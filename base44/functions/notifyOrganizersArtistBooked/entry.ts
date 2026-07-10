/**
 * When an artist gets booked, notify organizers in the same country/area
 * that the artist is coming — potential for more bookings.
 *
 * Payload:
 *   { artist_id, artist_name, event_name, event_date, city, country }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { artist_id, artist_name, event_name, event_date, city, country } = await req.json();
  if (!artist_id || !country) return Response.json({ error: 'artist_id and country required' }, { status: 400 });

  const allUsers = await base44.asServiceRole.entities.User.list(null, 500).catch(() => []);
  const organizers = allUsers.filter(u => u.role === 'organizer' || u.role === 'admin');

  const orgProfiles = await base44.asServiceRole.entities.OrganizerProfile.list(null, 500).catch(() => []);
  const profileByEmail = {};
  orgProfiles.forEach(p => { if (p.email) profileByEmail[p.email] = p; });

  const countryLower = (country || '').toLowerCase();
  const cityLower = (city || '').toLowerCase();

  const targeted = organizers.filter(u => {
    const profile = profileByEmail[u.email];
    const orgLocation = (profile?.country || profile?.city || u.country || '').toLowerCase();
    return orgLocation.includes(countryLower) || (cityLower && orgLocation.includes(cityLower));
  });

  const recipients = targeted.length > 0 ? targeted : organizers;

  const dateStr = event_date ? new Date(event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const locationStr = [city, country].filter(Boolean).join(', ');

  const notifTitle = `🎤 ${artist_name || 'An artist'} is coming to ${locationStr}`;
  const notifMessage = `${artist_name} has been booked for "${event_name || 'an event'}"${dateStr ? ` on ${dateStr}` : ''} in ${locationStr}. They'll be in your area — book them for your next event!`;

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

  return Response.json({ success: true, notified: created });
});