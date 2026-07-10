import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins or automations (service role) should run this
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Find all referrals where unlock_date is in the past and status is still "locked"
    const allReferrals = await base44.asServiceRole.entities.Referral.list("-created_date", 2000);
    
    const now = new Date();
    const maturedReferrals = allReferrals.filter(r => {
      if (!r.unlock_date || r.status === 'pending_payout' || r.status === 'notified' || r.status === 'withdrawn') return false;
      const unlockDate = new Date(r.unlock_date);
      return unlockDate <= now;
    });

    if (maturedReferrals.length === 0) {
      return Response.json({ message: 'No matured referrals to process', count: 0 });
    }

    // Group by maturity date (the day unlock_date falls on)
    const groups = {};
    for (const ref of maturedReferrals) {
      const maturityDay = new Date(ref.unlock_date).toISOString().slice(0, 10); // YYYY-MM-DD
      if (!groups[maturityDay]) groups[maturityDay] = [];
      groups[maturityDay].push(ref);
    }

    // For each group, mark referrals as "pending_payout" and send one admin notification
    const results = [];
    for (const [maturityDay, refs] of Object.entries(groups)) {
      const totalEarnings = refs.reduce((sum, r) => sum + (r.credit_earned || 0), 0);
      const affiliateCount = new Set(refs.map(r => r.referrer_email)).size;

      // Build detailed breakdown
      const breakdown = refs.map(r => ({
        affiliate_name: r.referrer_name || r.referrer_email,
        affiliate_email: r.referrer_email,
        referred_name: r.referred_name || r.referred_email,
        signup_date: r.created_date ? new Date(r.created_date).toISOString().slice(0, 10) : 'Unknown',
        earnings: r.credit_earned || 0,
        eligible_payout_date: maturityDay,
        type: r.referral_type || 'affiliate',
      }));

      // Mark all as pending_payout
      for (const ref of refs) {
        await base44.asServiceRole.entities.Referral.update(ref.id, {
          status: 'pending_payout',
        }).catch(() => {});
      }

      // Create a single consolidated notification for admins
      const detailLines = breakdown.map(b =>
        `• ${b.affiliate_name} — $${b.earnings.toFixed(2)} (${b.referred_name}, signed up ${b.signup_date}, eligible ${b.eligible_payout_date})`
      );
      const message = `Batch matured on ${maturityDay}\n${affiliateCount} affiliate(s) · ${refs.length} referral(s) · $${totalEarnings.toFixed(2)} total\n\n${detailLines.join('\n')}`;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user?.email || 'admin',
        subject: `💰 Affiliate Payout Due — ${affiliateCount} affiliate(s) — $${totalEarnings.toFixed(2)}`,
        body: message,
      }).catch(() => {});

      // Also create a Notification entity for admins
      await base44.asServiceRole.entities.Notification.create({
        user_email: 'admin',
        title: `💰 Affiliate Payouts Due: ${affiliateCount} affiliate(s) — $${totalEarnings.toFixed(2)}`,
        message,
        type: 'general',
      }).catch(() => {});

      results.push({
        maturityDay,
        affiliateCount,
        referralCount: refs.length,
        totalEarnings,
      });
    }

    return Response.json({
      message: `Processed ${maturedReferrals.length} matured referrals across ${results.length} batches`,
      batches: results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});