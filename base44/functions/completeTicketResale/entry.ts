import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Security: this endpoint transfers ticket ownership. It must NOT be callable
    // by a regular buyer, otherwise any authenticated user could acquire any
    // listed resale ticket for free. Legitimate resale purchases are paid via
    // the verified Stripe flow (stripeResaleCheckout -> stripeWebhook ->
    // processResaleCompletion). This direct completion path is restricted to
    // admins for manual/support interventions only.
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: resale completion requires admin authorization' }, { status: 403 });
    }

    const body = await req.json();
    const { ticket_listing_id, event_id } = body;
    let { ticket_id } = body;

    if (!ticket_listing_id) {
      return Response.json({ error: 'Missing ticket_listing_id' }, { status: 400 });
    }

    // Get the ticket listing
    const listings = await base44.asServiceRole.entities.TicketListing.filter(
      { id: ticket_listing_id }, null, 1
    ).catch(() => []);

    if (listings.length === 0) {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }

    const listing = listings[0];

    // Use ticket_id from listing if not explicitly provided
    if (!ticket_id) ticket_id = listing.ticket_id;

    if (!ticket_id) {
      return Response.json({ error: 'Ticket ID not found in listing' }, { status: 400 });
    }

    // Prevent seller from buying their own ticket
    if (listing.seller_email === user.email) {
      return Response.json({ error: "You can't buy your own listing" }, { status: 400 });
    }

    // Check listing is still active
    if (listing.status !== 'active') {
      return Response.json({ error: 'This listing is no longer available' }, { status: 400 });
    }

    // Get the ticket
    const tickets = await base44.asServiceRole.entities.Ticket.filter(
      { id: ticket_id }, null, 1
    ).catch(() => []);

    if (tickets.length === 0) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const ticket = tickets[0];

    // Block resale of loyalty reward tickets
    if (ticket.purchased_with_loyalty) {
      return Response.json({ error: 'Reward tickets cannot be resold' }, { status: 400 });
    }

    // Support both field names (resale_price from ResellModal, listing_price from ResaleMarketplace)
    const listingPrice = listing.resale_price || listing.listing_price || 0;
    if (!listingPrice) {
      return Response.json({ error: 'Listing has no valid price' }, { status: 400 });
    }
    const originalPrice = listing.original_price || ticket.resale_original_price || ticket.price_paid || 0;

    // Tiered platform fee paid by the BUYER (same scale as primary sales)
    function getResalePlatformFee(price) {
      if (price <= 50) return 1.0;
      if (price <= 100) return 1.5;
      if (price <= 250) return 2.0;
      if (price <= 500) return 3.0;
      return 5.0;
    }
    const platformFee = getResalePlatformFee(listingPrice);
    const buyerTotal = listingPrice + platformFee; // buyer pays listing price + fee
    const sellerPayout = listingPrice;             // seller receives full listing price

    // Create transaction record
    const transaction = await base44.asServiceRole.entities.ResaleTransaction.create({
      ticket_listing_id,
      ticket_id,
      event_id: listing.event_id || event_id,
      event_title: listing.event_title,
      original_seller_email: listing.seller_email,
      original_seller_name: listing.seller_name,
      buyer_email: user.email,
      buyer_name: user.full_name,
      listing_price: listingPrice,
      original_ticket_price: originalPrice,
      buyer_total: buyerTotal,
      platform_fee: platformFee,
      seller_payout: sellerPayout,
      status: 'completed',
      completed_at: new Date().toISOString(),
      payment_method: 'platform_credit',
    });

    // Transfer ticket ownership to buyer
    // Preserve the original price chain for multi-resale support
    await base44.asServiceRole.entities.Ticket.update(ticket_id, {
      owner_email: user.email,
      owner_name: user.full_name,
      price_paid: buyerTotal,
      is_resale: true,
      resale_original_price: originalPrice,
    });

    // Mark listing as sold
    await base44.asServiceRole.entities.TicketListing.update(ticket_listing_id, {
      status: 'sold',
      sold_at: new Date().toISOString(),
      sold_to_email: user.email,
    });

    // Send confirmation emails (non-blocking)
    Promise.all([
      base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject: `✅ Ticket Purchase Confirmed — ${listing.event_title}`,
        body: `Congratulations! You purchased a ticket to ${listing.event_title}!\n\nTicket price: $${listingPrice.toFixed(2)}\nPlatform fee: $${platformFee.toFixed(2)}\nTotal paid: $${buyerTotal.toFixed(2)}\n\nView your tickets at /my-tickets`,
      }).catch(() => {}),
      base44.asServiceRole.integrations.Core.SendEmail({
        to: listing.seller_email,
        subject: `💰 Your Ticket Sold — ${listing.event_title}`,
        body: `Your ticket to ${listing.event_title} sold for $${listingPrice.toFixed(2)}!\n\nYour payout: $${sellerPayout.toFixed(2)}\n(Platform fee is covered by the buyer)`,
      }).catch(() => {}),
    ]).catch(() => {});

    return Response.json({
      success: true,
      transaction_id: transaction.id,
      message: 'Ticket transferred successfully.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});