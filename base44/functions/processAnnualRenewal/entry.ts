import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all active subscriptions ready for renewal
    const activeSubscriptions = await base44.asServiceRole.entities.FanSubscription.filter(
      { status: "active", payment_status: "active" },
      null,
      500
    );

    const now = new Date();
    const results = { processed: 0, failed: 0, errors: [] };

    // Using Stripe API via backend
    const STRIPE_API_KEY = Deno.env.get("STRIPE_API_KEY");

    for (const sub of activeSubscriptions) {
      try {
        // Check if renewal date is today or overdue
        if (!sub.next_billing_date || new Date(sub.next_billing_date) > now) {
          continue;
        }

        // Attempt to charge via Stripe
        const chargeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${STRIPE_API_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            amount: Math.round(sub.amount * 100),
            currency: 'usd',
            customer: sub.stripe_customer_id,
            payment_method: sub.stripe_payment_method_id,
            off_session: 'true',
            confirm: 'true',
            description: `Annual renewal - ${sub.tier_name} for ${sub.fan_email}`,
          }),
        });

        const chargeData = await chargeResponse.json();

        if (chargeResponse.ok && chargeData.status === 'succeeded') {
          // Charge successful - update subscription
          const nextRenewal = new Date(sub.next_billing_date);
          nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);

          await base44.asServiceRole.entities.FanSubscription.update(sub.id, {
            payment_status: "active",
            last_charge_date: now.toISOString(),
            next_billing_date: nextRenewal.toISOString(),
            failed_payment_reason: null,
            failed_payment_date: null,
          });

          results.processed++;
        } else {
          throw new Error(chargeData.error?.message || 'Payment failed');
        }
      } catch (chargeError) {
        // Charge failed - update status and send notification
        const errorMsg = chargeError.message || "Unknown error";

        await base44.asServiceRole.entities.FanSubscription.update(sub.id, {
          status: "past_due",
          payment_status: "failed",
          failed_payment_reason: errorMsg,
          failed_payment_date: now.toISOString(),
        });

        // Send failure notification
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: sub.fan_email,
          subject: `⚠️ Payment Failed - ${sub.tier_name} Membership`,
          body: `Hi ${sub.fan_name},

Your ${sub.tier_name} membership renewal payment failed on ${now.toLocaleDateString()}.

Error: ${errorMsg}

Your membership is now paused. Please update your payment method to restore access.

Update payment: [Profile Settings]

Once payment succeeds, your membership will be renewed from your original signup date (${new Date(sub.original_signup_date).toLocaleDateString()}).

Support: support@reizor.com`,
        });

        results.failed++;
        results.errors.push({ subscription_id: sub.id, fan_email: sub.fan_email, error: errorMsg });
      }
    }

    return Response.json({
      status: "success",
      timestamp: now.toISOString(),
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});