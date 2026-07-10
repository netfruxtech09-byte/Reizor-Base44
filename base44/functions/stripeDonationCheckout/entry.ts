import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { artistId, artistName, artistEmail, amount, message } = await req.json();

  if (!artistId || !amount || amount < 1) {
    return Response.json({ error: 'Invalid donation amount' }, { status: 400 });
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

  const fee = parseFloat((amount * 0.1).toFixed(2));
  const net = parseFloat((amount - fee).toFixed(2));
  const totalCents = Math.round(amount * 100);

  // Create pending donation record
  const donation = await base44.asServiceRole.entities.ArtistDonation.create({
    artist_id: artistId,
    artist_name: artistName,
    artist_email: artistEmail,
    donor_email: user.email,
    donor_name: user.full_name,
    amount,
    platform_fee: fee,
    net_amount: net,
    message: message || '',
    status: 'pending',
  });

  // Create a PaymentIntent instead of a Checkout Session
   const paymentIntent = await stripe.paymentIntents.create({
     amount: totalCents,
     currency: 'usd',
     receipt_email: user.email,
     metadata: {
       type: 'donation',
       donation_id: donation.id,
       artist_id: artistId,
       artist_name: artistName || '',
       artist_email: artistEmail || '',
       donor_email: user.email,
       donor_name: user.full_name || '',
       net_amount: String(net),
       platform_fee: String(fee),
     },
   });

  // Save payment intent id (idempotency: use stripe_payment_intent_id as unique key)
  await base44.asServiceRole.entities.ArtistDonation.update(donation.id, {
    stripe_payment_intent_id: paymentIntent.id,
    stripe_webhook_event_id: '', // Will be set by webhook
  });

  return Response.json({
    clientSecret: paymentIntent.client_secret,
    donationId: donation.id,
  });
});