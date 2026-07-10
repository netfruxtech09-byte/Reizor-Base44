import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ACTIONS = ['approve', 'reject', 'deactivate', 'reactivate', 'delete'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });

    const { activity_id, action, approved_points, admin_notes } = await req.json();
    if (!activity_id || !ACTIONS.includes(action)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const activity = await svc.entities.CustomEarningActivity.get(activity_id).catch(() => null);
    if (!activity) return Response.json({ error: 'Activity not found' }, { status: 404 });

    if (action === 'delete') {
      await svc.entities.CustomEarningActivity.delete(activity_id);
      return Response.json({ success: true });
    }

    const update = {
      reviewed_by: user.email,
      reviewed_at: new Date().toISOString(),
    };
    if (admin_notes !== undefined) update.admin_notes = admin_notes;

    if (action === 'approve') {
      update.status = 'approved';
      update.approved_points = approved_points !== undefined ? Number(approved_points) : activity.proposed_points;
    } else if (action === 'reject') {
      update.status = 'rejected';
    } else if (action === 'deactivate') {
      update.status = 'deactivated';
    } else if (action === 'reactivate') {
      update.status = 'approved';
    }

    const updated = await svc.entities.CustomEarningActivity.update(activity_id, update);

    await svc.entities.Notification.create({
      user_email: activity.owner_email,
      title: `Custom Loyalty Activity ${update.status === 'approved' ? 'Approved ✅' : update.status === 'rejected' ? 'Rejected ❌' : 'Updated'}`,
      message: `Your custom earning activity "${activity.activity_name}" was ${update.status}.${update.status === 'approved' ? ` It now awards ${update.approved_points} points per verified action.` : ''}`,
      type: 'general',
    }).catch(() => {});

    return Response.json({ success: true, activity: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});