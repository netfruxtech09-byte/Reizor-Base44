import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { owner_type, owner_id, scan_points } = await req.json();
    if (owner_type !== 'organizer' || !owner_id) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const isAdmin = user.role === 'admin';
    const isOwner = user.role === 'organizer' && user.id === owner_id;
    if (!isAdmin && !isOwner) {
      return Response.json({ error: 'Not authorized to update this loyalty program.' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const programs = await svc.entities.LoyaltyProgram.filter({ owner_type, owner_id }, 'created_date', 1);
    let program = programs[0];

    const update = { scan_points: Number(scan_points) || 0 };

    if (program) {
      program = await svc.entities.LoyaltyProgram.update(program.id, update);
    } else {
      program = await svc.entities.LoyaltyProgram.create({
        owner_type,
        owner_id,
        owner_name: user.full_name || user.email,
        status: 'active',
        ...update,
      });
    }

    return Response.json({ success: true, program });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});