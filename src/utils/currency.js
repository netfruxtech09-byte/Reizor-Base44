/**
 * Supported currencies for ticket pricing.
 * Sorted alphabetically by label. Removed: NGN, ZAR, CNY, ILS, SAR.
 */
export const CURRENCIES = [
  { code: "AED", symbol: "د.إ", label: "AED — UAE Dirham" },
  { code: "AUD", symbol: "A$",  label: "AUD — Australian Dollar" },
  { code: "BRL", symbol: "R$",  label: "BRL — Brazilian Real" },
  { code: "CAD", symbol: "CA$", label: "CAD — Canadian Dollar" },
  { code: "EUR", symbol: "€",   label: "EUR — Euro" },
  { code: "GBP", symbol: "£",   label: "GBP — British Pound" },
  { code: "INR", symbol: "₹",   label: "INR — Indian Rupee" },
  { code: "JPY", symbol: "¥",   label: "JPY — Japanese Yen" },
  { code: "MXN", symbol: "MX$", label: "MXN — Mexican Peso" },
  { code: "SGD", symbol: "S$",  label: "SGD — Singapore Dollar" },
  { code: "THB", symbol: "฿",   label: "THB — Thai Baht" },
  { code: "USD", symbol: "$",   label: "USD — US Dollar" },
];

/**
 * Get currency symbol for a given code. Falls back to the code itself.
 */
export function getCurrencySymbol(code) {
  const found = CURRENCIES.find(c => c.code === code);
  return found ? found.symbol : (code || "$");
}

/**
 * Format a price with its currency symbol.
 */
export function formatPrice(amount, currencyCode) {
  const symbol = getCurrencySymbol(currencyCode || "USD");
  const num = parseFloat(amount) || 0;
  // For currencies that don't use decimals (JPY, etc.)
  const noDecimals = ["JPY", "KRW", "IDR"].includes(currencyCode);
  return `${symbol}${noDecimals ? Math.round(num) : num.toFixed(2)}`;
}

/**
 * Fetch the conversion rate from a given currency to USD.
 * Uses the open.er-api.com free endpoint (no API key required).
 * Returns the rate (e.g. 0.012 for INR→USD) or null on failure.
 */
export async function fetchUsdConversionRate(fromCurrency) {
  if (!fromCurrency || fromCurrency === "USD") return 1;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);
    if (!res.ok) throw new Error("Rate fetch failed");
    const data = await res.json();
    if (data.result !== "success" || !data.rates?.USD) throw new Error("Invalid response");
    return data.rates.USD;
  } catch {
    return null; // caller must handle null
  }
}

// Cache exchange rates for ~55 minutes (open.er-api.com updates hourly)
const _rateCache = new Map();
const RATE_TTL = 55 * 60 * 1000;

/**
 * Get the USD-per-unit rate for a currency (cached).
 * Returns 1 for USD, or null if the fetch fails.
 * `usdRate` = USD value of 1 unit of `currency` (e.g. THB ≈ 0.028).
 *   USD amount → currency: amount / usdRate
 *   currency amount → USD: amount * usdRate
 */
export async function getUsdRate(currency) {
  if (!currency || currency === "USD") return 1;
  const now = Date.now();
  const cached = _rateCache.get(currency);
  if (cached && now - cached.ts < RATE_TTL) return cached.rate;
  const rate = await fetchUsdConversionRate(currency);
  if (rate && rate > 0) _rateCache.set(currency, { rate, ts: now });
  return rate; // null on failure
}

/**
 * Convert a USD amount into the target currency using a cached rate fetch.
 * Falls back to the original USD amount if the rate is unavailable.
 */
export async function convertUsdToCurrency(usdAmount, currency) {
  if (!currency || currency === "USD") return usdAmount;
  const rate = await getUsdRate(currency);
  if (!rate || rate <= 0) return usdAmount; // fallback: treat as USD
  return usdAmount / rate;
}