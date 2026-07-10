import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      transfer_id,
      original_ticket_id,
      new_ticket_code,
      new_owner_email,
      new_owner_name,
      event_id,
      event_title,
      ticket_type_id,
      ticket_type_name,
      order_id,
      price_paid,
    } = await req.json();

    // Fetch transfer by id (built-in field — must use list+find since filter() only works on custom fields)
    const allTransfers = await base44.asServiceRole.entities.TicketTransfer.filter({ original_ticket_id }, null, 10);
    const transfer = allTransfers.find(t => t.id === transfer_id);
    if (!transfer) return Response.json({ error: 'Transfer not found' }, { status: 404 });
    if (transfer.status !== 'pending') return Response.json({ error: 'Transfer already processed' }, { status: 400 });
    if (transfer.to_email !== user.email.toLowerCase() && transfer.to_email !== user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (new Date(transfer.expires_at) < new Date()) {
      return Response.json({ error: 'Transfer expired' }, { status: 400 });
    }

    // Block transfer of loyalty reward tickets
    const originalTickets = await base44.asServiceRole.entities.Ticket.filter(
      { id: original_ticket_id }, null, 1
    ).catch(() => []);
    if (originalTickets[0]?.purchased_with_loyalty) {
      return Response.json({ error: 'Reward tickets cannot be transferred' }, { status: 400 });
    }

    // 1. Create new ticket for recipient with fresh code
    await base44.asServiceRole.entities.Ticket.create({
      ticket_code: new_ticket_code,
      event_id,
      event_title,
      ticket_type_id,
      ticket_type_name,
      order_id,
      owner_email: new_owner_email,
      owner_name: new_owner_name,
      price_paid: price_paid || 0,
      status: 'active',
      qr_data: new_ticket_code,
    });

    // 2. Mark original ticket as permanently transferred (invalidated)
    await base44.asServiceRole.entities.Ticket.update(original_ticket_id, {
      status: 'transferred',
    });

    // 3. Mark transfer as claimed
    await base44.asServiceRole.entities.TicketTransfer.update(transfer_id, {
      status: 'claimed',
    });

    return Response.json({ success: true, new_ticket_code });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});