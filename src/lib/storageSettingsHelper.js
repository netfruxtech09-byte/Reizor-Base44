import { base44 } from '@/api/base44Client';

let cachedSettings = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch storage pricing settings via the trackStorageUsage backend function (service role).
 * This works for ALL user roles since AppSettings has admin-only RLS.
 * Single source of truth — never hardcode pricing values anywhere else.
 *
 * @returns {Promise<{freeGb: number, pricePerGb: number, billingEnabled: boolean}>}
 */
export async function getStorageSettings() {
  const now = Date.now();

  if (cachedSettings && now - cacheTime < CACHE_DURATION) {
    return cachedSettings;
  }

  try {
    const res = await base44.functions.invoke('trackStorageUsage', { action: 'summary' });
    const data = res.data;

    const result = {
      freeGb: data.free_gb_total ?? 10,
      pricePerGb: data.price_per_gb ?? 0.30,
      billingEnabled: data.billing_enabled ?? false,
    };

    cachedSettings = result;
    cacheTime = now;
    return result;
  } catch (error) {
    console.error("[storageSettingsHelper] Failed to fetch settings via trackStorageUsage:", error.message);
    return { freeGb: 10, pricePerGb: 0.30, billingEnabled: false };
  }
}

export function clearStorageSettingsCache() {
  cachedSettings = null;
  cacheTime = 0;
}