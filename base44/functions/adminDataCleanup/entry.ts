import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Ordered list: dependents before parents
const CLEANUP_ENTITIES = [
  ['Scan', 'Scanner records'],
  ['PollVote', 'Poll votes'],
  ['RaffleEntry', 'Raffle entries'],
  ['CommunityPostLike', 'Post likes'],
  ['CommunityComment', 'Community comments'],
  ['ArtistComment', 'Artist comments'],
  ['ArtistClickTracking', 'Click tracking'],
  ['ArtistFollow', 'Artist follows'],
  ['BookingNote', 'Booking notes'],
  ['BookingReview', 'Booking reviews'],
  ['BookingHistory', 'Booking history'],
  ['EventView', 'Event views'],
  ['EventRsvp', 'Event RSVPs'],
  ['SavedEvent', 'Saved events'],
  ['WaitlistEntry', 'Waitlist entries'],
  ['GuestList', 'Guest list entries'],
  ['TwoFactorOTP', '2FA OTPs'],
  ['AppErrorLog', 'Error logs'],
  ['TicketTransfer', 'Ticket transfers'],
  ['TicketListing', 'Resale listings'],
  ['Ticket', 'Tickets'],
  ['TableReservation', 'Table reservations'],
  ['Order', 'Orders'],
  ['MerchOrder', 'Merch orders'],
  ['ResaleWalletTransaction', 'Resale wallet transactions'],
  ['ResaleSellerPayoutRequest', 'Resale payout requests'],
  ['ResaleSellerBalance', 'Resale seller balances'],
  ['ResaleTransaction', 'Resale transactions'],
  ['PromoCode', 'Promo codes'],
  ['TicketType', 'Ticket types'],
  ['Table', 'Tables/VIP configs'],
  ['SeatMap', 'Seat maps'],
  ['EventGiveaway', 'Event giveaways'],
  ['EventVendor', 'Event vendors'],
  ['EventExpense', 'Event expenses'],
  ['EventIncome', 'Event income'],
  ['EventPoll', 'Polls'],
  ['EventRaffle', 'Raffles'],
  ['EventDiscovery', 'Event discovery'],
  ['EventRecommendation', 'Recommendations'],
  ['SellerLink', 'Seller links'],
  ['Event', 'Events'],
  ['ShoutoutRequest', 'Shoutout requests'],
  ['FanSubscription', 'Fan subscriptions'],
  ['FanTier', 'Fan tiers'],
  ['DigitalPurchase', 'Digital purchases'],
  ['DigitalProduct', 'Digital products'],
  ['VideoChat', 'Video chats'],
  ['ArtistDonation', 'Artist donations'],
  ['ArtistPayout', 'Artist payouts'],
  ['ArtistRaffle', 'Artist raffles'],
  ['ArtistTourSchedule', 'Artist tour schedules'],
  ['ArtistPost', 'Artist posts'],
  ['ArtistAlbum', 'Artist albums'],
  ['ArtistBooking', 'Artist bookings'],
  ['BookingContract', 'Booking contracts'],
  ['TechnicalRider', 'Technical riders'],
  ['MediaItem', 'Media items'],
  ['Artist', 'Artist profiles'],
  ['Permission', 'Team permissions'],
  ['InviteLink', 'Invite links'],
  ['OrganizerBankInfo', 'Bank info'],
  ['OrganizerPayoutRequest', 'Payout requests'],
  ['OrganizerStorageRecord', 'Storage records'],
  ['OrganizerMediaPost', 'Organizer media posts'],
  ['OrganizerFeeSettings', 'Organizer fee settings'],
  ['OrganizerLoyaltyTier', 'Loyalty tiers'],
  ['OrganizerCredit', 'Organizer credits'],
  ['OrganizerProfile', 'Organizer profiles'],
  ['AffiliateEarning', 'Affiliate earnings'],
  ['Referral', 'Referrals'],
  ['ManualIncome', 'Manual income'],
  ['Expense', 'Expenses'],
  ['AdminExpense', 'Admin expenses'],
  ['LoyaltyAccount', 'Loyalty accounts'],
  ['CommunityPost', 'Community posts'],
  ['Review', 'Reviews'],
  ['Message', 'Messages'],
  ['Notification', 'Notifications'],
  ['AIFlyerAcknowledgement', 'AI flyer acknowledgements'],
  ['AIFlyerSession', 'AI flyer sessions'],
  ['AIFlyerCredit', 'AI flyer credits'],
  ['VideoBudget', 'Video budgets'],
  ['OrganizerStorageSettings', 'Storage settings (keep globals)'],
  ['WhiteLabelFeeProposal', 'WL proposals'],
  ['WhiteLabel', 'White labels'],
  ['EmailRecipient', 'Email recipients'],
  ['EmailCampaign', 'Email campaigns'],
  ['ExternalEvent', 'External events'],
  ['PaymentMethod', 'Payment methods'],
  ['CashbackTermsSignature', 'Cashback signatures'],
  ['OrganizerFinancialLabel', 'Financial labels'],
  ['CustomGenre', 'Custom genres'],
  ['Product', 'Products'],
];

