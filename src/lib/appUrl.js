/**
 * Single source of truth for the public app base URL.
 * All share links, QR codes, email links, and social previews must use this.
 * Never use window.location.origin for generated/shareable links.
 */
export const APP_BASE_URL = "https://reizor.com";

/**
 * Build a full public URL for a given path.
 * @param {string} path - e.g. "/events/abc123"
 * @returns {string} - e.g. "https://reizor.com/events/abc123"
 */
export function getAppUrl(path = "") {
  return `${APP_BASE_URL}${path}`;
}