import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'organizer'].includes(user.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { orderId, reason } = await req.json();
  if (!orderId) return Response.json({ error: 'Missing orderId' }, { status: 400 });

  const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId }, null, 1);
  const order = orders[0];
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
  if (order.status === 'refunded') return Response.json({ error: 'Already refunded' }, { status: 400 });
  if (order.status !== 'completed') return Response.json({ error: 'Can only refund completed orders' }, { status: 400 });

  const now = new Date().toISOString();

  // Mark as refund requested
  await base44.asServiceRole.entities.Order.update(orderId, {
    status: 'pending',
    pending_reason: 'refund_requested',
    pending_since: now,
    refund_requested_at: now,
    refund_request_reason: reason || '',
    status_updated_at: now,
  });

  let stripeRefundId = '';
  const refundedAt = new Date().toISOString();

  // Return wallet portion if hybrid or wallet payment
  if ((order.payment_method === 'wallet' || order.payment_method === 'hybrid') && order.wallet_amount_paid > 0) {
    const walletRecords = await base44.asServiceRole.entities.ResaleSellerBalance.filter({ seller_email: order.customer_email }, null, 1).catch(() => []);
    if (walletRecords[0]) {
      await base44.asServiceRole.entities.ResaleSellerBalance.update(walletRecords[0].id, {
        available_balance: (walletRecords[0].available_balance || 0) + order.wallet_amount_paid,
        last_transaction_date: refundedAt,
      });
      // Create wallet transaction record for refund
      await base44.asServiceRole.entities.ResaleWalletTransaction.create({
        seller_email: order.customer_email,
        seller_name: order.customer_name,
        transaction_type: 'credit',
        amount: order.wallet_amount_paid,
        event_id: order.event_id,
        event_title: order.event_title,
        description: `Refund - Order ${order.order_number}`,
        status: 'completed',
      });
    }
  }

  // Issue Stripe refund only for the Stripe-paid portion (if any)
  if (order.stripe_amount_paid > 0 && order.stripe_payment_intent_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
      if (pi.latest_charge) {
        const refund = await stripe.refunds.create({
          charge: pi.latest_charge,
          reason: 'requested_by_customer',
        });
        stripeRefundId = refund.id;
      }
    } catch (err) {
      console.error('Stripe refund failed:', err.message);
      // Keep order in refund_requested state — admin can retry
      return Response.json({ error: `Stripe refund failed: ${err.message}` }, { status: 500 });
    }
  }

  // Mark as refunded only after both wallet and Stripe are handled
  await base44.asServiceRole.entities.Order.update(orderId, {
    status: 'refunded',
    stripe_payment_status: 'refunded',
    stripe_refund_id: stripeRefundId || '',
    refunded_by: user.full_name || user.role,
    refunded_by_email: user.email,
    refunded_at: refundedAt,
    refund_reason: reason || '',
    status_updated_at: refundedAt,
  });

  // Add to history
  const history = [...(order.status_history || [])];
  history.push({ status: 'pending', pending_reason: 'refund_requested', changed_at: now, changed_by: user.email });
  history.push({ status: 'refunded', pending_reason: null, changed_at: refundedAt, changed_by: user.email });
  await base44.asServiceRole.entities.Order.update(orderId, { status_history: history }).catch(() => {});

  // Cancel related tickets
  const tickets = await base44.asServiceRole.entities.Ticket.filter({ order_id: orderId }).catch(() => []);
  for (const t of tickets) {
    await base44.asServiceRole.entities.Ticket.update(t.id, { status: 'refunded' }).catch(() => {});
  }

  // Notify customer
  if (order.customer_email) {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: order.customer_email,
      subject: `Refund Processed — ${order.event_title}`,
      body: `Hi ${order.customer_name},\n\nYour refund for order ${order.order_number} ($${order.total?.toFixed(2)}) has been processed.\n${reason ? `Reason: ${reason}` : ''}\n\nPlease allow 5-10 business days for the funds to appear on your statement.`,
    }).catch(() => {});
  }

  return Response.json({ success: true, stripeRefundId });
});