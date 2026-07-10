/**
 * Video Minute Billing — automatic account-level usage-based billing.
 *
 * No plans. No selection. Fully automatic.
 * Free monthly allowance (e.g. 500 min) → auto billable after exhaustion.
 * Only playback counts — upload/encoding are NEVER charged.
 *
 * Actions:
 *   get_pricing               — public: get current pricing config
 *   update_pricing            — admin only: update pricing
 *   create_checkout           — create Stripe checkout for optional billable-credit top-up
 *   confirm_payment           — confirm payment, add billable credit to account
 *   track_watch               — track watch session, auto-deduct free then billable
 *   get_account_usage         — get account-level usage for a video (via organizer lookup)
 *   get_organizer_usage       — get usage summary for an organizer
 *   check_playable            — always true (free tier always available, tracking is automatic)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.21.0';

// ── Default pricing ──
const DEFAULT_PER_MINUTE_RATE = 0.0016; // $0.0016/min
const DEFAULT_FREE_MINUTES_PER_USER_MONTHLY = 500;
const DEFAULT_EFFECTIVE_RATE = DEFAULT_PER_MINUTE_RATE;

// Pricing settings keys (stored in AppSettings)
const PK_PER_MINUTE_RATE = 'video_usage_per_minute_rate';
const PK_FREE_MINUTES_PER_USER = 'video_usage_free_minutes_per_user_monthly';
const PK_BILLING_ENABLED = 'video_usage_minute_billing_enabled';
const PK_CATEGORY = 'video_usage_pricing';

async function getPricingSettings(base44) {
  const all = await base44.asServiceRole.entities.AppSettings.filter(
    { category: PK_CATEGORY }, null, 20
  ).catch(() => []);
  const map = {};
  all.forEach(s => { map[s.setting_key] = s.setting_value; });

  const perMinuteRate = map[PK_PER_MINUTE_RATE] !== undefined
    ? parseFloat(map[PK_PER_MINUTE_RATE])
    : DEFAULT_PER_MINUTE_RATE;

  const freeMinutesPerUser = parseFloat(map[PK_FREE_MINUTES_PER_USER] || String(DEFAULT_FREE_MINUTES_PER_USER_MONTHLY));
  const minuteBillingEnabled = map[PK_BILLING_ENABLED] === 'true';

  return {
    minute_billing_enabled: minuteBillingEnabled,
    per_minute_rate: perMinuteRate,
    effective_rate_per_minute: perMinuteRate,
    free_minutes_per_user_monthly: freeMinutesPerUser,
  };
}

// Upsert a single AppSettings record
async function upsertSetting(base44, key, value, label, category) {
  const existing = await base44.asServiceRole.entities.AppSettings.filter(
    { setting_key: key, category }, null, 1
  ).catch(() => []);
  if (existing[0]) {
    return base44.asServiceRole.entities.AppSettings.update(existing[0].id, {
      setting_value: String(value),
    });
  }
  return base44.asServiceRole.entities.AppSettings.create({
    setting_key: key,
    setting_value: String(value),
    label,
    category,
  });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── get_pricing (public) ──────────────────────────────────────────────────
  if (action === 'get_pricing') {
    const pricing = await getPricingSettings(base44);
    return Response.json(pricing);
  }

  // ── update_pricing (admin only) ───────────────────────────────────────────
  if (action === 'update_pricing') {
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }
    const {
      per_minute_rate, free_minutes_per_user_monthly,
      minute_billing_enabled,
    } = body;

    if (per_minute_rate != null) {
      await upsertSetting(base44, PK_PER_MINUTE_RATE, per_minute_rate,
        'Per-minute streaming rate (USD)', PK_CATEGORY);
    }
    if (free_minutes_per_user_monthly != null) {
      await upsertSetting(base44, PK_FREE_MINUTES_PER_USER, free_minutes_per_user_monthly,
        'Monthly free minutes per user', PK_CATEGORY);
    }
    if (minute_billing_enabled !== undefined) {
      await upsertSetting(base44, PK_BILLING_ENABLED, minute_billing_enabled,
        'Enable per-minute billing', PK_CATEGORY);
    }

    const pricing = await getPricingSettings(base44);
    return Response.json({ success: true, pricing });
  }

  // ── Helper: check if an organizer has exceeded storage limit ──────────────
  async function isStorageExhausted(organizerId) {
    const records = await base44.asServiceRole.entities.OrganizerStorageRecord.filter(
      { organizer_id: organizerId, deleted: false }, null, 2000
    ).catch(() => []);
    const totalBytes = records.reduce((s, r) => s + (r.file_size_bytes || 0), 0);
    const totalGb = totalBytes / 1073741824;

    const settings = await base44.asServiceRole.entities.AppSettings.filter(
      { category: 'storage' }, null, 20
    ).catch(() => []);
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.setting_key] = s.setting_value; });
    const freeGb = parseFloat(settingsMap['storage_free_gb_per_month'] || 10);

    return { exhausted: totalGb >= freeGb, totalGb, freeGb };
  }

  // ── Helper: check if an organizer is admin ────────────────────────────────
  async function isAdminOwner(organizerId) {
    const users = await base44.asServiceRole.entities.User.filter(
      { id: organizerId }, null, 1
    ).catch(() => []);
    return users[0]?.role === 'admin';
  }

  // ── Helper: check streaming availability for an organizer ─────────────────
  async function checkStreamingAvailability(organizerId) {
    const pricing = await getPricingSettings(base44);
    const freeLimit = pricing.free_minutes_per_user_monthly || DEFAULT_FREE_MINUTES_PER_USER_MONTHLY;
    const monthKey = new Date().toISOString().slice(0, 7);

    const logs = await base44.asServiceRole.entities.VideoWatchLog.filter(
      { organizer_id: organizerId }, '-created_date', 1000
    ).catch(() => []);
    const monthLogs = logs.filter(l => l.created_date?.startsWith(monthKey));
    const freeUsed = monthLogs.filter(l => l.is_free).reduce((s, l) => s + (l.minutes_watched || 0), 0);
    const freeRemaining = Math.max(0, freeLimit - freeUsed);

    const activePlans = await base44.asServiceRole.entities.VideoMinutePlan.filter(
      { organizer_id: organizerId, status: 'active' }, null, 50
    ).catch(() => []);
    const billableCredit = activePlans.reduce((s, p) => s + (p.remaining_minutes || 0), 0);

    const totalAvailable = freeRemaining + billableCredit;
    return {
      exhausted: totalAvailable <= 0,
      freeRemaining, freeLimit, freeUsed,
      billableCreditRemaining: billableCredit,
      totalAvailable,
    };
  }

  // ── check_playable (public, no auth) ──────────────────────────────────────
  if (action === 'check_playable') {
    const { video_url, video_id } = body;
    if (!video_url && !video_id) {
      return Response.json({ playable: true, reason: 'no_context' });
    }

    // Resolve owner — check OrganizerMediaPost, ArtistPost, ArtistAlbum, CommunityPost
    let ownerId = '';
    let ownerEmail = '';
    if (video_id) {
      // Try OrganizerMediaPost
      const orgPost = await base44.asServiceRole.entities.OrganizerMediaPost.filter(
        { id: video_id }, null, 1
      ).catch(() => []);
      if (orgPost[0]) { ownerId = orgPost[0].organizer_id || ''; }

      // Try ArtistPost
      if (!ownerId) {
        const artistPost = await base44.asServiceRole.entities.ArtistPost.filter(
          { id: video_id }, null, 1
        ).catch(() => []);
        if (artistPost[0]) { ownerId = artistPost[0].artist_id || ''; }
      }

      // Try ArtistAlbum
      if (!ownerId) {
        const artistAlbum = await base44.asServiceRole.entities.ArtistAlbum.filter(
          { id: video_id }, null, 1
        ).catch(() => []);
        if (artistAlbum[0]) { ownerId = artistAlbum[0].artist_id || ''; }
      }

      // Try CommunityPost (uses email)
      if (!ownerId) {
        const commPost = await base44.asServiceRole.entities.CommunityPost.filter(
          { id: video_id }, null, 1
        ).catch(() => []);
        if (commPost[0]) { ownerId = commPost[0].author_email || ''; ownerEmail = commPost[0].author_email || ''; }
      }
    }
    if (!ownerId) return Response.json({ playable: true, reason: 'no_owner_resolved' });

    // Admin owners are always allowed
    const admin = await isAdminOwner(ownerId);
    if (admin) return Response.json({ playable: true, reason: 'admin_exempt', admin_exempt: true });

    // Check both storage and streaming limits
    const [storage, streaming] = await Promise.all([
      isStorageExhausted(ownerId),
      checkStreamingAvailability(ownerId),
    ]);

    const blocked = storage.exhausted || streaming.exhausted;
    const reasons = [];
    if (storage.exhausted) reasons.push('storage_exhausted');
    if (streaming.exhausted) reasons.push('streaming_exhausted');

    return Response.json({
      playable: !blocked,
      reason: blocked ? reasons.join('+') : 'available',
      storage: { exhausted: storage.exhausted, total_gb: storage.totalGb, free_gb: storage.freeGb },
      streaming: { exhausted: streaming.exhausted, free_remaining: streaming.freeRemaining, free_limit: streaming.freeLimit, billable_credit_remaining: streaming.billableCreditRemaining, total_available: streaming.totalAvailable },
    });
  }

  // ── check_playable_batch (public, no auth) ────────────────────────────────
  if (action === 'check_playable_batch') {
    const { items } = body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ results: {} });
    }

    // Deduplicate organizer IDs and cache lookups
    const organizerIds = new Set();
    const videoIdToOrgMap = {};
    items.forEach(item => {
      const oid = item.organizer_id || '';
      const vid = item.video_id || item.id || '';
      if (oid && vid) {
        organizerIds.add(oid);
        videoIdToOrgMap[vid] = oid;
      }
    });

    // Lookup admin status and storage for all unique organizers in parallel
    const orgCache = {};
    const orgPromises = Array.from(organizerIds).map(async (oid) => {
      const [admin, storage, streaming] = await Promise.all([
        isAdminOwner(oid),
        isStorageExhausted(oid),
        checkStreamingAvailability(oid),
      ]);
      orgCache[oid] = { admin, storage, streaming };
    });
    await Promise.all(orgPromises);

    // Build results
    const results = {};
    items.forEach(item => {
      const oid = item.organizer_id || '';
      const vid = item.video_id || item.id || '';
      const org = orgCache[oid];

      if (!vid) return;
      if (!org) { results[vid] = { playable: true, reason: 'no_organizer_data' }; return; }
      if (org.admin) { results[vid] = { playable: true, reason: 'admin_exempt' }; return; }

      const blocked = org.storage.exhausted || org.streaming.exhausted;
      const reasons = [];
      if (org.storage.exhausted) reasons.push('storage_exhausted');
      if (org.streaming.exhausted) reasons.push('streaming_exhausted');

      results[vid] = {
        playable: !blocked,
        reason: blocked ? reasons.join('+') : 'available',
      };
    });

    return Response.json({ results });
  }

  // All remaining actions require auth
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // ── get_account_usage (for a video — resolves organizer, returns account stats) ──
  if (action === 'get_account_usage' || action === 'get_video_plan') {
    const { video_url, video_id } = body;
    if (!video_url && !video_id) return Response.json({ error: 'Missing video_url or video_id' }, { status: 400 });

    // Resolve the organizer from the media post
    let organizerId = user?.id || '';
    let organizerEmail = user?.email || '';

    if (video_id) {
      const post = await base44.asServiceRole.entities.OrganizerMediaPost.filter(
        { id: video_id }, null, 1
      ).catch(() => []);
      if (post[0]) {
        organizerId = post[0].organizer_id || organizerId;
        organizerEmail = post[0].uploaded_by_email || organizerEmail;
      }
    }

    const pricing = await getPricingSettings(base44);
    const freeLimit = pricing.free_minutes_per_user_monthly || DEFAULT_FREE_MINUTES_PER_USER_MONTHLY;
    const monthKey = new Date().toISOString().slice(0, 7);

    // Aggregate all watch logs for this organizer this month
    const logs = await base44.asServiceRole.entities.VideoWatchLog.filter(
      { organizer_id: organizerId }, '-created_date', 1000
    ).catch(() => []);
    const monthLogs = logs.filter(l => l.created_date?.startsWith(monthKey));

    const totalUsed = monthLogs.reduce((s, l) => s + (l.minutes_watched || 0), 0);
    const freeUsed = monthLogs.filter(l => l.is_free).reduce((s, l) => s + (l.minutes_watched || 0), 0);
    const paidUsed = monthLogs.filter(l => l.is_paid).reduce((s, l) => s + (l.minutes_watched || 0), 0);
    const freeRemaining = Math.max(0, freeLimit - freeUsed);
    const billable = Math.max(0, totalUsed - freeLimit);

    // Get billable credit from existing VideoMinutePlan records for this organizer
    const plans = await base44.asServiceRole.entities.VideoMinutePlan.filter(
      { organizer_id: organizerId, status: 'active' }, null, 100
    ).catch(() => []);
    const totalBillableCredit = plans.reduce((s, p) => s + (p.remaining_minutes || 0), 0);

    return Response.json({
      pricing,
      account_usage: {
        total_used: totalUsed,
        free_used: freeUsed,
        free_limit: freeLimit,
        free_remaining: freeRemaining,
        paid_used: paidUsed,
        billable,
        billable_credit_remaining: totalBillableCredit,
        session_count: monthLogs.length,
        month_key: monthKey,
        rate: pricing.per_minute_rate,
      }
    });
  }

  // ── get_organizer_usage ───────────────────────────────────────────────────
  if (action === 'get_organizer_usage') {
    const { organizer_id } = body;
    const oid = organizer_id || user.id;

    const [plans, logs] = await Promise.all([
      base44.asServiceRole.entities.VideoMinutePlan.filter(
        { organizer_id: oid }, '-last_funded_at', 100
      ).catch(() => []),
      base44.asServiceRole.entities.VideoWatchLog.filter(
        { organizer_id: oid }, '-created_date', 500
      ).catch(() => []),
    ]);

    const pricing = await getPricingSettings(base44);
    const monthKey = new Date().toISOString().slice(0, 7);
    const monthLogs = logs.filter(l => l.created_date?.startsWith(monthKey));

    const totalWatchMinutes = monthLogs.reduce((s, l) => s + (l.minutes_watched || 0), 0);
    const freeMinutesUsed = monthLogs.filter(l => l.is_free).reduce((s, l) => s + (l.minutes_watched || 0), 0);
    const paidMinutesUsed = monthLogs.filter(l => l.is_paid).reduce((s, l) => s + (l.minutes_watched || 0), 0);

    return Response.json({
      plans,
      pricing,
      current_month: {
        month_key: monthKey,
        total_watch_minutes: totalWatchMinutes,
        free_minutes_used: freeMinutesUsed,
        free_minutes_limit: pricing.free_minutes_per_user_monthly || DEFAULT_FREE_MINUTES_PER_USER_MONTHLY,
        paid_minutes_used: paidMinutesUsed,
        watch_sessions: monthLogs.length,
      },
    });
  }

  // ── create_checkout ───────────────────────────────────────────────────────
  if (action === 'create_checkout') {
    const { video_url, video_title, minutes, video_type, owner_type, video_id } = body;
    if (!video_url) return Response.json({ error: 'Missing video_url' }, { status: 400 });
    if (!minutes || minutes < 1) return Response.json({ error: 'minutes (min 1) required' }, { status: 400 });

    const pricing = await getPricingSettings(base44);
    const ratePerMinute = pricing.effective_rate_per_minute;
    const totalCents = Math.round(minutes * ratePerMinute * 100);
    const totalDollars = totalCents / 100;

    if (totalCents < 50) {
      return Response.json({ error: `Minimum charge is $0.50 (${Math.ceil(0.50 / ratePerMinute)} minutes at current rate)` }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

    // Find or create plan
    let existing = await base44.asServiceRole.entities.VideoMinutePlan.filter(
      { video_url }, null, 1
    ).catch(() => []);
    let plan = existing[0];

    if (!plan) {
      plan = await base44.asServiceRole.entities.VideoMinutePlan.create({
        video_url,
        video_id: video_id || '',
        video_title: video_title || '',
        organizer_id: user.id,
        organizer_email: user.email,
        organizer_name: user.full_name || user.email,
        owner_type: owner_type || 'organizer',
        total_minutes: 0,
        used_minutes: 0,
        remaining_minutes: 0,
        free_minutes_used_this_month: 0,
        status: 'pending_payment',
        stripe_payment_ids: [],
        amount_paid: 0,
        video_type: video_type || 'normal',
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      receipt_email: user.email,
      metadata: {
        purpose: 'video_minute_plan',
        video_url,
        video_title: video_title || '',
        video_type: video_type || 'normal',
        minutes: String(minutes),
        rate_per_minute: String(ratePerMinute),
        plan_id: plan.id,
        user_id: user.id,
        user_email: user.email,
        owner_type: owner_type || 'organizer',
      },
    });

    return Response.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      plan_id: plan.id,
      breakdown: {
        minutes,
        rate_per_minute: ratePerMinute,
        total: totalDollars,
      },
    });
  }

  // ── confirm_payment ───────────────────────────────────────────────────────
  if (action === 'confirm_payment') {
    const { payment_intent_id, plan_id, minutes, amount } = body;
    if (!payment_intent_id || !plan_id) {
      return Response.json({ error: 'payment_intent_id and plan_id required' }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (pi.status !== 'succeeded') {
      return Response.json({ error: 'Payment not succeeded', stripe_status: pi.status }, { status: 400 });
    }

    const plans = await base44.asServiceRole.entities.VideoMinutePlan.filter(
      { id: plan_id }, null, 1
    ).catch(() => []);
    const plan = plans[0];
    if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 });

    // Idempotency
    if ((plan.stripe_payment_ids || []).includes(payment_intent_id)) {
      return Response.json({ success: true, already_applied: true, plan });
    }

    const addMinutes = minutes || parseInt(pi.metadata?.minutes || '0') || Math.round((amount || pi.amount / 100) / DEFAULT_EFFECTIVE_RATE);
    const addAmount = amount || (pi.amount / 100);

    const newTotal = (plan.total_minutes || 0) + addMinutes;
    const newRemaining = (plan.remaining_minutes || 0) + addMinutes;

    const updated = await base44.asServiceRole.entities.VideoMinutePlan.update(plan_id, {
      total_minutes: newTotal,
      remaining_minutes: newRemaining,
      status: 'active',
      stripe_payment_ids: [...(plan.stripe_payment_ids || []), payment_intent_id],
      amount_paid: (plan.amount_paid || 0) + addAmount,
      last_funded_at: new Date().toISOString(),
    });

    // Send confirmation email
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: "Reizor",
        to: plan.organizer_email,
        subject: `✅ Video Minutes Activated: ${plan.video_title || 'Your Video'}`,
        body: `${addMinutes} streaming minutes have been added to your video "${plan.video_title || 'Untitled'}".

Total minutes: ${newTotal}
Remaining: ${newRemaining}
Rate: $${String((pi.metadata?.rate_per_minute ? parseFloat(pi.metadata.rate_per_minute) : DEFAULT_EFFECTIVE_RATE).toFixed(4))}/minute
Amount paid: $${addAmount.toFixed(2)}

Your video is now active for fans to watch!

— REIZOR`,
      });
    } catch (_) { /* non-critical */ }

    return Response.json({ success: true, plan: updated });
  }

  // ── track_watch (plan-independent, fully automatic account-level tracking) ──
  if (action === 'track_watch') {
    const { video_url, video_id, minutes_watched, event_id, video_type, owner_type } = body;
    if (!video_url || !minutes_watched || minutes_watched <= 0) {
      return Response.json({ error: 'video_url and positive minutes_watched required' }, { status: 400 });
    }

    const pricing = await getPricingSettings(base44);
    const freeLimit = pricing.free_minutes_per_user_monthly || DEFAULT_FREE_MINUTES_PER_USER_MONTHLY;
    const monthKey = new Date().toISOString().slice(0, 7);
    const isAdmin = user?.role === 'admin';

    // ── Resolve organizer from media post ──
    let organizerId = user?.id || '';
    let organizerEmail = user?.email || '';

    if (video_id) {
      const post = await base44.asServiceRole.entities.OrganizerMediaPost.filter(
        { id: video_id }, null, 1
      ).catch(() => []);
      if (post[0]) {
        organizerId = post[0].organizer_id || organizerId;
        organizerEmail = post[0].uploaded_by_email || post[0].organizer_name || organizerEmail;
      }
    }

    // ── Aggregate existing logs for this organizer this month ──
    const existingLogs = await base44.asServiceRole.entities.VideoWatchLog.filter(
      { organizer_id: organizerId }, '-created_date', 1000
    ).catch(() => []);
    const monthLogs = existingLogs.filter(l => l.created_date?.startsWith(monthKey));
    const freeAlreadyUsed = monthLogs.filter(l => l.is_free).reduce((s, l) => s + (l.minutes_watched || 0), 0);
    const freeRemaining = Math.max(0, freeLimit - freeAlreadyUsed);

    // Split: free first, then billable
    const freePortion = Math.min(minutes_watched, freeRemaining);
    const billablePortion = minutes_watched - freePortion;

    const isFree = freePortion > 0;
    const isBillable = billablePortion > 0;

    // ── Create watch log ──
    const log = await base44.asServiceRole.entities.VideoWatchLog.create({
      video_url,
      video_id: video_id || '',
      organizer_id: organizerId,
      organizer_email: organizerEmail,
      fan_email: user?.email || 'anonymous',
      fan_name: user?.full_name || 'anonymous',
      minutes_watched,
      event_id: event_id || null,
      is_admin_exempt: isAdmin,
      is_free: isFree,
      is_paid: isBillable,
      video_type: video_type || 'normal',
      owner_type: owner_type || 'organizer',
    });

    // ── Deduct billable portion from active credit plans ──
    let creditUsed = 0;
    if (billablePortion > 0) {
      const activePlans = await base44.asServiceRole.entities.VideoMinutePlan.filter(
        { organizer_id: organizerId, status: 'active' }, null, 50
      ).catch(() => []);
      let remainingToDeduct = billablePortion;
      for (const p of activePlans) {
        if (remainingToDeduct <= 0) break;
        const canDeduct = Math.min(p.remaining_minutes || 0, remainingToDeduct);
        if (canDeduct > 0) {
          const nr = (p.remaining_minutes || 0) - canDeduct;
          await base44.asServiceRole.entities.VideoMinutePlan.update(p.id, {
            used_minutes: (p.used_minutes || 0) + canDeduct,
            remaining_minutes: nr,
            status: nr <= 0 ? 'exhausted' : 'active',
            ...(nr <= 0 ? { exhausted_at: new Date().toISOString() } : {}),
          }).catch(() => {});
          remainingToDeduct -= canDeduct;
          creditUsed += canDeduct;
        }
      }
    }

    // ── Check if account just became fully exhausted ──
    const newFreeRemaining = Math.max(0, freeRemaining - freePortion);
    const remainingCredit = billablePortion - creditUsed;
    const fullyExhausted = newFreeRemaining <= 0 && remainingCredit > 0;

    // Send exhaustion notification if this session pushed the account over
    if (fullyExhausted && !isAdmin) {
      const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://reizor.com';
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: "Reizor",
          to: organizerEmail,
          subject: `Video Streaming Limit Exhausted`,
          body: `Your monthly streaming limit has been reached and videos are no longer publicly playable.

Free minutes used: ${(freeAlreadyUsed + freePortion).toFixed(1)} / ${freeLimit} min
Billable credit remaining: ${Math.max(0, creditUsed - remainingCredit).toFixed(0)} min

Fans trying to view your videos will see a "temporarily unavailable" message.

To reactivate streaming immediately, add billable credit:
${appUrl}/organizer/media

— REIZOR`,
        });
      } catch (_) { /* non-critical */ }

      // Also send in-app notification
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_email: organizerEmail,
          title: `Streaming Limit Exhausted`,
          message: `Your monthly streaming limit has been reached. Videos are no longer publicly playable. Add billable credit to reactivate.`,
          type: 'general',
        });
      } catch (_) { /* non-critical */ }
    }

    return Response.json({
      tracked: true,
      free_portion: freePortion,
      billable_portion: billablePortion,
      credit_used: creditUsed,
      free_remaining_after: newFreeRemaining,
      fully_exhausted: fullyExhausted,
      log_id: log.id,
    });
  }

  // ── create_account_checkout (account-level billable credit top-up) ─────────
  if (action === 'create_account_checkout') {
    const { minutes } = body;
    if (!minutes || minutes < 1) return Response.json({ error: 'minutes (min 1) required' }, { status: 400 });

    const pricing = await getPricingSettings(base44);
    const ratePerMinute = pricing.effective_rate_per_minute;
    const totalCents = Math.round(minutes * ratePerMinute * 100);
    const totalDollars = totalCents / 100;

    if (totalCents < 50) {
      return Response.json({ error: `Minimum charge is $0.50 (${Math.ceil(0.50 / ratePerMinute)} minutes at current rate)` }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

    // Create an account-level credit plan (not tied to a specific video)
    const plan = await base44.asServiceRole.entities.VideoMinutePlan.create({
      video_url: `account_credit_${user.id}_${Date.now()}`,
      video_id: '',
      video_title: `Account Credit — ${user.full_name || user.email}`,
      organizer_id: user.id,
      organizer_email: user.email,
      organizer_name: user.full_name || user.email,
      owner_type: user.role === 'admin' ? 'organizer' : (user.role || 'organizer'),
      total_minutes: 0,
      used_minutes: 0,
      remaining_minutes: 0,
      free_minutes_used_this_month: 0,
      status: 'pending_payment',
      stripe_payment_ids: [],
      amount_paid: 0,
      video_type: 'normal',
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      receipt_email: user.email,
      metadata: {
        purpose: 'account_credit_topup',
        minutes: String(minutes),
        rate_per_minute: String(ratePerMinute),
        plan_id: plan.id,
        user_id: user.id,
        user_email: user.email,
      },
    });

    return Response.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      plan_id: plan.id,
      breakdown: {
        minutes,
        rate_per_minute: ratePerMinute,
        total: totalDollars,
      },
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});