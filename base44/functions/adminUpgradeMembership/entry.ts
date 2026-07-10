import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const { fan_email, tier_id, tier_name, artist_id, artist_name, artist_email, amount, is_free } = await req.json();

    // Cancel any existing active subscriptions for this fan/artist combo
    const existing = await base44.asServiceRole.entities.FanSubscription.filter(
      { fan_email, artist_id, status: "active" },
      null,
      10
    );

    for (const sub of existing) {
      await base44.asServiceRole.entities.FanSubscription.update(sub.id, { status: "cancelled" });
    }

    const now = new Date().toISOString();
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    // Create new subscription (free for admin upgrade, paid otherwise)
    const newSub = await base44.entities.FanSubscription.create({
      tier_id,
      tier_name,
      artist_id,
      artist_name,
      artist_email,
      fan_email,
      fan_name: fan_email.split("@")[0],
      amount: is_free ? 0 : amount,
      status: "active",
      started_at: now,
      next_billing_date: is_free ? null : nextYear.toISOString(),
      stripe_subscription_id: is_free ? "admin_free" : "pending",
      stripe_payment_method_id: "admin_free",
      stripe_customer_id: "admin_free",
      original_signup_date: now,
      last_charge_date: now,
      payment_status: is_free ? "active" : "active",
    });

    // Send notification
    const subject = is_free ? `Upgraded: ${tier_name}! 🎉` : `Updated: ${tier_name}`;
    const body = is_free
      ? `Hi there,\n\nAn admin has upgraded you to the ${tier_name} membership at no cost!\n\nEnjoy exclusive benefits and early access.\n\nThank you!`
      : `Hi there,\n\nYour membership has been updated to ${tier_name}.\n\nManage your membership in your profile.`;

    await base44.integrations.Core.SendEmail({
      to: fan_email,
      subject,
      body,
    });

    return Response.json({
      success: true,
      subscription_id: newSub.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});