async function deleteAllRecords(base44, entityName, filter) {
  let totalDeleted = 0;
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      const records = await base44.asServiceRole.entities[entityName].filter(filter || {}, null, 100);
      if (!records || records.length === 0) break;

      // Delete in parallel batches of 5
      const batchSize = 5;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const promises = batch.map(r => 
          base44.asServiceRole.entities[entityName].delete(r.id)
            .catch(e => ({ error: true, id: r.id, msg: e.message }))
        );
        const results = await Promise.allSettled(promises);
        totalDeleted += results.filter(r => r.status === 'fulfilled').length;
      }

      if (records.length < 100) break;
    } catch (e) {
      if ((e.message?.includes('429') || e.message?.includes('Rate limit')) && retries < maxRetries - 1) {
        retries++;
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw e;
    }
  }

  return totalDeleted;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { phase } = await req.json();

    if (phase === 'preview') {
      const counts = {};
      let total = 0;

      for (const [entity, label] of CLEANUP_ENTITIES) {
        try {
          const records = await base44.asServiceRole.entities[entity].list(null, 1000);
          const count = records.length;
          counts[entity] = { label, count, capped: count === 1000 };
          total += count;
        } catch (e) {
          counts[entity] = { label, count: 0, error: e.message };
        }
      }

      // Check organizers & artists (non-admin users)
      const allUsers = await base44.asServiceRole.entities.User.list(null, 1000);
      const nonAdminUsers = allUsers.filter(u => u.role !== 'admin' || u.email !== user.email);
      counts['User (non-admin)'] = { label: 'Non-admin user accounts', count: nonAdminUsers.length };
      total += nonAdminUsers.length;

      return Response.json({ 
        phase: 'preview', 
        counts, 
        total,
        adminUser: { email: user.email, name: user.full_name, role: user.role },
      });
    }

    if (phase === 'execute') {
      const results = [];
      let totalDeleted = 0;
      const startTime = Date.now();

      // 1. Delete test entities (non-admin users first, then their data)
      const allUsers = await base44.asServiceRole.entities.User.list(null, 1000);
      const nonAdminUsers = allUsers.filter(u => u.role !== 'admin' || u.email !== user.email);
      
      // Batch delete non-admin users
      for (let i = 0; i < nonAdminUsers.length; i += 10) {
        const batch = nonAdminUsers.slice(i, i + 10);
        const promises = batch.map(u => base44.asServiceRole.entities.User.delete(u.id).catch(() => {}));
        await Promise.allSettled(promises);
        totalDeleted += batch.length;
      }
      results.push({ entity: 'User (non-admin)', label: 'Non-admin user accounts', deleted: nonAdminUsers.length, status: 'ok' });

      // 2. Delete all transaction/data entities in dependency order
      for (const [entity, label] of CLEANUP_ENTITIES) {
        try {
          const filter = entity === 'OrganizerStorageSettings' ? { is_global: false } : {};
          const deleted = await deleteAllRecords(base44, entity, filter);
          results.push({ entity, label, deleted, status: 'ok' });
          totalDeleted += deleted;
        } catch (e) {
          results.push({ entity, label, deleted: 0, status: 'error', error: e.message });
        }
      }

      // 3. Verify cleanup
      const verification = {};
      const criticalEntities = ['Event', 'Order', 'Artist', 'OrganizerProfile', 'Expense', 'AdminExpense'];
      for (const entity of criticalEntities) {
        const remaining = await base44.asServiceRole.entities[entity].list(null, 10).catch(() => []);
        verification[entity] = remaining.length;
      }

      return Response.json({
        phase: 'complete',
        totalDeleted,
        results,
        verification,
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
        executedBy: user.email,
        notes: 'Admin account, settings, integrations, and platform config preserved.',
      });
    }

    return Response.json({ error: 'Invalid phase. Use "preview" or "execute".' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});