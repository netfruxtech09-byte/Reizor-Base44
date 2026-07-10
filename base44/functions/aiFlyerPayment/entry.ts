import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.21.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, eventId } = body;

  // ─────────────────────────────────────────────────────────────
  // check_credit — organizer-level free usage + pending totals
  // ─────────────────────────────────────────────────────────────
  if (action === 'check_credit') {
    const [allCredits, sessions] = await Promise.all([
      base44.asServiceRole.entities.AIFlyerCredit.filter({ organizer_email: user.email }, '-created_date', 100),
      base44.asServiceRole.entities.AIFlyerSession.filter({ organizer_email: user.email }, '-created_date', 50),
    ]);

    const freeUsed = allCredits.some(c => c.type === 'free');

    const openSessions = sessions.filter(s => s.status === 'open' || s.status === 'partially_paid');
    const globalPendingAmount = openSessions.reduce((sum, s) => sum + (s.pending_amount || 0), 0);
    const globalPendingCount = openSessions.reduce((sum, s) => sum + (s.pending_count || 0), 0);

    const crossEventSessions = (eventId && eventId.length > 0)
      ? openSessions.filter(s => s.event_id !== eventId && s.event_id !== '')
      : [];
    const crossEventPendingAmount = crossEventSessions.reduce((sum, s) => sum + (s.pending_amount || 0), 0);
    const crossEventPendingCount = crossEventSessions.reduce((sum, s) => sum + (s.pending_count || 0), 0);

    let eventSession = null;
    if (eventId && eventId.length > 0) {
      const evSessions = openSessions.filter(s => s.event_id === eventId);
      eventSession = evSessions[0] || null;
    }
    if (!eventSession) {
      const tempSessions = openSessions.filter(s => !s.event_id || s.event_id === '');
      eventSession = tempSessions[0] || null;
    }

    // Check if organizer has a saved payment method
    const paymentMethods = await base44.asServiceRole.entities.PaymentMethod.filter(
      { user_email: user.email, status: 'active' }, null, 10
    ).catch(() => []);
    const defaultPM = paymentMethods.find(pm => pm.is_default) || paymentMethods[0] || null;

    return Response.json({
      free_used: freeUsed,
      global_pending_amount: globalPendingAmount,
      global_pending_count: globalPendingCount,
      has_unpaid_balance: globalPendingAmount > 0,
      cross_event_pending_amount: crossEventPendingAmount,
      cross_event_pending_count: crossEventPendingCount,
      has_payment_method: !!defaultPM,
      payment_method_last_four: defaultPM?.card_last_four || null,
      payment_method_brand: defaultPM?.card_brand || null,
      session: eventSession ? {
        id: eventSession.id,
        pending_count: eventSession.pending_count || 0,
        pending_amount: eventSession.pending_amount || 0,
        paid_count: eventSession.paid_count || 0,
      } : null,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // use_free — marks free generation as used (organizer-level)
  // ─────────────────────────────────────────────────────────────
  if (action === 'use_free') {
    const existing = await base44.asServiceRole.entities.AIFlyerCredit.filter(
      { organizer_email: user.email, type: 'free' }, null, 1
    );
    if (existing.length > 0) {
      return Response.json({ success: true, already_used: true });
    }

    await base44.asServiceRole.entities.AIFlyerCredit.create({
      organizer_email: user.email,
      organizer_id: user.id,
      organizer_name: user.full_name || '',
      type: 'free',
      status: 'used',
      amount_paid: 0,
      event_id: eventId || '',
      generation_status: 'succeeded',
      used_at: new Date().toISOString(),
    });

    return Response.json({ success: true });
  }

  // ─────────────────────────────────────────────────────────────
  // save_acknowledgement — saves digital acceptance/e-sign record
  // ─────────────────────────────────────────────────────────────
  if (action === 'save_acknowledgement') {
    const { acknowledgementText, termsVersion } = body;
    const userAgent = req.headers.get('user-agent') || '';

    await base44.asServiceRole.entities.AIFlyerAcknowledgement.create({
      organizer_user_id: user.id,
      organizer_email: user.email,
      organizer_name: user.full_name || '',
      event_id: eventId || '',
      acknowledgement_text: acknowledgementText || '',
      checkbox_checked: true,
      accepted_at: new Date().toISOString(),
      user_agent: userAgent.slice(0, 500),
      terms_version: termsVersion || 'v3',
    });

    return Response.json({ success: true });
  }

  // ─────────────────────────────────────────────────────────────
  // create_payment_intent — creates a Stripe PI for $1 AI flyer charge
  // Returns clientSecret so the frontend can confirm payment
  // ─────────────────────────────────────────────────────────────
  if (action === 'create_payment_intent') {
    const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

    // Create a credit record in pending_payment state first (idempotency)
    const creditRecord = await base44.asServiceRole.entities.AIFlyerCredit.create({
      organizer_email: user.email,
      organizer_id: user.id,
      organizer_name: user.full_name || '',
      type: 'paid',
      status: 'pending_payment',
      amount_paid: 1,
      event_id: eventId || '',
      generation_status: 'pending',
    });

    // Look up saved default payment method
    const paymentMethods = await base44.asServiceRole.entities.PaymentMethod.filter(
      { user_email: user.email, status: 'active' }, null, 5
    ).catch(() => []);
    const defaultPM = paymentMethods.find(pm => pm.is_default) || paymentMethods[0] || null;

    const piParams = {
      amount: 100, // $1.00 in cents
      currency: 'usd',
      receipt_email: user.email,
      metadata: {
        organizer_email: user.email,
        organizer_id: user.id,
        organizer_name: user.full_name || '',
        event_id: eventId || '',
        credit_record_id: creditRecord.id,
        purpose: 'ai_flyer_generation',
      },
    };

    let hasSavedCard = false;
    if (defaultPM?.stripe_payment_method_id && defaultPM?.stripe_customer_id) {
      piParams.payment_method = defaultPM.stripe_payment_method_id;
      piParams.customer = defaultPM.stripe_customer_id;
      hasSavedCard = true;
    }

    const paymentIntent = await stripe.paymentIntents.create(piParams);

    // Store PI id on the credit record
    await base44.asServiceRole.entities.AIFlyerCredit.update(creditRecord.id, {
      stripe_payment_intent_id: paymentIntent.id,
    });

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      creditRecordId: creditRecord.id,
      paymentIntentId: paymentIntent.id,
      hasSavedCard,
      savedCardBrand: defaultPM?.card_brand || null,
      savedCardLastFour: defaultPM?.card_last_four || null,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // confirm_with_saved_card — confirms PI using the saved payment method
  // Returns success or requires_action for 3DS auth
  // ─────────────────────────────────────────────────────────────
  if (action === 'confirm_with_saved_card') {
    const { creditRecordId, paymentIntentId } = body;
    if (!creditRecordId || !paymentIntentId) {
      return Response.json({ error: 'creditRecordId and paymentIntentId required' }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

    // Find the saved payment method
    const paymentMethods = await base44.asServiceRole.entities.PaymentMethod.filter(
      { user_email: user.email, status: 'active' }, null, 5
    ).catch(() => []);
    const defaultPM = paymentMethods.find(pm => pm.is_default) || paymentMethods[0] || null;

    if (!defaultPM?.stripe_payment_method_id) {
      return Response.json({ error: 'No saved payment method found' }, { status: 400 });
    }

    // Confirm server-side with the saved card
    const pi = await stripe.paymentIntents.confirm(paymentIntentId);

    if (pi.status === 'succeeded') {
      await base44.asServiceRole.entities.AIFlyerCredit.update(creditRecordId, {
        status: 'charged',
        stripe_payment_method_id: defaultPM.stripe_payment_method_id,
        stripe_payment_intent_id: paymentIntentId,
        generation_status: 'pending',
        paid_at: new Date().toISOString(),
      });

      return Response.json({
        success: true,
        status: 'succeeded',
        creditRecordId,
      });
    }

    if (pi.status === 'requires_action') {
      return Response.json({
        success: false,
        status: 'requires_action',
        clientSecret: pi.client_secret,
        creditRecordId,
        paymentIntentId,
      });
    }

    // Payment failed or other status
    await base44.asServiceRole.entities.AIFlyerCredit.update(creditRecordId, {
      status: 'payment_failed',
      failure_reason: `Payment intent status: ${pi.status}`,
    });

    await _notifyAdminPaymentFailed(base44, user, creditRecordId, 1, `Payment intent status: ${pi.status}`, eventId || '');

    return Response.json({ error: `Payment ${pi.status}` }, { status: 402 });
  }

  // ─────────────────────────────────────────────────────────────
  // confirm_payment — called after Stripe confirms payment success
  // Marks credit as charged and ready to use for generation
  // ─────────────────────────────────────────────────────────────
  if (action === 'confirm_payment') {
    const { creditRecordId, paymentIntentId, paymentMethodId } = body;
    if (!creditRecordId) return Response.json({ error: 'creditRecordId required' }, { status: 400 });

    const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

    // Verify the payment intent status with Stripe
    let piStatus = 'unknown';
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      piStatus = pi.status;
    } catch (e) {
      // If we can't verify, trust the client for now but log
    }

    if (piStatus !== 'succeeded') {
      // Mark as failed
      await base44.asServiceRole.entities.AIFlyerCredit.update(creditRecordId, {
        status: 'payment_failed',
        failure_reason: `Payment intent status: ${piStatus}`,
      });

      // Notify admins
      await _notifyAdminPaymentFailed(base44, user, creditRecordId, 1, `Payment intent status: ${piStatus}`, eventId || '');

      return Response.json({ success: false, error: 'Payment not confirmed by Stripe', status: piStatus }, { status: 402 });
    }

    // Payment confirmed — mark credit as charged
    await base44.asServiceRole.entities.AIFlyerCredit.update(creditRecordId, {
      status: 'charged',
      stripe_payment_method_id: paymentMethodId || '',
      generation_status: 'pending',
      paid_at: new Date().toISOString(),
    });

    return Response.json({ success: true, creditRecordId });
  }

  // ─────────────────────────────────────────────────────────────
  // mark_generation_succeeded — called after AI generation completes
  // ─────────────────────────────────────────────────────────────
  if (action === 'mark_generation_succeeded') {
    const { creditRecordId } = body;
    if (!creditRecordId) return Response.json({ success: true }); // no-op if no record

    await base44.asServiceRole.entities.AIFlyerCredit.update(creditRecordId, {
      generation_status: 'succeeded',
      status: 'used',
      used_at: new Date().toISOString(),
    });

    return Response.json({ success: true });
  }

  // ─────────────────────────────────────────────────────────────
  // mark_generation_failed — called if AI generation fails after payment
  // Preserves the credit so organizer can retry without paying again
  // ─────────────────────────────────────────────────────────────
  if (action === 'mark_generation_failed') {
    const { creditRecordId } = body;
    if (!creditRecordId) return Response.json({ success: true });

    await base44.asServiceRole.entities.AIFlyerCredit.update(creditRecordId, {
      generation_status: 'failed',
      // Keep status as 'charged' so they can retry generation without re-paying
    });

    return Response.json({ success: true });
  }

  // ─────────────────────────────────────────────────────────────
  // notify_payment_failed — notify admins of a failed payment
  // ─────────────────────────────────────────────────────────────
  if (action === 'notify_payment_failed') {
    const { creditRecordId, amount, reason } = body;
    await _notifyAdminPaymentFailed(base44, user, creditRecordId || '', amount || 1, reason || 'Unknown', eventId || '');
    return Response.json({ success: true });
  }

  // ─────────────────────────────────────────────────────────────
  // add_to_pending_bill — legacy: kept for backward compat
  // ─────────────────────────────────────────────────────────────
  if (action === 'add_to_pending_bill' || action === 'add_to_cart') {
    const targetEventId = (eventId && eventId.length > 0) ? eventId : '';

    const allSessions = await base44.asServiceRole.entities.AIFlyerSession.filter(
      { organizer_email: user.email, status: 'open' }, '-created_date', 20
    );

    let session = null;
    if (targetEventId) {
      session = allSessions.find(s => s.event_id === targetEventId) || null;
    }
    if (!session) {
      session = allSessions.find(s => !s.event_id || s.event_id === '') || null;
    }

    if (session) {
      await base44.asServiceRole.entities.AIFlyerSession.update(session.id, {
        pending_count: (session.pending_count || 0) + 1,
        pending_amount: (session.pending_amount || 0) + 1,
        ...(targetEventId && (!session.event_id || session.event_id === '') ? { event_id: targetEventId } : {}),
      });
      return Response.json({ success: true, session_id: session.id });
    } else {
      const newSession = await base44.asServiceRole.entities.AIFlyerSession.create({
        organizer_email: user.email,
        organizer_id: user.id,
        event_id: targetEventId,
        pending_count: 1,
        pending_amount: 1,
        paid_count: 0,
        paid_amount: 0,
        status: 'open',
      });
      return Response.json({ success: true, session_id: newSession.id });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // link_event — links a temp session to a real event after creation
  // ─────────────────────────────────────────────────────────────
  if (action === 'link_event') {
    const { newEventId } = body;
    if (!newEventId) return Response.json({ error: 'newEventId required' }, { status: 400 });

    const tempSessions = await base44.asServiceRole.entities.AIFlyerSession.filter(
      { organizer_email: user.email, status: 'open' }, '-created_date', 10
    );
    const tempSession = tempSessions.find(s => !s.event_id || s.event_id === '');
    if (tempSession) {
      await base44.asServiceRole.entities.AIFlyerSession.update(tempSession.id, { event_id: newEventId });
    }

    const tempCredits = await base44.asServiceRole.entities.AIFlyerCredit.filter(
      { organizer_email: user.email, type: 'free' }, null, 5
    );
    for (const c of tempCredits.filter(c => !c.event_id || c.event_id === '')) {
      await base44.asServiceRole.entities.AIFlyerCredit.update(c.id, { event_id: newEventId });
    }

    // Also link any pending/charged paid credits
    const paidCredits = await base44.asServiceRole.entities.AIFlyerCredit.filter(
      { organizer_email: user.email, type: 'paid' }, null, 20
    );
    for (const c of paidCredits.filter(c => !c.event_id || c.event_id === '')) {
      await base44.asServiceRole.entities.AIFlyerCredit.update(c.id, { event_id: newEventId });
    }

    return Response.json({ success: true });
  }

  // ─────────────────────────────────────────────────────────────
  // deduct_from_payout — admin: settles pending charges at payout
  // ─────────────────────────────────────────────────────────────
  if (action === 'deduct_from_payout') {
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    const { organizerEmail, payoutAmount } = body;
    if (!organizerEmail) return Response.json({ error: 'organizerEmail required' }, { status: 400 });

    const openSessions = await base44.asServiceRole.entities.AIFlyerSession.filter(
      { organizer_email: organizerEmail, status: 'open' }, '-created_date', 50
    );

    const totalPending = openSessions.reduce((sum, s) => sum + (s.pending_amount || 0), 0);
    const totalPendingCount = openSessions.reduce((sum, s) => sum + (s.pending_count || 0), 0);

    if (totalPending === 0) return Response.json({ deducted: 0, remaining_unpaid: 0 });

    const payout = payoutAmount || 0;
    const deducted = Math.min(payout, totalPending);
    const remainingUnpaid = totalPending - deducted;
    const now = new Date().toISOString();

    for (const s of openSessions) {
      await base44.asServiceRole.entities.AIFlyerSession.update(s.id, {
        status: remainingUnpaid === 0 ? 'paid' : 'partially_paid',
        paid_count: (s.paid_count || 0) + (s.pending_count || 0),
        paid_amount: (s.paid_amount || 0) + (s.pending_amount || 0),
        pending_count: 0,
        pending_amount: 0,
        paid_at: now,
      });
    }

    return Response.json({ success: true, deducted, remaining_unpaid: remainingUnpaid, total_pending_count: totalPendingCount });
  }

  // ─────────────────────────────────────────────────────────────
  // admin_mark_settled — admin manually clears unpaid balance
  // ─────────────────────────────────────────────────────────────
  if (action === 'admin_mark_settled') {
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    const { organizerEmail, sessionId } = body;

    const filter = sessionId ? { id: sessionId } : { organizer_email: organizerEmail };
    const sessions = await base44.asServiceRole.entities.AIFlyerSession.filter(filter, null, 50);
    const now = new Date().toISOString();

    for (const s of sessions.filter(s => s.status === 'open' || s.status === 'partially_paid')) {
      await base44.asServiceRole.entities.AIFlyerSession.update(s.id, {
        status: 'paid',
        paid_count: (s.paid_count || 0) + (s.pending_count || 0),
        paid_amount: (s.paid_amount || 0) + (s.pending_amount || 0),
        pending_count: 0,
        pending_amount: 0,
        paid_at: now,
      });
    }

    return Response.json({ success: true });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});

// ─────────────────────────────────────────────────────────────
// Helper: notify all admins of a failed payment
// ─────────────────────────────────────────────────────────────
async function _notifyAdminPaymentFailed(base44, organizer, creditRecordId, amount, reason, eventId) {
  try {
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, null, 20).catch(() => []);
    const now = new Date();
    const dateStr = now.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });

    const message = `AI Flyer payment FAILED\n\nOrganizer: ${organizer.full_name || ''} (${organizer.email})\nAmount: $${amount}.00\nDate/Time: ${dateStr} UTC\nEvent ID: ${eventId || 'N/A'}\nCredit Record: ${creditRecordId || 'N/A'}\nReason: ${reason}`;

    for (const admin of admins) {
      await base44.asServiceRole.entities.Notification.create({
        user_email: admin.email,
        title: `⚠️ AI Flyer Payment Failed — ${organizer.email}`,
        message,
        type: 'general',
      }).catch(() => {});
    }
  } catch (_) {
    // Non-fatal
  }
}