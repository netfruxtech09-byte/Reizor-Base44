import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.21.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { eventId, items, usedCredit, walletAmountPaid = 0, guestNames, guestPhone, name, email, sellerCode, sellerLinkId, promoCode, promoDiscount, organizerExtraFee = 0, vendorCommission = 0, precomputedSubtotal, precomputedPlatformFee } = body;

  if (!eventId || !items?.length) {
    return Response.json({ error: 'Missing eventId or items' }, { status: 400 });
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

  function getPlatformFee(price) {
    if (price <= 50) return 1.0;
    if (price <= 100) return 1.5;
    if (price <= 250) return 2.0;
    if (price <= 500) return 3.0;
    return 5.0;
  }

  // USD-per-unit rate for the event currency (cached hourly by the provider).
  // Used to convert a USD-tiered platform fee into the event currency.
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

  // Platform fee for a ticket priced in `currency`, returned in `currency`.
  function platformFeeForCurrency(priceLocal, currency, usdRate) {
    if (!currency || currency === 'USD' || !usdRate || usdRate <= 0) return getPlatformFee(priceLocal);
    return getPlatformFee(priceLocal * usdRate) / usdRate;
  }

  const evArr = await base44.asServiceRole.entities.Event.filter({ id: eventId }, null, 1);
  const event = evArr[0];
  if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });

  const ticketTypeIds = [...new Set(items.map(i => i.ticket_type_id))];
  const ttResults = await Promise.all(
    ticketTypeIds.map(id => base44.asServiceRole.entities.TicketType.filter({ id }, null, 1).then(r => r[0]).catch(() => null))
  );
  const ticketTypeMap = {};
  ttResults.forEach(tt => { if (tt) ticketTypeMap[tt.id] = tt; });

  const eventCurrency = event.currency || 'USD';
  // Fallback rate (only needed when the client did not precompute the fee).
  const usdRate = (typeof precomputedPlatformFee !== 'number' && eventCurrency !== 'USD')
    ? ((await fetchUsdRate(eventCurrency)) ?? 1)
    : 1;

  let subtotal = typeof precomputedSubtotal === 'number' ? precomputedSubtotal : 0;
  let platformFee = typeof precomputedPlatformFee === 'number' ? precomputedPlatformFee : 0;
  const orderItems = [];

  for (const item of items) {
    const tt = ticketTypeMap[item.ticket_type_id];
    if (!tt) return Response.json({ error: `Ticket type ${item.ticket_type_id} not found` }, { status: 404 });
    const itemSubtotal = tt.price * item.quantity;
    if (typeof precomputedSubtotal !== 'number') subtotal += itemSubtotal;
    if (typeof precomputedPlatformFee !== 'number') platformFee += platformFeeForCurrency(tt.price, eventCurrency, usdRate) * item.quantity;
    orderItems.push({
      ticket_type_id: tt.id,
      ticket_type_name: tt.name,
      quantity: item.quantity,
      unit_price: tt.price,
      subtotal: itemSubtotal,
    });
  }

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  // ── WL Hierarchy Fee Calculation ────────────────────────────────────────────
  // Resolve the WL context from the organizer's account
  let wlFeeBreakdown = [];
  let wlFeeTotal = 0;
  let childWlId = null;
  let childWlName = null;

  try {
    if (event.organizer_id) {
      const orgUser = await base44.asServiceRole.entities.User.filter({ id: event.organizer_id }, null, 1).catch(() => []);
      const orgEmail = orgUser[0]?.email;
      if (orgEmail) {
        // Find the WL record this organizer belongs to (by managed_organizer_ids or email match)
        const wlRecords = await base44.asServiceRole.entities.WhiteLabel.list('-created_date', 200).catch(() => []);
        const matchingWL = wlRecords.find(wl => {
          const managedIds = wl.managed_organizer_ids || [];
          return managedIds.includes(event.organizer_id) || wl.email === orgEmail;
        });
        if (matchingWL) {
          childWlId = matchingWL.id;
          childWlName = matchingWL.brand_name || matchingWL.name;
        }
      }
    }

    if (childWlId) {
      // Walk hierarchy and compute fees using asServiceRole (cannot be tampered by client)
      const now = new Date().toISOString();
      const chain = [];
      let currentId = childWlId;
      const visited = new Set();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const wlArr = await base44.asServiceRole.entities.WhiteLabel.filter({ id: currentId }, null, 1).catch(() => []);
        const wl = wlArr[0];
        if (!wl) break;
        chain.push({ wl_id: wl.id, wl_name: wl.brand_name || wl.name, wl_email: wl.email, parent_wl_id: wl.parent_wl_id || null });
        currentId = wl.parent_wl_id || null;
      }

      for (let i = 0; i < chain.length; i++) {
        const child = chain[i];
        const parentWlId = chain[i + 1]?.wl_id || null;

        const configs = await base44.asServiceRole.entities.WLFeeConfig.filter(
          { child_wl_id: child.wl_id, is_active: true },
          '-effective_from',
          10
        ).catch(() => []);

        const config = configs.find(c => {
          const parentMatches = parentWlId ? c.parent_wl_id === parentWlId : c.parent_type === 'reizor';
          const isEffective = !c.effective_from || c.effective_from <= now;
          return parentMatches && isEffective;
        });

        if (!config) continue;

        let feeAmount = 0;
        if (config.fee_type === 'percentage' || config.fee_type === 'both') {
          feeAmount += parseFloat(((config.fee_percent || 0) / 100 * subtotal).toFixed(2));
        }
        if (config.fee_type === 'flat' || config.fee_type === 'both') {
          feeAmount += parseFloat(((config.fee_flat || 0) * totalQty).toFixed(2));
        }

        wlFeeBreakdown.push({
          config_id: config.id,
          parent_type: config.parent_type,
          parent_wl_id: config.parent_wl_id || null,
          parent_wl_name: config.parent_wl_name || 'Reizor',
          child_wl_id: child.wl_id,
          child_wl_name: child.wl_name,
          fee_type: config.fee_type,
          fee_percent: config.fee_percent || 0,
          fee_flat: config.fee_flat || 0,
          fee_amount: feeAmount,
        });
      }

      wlFeeBreakdown.reverse(); // Root → child order
      wlFeeTotal = parseFloat(wlFeeBreakdown.reduce((s, b) => s + b.fee_amount, 0).toFixed(2));
    }
  } catch (wlErr) {
    // WL fee calculation failure should not block checkout — log and continue
    console.error('[WL Fee] Calculation error:', wlErr.message);
  }

  const extraFees = (parseFloat(organizerExtraFee) || 0) + (parseFloat(vendorCommission) || 0);
  const displayedFee = platformFee + extraFees + wlFeeTotal;
  const promoDiscountAmt = parseFloat(promoDiscount || 0);
  const creditApplied = Math.min(usedCredit || 0, subtotal + displayedFee - promoDiscountAmt);
  const walletApplied = Math.min(parseFloat(walletAmountPaid || 0), subtotal + displayedFee - promoDiscountAmt - creditApplied);
  const amountBeforeStripe = Math.max(0, subtotal + displayedFee - promoDiscountAmt - creditApplied - walletApplied);
  const cardProcessingFee = amountBeforeStripe > 0 ? parseFloat((amountBeforeStripe * 0.029 + 0.30).toFixed(2)) : 0;
  const chargeStripeFeeToBuyer = event.cc_fee_on_buyer !== false;
  const stripeFee = chargeStripeFeeToBuyer ? cardProcessingFee : 0;
  const grandTotal = parseFloat((amountBeforeStripe + stripeFee).toFixed(2));

  let paymentMethod = 'stripe';
  if (walletApplied > 0 && amountBeforeStripe > 0) {
    paymentMethod = 'hybrid';
  } else if (walletApplied > 0 && amountBeforeStripe <= 0) {
    paymentMethod = 'wallet';
  }

  let organizerEmail = '';
  if (event.organizer_id) {
    const orgUsers = await base44.asServiceRole.entities.User.filter({ id: event.organizer_id }, null, 1).catch(() => []);
    organizerEmail = orgUsers[0]?.email || '';
  }

  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  const now = new Date().toISOString();
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
    service_fee: displayedFee,
    card_processing_fee: cardProcessingFee,
    cc_fee_paid_by: chargeStripeFeeToBuyer ? 'buyer' : 'organizer',
    tax: 0,
    discount_amount: creditApplied + walletApplied + promoDiscountAmt,
    total: grandTotal,
    currency: event.currency || 'USD',
    status: 'pending',
    pending_reason: 'awaiting_stripe_confirmation',
    pending_since: now,
    status_updated_at: now,
    payment_method: paymentMethod,
    wallet_amount_paid: walletApplied,
    stripe_amount_paid: amountBeforeStripe + stripeFee,
    stripe_payment_status: 'pending',
    guest_names: guestNames || [],
    guest_phone: guestPhone || '',
    quantity: totalQty,
    seller_link_code: sellerCode || '',
    seller_link_id: sellerLinkId || '',
    organizer_extra_fee: parseFloat(organizerExtraFee) || (event.organizer_extra_fee || 0) * totalQty,
    promo_code: promoCode || '',
    status_history: [{ status: 'pending', pending_reason: 'awaiting_stripe_confirmation', changed_at: now, changed_by: 'system' }],
    // WL hierarchy fees — stored for audit
    wl_fee_total: wlFeeTotal,
    wl_fee_breakdown: wlFeeBreakdown,
    child_wl_id: childWlId || '',
    child_wl_name: childWlName || '',
  });

  // Free order — fulfill immediately (credit only or credit + wallet)
  if (grandTotal <= 0) {
    const paidAt = new Date().toISOString();
    await base44.asServiceRole.entities.Order.update(order.id, {
      status: 'completed',
      stripe_payment_status: 'paid',
      paid_at: paidAt,
      status_updated_at: paidAt,
      status_history: [...(order.status_history || []), { status: 'completed', pending_reason: null, changed_at: paidAt, changed_by: 'system' }],
    });

    if (walletApplied > 0) {
      const walletRecords = await base44.asServiceRole.entities.ResaleSellerBalance.filter({ seller_email: email || user.email }, null, 1).catch(() => []);
      if (walletRecords[0]) {
        await base44.asServiceRole.entities.ResaleSellerBalance.update(walletRecords[0].id, {
          available_balance: Math.max(0, (walletRecords[0].available_balance || 0) - walletApplied),
          last_transaction_date: paidAt,
        });
        await base44.asServiceRole.entities.ResaleWalletTransaction.create({
          seller_email: email || user.email,
          seller_name: name || user.full_name,
          transaction_type: 'debit',
          amount: walletApplied,
          event_id: eventId,
          event_title: event.title,
          description: `Ticket Purchase - Order ${order.id}`,
          status: 'completed',
        });
      }
    }

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
          paid_with_credit: creditApplied > 0 || walletApplied > 0,
        });
      }
      const tt = ticketTypeMap[item.ticket_type_id];
      if (tt) {
        await base44.asServiceRole.entities.TicketType.update(item.ticket_type_id, {
          quantity_sold: (tt.quantity_sold || 0) + item.quantity,
        }).catch(() => {});
      }
    }
    await base44.asServiceRole.entities.Event.update(eventId, {
      tickets_sold: (event.tickets_sold || 0) + totalQty,
    }).catch(() => {});

    if (sellerLinkId || sellerCode) {
      const slArr = sellerLinkId
        ? await base44.asServiceRole.entities.SellerLink.filter({ id: sellerLinkId }, null, 1).catch(() => [])
        : await base44.asServiceRole.entities.SellerLink.filter({ tracking_code: sellerCode, event_id: eventId }, null, 1).catch(() => []);
      const sl = slArr[0];
      if (sl) {
        let commission = 0;
        if (sl.commission_type === 'fixed') commission = (sl.commission_value || 0) * totalQty;
        else if (sl.commission_type === 'percentage') commission = subtotal * ((sl.commission_value || 0) / 100);
        await base44.asServiceRole.entities.SellerLink.update(sl.id, {
          tickets_sold: (sl.tickets_sold || 0) + totalQty,
          total_revenue: (sl.total_revenue || 0) + subtotal,
          commission_earned: (sl.commission_earned || 0) + commission,
          last_sale_date: new Date().toISOString(),
        }).catch(() => {});
      }
    }

    return Response.json({ free: true, orderId: order.id });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(grandTotal * 100),
    currency: (event.currency || 'USD').toLowerCase(),
    receipt_email: email || user.email,
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
      wallet_applied: String(walletApplied),
      platform_fee: String(displayedFee),
      stripe_fee: String(stripeFee),
      grand_total: String(grandTotal),
      wl_fee_total: String(wlFeeTotal),
      child_wl_id: childWlId || '',
      seller_code: sellerCode || '',
      seller_link_id: sellerLinkId || '',
      guest_names: JSON.stringify(guestNames || []),
      promo_code: promoCode || '',
      promo_discount: String(promoDiscountAmt),
      payment_method: paymentMethod,
    },
  });

  await base44.asServiceRole.entities.Order.update(order.id, {
    stripe_payment_intent_id: paymentIntent.id,
  });

  return Response.json({
    clientSecret: paymentIntent.client_secret,
    orderId: order.id,
    grandTotal,
    wlFeeTotal,
  });
});