import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ACTIONS = ['freeze_account', 'unfreeze_account', 'reverse_points', 'deactivate_program', 'reactivate_program', 'deactivate_tier', 'reactivate_tier', 'delete_program', 'delete_tier'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });

    const body = await req.json();
    const { action } = body;
    if (!ACTIONS.includes(action)) return Response.json({ error: 'Invalid action' }, { status: 400 });

    const svc = base44.asServiceRole;

    if (action === 'freeze_account' || action === 'unfreeze_account') {
      const { user_email, owner_type, owner_id, reason } = body;
      if (!user_email || !owner_type || !owner_id) return Response.json({ error: 'Missing fields' }, { status: 400 });
      const existing = await svc.entities.LoyaltyPointsBalance.filter({ user_email, owner_type, owner_id }, null, 1);
      const frozen = action === 'freeze_account';
      if (existing[0]) {
        await svc.entities.LoyaltyPointsBalance.update(existing[0].id, { frozen, frozen_reason: frozen ? (reason || '') : '', frozen_by: frozen ? user.email : '' });
      } else {
        await svc.entities.LoyaltyPointsBalance.create({ user_email, owner_type, owner_id, balance: 0, lifetime_points: 0, frozen, frozen_reason: frozen ? (reason || '') : '', frozen_by: frozen ? user.email : '' });
      }
      await logAudit(svc, user, action, `${user_email} — ${owner_type}/${owner_id}`, reason);
      return Response.json({ success: true });
    }

    if (action === 'reverse_points') {
      const { ledger_id, reason } = body;
      if (!ledger_id) return Response.json({ error: 'ledger_id required' }, { status: 400 });
      const entry = await svc.entities.LoyaltyPointsLedger.get(ledger_id).catch(() => null);
      if (!entry) return Response.json({ error: 'Ledger entry not found' }, { status: 404 });
      if (entry.status === 'reversed') return Response.json({ error: 'Already reversed' }, { status: 400 });

      await svc.entities.LoyaltyPointsLedger.update(ledger_id, { status: 'reversed', reversed_reason: reason || '', reversed_by: user.email });
      await svc.entities.LoyaltyPointsLedger.create({
        user_email: entry.user_email,
        user_name: entry.user_name,
        owner_type: entry.owner_type,
        owner_id: entry.owner_id,
        owner_name: entry.owner_name,
        action_type: 'admin_adjustment',
        points: -entry.points,
        source_id: entry.id,
        dedup_key: `reversal|${entry.id}`,
        status: 'awarded',
      });

      const balances = await svc.entities.LoyaltyPointsBalance.filter({ user_email: entry.user_email, owner_type: entry.owner_type, owner_id: entry.owner_id }, null, 1);
      if (balances[0]) {
        await svc.entities.LoyaltyPointsBalance.update(balances[0].id, {
          balance: (balances[0].balance || 0) - entry.points,
          lifetime_points: (balances[0].lifetime_points || 0) - entry.points,
        });
      }
      await logAudit(svc, user, action, `${entry.user_email} — ${entry.points} pts (${entry.action_type})`, reason);
      return Response.json({ success: true });
    }

    if (action === 'deactivate_program' || action === 'reactivate_program') {
      const { owner_type, owner_id, owner_name } = body;
      if (!owner_type || !owner_id) return Response.json({ error: 'Missing fields' }, { status: 400 });
      const existing = await svc.entities.LoyaltyProgram.filter({ owner_type, owner_id }, null, 1);
      const status = action === 'deactivate_program' ? 'deactivated' : 'active';
      if (existing[0]) {
        await svc.entities.LoyaltyProgram.update(existing[0].id, { status, deactivated_by: status === 'deactivated' ? user.email : '', deactivated_at: status === 'deactivated' ? new Date().toISOString() : '' });
      } else {
        await svc.entities.LoyaltyProgram.create({ owner_type, owner_id, owner_name: owner_name || '', status });
      }
      await logAudit(svc, user, action, `${owner_type} — ${owner_name || owner_id}`);
      return Response.json({ success: true });
    }

    if (action === 'deactivate_tier' || action === 'reactivate_tier') {
      const { tier_id, reason } = body;
      if (!tier_id) return Response.json({ error: 'tier_id required' }, { status: 400 });
      const deactivating = action === 'deactivate_tier';
      await svc.entities.LoyaltyRewardTier.update(tier_id, {
        is_active: !deactivating,
        deactivated_by: deactivating ? user.email : '',
        deactivated_at: deactivating ? new Date().toISOString() : '',
        deactivation_reason: deactivating ? (reason || '') : '',
      });
      const tier = await svc.entities.LoyaltyRewardTier.get(tier_id).catch(() => null);
      await logAudit(svc, user, action, tier ? `${tier.tier_name} (${tier.owner_type}/${tier.owner_id})` : tier_id, reason);
      return Response.json({ success: true });
    }

    if (action === 'delete_program') {
      const { owner_type, owner_id, owner_name } = body;
      if (!owner_type || !owner_id) return Response.json({ error: 'Missing fields' }, { status: 400 });

      const programs = await svc.entities.LoyaltyProgram.filter({ owner_type, owner_id }, null, 10);
      for (const p of programs) {
        await svc.entities.LoyaltyProgram.delete(p.id).catch(() => {});
      }
      const tiers = await svc.entities.LoyaltyRewardTier.filter({ owner_type, owner_id }, null, 200);
      for (const t of tiers) {
        await svc.entities.LoyaltyRewardTier.delete(t.id).catch(() => {});
      }
      await logAudit(svc, user, action, `${owner_type} — ${owner_name || owner_id} (program + ${tiers.length} tier(s) deleted)`);
      return Response.json({ success: true, tiers_deleted: tiers.length });
    }

    if (action === 'delete_tier') {
      const { tier_id } = body;
      if (!tier_id) return Response.json({ error: 'tier_id required' }, { status: 400 });
      const tier = await svc.entities.LoyaltyRewardTier.get(tier_id).catch(() => null);
      if (!tier) return Response.json({ error: 'Tier not found' }, { status: 404 });
      await svc.entities.LoyaltyRewardTier.delete(tier_id);
      await logAudit(svc, user, action, `${tier.tier_name} (${tier.owner_type}/${tier.owner_id})`);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unhandled action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function logAudit(svc, user, action, targetSummary, reason) {
  await svc.entities.AdminLoyaltyAuditLog.create({
    admin_email: user.email,
    admin_name: user.full_name || user.email,
    action,
    target_summary: targetSummary || '',
    reason: reason || '',
  }).catch(() => {});
}