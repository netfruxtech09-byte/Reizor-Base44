import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const { code, discount_type, discount_value, tier_id, tier_name, max_uses, valid_until, description } = await req.json();

    // Check if code already exists
    const existing = await base44.asServiceRole.entities.PromoCode.filter({ code }, null, 1);
    if (existing.length > 0) {
      return Response.json({ error: "Promo code already exists" }, { status: 400 });
    }

    const promo = await base44.asServiceRole.entities.PromoCode.create({
      code: code.toUpperCase(),
      discount_type,
      discount_value,
      tier_id,
      tier_name,
      valid_until,
      max_uses: max_uses || -1,
      uses_remaining: max_uses || -1,
      created_by: user.email,
      is_active: true,
      description,
    });

    return Response.json({
      success: true,
      promo_code: promo,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});