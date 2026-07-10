import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { giveaway_id, selected_winner_ids } = body;

    if (!giveaway_id || !selected_winner_ids || selected_winner_ids.length === 0) {
      return Response.json({ error: 'giveaway_id and selected_winner_ids required' }, { status: 400 });
    }

    // Fetch giveaway
    const giveaway = await base44.entities.Giveaway.get(giveaway_id);
    if (!giveaway) return Response.json({ error: 'Giveaway not found' }, { status: 404 });

    // Check for existing prizes to prevent duplicates
    const existingPrizes = await base44.asServiceRole.entities.PrizeWallet.filter(
      { giveaway_id: giveaway_id },
      null,
      500
    ).catch(() => []);
    const existingUserIds = new Set(existingPrizes.map(p => p.user_id));

    // Filter out winners who already have prizes
    const newWinnerIds = selected_winner_ids.filter(id => !existingUserIds.has(id));

    if (newWinnerIds.length === 0) {
      return Response.json({
        success: true,
        prizes_created: 0,
        message: 'All selected winners already have prizes for this giveaway',
      });
    }

    // Fetch winners' user records
    const winners = await base44.asServiceRole.entities.User.list(null, 100);
    const winnerMap = new Map(winners.map(w => [w.id, w]));

    // Create one PrizeWallet entry per new winner — Fan (role "user") accounts only.
    // Organizer/artist/admin/white_label accounts can never be selected as winners or receive prizes.
    const prizes = [];
    const skippedNonFan = [];
    for (let i = 0; i < newWinnerIds.length; i++) {
      const userId = newWinnerIds[i];
      const winner = winnerMap.get(userId);
      if (!winner) continue;
      if (winner.role !== 'user') {
        skippedNonFan.push(userId);
        continue;
      }

      // Generate unique redemption code
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      const redemptionCode = `PRIZE-${timestamp.toUpperCase()}${random.toUpperCase()}`;

      // Generate QR code URL
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(redemptionCode);

      // Calculate expiry (90 days from now)
      const expiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const prizeData = {
        user_id: userId,
        user_email: winner.email,
        user_name: winner.full_name || winner.email,
        giveaway_id: giveaway_id,
        giveaway_title: giveaway.title,
        event_id: giveaway.linked_event_id || null,
        event_title: giveaway.linked_event_title || null,
        organizer_id: giveaway.owner_id,
        organizer_name: giveaway.owner_name,
        prize_title: giveaway.prize_name || giveaway.prize_description,
        prize_description: giveaway.prize_description,
        prize_type: giveaway.prize_type,
        redemption_code: redemptionCode,
        qr_code_url: qrUrl,
        status: 'unclaimed',
        redemption_instructions: giveaway.terms_and_conditions || 'Show this QR code to claim your prize.',
        expiry_date: expiryDate,
      };

      prizes.push(prizeData);
    }

    // Bulk create prizes
    const createdPrizes = [];
    if (prizes.length > 0) {
      createdPrizes.push(...(await base44.asServiceRole.entities.PrizeWallet.bulkCreate(prizes)));
    }

    // Trigger notifications for each prize
    for (const prize of createdPrizes) {
      base44.functions.invoke('notifyPrizeWon', { prize_wallet_id: prize.id }).catch(() => {});
    }

    // Update giveaway: mark winners_selected and populate winner lists
    await base44.entities.Giveaway.update(giveaway_id, {
      winners_selected: true,
      winner_ids: selected_winner_ids,
      winner_emails: selected_winner_ids.map(id => winnerMap.get(id)?.email).filter(Boolean),
      winner_names: selected_winner_ids.map(id => winnerMap.get(id)?.full_name || winnerMap.get(id)?.email).filter(Boolean),
      drawn_at: new Date().toISOString(),
      drawn_by: (await base44.auth.me()).email,
    });

    return Response.json({
      success: true,
      prizes_created: createdPrizes.length,
      duplicates_skipped: selected_winner_ids.length - newWinnerIds.length,
      non_fan_skipped: skippedNonFan.length,
      prizes: createdPrizes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});