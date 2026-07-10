import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const now = new Date().toISOString();
    
    // Find all unclaimed prizes that have expired
    const expiredPrizes = await base44.asServiceRole.entities.PrizeWallet.filter(
      {
        status: 'unclaimed',
        expiry_date: { $lt: now }
      },
      null,
      500
    ).catch(() => []);

    if (expiredPrizes.length === 0) {
      return Response.json({ success: true, updated: 0 });
    }

    // Mark them as expired
    const updates = expiredPrizes.map(p => ({
      id: p.id,
      status: 'expired'
    }));

    await base44.asServiceRole.entities.PrizeWallet.bulkUpdate(updates);

    return Response.json({
      success: true,
      updated: expiredPrizes.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});