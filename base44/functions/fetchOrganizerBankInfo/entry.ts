import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { organizer_id } = await req.json();

    if (!organizer_id) {
      return Response.json({ error: 'organizer_id is required' }, { status: 400 });
    }

    const bankInfos = await base44.asServiceRole.entities.OrganizerBankInfo.filter(
      { organizer_id },
      null,
      1
    );

    if (!bankInfos.length) {
      return Response.json({ error: 'No bank info found' }, { status: 404 });
    }

    return Response.json({ bank_info: bankInfos[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});