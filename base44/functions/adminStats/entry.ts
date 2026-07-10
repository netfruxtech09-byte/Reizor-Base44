import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sr = base44.asServiceRole.entities;

    const [
      users, events, orders, tickets,
      loyaltyAccounts, externalEvents, whiteLabels, subLabels,
      payoutRequests
    ] = await Promise.all([
      sr.User.list(null, 500),
      sr.Event.list(null, 500),
      sr.Order.list("-created_date", 500),
      sr.Ticket.list(null, 500),
      sr.LoyaltyAccount.list(null, 500),
      sr.ExternalEvent.list(null, 500),
      sr.WhiteLabel.list(null, 200),
      sr.WhiteLabelFeeProposal.list("-created_date", 500),
      sr.OrganizerPayoutRequest.filter({ status: "pending_review" }, "-created_date", 100),
    ]);

    const wlIds = new Set(whiteLabels.map(wl => wl.id));
    const validSubLabels = subLabels.filter(p => p.parent_wl_id && wlIds.has(p.parent_wl_id));

    const isEventPastUtil = (e) => {
      const refDate = e.end_date || e.date;
      if (!refDate) return false;
      return new Date(refDate) < new Date();
    };
    const isActivePublishedUtil = (e) => {
      const isPublished = e.status === "published" || e.status === "sold_out";
      const isDeactivated = e.deactivated === true;
      const isPast = isEventPastUtil(e);
      return isPublished && !isDeactivated && !isPast;
    };

    const completedOrders = orders.filter(o => o.status === "completed");
    const gmv = completedOrders.reduce((s, o) => s + (o.total || 0), 0);
    const activeMembers = loyaltyAccounts.filter(l => l.membership_status === "active");
    const standardMembers = activeMembers.filter(l => l.membership_plan === "standard");
    const premiumMembers = activeMembers.filter(l => l.membership_plan === "premium");
    const membershipRevenue = (standardMembers.length * 5.14) + (premiumMembers.length * 10.29);
    const totalCashbackIssued = loyaltyAccounts.reduce((s, l) => s + (l.cashback_balance || 0), 0);
    const affiliateClicks = externalEvents.reduce((s, e) => s + (e.click_count || 0), 0);
    const affiliateConfirmed = externalEvents.reduce((s, e) => s + (e.confirmed_earnings || 0), 0);

    return Response.json({
      users: users.length,
      events: events.length,
      publishedEvents: events.filter(isActivePublishedUtil).length,
      orders: completedOrders.length,
      gmv,
      tickets: tickets.length,
      organizers: users.filter(u => u.role === "organizer").length,
      artists: users.filter(u => u.is_artist || u.role === "artist").length,
      managers: users.filter(u => u.role === "manager").length,
      fans: users.filter(u => !u.role || u.role === "user").length,
      admins: users.filter(u => u.role === "admin").length,
      whiteLabels: whiteLabels.length,
      subLabels: validSubLabels.length,
      subLabelsPending: validSubLabels.filter(p => p.status === "pending").length,
      pendingPayouts: payoutRequests.length,
      pendingPayoutDetails: payoutRequests.map(r => ({ organizer_name: r.organizer_name })),
      activeMembers: activeMembers.length,
      standardMembers: standardMembers.length,
      premiumMembers: premiumMembers.length,
      membershipRevenue,
      totalCashbackIssued,
      affiliateEvents: externalEvents.length,
      affiliateClicks,
      affiliateConfirmed,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});