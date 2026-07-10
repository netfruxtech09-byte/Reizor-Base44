import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch users with role "organizer" (service role to bypass RLS on User entity)
    const users = await base44.asServiceRole.entities.User.filter({ role: "organizer" }, null, 500).catch(() => []);

    // Fetch OrganizerProfile records (publicly readable — use service role for unauthenticated guests)
    const profiles = await base44.asServiceRole.entities.OrganizerProfile.list(null, 500).catch(() => []);

    // Build set of valid organizer user IDs — the single source of truth
    const organizerUserIds = new Set(users.map(u => String(u.id)));

    // Only include profiles whose organizer_id matches a current organizer user.
    // Do NOT match by email — a single user can have multiple stale profiles with
    // different organizer_id values, causing ghost/duplicate entries.
    const profileMap = {};
    for (const p of profiles) {
      const oid = p.organizer_id ? String(p.organizer_id) : null;
      if (oid && organizerUserIds.has(oid)) {
        // If multiple profiles exist for the same organizer_id, prefer the one
        // with richer data (non-empty business_name, city, etc.)
        const existing = profileMap[oid];
        if (!existing || (p.business_name && !existing.business_name) || (p.city && !existing.city)) {
          profileMap[oid] = p;
        }
      }
    }

    const result = [];
    const seen = new Set();

    // Add profiles that belong to current organizers (by user ID)
    for (const p of profiles) {
      const oid = String(p.organizer_id || "");
      if (!oid || seen.has(oid)) continue;
      if (!profileMap[oid]) continue; // skip profiles from non-organizers
      seen.add(oid);
      result.push({
        organizer_id: oid,
        business_name: p.business_name || p.full_name || "",
        full_name: p.full_name || "",
        profile_image: p.profile_image || "",
        city: p.city || "",
        country: p.country || "",
        id: p.id,
      });
    }

    // Add users with role "organizer" who don't have a profile
    for (const u of users) {
      const uid = String(u.id || "");
      if (seen.has(uid)) continue;
      seen.add(uid);
      result.push({
        organizer_id: uid,
        business_name: u.full_name || "",
        full_name: u.full_name || "",
        profile_image: "",
        city: "",
        country: "",
        id: null,
      });
    }

    return Response.json({ organizers: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});