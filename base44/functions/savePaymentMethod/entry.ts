import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.21.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

  // ─────────────────────────────────────────────────────────────
  // create_setup_intent — create a Stripe SetupIntent to collect card
  // ─────────────────────────────────────────────────────────────
  if (action === 'create_setup_intent') {
    // Look up or create Stripe customer
    const existingMethods = await base44.asServiceRole.entities.PaymentMethod.filter(
      { user_email: user.email, status: 'active' }, null, 5
    ).catch(() => []);

    let customerId = null;

    // Try to find existing customer via saved PM
    if (existingMethods.length > 0) {
      for (const pm of existingMethods) {
        if (pm.stripe_customer_id) {
          customerId = pm.stripe_customer_id;
          break;
        }
        // Try fetching from Stripe PM
        if (pm.stripe_payment_method_id) {
          try {
            const spm = await stripe.paymentMethods.retrieve(pm.stripe_payment_method_id);
            if (spm.customer) { customerId = spm.customer; break; }
          } catch (_) {}
        }
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || '',
        metadata: { base44_user_id: user.id, base44_user_email: user.email },
      });
      customerId = customer.id;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: 'off_session',
      metadata: {
        user_email: user.email,
        user_id: user.id,
      },
    });

    return Response.json({
      clientSecret: setupIntent.client_secret,
      customerId,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // confirm_setup — called after Stripe SetupIntent succeeds
  // Retrieves card details from Stripe and saves to PaymentMethod entity
  // ─────────────────────────────────────────────────────────────
  if (action === 'confirm_setup') {
    const { setupIntentId, customerId } = body;
    if (!setupIntentId) return Response.json({ error: 'setupIntentId required' }, { status: 400 });

    const si = await stripe.setupIntents.retrieve(setupIntentId);
    if (si.status !== 'succeeded') {
      return Response.json({ error: `SetupIntent status: ${si.status}` }, { status: 400 });
    }

    const pmId = si.payment_method;
    if (!pmId) return Response.json({ error: 'No payment method on SetupIntent' }, { status: 400 });

    const spm = await stripe.paymentMethods.retrieve(pmId);
    const card = spm.card;
    if (!card) return Response.json({ error: 'No card data' }, { status: 400 });

    // Mark any existing methods as non-default
    const existing = await base44.asServiceRole.entities.PaymentMethod.filter(
      { user_email: user.email, status: 'active' }, null, 20
    ).catch(() => []);

    for (const pm of existing) {
      if (pm.is_default) {
        await base44.asServiceRole.entities.PaymentMethod.update(pm.id, { is_default: false }).catch(() => {});
      }
    }

    // Save safe card metadata
    const saved = await base44.asServiceRole.entities.PaymentMethod.create({
      user_email: user.email,
      stripe_payment_method_id: pmId,
      stripe_customer_id: customerId || (spm.customer ? String(spm.customer) : ''),
      card_brand: card.brand || 'unknown',
      card_last_four: card.last4 || '****',
      expiry_month: card.exp_month,
      expiry_year: card.exp_year,
      billing_zip: spm.billing_details?.address?.postal_code || '',
      is_default: true,
      status: 'active',
    });

    return Response.json({
      success: true,
      payment_method: {
        id: saved.id,
        card_brand: card.brand,
        card_last_four: card.last4,
        expiry_month: card.exp_month,
        expiry_year: card.exp_year,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // list — return saved active payment methods for current user
  // ─────────────────────────────────────────────────────────────
  if (action === 'list') {
    const methods = await base44.entities.PaymentMethod.filter(
      { user_email: user.email, status: 'active' }, null, 10
    ).catch(() => []);
    return Response.json({ methods });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});