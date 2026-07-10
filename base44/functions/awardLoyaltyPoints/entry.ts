import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ACTION_TYPES = ['like', 'comment', 'review', 'scan', 'raffle', 'poll', 'share'];
const OWNER_TYPES = ['organizer', 'artist', 'platform'];
const PRIZE_TYPES = ['free_drink', 'free_entry', 'merchandise', 'free_ticket', 'discount', 'credit', 'custom'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'user') {
      return Response.json({ error: 'Only fan accounts can earn loyalty points.' }, { status: 403 });
    }

    const { action_type, owner_type, owner_id, owner_name, source_id } = await req.json();

    if (!ACTION_TYPES.includes(action_type)) {
      return Response.json({ error: 'Invalid action_type' }, { status: 400 });
    }
    if (!OWNER_TYPES.includes(owner_type)) {
      return Response.json({ error: 'Invalid owner_type' }, { status: 400 });
    }
    const resolvedOwnerId = owner_type === 'platform' ? 'platform' : owner_id;
    if (!resolvedOwnerId) {
      return Response.json({ error: 'owner_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const ownerEmail = await resolveOwnerEmail(svc, owner_type, resolvedOwnerId);

    // ── Program status check (sorted for a deterministic canonical record) ──
    const programs = await svc.entities.LoyaltyProgram.filter({ owner_type, owner_id: resolvedOwnerId }, 'created_date', 1);
    let program = programs[0];
    if (!program) {
      program = await svc.entities.LoyaltyProgram.create({ owner_type, owner_id: resolvedOwnerId, owner_name: owner_name || '', status: 'active' });
    }
    if (program.status === 'deactivated') {
      return Response.json({ error: 'This loyalty program is currently inactive.' }, { status: 403 });
    }

    // ── Follow requirement for organizer/artist activations ──
    if (owner_type === 'organizer') {
      const follows = await svc.entities.OrganizerFollow.filter({ follower_email: user.email, organizer_id: resolvedOwnerId }, null, 1);
      if (follows.length === 0) {
        return Response.json({
          error: 'follow_required',
          message: `Follow ${owner_name || 'this organizer'} to participate and earn points.`,
        }, { status: 403 });
      }
    } else if (owner_type === 'artist') {
      const follows = await svc.entities.ArtistFollow.filter({ follower_email: user.email, artist_id: resolvedOwnerId }, null, 1);
      if (follows.length === 0) {
        return Response.json({
          error: 'follow_required',
          message: `Follow ${owner_name || 'this artist'} to participate and earn points.`,
        }, { status: 403 });
      }
    }
    // platform: no follow requirement

    // ── Frozen account check ──
    const balances = await svc.entities.LoyaltyPointsBalance.filter({ user_email: user.email, owner_type, owner_id: resolvedOwnerId }, null, 1);
    let balance = balances[0];
    if (balance?.frozen) {
      return Response.json({ error: 'Your loyalty account is frozen. Contact support for assistance.' }, { status: 403 });
    }

    // ── Duplicate prevention ──
    const dedupKey = `${user.email}|${owner_type}|${resolvedOwnerId}|${action_type}|${source_id || 'none'}`;
    const existingLedger = await svc.entities.LoyaltyPointsLedger.filter({ dedup_key: dedupKey }, null, 1);
    if (existingLedger.length > 0) {
      return Response.json({ error: 'Points for this action have already been awarded.' }, { status: 409 });
    }

    // ── Default point value ──
    const rules = await svc.entities.LoyaltyPointRule.list(null, 1);
    const rule = rules[0] || await svc.entities.LoyaltyPointRule.create({});
    const points = rule[`${action_type}_points`] ?? 0;

    // ── Ledger + balance ──
    await svc.entities.LoyaltyPointsLedger.create({
      user_email: user.email,
      user_name: user.full_name || user.email,
      owner_type,
      owner_id: resolvedOwnerId,
      owner_name: owner_name || '',
      owner_email: ownerEmail || '',
      action_type,
      points,
      source_id: source_id || '',
      dedup_key: dedupKey,
      status: 'awarded',
    });

    const oldBalance = balance?.balance || 0;
    const newBalance = oldBalance + points;
    if (balance) {
      await svc.entities.LoyaltyPointsBalance.update(balance.id, {
        balance: newBalance,
        lifetime_points: (balance.lifetime_points || 0) + points,
        owner_email: ownerEmail || balance.owner_email || '',
      });
    } else {
      await svc.entities.LoyaltyPointsBalance.create({
        user_email: user.email,
        user_name: user.full_name || user.email,
        owner_type,
        owner_id: resolvedOwnerId,
        owner_name: owner_name || '',
        owner_email: ownerEmail || '',
        balance: newBalance,
        lifetime_points: points,
      });
    }

    const newClaims = await checkAndAwardTiers(svc, { user, owner_type, owner_id: resolvedOwnerId, owner_name, ownerEmail, newBalance });

    return Response.json({ success: true, points_awarded: points, balance: newBalance, new_rewards: newClaims });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function resolveOwnerEmail(svc, ownerType, ownerId) {
  try {
    if (ownerType === 'organizer') {
      const u = await svc.entities.User.get(ownerId).catch(() => null);
      return u?.email || '';
    }
    if (ownerType === 'artist') {
      const artist = await svc.entities.Artist.get(ownerId).catch(() => null);
      return artist?.user_email || '';
    }
  } catch (_) { /* noop */ }
  return '';
}

async function checkAndAwardTiers(svc, { user, owner_type, owner_id, owner_name, ownerEmail, newBalance }) {
  const tiers = await svc.entities.LoyaltyRewardTier.filter({ owner_type, owner_id, is_active: true }, 'points_required', 100);
  const newClaims = [];

  for (const tier of tiers) {
    if (!tier.points_required || newBalance < tier.points_required) continue;

    const existingClaims = await svc.entities.LoyaltyRewardClaim.filter({ fan_email: user.email, tier_id: tier.id }, null, 500);

    if (!tier.is_repeatable) {
      if (existingClaims.length > 0) continue;
      const claim = await createClaim(svc, tier, user, owner_type, owner_name, ownerEmail);
      newClaims.push(claim);
    } else {
      let awardCount = existingClaims.length;
      while ((awardCount + 1) * tier.points_required <= newBalance) {
        const claim = await createClaim(svc, tier, user, owner_type, owner_name, ownerEmail);
        newClaims.push(claim);
        awardCount++;
      }
    }
  }
  return newClaims;
}

async function createClaim(svc, tier, user, ownerType, ownerName, ownerEmail) {
  const resolvedOwnerName = ownerName || tier.owner_name || '';
  const claim = await svc.entities.LoyaltyRewardClaim.create({
    fan_email: user.email,
    fan_name: user.full_name || user.email,
    owner_type: tier.owner_type,
    owner_id: tier.owner_id,
    owner_name: resolvedOwnerName,
    owner_email: tier.owner_email || ownerEmail || '',
    tier_id: tier.id,
    tier_name: tier.tier_name,
    points_spent: tier.points_required,
    reward_title: tier.reward_title,
    reward_type: tier.reward_type,
    status: 'pending',
    claimed_at: new Date().toISOString(),
  });

  // ── Free Ticket rewards linked to a specific event/ticket type: auto-issue a real ticket, capped at ticket_max_value ──
  let generatedTicketId = null;
  if (tier.reward_type === 'free_ticket' && tier.ticket_event_id && tier.ticket_type_id) {
    generatedTicketId = await issueLoyaltyTicket(svc, tier, user);
  }

  // ── Create PrizeWallet entry so the reward shows in My Prizes, with QR + redemption code ──
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const redemptionCode = `LOYALTY-${timestamp.toUpperCase()}${random.toUpperCase()}`;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(redemptionCode);
  const programLabel = ownerType === 'platform' ? 'Reizor Community' : (resolvedOwnerName || 'Loyalty Program');

  await svc.entities.PrizeWallet.create({
    user_id: user.id,
    user_email: user.email,
    user_name: user.full_name || user.email,
    source_type: 'loyalty_tier',
    giveaway_title: `${programLabel} — ${tier.tier_name}`,
    tier_id: tier.id,
    tier_name: tier.tier_name,
    organizer_id: tier.owner_id,
    organizer_name: resolvedOwnerName,
    prize_title: tier.reward_title,
    prize_description: tier.reward_description || '',
    prize_type: PRIZE_TYPES.includes(tier.reward_type) ? tier.reward_type : 'custom',
    redemption_code: redemptionCode,
    qr_code_url: qrUrl,
    status: generatedTicketId ? 'redeemed' : 'unclaimed',
    redemption_instructions: generatedTicketId
      ? 'Your free ticket has been added automatically — check My Tickets.'
      : (tier.redemption_instructions || 'Show this QR code to claim your reward.'),
  }).catch((e) => console.error('PrizeWallet create failed:', e.message));

  await svc.entities.Notification.create({
    user_email: user.email,
    title: `🎁 You unlocked ${tier.tier_name}!`,
    message: generatedTicketId
      ? `You reached ${tier.points_required} points with ${programLabel} and earned a free ticket to ${tier.ticket_event_title || 'the event'}. Check My Tickets!`
      : `You reached ${tier.points_required} points with ${programLabel} and earned: ${tier.reward_title}. Check My Prizes for your redemption code.`,
    type: 'general',
    link: generatedTicketId ? '/my-tickets' : '/my-prizes',
  }).catch(() => {});

  try {
    await svc.integrations.Core.SendEmail({
      to: user.email,
      subject: `You unlocked a reward: ${tier.reward_title}`,
      body: `Congratulations! You reached ${tier.points_required} points with ${programLabel} and earned: ${tier.reward_title}.\n\n${tier.reward_description || ''}\n\nRedemption code: ${redemptionCode}\n\nOpen My Prizes in the app to view your QR code and claim instructions.`,
    });
  } catch (_) { /* email is best-effort */ }

  if (ownerEmail) {
    await svc.entities.Notification.create({
      user_email: ownerEmail,
      title: `🎉 ${user.full_name || user.email} unlocked ${tier.tier_name}!`,
      message: `A fan reached ${tier.points_required} points and claimed: ${tier.reward_title}.`,
      type: 'general',
    }).catch(() => {});
  }

  return claim;
}

async function issueLoyaltyTicket(svc, tier, user) {
  try {
    const ticketTypes = await svc.entities.TicketType.filter({ id: tier.ticket_type_id }, null, 1).catch(() => []);
    const tt = ticketTypes[0];
    const price = tt?.price || 0;
    const maxValue = tier.ticket_max_value || 0;
    if (maxValue && price > maxValue) return null; // ticket price exceeds the configured cap — skip auto-issue

    const ticketCode = `LOYALTY-${(tier.id || '000000').slice(-6)}-${Date.now().toString(36).toUpperCase()}`;
    const qrData = JSON.stringify({
      ticket_code: ticketCode,
      event_id: tier.ticket_event_id,
      ticket_type: tier.ticket_type_name,
      owner: user.email,
      source: 'loyalty_reward',
    });
    const ticket = await svc.entities.Ticket.create({
      ticket_code: ticketCode,
      event_id: tier.ticket_event_id,
      ticket_type_id: tier.ticket_type_id,
      order_id: `loyalty_${tier.id}_${Date.now()}`,
      owner_email: user.email,
      owner_name: user.full_name || user.email,
      status: 'active',
      event_title: tier.ticket_event_title || '',
      ticket_type_name: tier.ticket_type_name || '',
      price_paid: 0,
      qr_data: qrData,
      purchased_with_loyalty: true,
    }).catch(() => null);

    if (ticket && tt) {
      await svc.entities.TicketType.update(tt.id, { quantity_sold: (tt.quantity_sold || 0) + 1 }).catch(() => {});
    }
    return ticket?.id || null;
  } catch (_) {
    return null;
  }
}