import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

function getPlatformFee(price) {
  if (price <= 50) return 1.0;
  if (price <= 100) return 1.5;
  if (price <= 250) return 2.0;
  if (price <= 500) return 3.0;
  return 5.0;
}

async function fetchUsdRate(currency) {
  if (!currency || currency === 'USD') return 1;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.result !== 'success' || !data.rates?.USD) return null;
    return data.rates.USD;
  } catch { return null; }
}
function platformFeeForCurrency(priceLocal, currency, usdRate) {
  if (!currency || currency === 'USD' || !usdRate || usdRate <= 0) return getPlatformFee(priceLocal);
  return getPlatformFee(priceLocal * usdRate) / usdRate;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { eventId, items, usedCredit, guestNames, guestPhone, name, email, sellerCode, promoCode, promoDiscount } = body;

  if (!eventId || !items?.length) {
    return Response.json({ error: 'Missing eventId or items' }, { status: 400 });
  }

  // Load event
  const evArr = await base44.asServiceRole.entities.Event.filter({ id: eventId }, null, 1);
  const event = evArr[0];
  if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });

  // Load all ticket types for the items
  const ticketTypeIds = [...new Set(items.map(i => i.ticket_type_id))];
  const ttResults = await Promise.all(
    ticketTypeIds.map(id => base44.asServiceRole.entities.TicketType.filter({ id }, null, 1).then(r => r[0]).catch(() => null))
  );
  const ticketTypeMap = {};
  ttResults.forEach(tt => { if (tt) ticketTypeMap[tt.id] = tt; });

  // Calculate totals
  const eventCurrency = event.currency || 'USD';
  const usdRate = eventCurrency === 'USD' ? 1 : ((await fetchUsdRate(eventCurrency)) ?? 1);
  let subtotal = 0;
  let platformFee = 0;
  const orderItems = [];

  for (const item of items) {
    const tt = ticketTypeMap[item.ticket_type_id];
    if (!tt) return Response.json({ error: `Ticket type ${item.ticket_type_id} not found` }, { status: 404 });
    const itemSubtotal = tt.price * item.quantity;
    subtotal += itemSubtotal;
    platformFee += platformFeeForCurrency(tt.price, eventCurrency, usdRate) * item.quantity;
    orderItems.push({
      ticket_type_id: tt.id,
      ticket_type_name: tt.name,
      quantity: item.quantity,
      unit_price: tt.price,
      subtotal: itemSubtotal,
    });
  }

  const promoDiscountAmt = parseFloat(promoDiscount || 0);
  const creditApplied = Math.min(usedCredit || 0, subtotal + platformFee - promoDiscountAmt);
  const amountBeforeStripe = Math.max(0, subtotal + platformFee - promoDiscountAmt - creditApplied);
  // Only charge CC fee to buyer if organizer setting allows it (default: true)
  const chargeStripeFeeToBuyer = event.cc_fee_on_buyer !== false;
  // Calculate card fee on the base amount (subtotal + platform fee - discounts/credits)
  const cardProcessingFee = amountBeforeStripe > 0 ? parseFloat((amountBeforeStripe * 0.029 + 0.30).toFixed(2)) : 0;
  // If buyer pays CC fee, add it to total; if organizer absorbs it, do not add to customer total
  const stripeFee = chargeStripeFeeToBuyer ? cardProcessingFee : 0;
  const grandTotal = parseFloat((amountBeforeStripe + stripeFee).toFixed(2));

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  // Get organizer email
  let organizerEmail = '';
  if (event.organizer_id) {
    const orgUsers = await base44.asServiceRole.entities.User.filter({ id: event.organizer_id }, null, 1).catch(() => []);
    organizerEmail = orgUsers[0]?.email || '';
  }

  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  // Create a pending order BEFORE Stripe — fulfilled by webhook on success
  const order = await base44.asServiceRole.entities.Order.create({
    order_number: orderNumber,
    event_id: eventId,
    event_title: event.title,
    organizer_id: event.organizer_id,
    organizer_name: event.organizer_name,
    organizer_email: organizerEmail,
    customer_email: email || user.email,
    customer_name: name || user.full_name,
    items: orderItems,
    subtotal,
    service_fee: platformFee,
    card_processing_fee: cardProcessingFee,
    cc_fee_paid_by: chargeStripeFeeToBuyer ? 'buyer' : 'organizer',
    tax: 0,
    discount_amount: creditApplied + promoDiscountAmt,
    total: grandTotal,
    currency: event.currency || 'USD',
    status: 'pending',
    payment_method: 'stripe',
    stripe_payment_status: 'pending',
    guest_names: guestNames || [],
    guest_phone: guestPhone || '',
    quantity: totalQty,
    seller_link_code: sellerCode || '',
    organizer_extra_fee: (event.organizer_extra_fee || 0) * totalQty,
    promo_code: promoCode || '',
  });

  // Free order (fully covered by credit/promo)
  if (grandTotal <= 0) {
    // Fulfill immediately
    await base44.asServiceRole.entities.Order.update(order.id, {
      status: 'completed',
      stripe_payment_status: 'paid',
      paid_at: new Date().toISOString(),
    });
    // Create tickets
    for (const item of orderItems) {
      for (let i = 0; i < item.quantity; i++) {
        const ticketCode = `TKT-${order.id.slice(-6).toUpperCase()}-${i + 1}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        await base44.asServiceRole.entities.Ticket.create({
          ticket_code: ticketCode,
          event_id: eventId,
          event_title: event.title,
          order_id: order.id,
          ticket_type_id: item.ticket_type_id,
          ticket_type_name: item.ticket_type_name,
          owner_email: email || user.email,
          owner_name: name || user.full_name,
          price_paid: item.unit_price,
          status: 'active',
          qr_data: ticketCode,
          paid_with_credit: creditApplied > 0,
        });
      }
      // Update ticket inventory
      const tt = ticketTypeMap[item.ticket_type_id];
      if (tt) {
        await base44.asServiceRole.entities.TicketType.update(item.ticket_type_id, {
          quantity_sold: (tt.quantity_sold || 0) + item.quantity,
        }).catch(() => {});
      }
    }
    // Update event tickets_sold
    await base44.asServiceRole.entities.Event.update(eventId, {
      tickets_sold: (event.tickets_sold || 0) + totalQty,
    }).catch(() => {});
    return Response.json({ free: true, orderId: order.id });
  }

  const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com';

  // Build Stripe line items (one line per ticket type)
  const stripeLineItems = orderItems.map(item => ({
    price_data: {
      currency: (event.currency || 'USD').toLowerCase(),
      product_data: {
        name: `${item.ticket_type_name} × ${item.quantity} — ${event.title}`,
        description: `${event.venue_name || ''} · ${event.city || ''}`,
      },
      unit_amount: Math.round(((item.unit_price * item.quantity + getPlatformFee(item.unit_price) * item.quantity) / orderItems.length + stripeFee / orderItems.length) * 100 / item.quantity),
    },
    quantity: item.quantity,
  }));

  // Simpler: single line item for grand total to avoid rounding issues
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: (event.currency || 'USD').toLowerCase(),
          product_data: {
            name: `${totalQty} Ticket${totalQty > 1 ? 's' : ''} — ${event.title}`,
            description: orderItems.map(i => `${i.ticket_type_name} ×${i.quantity}`).join(', '),
          },
          unit_amount: Math.round(grandTotal * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      order_id: order.id,
      event_id: eventId,
      items: JSON.stringify(orderItems.map(i => ({ ticket_type_id: i.ticket_type_id, ticket_type_name: i.ticket_type_name, quantity: i.quantity, unit_price: i.unit_price }))),
      quantity: String(totalQty),
      user_email: user.email,
      buyer_name: name || user.full_name,
      buyer_email: email || user.email,
      guest_phone: guestPhone || '',
      credit_applied: String(creditApplied),
      platform_fee: String(platformFee),
      stripe_fee: String(stripeFee),
      grand_total: String(grandTotal),
      seller_code: sellerCode || '',
      guest_names: JSON.stringify(guestNames || []),
      promo_code: promoCode || '',
      promo_discount: String(promoDiscountAmt),
    },
    customer_email: email || user.email,
    success_url: `${appUrl}/order-confirmation/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout/${eventId}?cancelled=1`,
  });

  // Save session ID to order
  await base44.asServiceRole.entities.Order.update(order.id, {
    stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent || '',
  });

  return Response.json({ sessionId: session.id, sessionUrl: session.url, orderId: order.id });
});