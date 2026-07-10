import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Public people search — matches Organizers, Artists, and opted-in public Fans by name.
// Used by the Home/Search "Find Your Night" search to route directly to a profile.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { query } = await req.json();
    const q = (query || "").trim().toLowerCase();
    if (q.length < 2) return Response.json({ people: [] });

    const [orgUsers, orgProfiles, artists, fanUsers] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ role: "organizer" }, null, 500).catch(() => []),
      base44.asServiceRole.entities.OrganizerProfile.list(null, 500).catch(() => []),
      base44.asServiceRole.entities.Artist.filter({ status: "active", approval_status: "approved" }, null, 500).catch(() => []),
      base44.asServiceRole.entities.User.filter({ role: "user", is_public_profile: true }, null, 500).catch(() => []),
    ]);

    const people = [];

    // Organizers — one entry per organizer user, preferring profile data
    const orgUserIds = new Set(orgUsers.map(u => String(u.id)));
    const profileByOrgId = {};
    for (const p of orgProfiles) {
      const oid = p.organizer_id ? String(p.organizer_id) : null;
      if (oid && orgUserIds.has(oid)) profileByOrgId[oid] = p;
    }
    for (const u of orgUsers) {
      const uid = String(u.id);
      const profile = profileByOrgId[uid];
      const name = profile?.business_name || profile?.full_name || u.full_name || "";
      if (name.toLowerCase().includes(q)) {
        people.push({
          type: "organizer",
          id: uid,
          name,
          subtitle: profile?.city ? `${profile.city}${profile.country ? ", " + profile.country : ""}` : "Organizer",
          image: profile?.profile_image || "",
          href: `/organizers/${uid}`,
          exact: name.toLowerCase() === q,
        });
      }
    }

    // Artists
    for (const a of artists) {
      const name = a.display_name || "";
      if (name.toLowerCase().includes(q)) {
        people.push({
          type: "artist",
          id: a.id,
          name,
          subtitle: a.genre ? a.genre.replace(/_/g, " ") : "Artist",
          image: a.profile_image || "",
          href: `/artists/${a.id}`,
          exact: name.toLowerCase() === q,
        });
      }
    }

    // Public fans only
    for (const f of fanUsers) {
      const name = f.full_name || "";
      if (name.toLowerCase().includes(q)) {
        people.push({
          type: "fan",
          id: f.id,
          name,
          subtitle: "Fan",
          image: "",
          href: `/fans/${f.id}`,
          exact: name.toLowerCase() === q,
        });
      }
    }

    return Response.json({ people: people.slice(0, 20) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});