import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Checks whether an email can be used to invite a new White Label Partner.
// Blocks: existing User records of ANY role (admin, organizer, artist, fan, white_label,
// sub_white_label, manager, vendor) and existing non-cancelled/expired WhiteLabel invites.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { email, excludeWlId } = await req.json();
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) return Response.json({ error: 'email is required' }, { status: 400 });

    // Check existing users of any role (admin, organizer, artist, fan, white_label, etc.)
    const allUsers = await base44.asServiceRole.entities.User.list(null, 2000).catch(() => []);
    const existingUser = allUsers.find(u => (u.email || '').trim().toLowerCase() === normalized);
    if (existingUser) {
      return Response.json({
        available: false,
        reason: 'user_exists',
        message: 'This email is already registered. Please use a different email address.',
      });
    }

    // Check existing pending/active WhiteLabel invites for this email
    const wls = await base44.asServiceRole.entities.WhiteLabel.filter({ email: normalized }, null, 20).catch(() => []);
    const activeInvite = wls.find(w => w.id !== excludeWlId && w.signup_status !== 'cancelled' && w.signup_status !== 'expired');
    if (activeInvite) {
      return Response.json({
        available: false,
        reason: 'pending_invite',
        message: 'An active invitation already exists for this email.',
      });
    }

    return Response.json({ available: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});