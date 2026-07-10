import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const TABLE_PLATFORM_FEE = 10;

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
function tableFeeForCurrency(currency, usdRate) {
  if (!currency || currency === 'USD' || !usdRate || usdRate <= 0) return TABLE_PLATFORM_FEE;
  return TABLE_PLATFORM_FEE / usdRate;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

  const body = await req.json();
  const { tableId, eventId, sellerLinkId, buyerName, buyerEmail, grandTotal, stripeFee } = body;

  if (!tableId || !eventId) return Response.json({ error: 'Missing tableId or eventId' }, { status: 400 });

  const [evArr, tableArr] = await Promise.all([
    base44.asServiceRole.entities.Event.filter({ id: eventId }, null, 1),
    base44.asServiceRole.entities.Table.filter({ id: tableId }, null, 1),
  ]);
  const event = evArr[0];
  const table = tableArr[0];
  if (!event || !table) return Response.json({ error: 'Event or table not found' }, { status: 404 });

  let sellerLink = null;
  if (sellerLinkId) {
    const slArr = await base44.asServiceRole.entities.SellerLink.filter({ id: sellerLinkId }, null, 1).catch(() => []);
    sellerLink = slArr[0] || null;
  }

  let vendorCommission = 0;
  if (sellerLink && sellerLink.commission_type && sellerLink.commission_type !== 'none') {
    if (sellerLink.commission_type === 'fixed') {
      vendorCommission = sellerLink.commission_value || 0;
    } else if (sellerLink.commission_type === 'percentage') {
      vendorCommission = (table.price || 0) * ((sellerLink.commission_value || 0) / 100);
    }
  }

  const tablePrice = table.price || 0;
  const eventCurrency = event.currency || 'USD';
  const usdRate = eventCurrency === 'USD' ? 1 : ((await fetchUsdRate(eventCurrency)) ?? 1);
  const convertedTableFee = tableFeeForCurrency(eventCurrency, usdRate);
  const processingFee = parseFloat((stripeFee || 0).toFixed(2));
  const baseAmount = parseFloat((tablePrice + convertedTableFee + vendorCommission).toFixed(2));
  const totalAmount = grandTotal ? parseFloat(parseFloat(grandTotal).toFixed(2)) : parseFloat((baseAmount * 1.029 + 0.30).toFixed(2));

  let organizerEmail = '';
  if (event.organizer_id) {
    const orgArr = await base44.asServiceRole.entities.User.filter({ id: event.organizer_id }, null, 1).catch(() => []);
    organizerEmail = orgArr[0]?.email || '';
  }

  const orderNumber = `TBL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  const order = await base44.asServiceRole.entities.Order.create({
    order_number: orderNumber,
    event_id: eventId,
    event_title: event.title,
    organizer_id: event.organizer_id,
    organizer_name: event.organizer_name,
    organizer_email: organizerEmail,
    customer_email: buyerEmail || user.email,
    customer_name: buyerName || user.full_name,
    items: [{ ticket_type_id: tableId, ticket_type_name: table.name, quantity: 1, unit_price: tablePrice, subtotal: tablePrice }],
    subtotal: tablePrice,
    service_fee: convertedTableFee,
    vendor_commission: vendorCommission,
    tax: processingFee,
    total: totalAmount,
    currency: event.currency || 'USD',
    status: 'pending',
    payment_method: 'stripe',
    stripe_payment_status: 'pending',
    seller_link_id: sellerLinkId || '',
    seller_tracking_code: sellerLink?.tracking_code || '',
  });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(totalAmount * 100),
    currency: (event.currency || 'USD').toLowerCase(),
    receipt_email: buyerEmail || user.email,
    metadata: {
      type: 'table',
      order_id: order.id,
      event_id: eventId,
      table_id: tableId,
      table_name: table.name,
      buyer_email: buyerEmail || user.email,
      buyer_name: buyerName || user.full_name || user.email,
      seller_link_id: sellerLinkId || '',
      seller_tracking_code: sellerLink?.tracking_code || '',
      platform_fee: String(convertedTableFee),
      vendor_commission: String(vendorCommission),
      processing_fee: String(processingFee),
      total: String(totalAmount),
    },
  });

  await base44.asServiceRole.entities.Order.update(order.id, {
    stripe_payment_intent_id: paymentIntent.id,
  });

  return Response.json({
    clientSecret: paymentIntent.client_secret,
    orderId: order.id,
    grandTotal: totalAmount,
  });
});