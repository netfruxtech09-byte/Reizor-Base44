import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tier_id, tier_name, artist_id, artist_name, artist_email, amount, stripe_payment_method_id, stripe_customer_id } = await req.json();

    const STRIPE_API_KEY = Deno.env.get("STRIPE_API_KEY");

    // Create Stripe subscription for annual billing via REST API
    const subResponse = await fetch('https://api.stripe.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: stripe_customer_id,
        items: `[{"price":"${tier_id}"}]`,
        default_payment_method: stripe_payment_method_id,
        billing_cycle_anchor: String(Math.floor(Date.now() / 1000)),
      }),
    });

    const subscription = await subResponse.json();

    if (!subResponse.ok) {
      throw new Error(subscription.error?.message || 'Failed to create subscription');
    }

    // Create FanSubscription record
    const now = new Date().toISOString();
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    const fanSub = await base44.entities.FanSubscription.create({
      tier_id,
      tier_name,
      artist_id,
      artist_name,
      artist_email,
      fan_email: user.email,
      fan_name: user.full_name,
      amount,
      status: "active",
      started_at: now,
      next_billing_date: nextYear.toISOString(),
      stripe_subscription_id: subscription.id,
      stripe_payment_method_id,
      stripe_customer_id,
      original_signup_date: now,
      last_charge_date: now,
      payment_status: "active",
    });

    // Send welcome email
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `Welcome to ${tier_name}! 🎉`,
      body: `Hi ${user.full_name},

Welcome to the ${tier_name} membership! Your card will be automatically charged $${amount.toFixed(2)} every year on ${new Date().toLocaleDateString()}.

Benefits:
✅ Exclusive perks and early access
✅ Automatic annual renewal
✅ Secure card storage

Manage membership: [Profile Settings]

Thank you!`,
    });

    return Response.json({
      success: true,
      subscription_id: fanSub.id,
      stripe_subscription: subscription.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});