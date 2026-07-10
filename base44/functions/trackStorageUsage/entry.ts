/**
 * trackStorageUsage — backend function
 *
 * Handles OrganizerStorageRecord create/soft-delete so secrets never touch the frontend.
 *
 * Actions:
 *   record   — create a new storage record after a successful upload
 *   delete   — soft-delete a storage record by file_url (marks deleted=true)
 *   summary  — get usage summary for the current user (monthly + total)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BYTES_PER_GB = 1_073_741_824;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── record ─────────────────────────────────────────────────────────────────
  if (action === 'record') {
    const {
      file_url, file_key, file_size_bytes, mime_type, file_category,
      entity_type, entity_id, owner_name,
    } = body;

    if (!file_url || file_size_bytes === undefined || file_size_bytes === null) {
      return Response.json({ error: 'file_url and file_size_bytes are required' }, { status: 400 });
    }

    const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM

    const record = await base44.asServiceRole.entities.OrganizerStorageRecord.create({
      organizer_id: user.id,
      organizer_email: user.email,
      organizer_name: owner_name || user.full_name || user.email,
      file_url,
      file_key: file_key || '',
      file_size_bytes: Number(file_size_bytes),
      mime_type: mime_type || 'application/octet-stream',
      file_category: file_category || 'other',
      event_id: entity_type === 'event' ? (entity_id || '') : '',
      month_key: monthKey,
      deleted: false,
    });

    return Response.json({ success: true, record });
  }

  // ── delete ─────────────────────────────────────────────────────────────────
  if (action === 'delete') {
    const { file_url } = body;
    if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

    // Find the record (service role — owner's record)
    const records = await base44.asServiceRole.entities.OrganizerStorageRecord.filter(
      { file_url, organizer_id: user.id, deleted: false },
      null, 1
    ).catch(() => []);

    if (records[0]) {
      await base44.asServiceRole.entities.OrganizerStorageRecord.update(records[0].id, {
        deleted: true,
        deleted_at: new Date().toISOString(),
      });
    }

    return Response.json({ success: true, deleted: !!records[0] });
  }

  // ── summary ────────────────────────────────────────────────────────────────
  if (action === 'summary') {
    const monthKey = body.month_key || new Date().toISOString().slice(0, 7);
    const targetId = user.role === 'admin' && body.organizer_id ? body.organizer_id : user.id;

    const allRecords = await base44.asServiceRole.entities.OrganizerStorageRecord.filter(
      { organizer_id: targetId, deleted: false },
      null, 2000
    ).catch(() => []);

    const monthRecords = allRecords.filter(r => r.month_key === monthKey);

    // Get pricing settings
    const settings = await base44.asServiceRole.entities.AppSettings.filter(
      { category: 'storage' }, null, 20
    ).catch(() => []);
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.setting_key] = s.setting_value; });

    if (!settingsMap['storage_free_gb_per_month']) console.warn("[trackStorageUsage] storage_free_gb_per_month setting is missing — using fallback 10");
    if (!settingsMap['storage_price_per_gb']) console.warn("[trackStorageUsage] storage_price_per_gb setting is missing — using fallback 0.30");

    const freeGbTotal = parseFloat(settingsMap['storage_free_gb_per_month'] || 10);
    const pricePerGb = parseFloat(settingsMap['storage_price_per_gb'] || 0.30);
    const billingEnabled = (settingsMap['storage_billing_enabled'] || 'false') === 'true';

    const totalBytes = allRecords.reduce((s, r) => s + (r.file_size_bytes || 0), 0);
    const monthBytes = monthRecords.reduce((s, r) => s + (r.file_size_bytes || 0), 0);

    const isAdmin = user.role === 'admin';
    const totalGb = totalBytes / BYTES_PER_GB;
    const monthGb = monthBytes / BYTES_PER_GB;
    // Included storage is TOTAL (not monthly) — check against all-time usage
    const extraGb = isAdmin ? 0 : Math.max(0, totalGb - freeGbTotal);
    const estimatedCharge = billingEnabled ? extraGb * pricePerGb : 0;

    // Category breakdown
    const byCategory = {};
    allRecords.forEach(r => {
      const cat = r.file_category || 'other';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, bytes: 0 };
      byCategory[cat].count++;
      byCategory[cat].bytes += r.file_size_bytes || 0;
    });

    return Response.json({
      total_bytes: totalBytes,
      total_gb: totalGb,
      month_bytes: monthBytes,
      month_gb: monthGb,
      free_gb_total: freeGbTotal,
      extra_gb: extraGb,
      price_per_gb: pricePerGb,
      billing_enabled: billingEnabled,
      estimated_charge: estimatedCharge,
      month_key: monthKey,
      record_count: allRecords.length,
      by_category: byCategory,
      is_admin: isAdmin,
      has_limit: !isAdmin,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});