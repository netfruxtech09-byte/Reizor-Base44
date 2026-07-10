import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { prize_wallet_id } = body;

    if (!prize_wallet_id) {
      return Response.json({ error: 'prize_wallet_id required' }, { status: 400 });
    }

    // Fetch prize wallet
    const prize = await base44.asServiceRole.entities.PrizeWallet.get(prize_wallet_id);
    if (!prize) return Response.json({ error: 'Prize not found' }, { status: 404 });

    // Create in-app notification
    const notification = await base44.asServiceRole.entities.Notification.create({
      user_email: prize.user_email,
      title: `🎉 You won ${prize.prize_title}!`,
      message: `Open My Prizes to view your QR code and claim instructions.`,
      type: 'prize_won',
      link: '/my-prizes',
    });

    // Send email notification
    try {
      await base44.integrations.Core.SendEmail({
        to: prize.user_email,
        subject: `You won a prize: ${prize.prize_title}`,
        body: `Congratulations! You won: ${prize.prize_title}\n\nEvent: ${prize.event_title || 'N/A'}\nGiveaway: ${prize.giveaway_title}\n\nOpen My Prizes to view your QR code and claim instructions.\n\nYour redemption code: ${prize.redemption_code}`,
      });
    } catch (emailErr) {
      console.warn('Email send failed:', emailErr.message);
      // Continue anyway - in-app notification was created
    }

    return Response.json({
      success: true,
      notification_id: notification.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});