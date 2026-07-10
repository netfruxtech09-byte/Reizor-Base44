/**
 * calculateWLFees — Hierarchical White Label fee calculator
 *
 * Called by payment flows (ticket purchase, table booking, subscriptions) to
 * compute the full WL fee chain for a transaction.
 *
 * Given a child_wl_id, this function walks UP the parent hierarchy (via
 * WhiteLabel.parent_wl_id) and fetches the active WLFeeConfig for each
 * parent→child relationship. It returns a breakdown array ordered from
 * top (Reizor) to bottom (direct parent), plus a total WL fee amount.
 *
 * The Reizor platform fee (tiered $0.50–$5 per ticket) is NOT modified —
 * it is computed separately in stripeCreatePaymentIntent. WL fees are additive.
 *
 * Security:
 * - All DB calls use asServiceRole (cannot be manipulated by the calling user).
 * - The caller provides subtotal + child_wl_id only — no fee amounts from client.
 * - Returns 401 if not authenticated.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { child_wl_id, subtotal_per_ticket, quantity = 1 } = body;

    if (!child_wl_id) {
      // No WL context — no WL fees apply
      return Response.json({ breakdown: [], total_wl_fee: 0 });
    }

    const subtotal = (parseFloat(subtotal_per_ticket) || 0) * quantity;

    // ── Walk the parent chain ──────────────────────────────────────────────
    // Build ordered chain from child → root, then reverse to get root → child
    const chain = []; // [ { wl_id, wl_name, wl_email, parent_wl_id } ]
    let currentId = child_wl_id;
    const visited = new Set();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const wlArr = await base44.asServiceRole.entities.WhiteLabel.filter({ id: currentId }, null, 1).catch(() => []);
      const wl = wlArr[0];
      if (!wl) break;
      chain.push({ wl_id: wl.id, wl_name: wl.brand_name || wl.name, wl_email: wl.email, parent_wl_id: wl.parent_wl_id || null });
      currentId = wl.parent_wl_id || null;
    }

    // chain[0] = direct child, chain[last] = top-level WL
    // Relationships to look up: parent_type=reizor→chain[last], parent_type=wl→chain[n]→chain[n-1], etc.
    const breakdown = [];
    const now = new Date().toISOString();

    // Fetch active fee config for each parent→child pair in the chain
    // chain is ordered [child, ..., topLevelWL]
    // Pair indices: (chain[n+1] is parent of chain[n])
    for (let i = 0; i < chain.length; i++) {
      const child = chain[i];
      const parentWlId = chain[i + 1]?.wl_id || null; // null means Reizor is the parent

      // Query the active fee config for this parent→child relationship
      const configs = await base44.asServiceRole.entities.WLFeeConfig.filter(
        {
          child_wl_id: child.wl_id,
          is_active: true,
        },
        '-effective_from',
        10
      ).catch(() => []);

      // Find the config with the correct parent and effective date <= now
      const config = configs.find(c => {
        const parentMatches = parentWlId
          ? c.parent_wl_id === parentWlId
          : c.parent_type === 'reizor';
        const isEffective = !c.effective_from || c.effective_from <= now;
        return parentMatches && isEffective;
      });

      if (!config) continue;

      // Calculate fee amount
      let feeAmount = 0;
      if (config.fee_type === 'percentage' || config.fee_type === 'both') {
        feeAmount += parseFloat(((config.fee_percent || 0) / 100 * subtotal).toFixed(2));
      }
      if (config.fee_type === 'flat' || config.fee_type === 'both') {
        feeAmount += parseFloat(((config.fee_flat || 0) * quantity).toFixed(2));
      }

      breakdown.push({
        config_id: config.id,
        parent_type: config.parent_type,
        parent_wl_id: config.parent_wl_id || null,
        parent_wl_name: config.parent_wl_name || 'Reizor',
        child_wl_id: child.wl_id,
        child_wl_name: child.wl_name,
        fee_type: config.fee_type,
        fee_percent: config.fee_percent || 0,
        fee_flat: config.fee_flat || 0,
        fee_amount: feeAmount,
        effective_from: config.effective_from,
      });
    }

    // Order breakdown from root (Reizor/top WL) down to direct parent
    breakdown.reverse();

    const total_wl_fee = parseFloat(breakdown.reduce((s, b) => s + b.fee_amount, 0).toFixed(2));

    return Response.json({ breakdown, total_wl_fee });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});