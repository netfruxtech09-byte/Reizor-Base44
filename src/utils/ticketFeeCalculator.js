/**
 * Platform default fee scale (per ticket) — defined in USD:
 * $0 – $50     → $1.00
 * $51 – $100   → $1.50
 * $101 – $250  → $2.00
 * $251 – $500  → $3.00
 * $501+        → $5.00
 *
 * Table sale platform fee: $10.00 (flat, per table)
 *
 * For non-USD events the ticket price is converted to USD to pick the
 * correct tier, then the USD fee is converted back into the event currency.
 * `usdRate` = USD value of 1 unit of the event currency (from getUsdRate).
 */
export function getTicketPlatformFee(priceUsd) {
  const price = parseFloat(priceUsd) || 0;
  if (price <= 50) return 1.0;
  if (price <= 100) return 1.5;
  if (price <= 250) return 2.0;
  if (price <= 500) return 3.0;
  return 5.0;
}

/**
 * Calculate total platform fee for multiple tickets (USD prices).
 */
export function calculatePlatformFee(ticketPrice, quantity) {
  return getTicketPlatformFee(ticketPrice) * (quantity || 1);
}

/**
 * Platform fee for a ticket priced in `currency`, returned in `currency`.
 * Uses `usdRate` (USD per 1 unit of currency) to convert price→USD for tier
 * selection, then converts the USD fee back to `currency` for display/charge.
 * For USD, or when the rate is unavailable, behaves like getTicketPlatformFee.
 */
export function getTicketPlatformFeeForCurrency(priceLocal, currency, usdRate) {
  if (!currency || currency === "USD" || !usdRate || usdRate <= 0) {
    return getTicketPlatformFee(priceLocal);
  }
  const priceUsd = priceLocal * usdRate;
  const feeUsd = getTicketPlatformFee(priceUsd);
  return feeUsd / usdRate;
}

export function calculatePlatformFeeForCurrency(priceLocal, quantity, currency, usdRate) {
  return getTicketPlatformFeeForCurrency(priceLocal, currency, usdRate) * (quantity || 1);
}

/**
 * Platform fee for tables: $10 per table (flat, USD)
 */
export const TABLE_PLATFORM_FEE = 10;

/**
 * Table platform fee converted into the event currency.
 */
export function getTablePlatformFeeForCurrency(currency, usdRate) {
  if (!currency || currency === "USD" || !usdRate || usdRate <= 0) return TABLE_PLATFORM_FEE;
  return TABLE_PLATFORM_FEE / usdRate;
}

/**
 * Fee scale bands for UI display
 */
export const TICKET_FEE_SCALE = [
  { range: "$0 – $50",      fee: "$1.00" },
  { range: "$51 – $100",    fee: "$1.50" },
  { range: "$101 – $250",   fee: "$2.00" },
  { range: "$251 – $500",   fee: "$3.00" },
  { range: "$501 – $1,000", fee: "$5.00" },
];