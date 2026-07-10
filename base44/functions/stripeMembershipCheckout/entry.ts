import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

// Membership plans
const PLANS = {
  standard: { price: 4.99, label: 'Standard Membership' },
  premium:  { price: 9.99, label: 'Premium Membership' },
};

Deno.serve(async (req) => {
   const base44 = createClientFromRequest(req);
   const user = await base44.auth.me();
   if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

   const { planKey, loyaltyAccountId } = await req.json();
   const plan = PLANS[planKey];
   if (!plan) return Response.json({ error: 'Invalid plan' }, { status: 400 });

   // CC fee (3%)
   const ccFee = parseFloat((plan.price * 0.03).toFixed(2));
   const total = parseFloat((plan.price + ccFee).toFixed(2));
   const totalCents = Math.round(total * 100);

   // Create a PaymentIntent instead of a Checkout Session
   const paymentIntent = await stripe.paymentIntents.create({
     amount: totalCents,
     currency: 'usd',
     receipt_email: user.email,
     metadata: {
       type: 'membership',
       membership_plan: planKey,
       loyalty_account_id: loyaltyAccountId || '',
       user_email: user.email,
       user_name: user.full_name || '',
       base_price: String(plan.price),
       cc_fee: String(ccFee),
       total: String(total),
     },
   });

   return Response.json({ clientSecret: paymentIntent.client_secret });
});