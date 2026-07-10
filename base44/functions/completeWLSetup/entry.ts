import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Called when an invited White Label Partner finishes their setup form.
// Assigns the correct "white_label" role to the accepting user's account (service role,
// since users cannot change their own role). Verifies the caller's email matches the
// invited WhiteLabel record's email before granting the role.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { wl_id } = await req.json();
    if (!wl_id) return Response.json({ error: 'wl_id is required' }, { status: 400 });

    const wl = await base44.asServiceRole.entities.WhiteLabel.get(wl_id).catch(() => null);
    if (!wl) return Response.json({ error: 'White Label record not found' }, { status: 404 });

    if ((wl.email || '').toLowerCase() !== (user.email || '').toLowerCase()) {
      return Response.json({ error: 'This invite does not belong to your account' }, { status: 403 });
    }

    // Don't downgrade admins — everything else becomes white_label
    if (user.role !== 'admin' && user.role !== 'white_label') {
      await base44.asServiceRole.entities.User.update(user.id, {
        role: wl.parent_wl_id ? 'sub_white_label' : 'white_label',
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});