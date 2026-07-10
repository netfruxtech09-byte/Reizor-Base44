import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });
const PENDING_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

async function recordStatusChange(base44, orderId, newStatus, pendingReason, changedBy) {
  const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId }, null, 1);
  const order = orders[0];
  if (!order) return;
  
  const newHistory = [...(order.status_history || []), {
    status: newStatus,
    pending_reason: pendingReason || null,
    changed_at: new Date().toISOString(),
    changed_by: changedBy || 'system'
  }];
  
  await base44.asServiceRole.entities.Order.update(orderId, {
    status_history: newHistory,
    status_updated_at: new Date().toISOString(),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  // Only admins can trigger manual reconciliation; scheduled automation is service-role
  const isManualTrigger = !!user;
  if (isManualTrigger && user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const pendingOrders = await base44.asServiceRole.entities.Order.filter(
    { status: 'pending' },
    '-pending_since',
    500
  ).catch(() => []);

  console.log(`Reconciling ${pendingOrders.length} pending orders...`);

  const results = {
    checked: 0,
    auto_completed: 0,
    auto_failed: 0,
    auto_expired: 0,
    still_pending: 0,
    errors: []
  };

  for (const order of pendingOrders) {
    try {
      results.checked++;
      const pendingSinceTime = order.pending_since ? new Date(order.pending_since).getTime() : order.created_date ? new Date(order.created_date).getTime() : 0;
      const timePending = now.getTime() - pendingSinceTime;
      const isExpired = timePending > PENDING_TIMEOUT_MS;

      // Recheck Stripe
      let stripeStatus = null;
      let stripePaid = false;
      let stripeFailed = false;

      if (order.stripe_payment_intent_id) {
        try {
          const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
          stripeStatus = pi.status; // requires_payment_method, requires_confirmation, requires_action, processing, succeeded, canceled
          stripePaid = pi.status === 'succeeded';
          stripeFailed = pi.status === 'canceled';
        } catch (err) {
          console.error(`Failed to check PI ${order.stripe_payment_intent_id}:`, err.message);
          results.errors.push({ order_id: order.id, error: `PI check failed: ${err.message}` });
        }
      } else if (order.stripe_session_id) {
        try {
          const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
          stripeStatus = session.payment_status; // paid, unpaid, no_payment_required
          stripePaid = session.payment_status === 'paid';
        } catch (err) {
          console.error(`Failed to check session ${order.stripe_session_id}:`, err.message);
          results.errors.push({ order_id: order.id, error: `Session check failed: ${err.message}` });
        }
      }

      // Auto-complete if Stripe shows paid
      if (stripePaid) {
        console.log(`[AUTO-COMPLETE] Order ${order.order_number}: Stripe confirmed payment succeeded`);
        
        // Verify tickets not already created (idempotency)
        const existingTickets = await base44.asServiceRole.entities.Ticket.filter(
          { order_id: order.id },
          null,
          1
        ).catch(() => []);

        if (existingTickets.length === 0) {
          // Create tickets based on order items
          const orderItems = order.items || [];
          for (const item of orderItems) {
            for (let i = 0; i < item.quantity; i++) {
              const ticketCode = `TKT-${order.id.slice(-6).toUpperCase()}-${i + 1}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
              await base44.asServiceRole.entities.Ticket.create({
                ticket_code: ticketCode,
                event_id: order.event_id,
                event_title: order.event_title,
                order_id: order.id,
                ticket_type_id: item.ticket_type_id,
                ticket_type_name: item.ticket_type_name,
                owner_email: order.customer_email,
                owner_name: order.customer_name,
                price_paid: item.unit_price,
                status: 'active',
                qr_data: ticketCode,
              }).catch(err => console.error('Ticket creation failed:', err.message));
            }
          }

          // Update event tickets_sold
          const events = await base44.asServiceRole.entities.Event.filter({ id: order.event_id }, null, 1).catch(() => []);
          if (events[0]) {
            const totalQty = orderItems.reduce((s, i) => s + (i.quantity || 0), 0);
            await base44.asServiceRole.entities.Event.update(order.event_id, {
              tickets_sold: (events[0].tickets_sold || 0) + totalQty,
            }).catch(() => {});
          }
        }

        await base44.asServiceRole.entities.Order.update(order.id, {
          status: 'completed',
          stripe_payment_status: 'paid',
          paid_at: new Date().toISOString(),
          reconciliation_status: 'auto_completed',
          last_payment_check_at: new Date().toISOString(),
        });
        await recordStatusChange(base44, order.id, 'completed', null, 'reconciliation:stripe_verified');
        results.auto_completed++;
      }
      // Auto-fail if Stripe shows failed/canceled
      else if (stripeFailed) {
        console.log(`[AUTO-FAIL] Order ${order.order_number}: Stripe confirmed payment failed/canceled`);
        await base44.asServiceRole.entities.Order.update(order.id, {
          status: 'failed',
          stripe_payment_status: 'failed',
          reconciliation_status: 'verified_with_stripe',
          last_payment_check_at: new Date().toISOString(),
        });
        await recordStatusChange(base44, order.id, 'failed', null, 'reconciliation:stripe_failed');
        results.auto_failed++;
      }
      // Auto-expire if unpaid and timed out
      else if (isExpired && !stripePaid) {
        console.log(`[AUTO-EXPIRE] Order ${order.order_number}: Unpaid for > 24 hours`);
        await base44.asServiceRole.entities.Order.update(order.id, {
          status: 'expired',
          reconciliation_status: 'verified_with_stripe',
          last_payment_check_at: new Date().toISOString(),
          expired_at: new Date().toISOString(),
        });
        await recordStatusChange(base44, order.id, 'expired', null, 'reconciliation:timeout');
        results.auto_expired++;
      }
      // Still processing
      else {
        await base44.asServiceRole.entities.Order.update(order.id, {
          last_payment_check_at: new Date().toISOString(),
          reconciliation_status: 'verified_with_stripe',
        });
        results.still_pending++;
      }
    } catch (err) {
      console.error(`Error reconciling order ${order.id}:`, err.message);
      results.errors.push({ order_id: order.id, error: err.message });
    }
  }

  console.log('Reconciliation complete:', results);
  return Response.json(results);
});