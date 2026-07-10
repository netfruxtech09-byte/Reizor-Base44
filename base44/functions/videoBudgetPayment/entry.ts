/**
 * Video Budget Payment Backend Function
 *
 * Actions:
 *   create_payment_intent  — create a Stripe PaymentIntent for a video budget top-up
 *   confirm_payment        — called after Stripe payment succeeds; credits the budget
 *   track_view             — record a video view and update estimated usage
 *   get_budget             — get budget record for a video URL
 *   get_settings           — get admin-configured pricing settings
 *   check_playable         — check if a video is allowed to play (budget gate)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const SETTING_KEY_PRICE_PER_GB = 'video_budget_price_per_gb';
const SETTING_KEY_FREE_GB = 'video_budget_free_gb_per_video';
const SETTING_KEY_ENFORCEMENT = 'video_budget_enforcement_enabled';
const SETTING_KEY_ALLOW_LEGACY = 'video_budget_allow_legacy';
const DEFAULT_PRICE_PER_GB = 0.10;
const DEFAULT_FREE_GB = 0;

async function getSettings(base44) {
  const settings = await base44.asServiceRole.entities.AppSettings.filter({
    category: 'video_budget'
  }, null, 20).catch(() => []);
  const map = {};
  settings.forEach(s => { map[s.setting_key] = s.setting_value; });
  return {
    price_per_gb: parseFloat(map[SETTING_KEY_PRICE_PER_GB] || DEFAULT_PRICE_PER_GB),
    free_gb_per_video: parseFloat(map[SETTING_KEY_FREE_GB] || DEFAULT_FREE_GB),
    enforcement_enabled: (map[SETTING_KEY_ENFORCEMENT] || 'false') === 'true',
    allow_legacy_videos: (map[SETTING_KEY_ALLOW_LEGACY] ?? 'true') !== 'false',
  };
}

async function findBudgetRecord(base44, videoUrl) {
  const results = await base44.asServiceRole.entities.VideoBudget.filter({ video_url: videoUrl }, null, 1).catch(() => []);
  return results[0] || null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── get_settings (admin only) ─────────────────────────────────────────────
  if (action === 'get_settings') {
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const s = await getSettings(base44);
    return Response.json(s);
  }

  // ── check_playable (public — no auth required) ────────────────────────────
  if (action === 'check_playable') {
    const { video_url } = body;
    if (!video_url) return Response.json({ playable: true, reason: 'no_url' });

    const settings = await getSettings(base44);
    if (!settings.enforcement_enabled) return Response.json({ playable: true, reason: 'enforcement_disabled' });

    const budget = await findBudgetRecord(base44, video_url);
    // No budget record — use allow_legacy setting
    if (!budget) return Response.json({ playable: settings.allow_legacy_videos, reason: settings.allow_legacy_videos ? 'no_budget_legacy_allowed' : 'no_budget_blocked' });
    if (budget.status === 'legacy') return Response.json({ playable: true, reason: 'legacy' });
    // Per-record enforcement override
    if (!budget.enforcement_enabled) return Response.json({ playable: true, reason: 'enforcement_disabled_on_record' });
    if (budget.status === 'paused') return Response.json({ playable: false, reason: 'budget_exhausted', budget_id: budget.id });
    return Response.json({ playable: true, reason: 'active', budget_id: budget.id });
  }

  // All remaining actions require auth
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // ── get_budget ────────────────────────────────────────────────────────────
  if (action === 'get_budget') {
    const { video_url } = body;
    if (!video_url) return Response.json({ error: 'Missing video_url' }, { status: 400 });
    const budget = await findBudgetRecord(base44, video_url);
    const videoBudgetSettings = await getSettings(base44);
    
    // Fetch STORAGE pricing settings (admin-configured global rates)
    const storageSettings = await base44.asServiceRole.entities.AppSettings.filter({
      category: 'storage'
    }, null, 20).catch(() => []);
    const storageMap = {};
    storageSettings.forEach(s => { storageMap[s.setting_key] = s.setting_value; });
    const price_per_gb = parseFloat(storageMap['storage_price_per_gb'] || 0.10);
    const free_gb_per_month = parseFloat(storageMap['storage_free_gb_per_month'] || 10);
    
    // Get current month's storage usage
    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7); // YYYY-MM
    const storageRecords = await base44.asServiceRole.entities.OrganizerStorageRecord.filter({
      organizer_id: user.id,
      month_key: monthKey,
      deleted: false
    }, null, 500).catch(() => []);
    
    const totalUsedBytes = storageRecords.reduce((sum, r) => sum + (r.file_size_bytes || 0), 0);
    const totalUsedGB = totalUsedBytes / (1024 * 1024 * 1024);
    
    const storageUsage = {
      month_key: monthKey,
      total_used_bytes: totalUsedBytes,
      total_used_gb: totalUsedGB,
      file_count: storageRecords.length,
    };
    
    // Return settings with admin-configured storage pricing (NOT defaults)
    const settings = { ...videoBudgetSettings, price_per_gb, free_gb_per_month };
    
    return Response.json({ budget, settings, storage_usage: storageUsage });
  }

  // ── create_payment_intent ─────────────────────────────────────────────────
  if (action === 'create_payment_intent') {
    const { video_url, video_title, amount, file_size_bytes, context_type, context_id, owner_type } = body;
    if (!video_url || !amount || amount < 1) {
      return Response.json({ error: 'video_url and amount (min $1) are required' }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

    // Check for existing budget record
    let budget = await findBudgetRecord(base44, video_url);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      receipt_email: user.email,
      metadata: {
        purpose: 'video_budget',
        video_url,
        video_title: video_title || '',
        budget_id: budget?.id || '',
        user_id: user.id,
        user_email: user.email,
        amount: String(amount),
        context_type: context_type || 'other',
        context_id: context_id || '',
        owner_type: owner_type || 'organizer',
      },
    });

    // Create or update the budget record in pending state
    if (!budget) {
      const settings = await getSettings(base44);
      budget = await base44.asServiceRole.entities.VideoBudget.create({
        owner_user_id: user.id,
        owner_email: user.email,
        owner_name: user.full_name || user.email,
        owner_type: owner_type || 'organizer',
        video_url,
        video_title: video_title || '',
        file_size_bytes: file_size_bytes || 0,
        context_type: context_type || 'other',
        context_id: context_id || '',
        budget_amount: 0,
        used_amount: 0,
        remaining_amount: 0,
        status: 'no_budget',
        enforcement_enabled: settings.enforcement_enabled,
        stripe_payment_ids: [],
      });
    }

    return Response.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      budget_id: budget.id,
    });
  }

  // ── confirm_payment ───────────────────────────────────────────────────────
  if (action === 'confirm_payment') {
    const { payment_intent_id, budget_id, amount } = body;
    if (!payment_intent_id || !budget_id) {
      return Response.json({ error: 'payment_intent_id and budget_id required' }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_RESTRICTED_SECRET_KEY'), { apiVersion: '2024-06-20' });

    // Verify with Stripe
    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (pi.status !== 'succeeded') {
      return Response.json({ error: 'Payment not succeeded', stripe_status: pi.status }, { status: 400 });
    }

    // Fetch budget
    const budgets = await base44.asServiceRole.entities.VideoBudget.filter({ id: budget_id }, null, 1).catch(() => []);
    const budget = budgets[0];
    if (!budget) return Response.json({ error: 'Budget record not found' }, { status: 404 });

    // Idempotency: check if this PI was already applied
    if ((budget.stripe_payment_ids || []).includes(payment_intent_id)) {
      return Response.json({ success: true, already_applied: true, budget });
    }

    const addAmount = amount || (pi.amount / 100);
    const newBudget = (budget.budget_amount || 0) + addAmount;
    const newRemaining = Math.max(0, newBudget - (budget.used_amount || 0));
    const newStatus = newRemaining > 0 ? 'active' : 'paused';

    const updated = await base44.asServiceRole.entities.VideoBudget.update(budget_id, {
      budget_amount: newBudget,
      remaining_amount: newRemaining,
      status: newStatus,
      enforcement_enabled: true,
      stripe_payment_ids: [...(budget.stripe_payment_ids || []), payment_intent_id],
      last_funded_at: new Date().toISOString(),
    });

    return Response.json({ success: true, budget: updated });
  }

  // ── track_view ────────────────────────────────────────────────────────────
  if (action === 'track_view') {
    const { video_url, playback_seconds, file_size_bytes } = body;
    if (!video_url) return Response.json({ error: 'Missing video_url' }, { status: 400 });

    const settings = await getSettings(base44);
    const budget = await findBudgetRecord(base44, video_url);
    if (!budget) return Response.json({ tracked: false, reason: 'no_budget_record' });

    // Estimate bandwidth: assume 1x streaming = file_size_bytes delivered per full play
    // Partial plays scale by playback_seconds / estimated_duration
    // If we don't have duration, assume 1 full-size delivery per play
    const fileSizeBytes = file_size_bytes || budget.file_size_bytes || 0;
    const estimatedBytesDelivered = fileSizeBytes; // conservative: full file per view
    const estimatedGbDelivered = estimatedBytesDelivered / (1024 * 1024 * 1024);
    const costEstimate = estimatedGbDelivered * settings.price_per_gb;

    const newViewCount = (budget.estimated_view_count || 0) + 1;
    const newGbUsed = (budget.estimated_gb_used || 0) + estimatedGbDelivered;
    const newUsedAmount = (budget.used_amount || 0) + costEstimate;
    const newRemaining = Math.max(0, (budget.budget_amount || 0) - newUsedAmount);
    const newStatus = budget.enforcement_enabled
      ? (newRemaining <= 0 ? 'paused' : 'active')
      : budget.status;

    const updateData = {
      estimated_view_count: newViewCount,
      estimated_gb_used: newGbUsed,
      used_amount: newUsedAmount,
      remaining_amount: newRemaining,
      status: newStatus,
    };
    if (newStatus === 'paused' && budget.status !== 'paused') {
      updateData.paused_at = new Date().toISOString();
    }

    await base44.asServiceRole.entities.VideoBudget.update(budget.id, updateData).catch(() => {});

    return Response.json({ tracked: true, new_status: newStatus, views: newViewCount });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});