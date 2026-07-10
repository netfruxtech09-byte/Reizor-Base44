import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Returns a fan's public profile fields only if they opted in via is_public_profile.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { userId } = await req.json();
    if (!userId) return Response.json({ error: "userId is required" }, { status: 400 });

    const user = await base44.asServiceRole.entities.User.get(userId).catch(() => null);
    if (!user || user.role !== "user" || !user.is_public_profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    return Response.json({
      full_name: user.full_name || "Fan",
      preferred_genres: user.preferred_genres || [],
      created_date: user.created_date,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});