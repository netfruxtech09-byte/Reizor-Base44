import { base44 } from "@/api/base44Client";

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Mac OS X/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "web";
}

let _cachedUser = null;
async function getUser() {
  if (_cachedUser) return _cachedUser;
  try {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) return null;
    _cachedUser = await base44.auth.me();
    return _cachedUser;
  } catch {
    return null;
  }
}

// Deduplicate: don't log the exact same error twice in a session
const _logged = new Set();

/**
 * Log a business-relevant event to the admin system logs.
 * Only use for actionable business events — NOT for render errors or stack traces.
 *
 * @param {Object} params
 * @param {string} params.message - Human-readable event description
 * @param {string} params.type - One of: api_error, payment_error, streaming_error, storage_error, auth_error, upload_error, billing_error
 * @param {string} [params.details] - Optional structured details (JSON string or plain text)
 */
export async function logBusinessEvent({ message, type = "api_error", details }) {
  const dedupeKey = `${type}:${message}`;
  if (_logged.has(dedupeKey)) return;
  _logged.add(dedupeKey);

  const user = await getUser();
  const platform = detectPlatform();
  const route_url = window.location.pathname + window.location.search;

  try {
    await base44.entities.AppErrorLog.create({
      error_message: String(message || "Unknown event").slice(0, 2000),
      error_type: type,
      error_stack: String(details || "").slice(0, 5000),
      route_url,
      user_id: user?.id || "",
      user_email: user?.email || "",
      user_role: user?.role || "",
      platform,
      user_agent: navigator.userAgent.slice(0, 500),
    });
  } catch {
    // Never throw — logging must never break the app
  }
}

/**
 * Deprecated — replaced by logBusinessEvent.
 * Kept for backward compatibility but does NOT log to AppErrorLog.
 * Render errors and stack traces are NOT business-relevant.
 */
export async function logCrash({ message, stack, type, componentStack, extraContext }) {
  // Silently ignore — render/component errors are not business logs
  // The error is still printed to console for debugging purposes
  console.warn("[ErrorBoundary]", message, { stack, type, componentStack, extraContext });
}

/**
 * Install global error handlers.
 * These NO LONGER log to AppErrorLog — frontend render errors are NOT business-relevant.
 * Errors are still visible in the browser console for debugging.
 */
export function installGlobalErrorHandlers() {
  window.onerror = (message, source, lineno, colno, error) => {
    // Only log to console, never to AppErrorLog
    console.error("[GlobalError]", message, error?.stack || `${source}:${lineno}:${colno}`);
    return false;
  };

  window.onunhandledrejection = (event) => {
    console.error("[UnhandledRejection]", event.reason);
  };
}