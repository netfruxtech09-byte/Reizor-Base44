import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, prize_wallet_id, redemption_code } = body;

    if (action === 'redeem') {
      // Redeem a prize by QR code or manual redemption code
      if (!prize_wallet_id && !redemption_code) {
        return Response.json({ error: 'prize_wallet_id or redemption_code required' }, { status: 400 });
      }

      // Fetch prize
      let prize;
      if (prize_wallet_id) {
        prize = await base44.asServiceRole.entities.PrizeWallet.get(prize_wallet_id);
      } else {
        const results = await base44.asServiceRole.entities.PrizeWallet.filter(
          { redemption_code: redemption_code.toUpperCase() },
          null,
          1
        );
        prize = results[0];
      }

      if (!prize) {
        return Response.json({ error: 'Prize not found' }, { status: 404 });
      }

      // Check if already redeemed
      if (prize.status === 'redeemed') {
        return Response.json({ error: 'This prize has already been claimed', status: 'already_redeemed' }, { status: 409 });
      }

      // Check if expired
      if (prize.expiry_date && new Date(prize.expiry_date) < new Date()) {
        return Response.json({ error: 'This prize has expired', status: 'expired' }, { status: 410 });
      }

      // Check if prize is in a valid status (unclaimed or won)
      const validStatuses = ['unclaimed', 'won'];
      if (!validStatuses.includes(prize.status)) {
        return Response.json({ error: 'This prize cannot be redeemed in its current status', status: 'invalid' }, { status: 400 });
      }

      // Get current user (staff/organizer)
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      // Verify user has permission to redeem prizes for this organizer/artist
      if (user.role !== 'admin' && user.role !== 'organizer' && user.role !== 'artist' && user.id !== prize.organizer_id) {
        return Response.json({ error: 'You do not have permission to redeem prizes for this organizer', status: 'forbidden' }, { status: 403 });
      }

      // Update prize status to redeemed
      await base44.asServiceRole.entities.PrizeWallet.update(prize_wallet_id || prize.id, {
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
        redeemed_by_email: user.email,
      });

      return Response.json({
        success: true,
        prize_id: prize.id,
        message: `Prize claimed: ${prize.prize_title}`,
        prize: {
          title: prize.prize_title,
          winner: prize.user_name,
          email: prize.user_email,
          giveaway: prize.giveaway_title,
        },
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});