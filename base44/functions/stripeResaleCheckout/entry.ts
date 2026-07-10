import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

function getResalePlatformFee(price) {
  if (price <= 50) return 1.0;
  if (price <= 100) return 1.5;
  if (price <= 250) return 2.0;
  if (price <= 500) return 3.0;
  return 5.0;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticketListingId } = await req.json();
  if (!ticketListingId) return Response.json({ error: 'Missing ticketListingId' }, { status: 400 });

  const listings = await base44.asServiceRole.entities.TicketListing.filter({ id: ticketListingId }, null, 1).catch(() => []);
  const listing = listings[0];
  if (!listing) return Response.json({ error: 'Listing not found' }, { status: 404 });
  if (listing.status !== 'active') return Response.json({ error: 'Listing no longer available' }, { status: 400 });
  if (listing.seller_email === user.email) return Response.json({ error: "Can't buy your own listing" }, { status: 400 });

  const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

  const listingPrice = listing.resale_price || listing.listing_price || 0;
  const platformFee = getResalePlatformFee(listingPrice);
  const buyerTotal = parseFloat((listingPrice + platformFee).toFixed(2));

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(buyerTotal * 100),
    currency: 'usd',
    receipt_email: user.email,
    metadata: {
      type: 'resale',
      ticket_listing_id: ticketListingId,
      ticket_id: listing.ticket_id || '',
      event_id: listing.event_id || '',
      event_title: listing.event_title || '',
      buyer_email: user.email,
      buyer_name: user.full_name || user.email,
      seller_email: listing.seller_email || '',
      seller_name: listing.seller_name || '',
      listing_price: String(listingPrice),
      platform_fee: String(platformFee),
      buyer_total: String(buyerTotal),
    },
  });

  return Response.json({
    clientSecret: paymentIntent.client_secret,
    buyerTotal,
    listingId: ticketListingId,
  });
});