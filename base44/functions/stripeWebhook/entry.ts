import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

// Create a one-time $3 fan_membership affiliate referral reward for the
// referrer (link owner) after the referred user completes the qualifying
// fan membership step. The referred user receives nothing.
// Guards: valid referrer email, no self-referral, no duplicate for the same
// referred user + referral_type.
async function createFanMembershipReferral(base44, referredEmail, referredName) {
  try {
    if (!referredEmail) return null;
    const users = await base44.asServiceRole.entities.User.filter({ email: referredEmail }, null, 1).catch(() => []);
    const referredUser = users[0];
    if (!referredUser) return null;
    const referrerEmail = referredUser.referred_by_email;
    if (!referrerEmail || referrerEmail === 'admin' || referrerEmail === referredEmail) return null;
    const referrers = await base44.asServiceRole.entities.User.filter({ email: referrerEmail }, null, 1).catch(() => []);
    const referrer = referrers[0];
    if (!referrer) return null;
    if (referrer.id === referredUser.id) return null;
    // Duplicate protection: no existing fan_membership reward for this referred user
    const existing = await base44.asServiceRole.entities.Referral.filter(
      { referred_email: referredEmail, referral_type: 'fan_membership' }, null, 1
    ).catch(() => []);
    if (existing.length > 0) return null;
    const unlockDate = new Date();
    unlockDate.setDate(unlockDate.getDate() + 90);
    const referralCode = `ref_${(referrer.id || '').slice(-8)}`;
    const ref = await base44.asServiceRole.entities.Referral.create({
      referrer_id: referrer.id,
      referrer_email: referrer.email,
      referrer_name: referrer.full_name || referrer.email,
      referrer_role: referrer.role || 'user',
      referral_code: referralCode,
      referred_id: referredUser.id,
      referred_email: referredEmail,
      referred_name: referredName || referredUser.full_name || referredEmail,
      referred_role: referredUser.role || 'user',
      referral_type: 'fan_membership',
      credit_earned: 3,
      unlock_date: unlockDate.toISOString(),
      status: 'locked',
    }).catch(() => null);
    if (ref) {
      await base44.asServiceRole.entities.Notification.create({
        user_email: referrer.email,
        title: `🎁 +$3 Referral: ${referredName || referredEmail} joined membership!`,
        message: `$3 affiliate reward locked for 90 days (unlocks ${unlockDate.toLocaleDateString()}). Referred user: ${referredName || referredEmail}. The person you referred did not receive a referral reward.`,
        type: 'general',
        link: '/organizer/referral',
      }).catch(() => {});
    }
    return ref;
  } catch (err) {
    console.error('createFanMembershipReferral error:', err.message);
    return null;
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    return Response.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  // Idempotency: only skip if an order already has this exact webhook event ID saved
  // (meaning we fully processed it before). A pending order won't have it yet.
  const existing = await base44.asServiceRole.entities.Order.filter(
    { stripe_webhook_event_id: event.id }, null, 1
  ).catch(() => []);
  if (existing.length > 0 && existing[0].status === 'completed') {
    console.log('Skipping already-processed event:', event.id);
    return Response.json({ received: true, skipped: 'already_processed' });
  }

  const data = event.data.object;

  try {
    switch (event.type) {

      // ── TICKET CHECKOUT COMPLETED ──
      case 'checkout.session.completed': {
        const session = data;
        if (session.payment_status !== 'paid') break;

        const meta = session.metadata || {};
        const orderId = meta.order_id;
        if (!orderId) break;

        const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId }, null, 1);
        const order = orders[0];
        if (!order || order.status === 'completed') break;

        const guestNames = JSON.parse(meta.guest_names || '[]');
        const buyerEmail = meta.buyer_email || session.customer_email;
        const buyerName = meta.buyer_name || '';
        // Support multi-item (new format) or single-item (legacy)
        const orderItemsMeta = meta.items ? JSON.parse(meta.items) : [{
          ticket_type_id: meta.ticket_type_id,
          ticket_type_name: '',
          quantity: parseInt(meta.quantity) || 1,
          unit_price: 0,
        }];
        const quantity = orderItemsMeta.reduce((s, i) => s + (i.quantity || 1), 0);

        // Handle table checkout (type === 'table')
        if (meta.type === 'table') {
          const tableId = meta.table_id;
          const buyerEmail = meta.buyer_email;
          const buyerName = meta.buyer_name;
          const platformFee = parseFloat(meta.platform_fee || '0');
          const vendorCommission = parseFloat(meta.vendor_commission || '0');
          const totalAmount = parseFloat(meta.total || '0');

          // Mark order completed
          await base44.asServiceRole.entities.Order.update(meta.order_id, {
            status: 'completed',
            stripe_payment_status: 'paid',
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent || '',
            stripe_customer_id: session.customer || '',
            stripe_webhook_event_id: event.id,
            paid_at: new Date().toISOString(),
          }).catch(() => {});

          // Create table reservation
          await base44.asServiceRole.entities.TableReservation.create({
            table_id: tableId,
            event_id: meta.event_id,
            order_id: meta.order_id,
            buyer_email: buyerEmail,
            buyer_name: buyerName,
            table_name: meta.table_name || '',
            status: 'reserved',
            platform_fee: platformFee,
            stripe_session_id: session.id,
          }).catch(() => {});

          // Update seller link stats
          if (meta.seller_link_id) {
            const slArr = await base44.asServiceRole.entities.SellerLink.filter({ id: meta.seller_link_id }, null, 1).catch(() => []);
            const sl = slArr[0];
            if (sl) {
              await base44.asServiceRole.entities.SellerLink.update(sl.id, {
                tables_sold: (sl.tables_sold || 0) + 1,
                total_revenue: (sl.total_revenue || 0) + totalAmount,
                commission_earned: (sl.commission_earned || 0) + vendorCommission,
                last_sale_date: new Date().toISOString(),
              }).catch(() => {});
            }
          }

          // Styled table reservation confirmation email
          try {
            const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://reizor.com';
            const evArrTable = await base44.asServiceRole.entities.Event.filter({ id: meta.event_id }, null, 1).catch(() => []);
            const evTable = evArrTable[0];
            const eventDateStrTable = evTable?.date
              ? new Date(evTable.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
              : '';
            const orderNumTable = meta.order_id?.slice(-8).toUpperCase() || 'N/A';

            const tableHtmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#07091a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#07091a;min-height:100vh;"><tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1024;border-radius:14px;border:1px solid #1e2545;overflow:hidden;">

<tr><td style="padding:22px 32px 18px;border-bottom:1px solid #1a2040;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><span style="font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">REIZOR</span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff1b8d;margin-left:3px;vertical-align:middle;"></span></td>
    <td align="right"><span style="font-size:10px;color:#5a647a;font-family:monospace;text-transform:uppercase;letter-spacing:2px;">Table Reservation</span></td>
  </tr></table>
</td></tr>

<tr><td style="padding:28px 32px 8px;">
  <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:900;color:#ffffff;">Table Reserved! &#x1FA91;</h1>
  <p style="margin:0 0 6px 0;font-size:15px;color:#d0d4e8;">Hi ${buyerName},</p>
  <p style="margin:0 0 20px 0;font-size:14px;color:#b0b8d4;line-height:1.7;">Your table has been confirmed for <strong style="color:#ffffff;">${evTable?.title || meta.event_id}</strong>. See you there!</p>

  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#131929;border:1px solid #232b4a;border-radius:10px;margin-bottom:20px;">
    <tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);width:45%;">Event</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${evTable?.title || meta.event_id}</td></tr>
    <tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">Venue</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${[evTable?.venue_name, evTable?.city].filter(Boolean).join(', ') || '—'}</td></tr>
    ${eventDateStrTable ? `<tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">Date</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${eventDateStrTable}</td></tr>` : ''}
    ${evTable?.doors_open ? `<tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">Doors Open</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${evTable.doors_open}</td></tr>` : ''}
    <tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">Table</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${meta.table_name || 'VIP Table'}</td></tr>
    <tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">Booking Ref</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06);font-family:monospace;">${orderNumTable}</td></tr>
    <tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">Payment</td><td style="padding:9px 16px;color:#4ade80;font-size:13px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06);">PAID</td></tr>
    <tr><td style="padding:12px 16px;color:#ffffff;font-size:13px;font-weight:800;font-family:monospace;">Total Paid</td><td style="padding:12px 16px;color:#ff1b8d;font-size:16px;font-weight:900;">$${totalAmount.toFixed(2)}</td></tr>
  </table>

  <div style="text-align:center;margin:24px 0 8px;">
    <a href="${appUrl}/my-tickets" style="display:inline-block;background:linear-gradient(135deg,#ff1b8d,#d4006e);color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 40px;border-radius:8px;">View My Booking &#x2192;</a>
  </div>
  <p style="margin:20px 0 0;font-size:14px;color:#b0b8d4;text-align:center;">See you at the event! &#x1F389;</p>
</td></tr>

<tr><td style="padding:16px 32px;border-top:1px solid #1a2040;background:#09102a;">
  <p style="margin:0;font-size:11px;color:#4a5470;text-align:center;line-height:1.6;">Questions? Reply to this email or visit <a href="https://reizor.com" style="color:#ff1b8d;text-decoration:none;">reizor.com</a><br/>You received this because you made a reservation on Reizor.</p>
</td></tr>
<tr><td style="padding:12px 32px;border-top:1px solid #131929;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><span style="font-size:10px;color:#2e3650;font-family:monospace;">&#169; ${new Date().getFullYear()} Reizor &#183; All rights reserved</span></td>
    <td align="right"><span style="font-size:10px;color:#2e3650;font-family:monospace;">reizor.com</span></td>
  </tr></table>
</td></tr>

</table></td></tr></table></body></html>`;

            await base44.asServiceRole.integrations.Core.SendEmail({
              from_name: 'Reizor',
              to: buyerEmail,
              subject: `Table Reserved! \uD83E\uDE91 \u2014 ${evTable?.title || meta.event_id}`,
              body: tableHtmlBody,
            });
          } catch (tableEmailErr) {
            console.error('Table confirmation email failed:', tableEmailErr.message);
          }

          break;
        }

        // Handle donation checkout (type === 'donation')
        if (meta.type === 'donation' || meta.donation_id) {
          const donationId = meta.donation_id;
          if (donationId) {
            await base44.asServiceRole.entities.ArtistDonation.update(donationId, {
              status: 'completed',
              stripe_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent || '',
            }).catch(() => {});

            // Notify artist
            if (meta.artist_email) {
              await base44.asServiceRole.integrations.Core.SendEmail({
                from_name: 'Reizor',
                to: meta.artist_email,
                subject: `💸 You received a donation of $${parseFloat(meta.net_amount || '0').toFixed(2)}!`,
                body: `${meta.donor_email} just donated to you on Reizor!\n\nAmount: $${parseFloat(meta.net_amount || '0').toFixed(2)} (after platform fee)\n\nCheck your artist dashboard for details.`,
              }).catch(() => {});
            }
          }
          break;
        }

        // Handle resale checkout (type === 'resale')
        if (meta.type === 'resale') {
          const ticketListingId = meta.ticket_listing_id;
          const ticketId = meta.ticket_id;
          const buyerEmail = meta.buyer_email;
          const buyerName = meta.buyer_name;
          const listingPrice = parseFloat(meta.listing_price || '0');
          const platformFee = parseFloat(meta.platform_fee || '0');
          const buyerTotal = parseFloat(meta.buyer_total || '0');

          // Get ticket & listing
          const tixArr = await base44.asServiceRole.entities.Ticket.filter({ id: ticketId }, null, 1).catch(() => []);
          const listingsArr = await base44.asServiceRole.entities.TicketListing.filter({ id: ticketListingId }, null, 1).catch(() => []);
          const ticket = tixArr[0];
          const listing = listingsArr[0];
          if (!ticket || !listing) break;

          // Create ResaleTransaction record
          const txRes = await base44.asServiceRole.entities.ResaleTransaction.create({
            ticket_listing_id: ticketListingId,
            ticket_id: ticketId,
            event_id: listing.event_id || meta.event_id,
            event_title: listing.event_title || meta.event_title,
            original_seller_email: listing.seller_email || meta.seller_email,
            original_seller_name: listing.seller_name || meta.seller_name,
            buyer_email: buyerEmail,
            buyer_name: buyerName,
            listing_price: listingPrice,
            buyer_total: buyerTotal,
            platform_fee: platformFee,
            seller_payout: listingPrice,
            status: 'completed',
            completed_at: new Date().toISOString(),
            payment_method: 'stripe',
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent || '',
          }).catch(err => { console.error('Failed to create ResaleTransaction:', err.message); return null; });

          if (!txRes) break;

          // Call processResaleCompletion to handle wallet credit & ticket transfer atomically
          try {
            await base44.asServiceRole.functions.invoke('processResaleCompletion', {
              ticket_listing_id: ticketListingId,
              ticket_id: ticketId,
              resale_transaction_id: txRes.id,
              buyer_email: buyerEmail,
              buyer_name: buyerName,
              seller_email: listing.seller_email,
              seller_name: listing.seller_name,
              listing_price: listingPrice,
              platform_fee: platformFee,
              buyer_total: buyerTotal,
              event_id: listing.event_id,
              event_title: listing.event_title,
            });
          } catch (invokeErr) {
            console.error('processResaleCompletion failed:', invokeErr.message);
          }

          // Mark listing sold
          await base44.asServiceRole.entities.TicketListing.update(ticketListingId, {
            status: 'sold',
            sold_at: new Date().toISOString(),
            sold_to_email: buyerEmail,
            stripe_webhook_event_id: event.id,
          }).catch(() => {});

          break;
        }

        // Handle membership checkout (type === 'membership')
        if (meta.type === 'membership') {
          const loyId = meta.loyalty_account_id;
          const planKey = meta.membership_plan;
          const expiryDate = new Date();
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);

          if (loyId) {
            await base44.asServiceRole.entities.LoyaltyAccount.update(loyId, {
              membership_plan: planKey,
              membership_status: 'active',
              membership_expires_at: expiryDate.toISOString(),
              stripe_customer_id: session.customer || '',
            }).catch(() => {});
          }

          // Notify user
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: meta.user_email,
            subject: `🎉 ${planKey === 'premium' ? 'Premium' : 'Standard'} Membership Activated!`,
            body: `Hi ${meta.user_name},\n\nYour ${planKey} membership is now active! Enjoy your exclusive benefits including raffle entries and loyalty badge.\n\nYour membership renews on ${expiryDate.toLocaleDateString()}.\n\nView your profile at /profile`,
          }).catch(() => {});

          // Award $3 affiliate referral to the referrer (link owner) only
          await createFanMembershipReferral(base44, meta.user_email, meta.user_name);
          break;
        }

        // Fulfil order
        const completedAt = new Date().toISOString();
        const updatedOrder = await base44.asServiceRole.entities.Order.filter({ id: orderId }, null, 1).then(r => r[0]);
        const historyEntry = updatedOrder?.status_history || [];
        historyEntry.push({ status: 'completed', pending_reason: null, changed_at: completedAt, changed_by: 'webhook:checkout.session.completed' });
        
        await base44.asServiceRole.entities.Order.update(orderId, {
          status: 'completed',
          stripe_payment_status: 'paid',
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent || '',
          stripe_charge_id: session.payment_intent || '',
          stripe_customer_id: session.customer || '',
          stripe_webhook_event_id: event.id,
          paid_at: completedAt,
          status_updated_at: completedAt,
          status_history: historyEntry,
        });

        // Create tickets for each item
        let guestIdx = 0;
        for (const item of orderItemsMeta) {
          // Load ticket type for name/price if not in metadata
          let ttName = item.ticket_type_name || '';
          let ttPrice = item.unit_price || 0;
          if (!ttName || !ttPrice) {
            const ttArr = await base44.asServiceRole.entities.TicketType.filter({ id: item.ticket_type_id }, null, 1).catch(() => []);
            const tt = ttArr[0];
            if (tt) { ttName = tt.name; ttPrice = tt.price; }
          }
          for (let i = 0; i < item.quantity; i++) {
            const guestName = guestNames[guestIdx] || buyerName;
            guestIdx++;
            const ticketCode = `TKT-${orderId.slice(-6).toUpperCase()}-${guestIdx}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            await base44.asServiceRole.entities.Ticket.create({
              ticket_code: ticketCode,
              event_id: meta.event_id,
              event_title: order.event_title,
              order_id: orderId,
              ticket_type_id: item.ticket_type_id,
              ticket_type_name: ttName,
              owner_email: buyerEmail,
              owner_name: buyerName,
              guest_name: guestName,
              guest_phone: meta.guest_phone || '',
              price_paid: ttPrice,
              status: 'active',
              qr_data: ticketCode,
              paid_with_credit: parseFloat(meta.credit_applied || '0') > 0,
            });
          }
          // Update ticket type inventory
          const ttArr2 = await base44.asServiceRole.entities.TicketType.filter({ id: item.ticket_type_id }, null, 1).catch(() => []);
          const tt2 = ttArr2[0];
          if (tt2) {
            await base44.asServiceRole.entities.TicketType.update(item.ticket_type_id, {
              quantity_sold: (tt2.quantity_sold || 0) + item.quantity,
            }).catch(() => {});
          }
        }

        // Update event tickets_sold
        const evArr = await base44.asServiceRole.entities.Event.filter({ id: meta.event_id }, null, 1).catch(() => []);
        if (evArr[0]) {
          await base44.asServiceRole.entities.Event.update(meta.event_id, {
            tickets_sold: (evArr[0].tickets_sold || 0) + quantity,
          }).catch(() => {});
        }

        // Send confirmation email — only if not already sent (duplicate protection)
        if (!order.email_sent) {
          try {
            const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://reizor.com';
            const evFull = evArr[0];

            // Collect ticket codes
            const createdTickets = await base44.asServiceRole.entities.Ticket.filter({ order_id: orderId }).catch(() => []);
            const ticketCodesHtml = createdTickets
              .map(t => `<li style="margin:4px 0;font-family:monospace;font-size:13px;color:#b0b8d4;">${t.ticket_type_name || 'General Admission'}: <strong style="color:#ffffff;">${t.ticket_code}</strong></li>`)
              .join('');

            // Format date
            const eventDateStr = evFull?.date
              ? new Date(evFull.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
              : '';

            // Fee rows
            const subtotal = order.subtotal || 0;
            // Combined customer-facing service fee = platform fee + organizer extra fee + stripe processing fee
            // This matches exactly what was shown at checkout and charged via Stripe
            const serviceFee = (order.service_fee || 0) + (order.organizer_extra_fee || 0) + parseFloat(meta.stripe_fee || '0');
            const discountAmount = order.discount_amount || 0;
            const total = order.total || 0;

            let feeRowsHtml = `
              <tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);width:45%;">Subtotal</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">$${subtotal.toFixed(2)}</td></tr>
              <tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">Service Fee</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">$${serviceFee.toFixed(2)}</td></tr>`;
            if (discountAmount > 0) {
              feeRowsHtml += `<tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">Discount</td><td style="padding:9px 16px;color:#4ade80;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">-$${discountAmount.toFixed(2)}</td></tr>`;
            }
            feeRowsHtml += `<tr><td style="padding:12px 16px;color:#ffffff;font-size:13px;font-weight:800;font-family:monospace;">Total</td><td style="padding:12px 16px;color:#ff1b8d;font-size:16px;font-weight:900;">$${total.toFixed(2)}</td></tr>`;

            const htmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#07091a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#07091a;min-height:100vh;"><tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1024;border-radius:14px;border:1px solid #1e2545;overflow:hidden;">

<tr><td style="padding:22px 32px 18px;border-bottom:1px solid #1a2040;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><span style="font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">REIZOR</span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff1b8d;margin-left:3px;vertical-align:middle;"></span></td>
    <td align="right"><span style="font-size:10px;color:#5a647a;font-family:monospace;text-transform:uppercase;letter-spacing:2px;">Notification</span></td>
  </tr></table>
</td></tr>

<tr><td style="padding:28px 32px 8px;">
  <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:900;color:#ffffff;">Tickets Confirmed! 🎟️</h1>
  <p style="margin:0 0 6px 0;font-size:15px;color:#d0d4e8;">Hi ${buyerName},</p>
  <p style="margin:0 0 20px 0;font-size:14px;color:#b0b8d4;line-height:1.7;">Your tickets are confirmed for <strong style="color:#ffffff;">${order.event_title}</strong>. Present your QR codes at the door.</p>

  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#131929;border:1px solid #232b4a;border-radius:10px;margin-bottom:20px;">
    <tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);width:45%;">Event</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${order.event_title}</td></tr>
    <tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">Venue</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${[evFull?.venue_name, evFull?.city].filter(Boolean).join(', ') || '—'}</td></tr>
    ${eventDateStr ? `<tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">Date</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${eventDateStr}</td></tr>` : ''}
    ${evFull?.doors_open ? `<tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">Doors Open</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${evFull.doors_open}</td></tr>` : ''}
    <tr><td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.06);">Order #</td><td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06);font-family:monospace;">${order.order_number}</td></tr>
    ${feeRowsHtml}
  </table>

  <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#ffffff;">Your ticket codes:</p>
  <ul style="margin:0 0 24px 0;padding-left:16px;">${ticketCodesHtml}</ul>

  <div style="text-align:center;margin:24px 0 8px;">
    <a href="${appUrl}/my-tickets" style="display:inline-block;background:linear-gradient(135deg,#ff1b8d,#d4006e);color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 40px;border-radius:8px;">View My Tickets →</a>
  </div>
  <p style="margin:20px 0 0;font-size:14px;color:#b0b8d4;text-align:center;">See you at the show! 🎉</p>
</td></tr>

<tr><td style="padding:16px 32px;border-top:1px solid #1a2040;background:#09102a;">
  <p style="margin:0;font-size:11px;color:#4a5470;text-align:center;line-height:1.6;">Questions? Reply to this email or visit <a href="https://reizor.com" style="color:#ff1b8d;text-decoration:none;">reizor.com</a><br/>You received this because you have an account on Reizor.</p>
</td></tr>
<tr><td style="padding:12px 32px;border-top:1px solid #131929;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><span style="font-size:10px;color:#2e3650;font-family:monospace;">© ${new Date().getFullYear()} Reizor · All rights reserved</span></td>
    <td align="right"><span style="font-size:10px;color:#2e3650;font-family:monospace;">reizor.com</span></td>
  </tr></table>
</td></tr>

</table></td></tr></table></body></html>`;

            await base44.asServiceRole.integrations.Core.SendEmail({
              from_name: 'Reizor',
              to: buyerEmail,
              subject: `Tickets Confirmed! 🎟️ — ${order.event_title}`,
              body: htmlBody,
            });

            // Mark email sent to prevent duplicates on webhook retry
            await base44.asServiceRole.entities.Order.update(orderId, { email_sent: true }).catch(() => {});
            console.log('Confirmation email sent to:', buyerEmail);
          } catch (emailErr) {
            console.error('Confirmation email failed:', emailErr.message);
          }
        } else {
          console.log('Skipping duplicate confirmation email for order:', orderId);
        }

        break;
      }

      // ── PAYMENT INTENT SUCCEEDED (embedded payment flow) ──
      case 'payment_intent.succeeded': {
        const pi = data;
        const meta = pi.metadata || {};
        const orders = await base44.asServiceRole.entities.Order.filter({ stripe_payment_intent_id: pi.id }, null, 1).catch(() => []);
        const order = orders[0];
        if (!order || order.status === 'completed') break;

        const orderId = order.id;

        // ── TABLE fulfillment ──
        if (meta.type === 'table') {
          await base44.asServiceRole.entities.Order.update(orderId, {
            status: 'completed',
            stripe_payment_status: 'paid',
            stripe_charge_id: pi.latest_charge || '',
            stripe_webhook_event_id: event.id,
            paid_at: new Date().toISOString(),
          }).catch(() => {});

          const tableId = meta.table_id;
          const existingRes = await base44.asServiceRole.entities.TableReservation.filter({ order_id: orderId }, null, 1).catch(() => []);
          if (!existingRes[0]) {
            await base44.asServiceRole.entities.TableReservation.create({
              table_id: tableId,
              event_id: meta.event_id,
              order_id: orderId,
              buyer_email: meta.buyer_email,
              buyer_name: meta.buyer_name,
              table_name: meta.table_name || '',
              status: 'reserved',
              platform_fee: parseFloat(meta.platform_fee || '0'),
              stripe_payment_intent_id: pi.id,
            }).catch(() => {});
          }

          if (meta.seller_link_id) {
            const slArr = await base44.asServiceRole.entities.SellerLink.filter({ id: meta.seller_link_id }, null, 1).catch(() => []);
            const sl = slArr[0];
            if (sl) {
              await base44.asServiceRole.entities.SellerLink.update(sl.id, {
                tables_sold: (sl.tables_sold || 0) + 1,
                total_revenue: (sl.total_revenue || 0) + parseFloat(meta.total || '0'),
                commission_earned: (sl.commission_earned || 0) + parseFloat(meta.vendor_commission || '0'),
                last_sale_date: new Date().toISOString(),
              }).catch(() => {});
            }
          }

          // Table confirmation email
          try {
            const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://reizor.com';
            const evArrT = await base44.asServiceRole.entities.Event.filter({ id: meta.event_id }, null, 1).catch(() => []);
            const evT = evArrT[0];
            const eventDateStrT = evT?.date ? new Date(evT.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
            const totalAmount = parseFloat(meta.total || '0');
            const tableHtmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#07091a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1024;border-radius:14px;border:1px solid #1e2545;overflow:hidden;">
<tr><td style="padding:22px 32px 18px;border-bottom:1px solid #1a2040;"><span style="font-size:20px;font-weight:900;color:#ffffff;">REIZOR</span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff1b8d;margin-left:3px;vertical-align:middle;"></span></td></tr>
<tr><td style="padding:28px 32px;">
  <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:900;color:#ffffff;">Table Reserved! 🪑</h1>
  <p style="margin:0 0 20px;font-size:14px;color:#b0b8d4;">Your table <strong style="color:#fff;">${meta.table_name}</strong> is confirmed for <strong style="color:#fff;">${evT?.title || ''}</strong>.</p>
  ${eventDateStrT ? `<p style="color:#b0b8d4;font-size:14px;">📅 ${eventDateStrT}</p>` : ''}
  <p style="color:#b0b8d4;font-size:14px;">💰 Total paid: <strong style="color:#ff1b8d;">$${totalAmount.toFixed(2)}</strong></p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${appUrl}/my-tickets" style="display:inline-block;background:linear-gradient(135deg,#ff1b8d,#d4006e);color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 40px;border-radius:8px;">View My Booking →</a>
  </div>
</td></tr>
</table></td></tr></table></body></html>`;
            await base44.asServiceRole.integrations.Core.SendEmail({
              from_name: 'Reizor',
              to: meta.buyer_email,
              subject: `Table Reserved! 🪑 — ${evT?.title || meta.event_id}`,
              body: tableHtmlBody,
            });
          } catch (e) { console.error('Table email error:', e.message); }
          break;
        }

        // ── DONATION fulfillment via PaymentIntent ──
        if (meta.type === 'donation' && meta.donation_id) {
          const existing = await base44.asServiceRole.entities.ArtistDonation.filter({ id: meta.donation_id }, null, 1).catch(() => []);
          // Check idempotency: skip if already processed by this webhook event
          if (existing[0] && existing[0].stripe_webhook_event_id === event.id) {
            console.log('Skipping already-processed donation webhook:', event.id);
            break;
          }
          if (existing[0] && existing[0].status !== 'completed') {
              await base44.asServiceRole.entities.ArtistDonation.update(meta.donation_id, {
                status: 'completed',
                stripe_payment_intent_id: pi.id,
                stripe_webhook_event_id: event.id,
              }).catch(() => {});
              if (meta.artist_email) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                  from_name: 'Reizor',
                  to: meta.artist_email,
                  subject: `💸 You received a donation of $${parseFloat(meta.net_amount || '0').toFixed(2)}!`,
                  body: `${meta.donor_email} just donated to you on Reizor!\n\nAmount: $${parseFloat(meta.net_amount || '0').toFixed(2)} (after platform fee)\n\nCheck your artist dashboard for details.`,
                }).catch(() => {});
              }
              // Notify donor with confirmation
              if (meta.donor_email) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                  from_name: 'Reizor',
                  to: meta.donor_email,
                  subject: `✅ Donation Confirmed — ${meta.artist_name}`,
                  body: `Hi,\n\nYour donation of $${parseFloat(meta.amount || '0').toFixed(2)} to ${meta.artist_name} has been confirmed.\n\n${meta.artist_name} will receive $${parseFloat(meta.net_amount || '0').toFixed(2)} after platform fees.\n\nThank you for supporting amazing artists on Reizor!`,
                }).catch(() => {});
              }
            }
            break;
          }

          // ── MEMBERSHIP fulfillment via PaymentIntent ──
          if (meta.type === 'membership' && meta.membership_plan) {
            const loyId = meta.loyalty_account_id;
            const planKey = meta.membership_plan;
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            if (loyId) {
              const existing = await base44.asServiceRole.entities.LoyaltyAccount.filter({ id: loyId }, null, 1).catch(() => []);
              // Check idempotency: skip if already processed by this webhook event
              if (existing[0] && existing[0].stripe_webhook_event_id === event.id) {
                console.log('Skipping already-processed membership webhook:', event.id);
                break;
              }
              if (existing[0] && existing[0].membership_status !== 'active') {
                await base44.asServiceRole.entities.LoyaltyAccount.update(loyId, {
                  membership_plan: planKey,
                  membership_status: 'active',
                  membership_expires_at: expiryDate.toISOString(),
                  stripe_payment_intent_id: pi.id,
                  stripe_webhook_event_id: event.id,
                }).catch(() => {});

                // Notify user
                await base44.asServiceRole.integrations.Core.SendEmail({
                  from_name: 'Reizor',
                  to: meta.user_email,
                  subject: `🎉 ${planKey === 'premium' ? 'Premium' : 'Standard'} Membership Activated!`,
                  body: `Hi ${meta.user_name},\n\nYour ${planKey} membership is now active! Enjoy your exclusive benefits including raffle entries and loyalty badge.\n\nYour membership renews on ${expiryDate.toLocaleDateString()}.\n\nView your profile at /profile`,
                }).catch(() => {});

                // Award $3 affiliate referral to the referrer (link owner) only
                await createFanMembershipReferral(base44, meta.user_email, meta.user_name);
              }
            }
            break;
          }

        // ── RESALE fulfillment via PaymentIntent ──
        if (meta.type === 'resale' && meta.ticket_listing_id) {
          const existingTx = await base44.asServiceRole.entities.ResaleTransaction.filter({ ticket_listing_id: meta.ticket_listing_id, status: 'completed' }, null, 1).catch(() => []);
          if (!existingTx[0]) {
            const listingPrice = parseFloat(meta.listing_price || '0');
            const platformFee = parseFloat(meta.platform_fee || '0');
            const buyerTotal = parseFloat(meta.buyer_total || '0');
            const listingsArr = await base44.asServiceRole.entities.TicketListing.filter({ id: meta.ticket_listing_id }, null, 1).catch(() => []);
            const listing = listingsArr[0];

            const txRes = await base44.asServiceRole.entities.ResaleTransaction.create({
              ticket_listing_id: meta.ticket_listing_id,
              ticket_id: meta.ticket_id,
              event_id: listing?.event_id || meta.event_id,
              event_title: listing?.event_title || meta.event_title,
              original_seller_email: listing?.seller_email || meta.seller_email,
              original_seller_name: listing?.seller_name || meta.seller_name,
              buyer_email: meta.buyer_email,
              buyer_name: meta.buyer_name,
              listing_price: listingPrice,
              buyer_total: buyerTotal,
              platform_fee: platformFee,
              seller_payout: listingPrice,
              status: 'completed',
              completed_at: new Date().toISOString(),
              payment_method: 'stripe',
              stripe_payment_intent_id: pi.id,
            }).catch(err => { console.error('Failed to create ResaleTransaction:', err.message); return null; });

            if (txRes) {
              try {
                await base44.asServiceRole.functions.invoke('processResaleCompletion', {
                  ticket_listing_id: meta.ticket_listing_id,
                  ticket_id: meta.ticket_id,
                  resale_transaction_id: txRes.id,
                  buyer_email: meta.buyer_email,
                  buyer_name: meta.buyer_name,
                  seller_email: listing?.seller_email || meta.seller_email,
                  seller_name: listing?.seller_name || meta.seller_name,
                  listing_price: listingPrice,
                  platform_fee: platformFee,
                  buyer_total: buyerTotal,
                  event_id: listing?.event_id || meta.event_id,
                  event_title: listing?.event_title || meta.event_title,
                });
              } catch (invokeErr) {
                console.error('processResaleCompletion failed:', invokeErr.message);
              }

              await base44.asServiceRole.entities.TicketListing.update(meta.ticket_listing_id, {
                status: 'sold',
                sold_at: new Date().toISOString(),
                sold_to_email: meta.buyer_email,
              }).catch(() => {});
            }
          }
          break;
        }

        // ── TICKET fulfillment ──
        const guestNames = JSON.parse(meta.guest_names || '[]');
        const buyerEmail = meta.buyer_email || order.customer_email;
        const buyerName = meta.buyer_name || order.customer_name;
        const orderItemsMeta = meta.items ? JSON.parse(meta.items) : [];
        const quantity = orderItemsMeta.reduce((s, i) => s + (i.quantity || 1), 0);

        // Idempotency: skip if tickets already created
        const existingTickets = await base44.asServiceRole.entities.Ticket.filter({ order_id: orderId }, null, 1).catch(() => []);
        if (existingTickets.length === 0 && orderItemsMeta.length > 0) {
          let guestIdx = 0;
          for (const item of orderItemsMeta) {
            for (let i = 0; i < item.quantity; i++) {
              const guestName = guestNames[guestIdx] || buyerName;
              guestIdx++;
              const ticketCode = `TKT-${orderId.slice(-6).toUpperCase()}-${guestIdx}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
              await base44.asServiceRole.entities.Ticket.create({
                ticket_code: ticketCode,
                event_id: meta.event_id,
                event_title: order.event_title,
                order_id: orderId,
                ticket_type_id: item.ticket_type_id,
                ticket_type_name: item.ticket_type_name,
                owner_email: buyerEmail,
                owner_name: buyerName,
                guest_name: guestName,
                guest_phone: meta.guest_phone || '',
                price_paid: item.unit_price,
                status: 'active',
                qr_data: ticketCode,
                paid_with_credit: parseFloat(meta.credit_applied || '0') > 0,
              });
            }
            const ttArr2 = await base44.asServiceRole.entities.TicketType.filter({ id: item.ticket_type_id }, null, 1).catch(() => []);
            const tt2 = ttArr2[0];
            if (tt2) {
              await base44.asServiceRole.entities.TicketType.update(item.ticket_type_id, {
                quantity_sold: (tt2.quantity_sold || 0) + item.quantity,
              }).catch(() => {});
            }
          }
          const evArr2 = await base44.asServiceRole.entities.Event.filter({ id: meta.event_id }, null, 1).catch(() => []);
          if (evArr2[0]) {
            await base44.asServiceRole.entities.Event.update(meta.event_id, {
              tickets_sold: (evArr2[0].tickets_sold || 0) + quantity,
            }).catch(() => {});
          }
        }

        await base44.asServiceRole.entities.Order.update(orderId, {
          status: 'completed',
          stripe_payment_status: 'paid',
          stripe_charge_id: pi.latest_charge || '',
          stripe_webhook_event_id: event.id,
          paid_at: new Date().toISOString(),
        });

        // ── Update SellerLink stats (ticket purchase via PaymentIntent) ──
        const sellerCode = meta.seller_code || order.seller_link_code || '';
        if (sellerCode && !order.seller_link_updated) {
          const slArr = await base44.asServiceRole.entities.SellerLink.filter({ tracking_code: sellerCode.toUpperCase() }, null, 1).catch(() => []);
          const sl = slArr[0];
          if (sl) {
            const revenue = parseFloat(meta.grand_total || order.total || 0);
            const commission = (() => {
              if (!sl.commission_type || sl.commission_type === 'none') return 0;
              if (sl.commission_type === 'fixed') return (sl.commission_value || 0) * quantity;
              if (sl.commission_type === 'percentage') return parseFloat(((sl.commission_value || 0) / 100 * revenue).toFixed(2));
              return 0;
            })();
            await base44.asServiceRole.entities.SellerLink.update(sl.id, {
              tickets_sold: (sl.tickets_sold || 0) + quantity,
              total_revenue: parseFloat(((sl.total_revenue || 0) + revenue).toFixed(2)),
              commission_earned: parseFloat(((sl.commission_earned || 0) + commission).toFixed(2)),
              last_sale_date: new Date().toISOString(),
            }).catch(() => {});
            await base44.asServiceRole.entities.Order.update(orderId, {
              seller_link_id: sl.id,
              seller_tracking_code: sellerCode.toUpperCase(),
              seller_link_updated: true,
            }).catch(() => {});
          }
        }

        // Deduct wallet if hybrid/wallet payment
        if ((order.payment_method === 'wallet' || order.payment_method === 'hybrid') && order.wallet_amount_paid > 0) {
          const walletRecords = await base44.asServiceRole.entities.ResaleSellerBalance.filter({ seller_email: buyerEmail }, null, 1).catch(() => []);
          if (walletRecords[0]) {
            const now = new Date().toISOString();
            await base44.asServiceRole.entities.ResaleSellerBalance.update(walletRecords[0].id, {
              available_balance: Math.max(0, (walletRecords[0].available_balance || 0) - order.wallet_amount_paid),
              last_transaction_date: now,
            });
            // Create wallet transaction record
            await base44.asServiceRole.entities.ResaleWalletTransaction.create({
              seller_email: buyerEmail,
              seller_name: buyerName,
              transaction_type: 'debit',
              amount: order.wallet_amount_paid,
              event_id: order.event_id,
              event_title: order.event_title,
              description: `Ticket Purchase - Order ${order.order_number}`,
              status: 'completed',
            });
          }
        }

        // Confirmation email
        if (!order.email_sent) {
          try {
            const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://reizor.com';
            const createdTickets = await base44.asServiceRole.entities.Ticket.filter({ order_id: orderId }).catch(() => []);
            const ticketCodesHtml = createdTickets.map(t => `<li style="margin:4px 0;font-family:monospace;font-size:13px;color:#b0b8d4;">${t.ticket_type_name || 'Ticket'}: <strong style="color:#fff;">${t.ticket_code}</strong></li>`).join('');
            const htmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#07091a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1024;border-radius:14px;border:1px solid #1e2545;overflow:hidden;">
<tr><td style="padding:22px 32px 18px;border-bottom:1px solid #1a2040;"><span style="font-size:20px;font-weight:900;color:#ffffff;">REIZOR</span></td></tr>
<tr><td style="padding:28px 32px;">
  <h1 style="margin:0 0 12px;font-size:22px;font-weight:900;color:#fff;">Tickets Confirmed! 🎟️</h1>
  <p style="margin:0 0 20px;font-size:14px;color:#b0b8d4;">Your tickets for <strong style="color:#fff;">${order.event_title}</strong> are confirmed!</p>
  <p style="font-size:13px;font-weight:700;color:#fff;">Your ticket codes:</p>
  <ul style="margin:0 0 24px;padding-left:16px;">${ticketCodesHtml}</ul>
  <div style="text-align:center;margin:24px 0;">
    <a href="${appUrl}/my-tickets" style="display:inline-block;background:linear-gradient(135deg,#ff1b8d,#d4006e);color:#fff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 40px;border-radius:8px;">View My Tickets →</a>
  </div>
</td></tr>
</table></td></tr></table></body></html>`;
            await base44.asServiceRole.integrations.Core.SendEmail({
              from_name: 'Reizor',
              to: buyerEmail,
              subject: `Tickets Confirmed! 🎟️ — ${order.event_title}`,
              body: htmlBody,
            });
            await base44.asServiceRole.entities.Order.update(orderId, { email_sent: true }).catch(() => {});
          } catch (e) { console.error('Ticket email error:', e.message); }
        }
        break;
      }

      // ── PAYMENT FAILED ──
      case 'payment_intent.payment_failed': {
        const pi = data;
        const orders = await base44.asServiceRole.entities.Order.filter({ stripe_payment_intent_id: pi.id }, null, 1).catch(() => []);
        if (orders[0] && orders[0].status === 'pending') {
          await base44.asServiceRole.entities.Order.update(orders[0].id, {
            status: 'failed',
            stripe_payment_status: 'failed',
            stripe_webhook_event_id: event.id,
          });
        }
        break;
      }

      // ── REFUND ──
      case 'charge.refunded': {
        const charge = data;
        const pi_id = charge.payment_intent;
        if (!pi_id) break;
        const orders = await base44.asServiceRole.entities.Order.filter({ stripe_payment_intent_id: pi_id }, null, 1).catch(() => []);
        const order = orders[0];
        if (!order) break;

        await base44.asServiceRole.entities.Order.update(order.id, {
          status: 'refunded',
          stripe_payment_status: 'refunded',
          stripe_refund_id: charge.refunds?.data?.[0]?.id || '',
          refunded_at: new Date().toISOString(),
          refunded_by: 'Stripe',
          stripe_webhook_event_id: event.id,
        });

        // Cancel associated tickets
        const tickets = await base44.asServiceRole.entities.Ticket.filter({ order_id: order.id }).catch(() => []);
        for (const t of tickets) {
          await base44.asServiceRole.entities.Ticket.update(t.id, { status: 'refunded' }).catch(() => {});
        }
        break;
      }

      // ── MEMBERSHIP SUBSCRIPTION EVENTS ──
      case 'invoice.payment_succeeded': {
        const invoice = data;
        const subId = invoice.subscription;
        if (!subId) break;
        const subs = await base44.asServiceRole.entities.FanSubscription.filter({ stripe_subscription_id: subId }, null, 1).catch(() => []);
        if (subs[0]) {
          await base44.asServiceRole.entities.FanSubscription.update(subs[0].id, {
            status: 'active',
            stripe_invoice_id: invoice.id,
            last_payment_at: new Date().toISOString(),
            stripe_webhook_event_id: event.id,
          });
          // Also update LoyaltyAccount membership status
          const loyArr = await base44.asServiceRole.entities.LoyaltyAccount.filter({ user_email: subs[0].fan_email }, null, 1).catch(() => []);
          if (loyArr[0]) {
            await base44.asServiceRole.entities.LoyaltyAccount.update(loyArr[0].id, {
              membership_status: 'active',
            }).catch(() => {});
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = data;
        const subId = invoice.subscription;
        if (!subId) break;
        const subs = await base44.asServiceRole.entities.FanSubscription.filter({ stripe_subscription_id: subId }, null, 1).catch(() => []);
        if (subs[0]) {
          await base44.asServiceRole.entities.FanSubscription.update(subs[0].id, {
            status: 'past_due',
            stripe_webhook_event_id: event.id,
          });
          const loyArr = await base44.asServiceRole.entities.LoyaltyAccount.filter({ user_email: subs[0].fan_email }, null, 1).catch(() => []);
          if (loyArr[0]) {
            await base44.asServiceRole.entities.LoyaltyAccount.update(loyArr[0].id, {
              membership_status: 'past_due',
            }).catch(() => {});
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = data;
        const subs = await base44.asServiceRole.entities.FanSubscription.filter({ stripe_subscription_id: sub.id }, null, 1).catch(() => []);
        if (subs[0]) {
          await base44.asServiceRole.entities.FanSubscription.update(subs[0].id, {
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            stripe_webhook_event_id: event.id,
          });
          const loyArr = await base44.asServiceRole.entities.LoyaltyAccount.filter({ user_email: subs[0].fan_email }, null, 1).catch(() => []);
          if (loyArr[0]) {
            await base44.asServiceRole.entities.LoyaltyAccount.update(loyArr[0].id, {
              membership_status: 'cancelled',
              membership_plan: 'none',
            }).catch(() => {});
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = data;
        const subs = await base44.asServiceRole.entities.FanSubscription.filter({ stripe_subscription_id: sub.id }, null, 1).catch(() => []);
        if (subs[0]) {
          await base44.asServiceRole.entities.FanSubscription.update(subs[0].id, {
            status: sub.status === 'active' ? 'active' : sub.status,
            stripe_webhook_event_id: event.id,
          });
        }
        break;
      }

      // (membership/resale checkout.session.completed is handled via meta.type checks inside the first case block above)

      // ── PAYMENT DISPUTE / CHARGEBACK ──
      case 'charge.dispute.created':
      case 'charge.dispute.updated': {
        const dispute = data;
        const chargeId = dispute.charge;
        const amount = (dispute.amount / 100).toFixed(2);
        const reason = dispute.reason || 'unknown';
        const disputeStatus = dispute.status || 'needs_response';
        const isNew = event.type === 'charge.dispute.created';

        // Find related order by charge_id or payment_intent
        let disputeOrder = null;
        const disputeOrdersByCharge = await base44.asServiceRole.entities.Order.filter(
          { stripe_charge_id: chargeId }, null, 1
        ).catch(() => []);
        disputeOrder = disputeOrdersByCharge[0];

        // Also try by payment_intent if charge lookup fails
        if (!disputeOrder && dispute.payment_intent) {
          const disputeOrdersByPI = await base44.asServiceRole.entities.Order.filter(
            { stripe_payment_intent_id: dispute.payment_intent }, null, 1
          ).catch(() => []);
          disputeOrder = disputeOrdersByPI[0];
        }

        // Mark the order as chargeback/disputed
        if (disputeOrder) {
          await base44.asServiceRole.entities.Order.update(disputeOrder.id, {
            status: 'chargeback',
            stripe_payment_status: 'disputed',
            stripe_dispute_id: dispute.id,
            dispute_reason: reason,
            dispute_status: disputeStatus,
            dispute_amount: parseFloat(amount),
            chargeback_at: new Date().toISOString(),
          }).catch(() => {});
        }

        if (!isNew) break; // Only notify admin on creation, not every update

        const admins = await base44.asServiceRole.entities.User.list(null, 500).then(u => u.filter(x => x.role === 'admin')).catch(() => []);
        const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://reizor.com';

        await Promise.all(admins.map(async (admin) => {
          // Duplicate check
          const existing = await base44.asServiceRole.entities.Notification.filter(
            { user_email: admin.email, title: `⚠️ Payment Dispute: $${amount}` }, null, 1
          ).catch(() => []);
          if (existing.length > 0) return;

          await base44.asServiceRole.entities.Notification.create({
            user_email: admin.email,
            title: `⚠️ Payment Dispute: $${amount}`,
            message: `A customer dispute/chargeback was received for an order. Please review the payment details. Reason: ${reason}. ${disputeOrder ? `Event: ${disputeOrder.event_title || '—'}. Customer: ${disputeOrder.customer_email || '—'}.` : `Charge ID: ${chargeId}.`}`,
            type: 'general',
            link: '/admin/orders',
            is_read: false,
          }).catch(() => {});

          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `⚠️ Payment Dispute Filed — $${amount}`,
            body: `
              <div style="font-family:Arial,sans-serif;background:#0a0d1a;padding:32px;color:#c8d0e8;">
                <h2 style="color:#ef4444;margin:0 0 16px;">⚠️ Payment Dispute Filed</h2>
                <p>A customer dispute/chargeback was received for an order. Please review the payment details.</p>
                <table style="width:100%;background:#0f1529;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #1e2a45;">
                  <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Dispute ID</td><td style="color:#c8d0e8;font-family:monospace;">${dispute.id}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Amount</td><td style="color:#ef4444;font-weight:bold;">$${amount}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Reason</td><td style="color:#fff;">${reason}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Status</td><td style="color:#fff;">${disputeStatus}</td></tr>
                  ${disputeOrder ? `<tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Event</td><td style="color:#c8d0e8;">${disputeOrder.event_title || '—'}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Customer</td><td style="color:#c8d0e8;">${disputeOrder.customer_email || '—'}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Order #</td><td style="color:#c8d0e8;font-family:monospace;">${disputeOrder.order_number || '—'}</td></tr>` : ''}
                  <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Charge ID</td><td style="color:#c8d0e8;font-family:monospace;">${chargeId}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Date</td><td style="color:#c8d0e8;">${new Date().toLocaleString()}</td></tr>
                </table>
                <a href="${appUrl}/admin/orders" style="display:inline-block;background:#ef4444;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Review in Admin →</a>
              </div>
            `,
          }).catch(() => {});
        }));
        break;
      }

      case 'charge.dispute.closed': {
        const dispute = data;
        const chargeId = dispute.charge;
        const closedStatus = dispute.status; // 'won', 'lost', 'warning_closed', etc.

        // Update order with final dispute outcome
        const closedOrders = await base44.asServiceRole.entities.Order.filter(
          { stripe_dispute_id: dispute.id }, null, 1
        ).catch(() => []);
        if (closedOrders[0]) {
          // If won, restore order to completed; if lost, keep as chargeback
          await base44.asServiceRole.entities.Order.update(closedOrders[0].id, {
            dispute_status: closedStatus,
            status: closedStatus === 'won' ? 'completed' : 'chargeback',
            stripe_payment_status: closedStatus === 'won' ? 'paid' : 'disputed',
          }).catch(() => {});
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }

  return Response.json({ received: true });
});