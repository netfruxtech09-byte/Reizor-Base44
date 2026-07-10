import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {
      ticket_listing_id,
      ticket_id,
      resale_transaction_id,
      buyer_email,
      buyer_name,
      seller_email,
      seller_name,
      listing_price,
      platform_fee,
      buyer_total,
      event_id,
      event_title,
    } = await req.json();

    if (!ticket_listing_id || !ticket_id || !buyer_email || !seller_email) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── 1. GENERATE NEW TICKET FOR BUYER ──
    const oldTicket = (await base44.asServiceRole.entities.Ticket.filter({ id: ticket_id }, null, 1).catch(() => []))[0];
    if (!oldTicket) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const newTicketCode = `TKT-RESALE-${ticket_id.slice(-6).toUpperCase()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const newQrData = newTicketCode;

    const newTicket = await base44.asServiceRole.entities.Ticket.create({
      ticket_code: newTicketCode,
      event_id: oldTicket.event_id,
      event_title: oldTicket.event_title,
      ticket_type_id: oldTicket.ticket_type_id,
      ticket_type_name: oldTicket.ticket_type_name,
      order_id: oldTicket.order_id,
      owner_email: buyer_email,
      owner_name: buyer_name,
      price_paid: buyer_total,
      qr_data: newQrData,
      status: 'active',
      is_resale: true,
      resale_original_price: oldTicket.price_paid || listing_price,
    }).catch(err => {
      console.error('Failed to create replacement ticket:', err.message);
      throw err;
    });

    // ── 2. MARK OLD TICKET AS TRANSFERRED ──
    await base44.asServiceRole.entities.Ticket.update(ticket_id, {
      status: 'transferred',
      replaced_by_resale: true,
      replacement_ticket_id: newTicket.id,
      resale_transaction_id: resale_transaction_id,
      owner_email: `TRANSFERRED_${Date.now()}@resale.internal`,
    }).catch(err => console.error('Failed to mark old ticket as transferred:', err.message));

    // ── 3. CREDIT SELLER RESALE WALLET ──
    const existingBalance = (await base44.asServiceRole.entities.ResaleSellerBalance.filter({ seller_email }, null, 1).catch(() => []))[0];

    if (existingBalance) {
      await base44.asServiceRole.entities.ResaleSellerBalance.update(existingBalance.id, {
        available_balance: (existingBalance.available_balance || 0) + listing_price,
        total_earned: (existingBalance.total_earned || 0) + listing_price,
        last_transaction_date: new Date().toISOString(),
      }).catch(err => console.error('Failed to update balance:', err.message));
    } else {
      await base44.asServiceRole.entities.ResaleSellerBalance.create({
        seller_email,
        seller_name,
        available_balance: listing_price,
        total_earned: listing_price,
        last_transaction_date: new Date().toISOString(),
      }).catch(err => console.error('Failed to create balance record:', err.message));
    }

    // ── 4. CREATE WALLET TRANSACTION RECORD ──
    await base44.asServiceRole.entities.ResaleWalletTransaction.create({
      seller_email,
      seller_name,
      transaction_type: 'credit',
      amount: listing_price,
      resale_transaction_id,
      ticket_id,
      event_id,
      event_title,
      buyer_email,
      buyer_name,
      listing_price,
      platform_fee,
      description: `Ticket Resale — ${event_title}`,
      status: 'completed',
    }).catch(err => console.error('Failed to create wallet transaction:', err.message));

    // ── 5. SEND NOTIFICATIONS ──
    Promise.all([
      // Notify seller of balance credit
      base44.asServiceRole.integrations.Core.SendEmail({
        to: seller_email,
        subject: `💰 Resale Balance Credited — ${event_title}`,
        body: `Hi ${seller_name},\n\nYour ticket to ${event_title} has been sold!\n\nCredited to your resale wallet: $${listing_price.toFixed(2)}\n\nYou can request a payout anytime from your resale earnings page.\n\nView your balance: /my-tickets (Resale Earnings)\n\nThank you for selling on Reizor!`,
      }).catch(() => {}),

      // Notify buyer of replacement ticket
      base44.asServiceRole.integrations.Core.SendEmail({
        to: buyer_email,
        subject: `✅ Resale Ticket Confirmed — ${event_title}`,
        body: `Hi ${buyer_name},\n\nYour resale ticket purchase is confirmed!\n\nNew Ticket Code: ${newTicketCode}\nEvent: ${event_title}\nTotal Paid: $${buyer_total.toFixed(2)}\n\nPresent this code at the door or view it in your account at /my-tickets\n\nSee you at the event! 🎉`,
      }).catch(() => {}),

      // Notify admin
      base44.asServiceRole.integrations.Core.SendEmail({
        to: 'admin@reizor.com',
        subject: `Resale Transaction Completed — ${event_title}`,
        body: `Resale transaction completed:\n\nEvent: ${event_title}\nSeller: ${seller_name} (${seller_email})\nBuyer: ${buyer_name} (${buyer_email})\nListing Price: $${listing_price.toFixed(2)}\nPlatform Fee: $${platform_fee.toFixed(2)}\nBuyer Total: $${buyer_total.toFixed(2)}\n\nSeller wallet credited: $${listing_price.toFixed(2)}\nOld Ticket ID: ${ticket_id}\nNew Ticket ID: ${newTicket.id}\nNew Ticket Code: ${newTicketCode}`,
      }).catch(() => {}),
    ]).catch(() => {});

    return Response.json({
      success: true,
      new_ticket_id: newTicket.id,
      new_ticket_code: newTicketCode,
      seller_balance_credited: listing_price,
      message: 'Resale transaction processed and seller wallet credited',
    });
  } catch (error) {
    console.error('Resale completion error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});