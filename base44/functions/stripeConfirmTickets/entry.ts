// Called by frontend after stripe.confirmPayment() succeeds
// Immediately fulfills the order so tickets appear in My Tickets right away.
// The webhook is a backup for reliability — idempotency prevents duplicates.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

  const body = await req.json();
  const { paymentIntentId, orderId } = body;

  if (!paymentIntentId || !orderId) {
    return Response.json({ error: 'Missing paymentIntentId or orderId' }, { status: 400 });
  }

  // Verify payment status with Stripe
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== 'succeeded') {
    return Response.json({ error: `Payment not succeeded. Status: ${pi.status}` }, { status: 400 });
  }

  // Load order
  const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId }, null, 1);
  const order = orders[0];
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

  // Already completed — return success (idempotent)
  if (order.status === 'completed') {
    return Response.json({ success: true, orderId, alreadyCompleted: true });
  }

  const meta = pi.metadata || {};
  const isTable = meta.type === 'table';

  if (isTable) {
    // Fulfill table reservation
    await base44.asServiceRole.entities.Order.update(orderId, {
      status: 'completed',
      stripe_payment_status: 'paid',
      stripe_payment_intent_id: pi.id,
      stripe_charge_id: pi.latest_charge || '',
      paid_at: new Date().toISOString(),
    });

    const existingRes = await base44.asServiceRole.entities.TableReservation.filter({ order_id: orderId }, null, 1).catch(() => []);
    if (!existingRes[0]) {
      await base44.asServiceRole.entities.TableReservation.create({
        table_id: meta.table_id,
        event_id: meta.event_id,
        order_id: orderId,
        buyer_email: meta.buyer_email,
        buyer_name: meta.buyer_name,
        table_name: meta.table_name || '',
        status: 'reserved',
        platform_fee: parseFloat(meta.platform_fee || '0'),
        stripe_payment_intent_id: pi.id,
      }).catch(() => {});
    }

    return Response.json({ success: true, orderId, type: 'table' });
  }

  // Fulfill tickets
  const guestNames = JSON.parse(meta.guest_names || '[]');
  const buyerEmail = meta.buyer_email || order.customer_email;
  const buyerName = meta.buyer_name || order.customer_name;
  const orderItemsMeta = meta.items ? JSON.parse(meta.items) : [];

  // Idempotency: check if tickets already exist
  const existingTickets = await base44.asServiceRole.entities.Ticket.filter({ order_id: orderId }, null, 1).catch(() => []);

  if (existingTickets.length === 0 && orderItemsMeta.length > 0) {
    let guestIdx = 0;
    for (const item of orderItemsMeta) {
      for (let i = 0; i < item.quantity; i++) {
        const guestName = guestNames[guestIdx] || buyerName;
        guestIdx++;
        const ticketCode = `TKT-${orderId.slice(-6).toUpperCase()}-${guestIdx}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        await base44.asServiceRole.entities.Ticket.create({
          ticket_code: ticketCode,
          event_id: meta.event_id,
          event_title: order.event_title,
          order_id: orderId,
          ticket_type_id: item.ticket_type_id,
          ticket_type_name: item.ticket_type_name,
          owner_email: buyerEmail,
          owner_name: buyerName,
          guest_name: guestName,
          guest_phone: meta.guest_phone || '',
          price_paid: item.unit_price,
          status: 'active',
          qr_data: ticketCode,
          paid_with_credit: parseFloat(meta.credit_applied || '0') > 0,
        });
      }
      // Update ticket inventory
      const ttArr = await base44.asServiceRole.entities.TicketType.filter({ id: item.ticket_type_id }, null, 1).catch(() => []);
      const tt = ttArr[0];
      if (tt) {
        await base44.asServiceRole.entities.TicketType.update(item.ticket_type_id, {
          quantity_sold: (tt.quantity_sold || 0) + item.quantity,
        }).catch(() => {});
      }
    }

    const totalQty = orderItemsMeta.reduce((s, i) => s + i.quantity, 0);
    const evArr = await base44.asServiceRole.entities.Event.filter({ id: meta.event_id }, null, 1).catch(() => []);
    if (evArr[0]) {
      await base44.asServiceRole.entities.Event.update(meta.event_id, {
        tickets_sold: (evArr[0].tickets_sold || 0) + totalQty,
      }).catch(() => {});
    }
  }

  await base44.asServiceRole.entities.Order.update(orderId, {
    status: 'completed',
    stripe_payment_status: 'paid',
    stripe_payment_intent_id: pi.id,
    stripe_charge_id: pi.latest_charge || '',
    paid_at: new Date().toISOString(),
  });

  // ── Update SellerLink stats if this order came through a seller tracking link ──
  const sellerCode = meta.seller_code || order.seller_link_code || '';
  if (sellerCode) {
    const sellerLinks = await base44.asServiceRole.entities.SellerLink.filter(
      { tracking_code: sellerCode.toUpperCase() },
      null, 1
    ).catch(() => []);
    const sellerLink = sellerLinks[0];
    if (sellerLink) {
      const totalQty = orderItemsMeta.reduce((s, i) => s + i.quantity, 0) || order.quantity || 0;
      const revenue = parseFloat(meta.grand_total || order.total || 0);
      const commission = (() => {
        if (!sellerLink.commission_type || sellerLink.commission_type === 'none') return 0;
        if (sellerLink.commission_type === 'fixed') return (sellerLink.commission_value || 0) * totalQty;
        if (sellerLink.commission_type === 'percentage') return parseFloat(((sellerLink.commission_value || 0) / 100 * revenue).toFixed(2));
        return 0;
      })();
      await base44.asServiceRole.entities.SellerLink.update(sellerLink.id, {
        tickets_sold: (sellerLink.tickets_sold || 0) + totalQty,
        total_revenue: parseFloat(((sellerLink.total_revenue || 0) + revenue).toFixed(2)),
        commission_earned: parseFloat(((sellerLink.commission_earned || 0) + commission).toFixed(2)),
        last_sale_date: new Date().toISOString(),
      }).catch(() => {});
      // Also save seller_link_id on the order for drill-down queries
      await base44.asServiceRole.entities.Order.update(orderId, {
        seller_link_id: sellerLink.id,
        seller_tracking_code: sellerCode.toUpperCase(),
      }).catch(() => {});
    }
  }

  return Response.json({ success: true, orderId, type: 'tickets' });
});