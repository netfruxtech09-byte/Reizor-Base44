import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { rateLimitEntities, rateLimit } from '@/lib/rateLimiter';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// Wrap entities with a global rate limiter to prevent API rate limit errors
// across all components and pages. All entity calls (list, filter, create, etc.)
// are queued and processed with a minimum delay between each request.
Object.defineProperty(base44, 'entities', {
  value: rateLimitEntities(base44.entities),
  writable: false,
  configurable: true,
});

// Also rate-limit auth.me() — called from many components simultaneously on page load
const origMe = base44.auth.me.bind(base44.auth);
base44.auth.me = rateLimit(origMe);

// ── App initialization marker (kept for compatibility) ────────────────────────
// The global 401 interceptor has been intentionally removed.
// Auth modal must only be triggered by explicit user actions via useAuthGate
// (requireAuth / guardedAction). Background/page-load 401s are silently ignored.
export function markAppInitialized() {}