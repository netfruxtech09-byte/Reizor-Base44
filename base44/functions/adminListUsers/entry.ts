import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // The caller's JWT may carry a stale role if they were upgraded to admin
    // mid-session. Verify against the live DB record so a freshly-promoted
    // admin isn't locked out of admin pages until they re-login.
    let isAdmin = user.role === 'admin';
    if (!isAdmin) {
      const fresh = await base44.asServiceRole.entities.User.get(user.id).catch(() => null);
      if (fresh && fresh.role === 'admin') isAdmin = true;
    }
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Use service role to bypass RLS — admins must be able to list all users
    // regardless of token staleness after a role upgrade
    const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);

    return Response.json({ users });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});