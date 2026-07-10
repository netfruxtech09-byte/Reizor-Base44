// Service Worker — network-first, no caching.
// Caching was causing white screens after login/logout by serving stale app shells.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  // Clear all existing caches on activation
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Pass every request straight through to the network — no caching.
// CRITICAL: DigitalOcean Spaces upload requests (presigned PUT/multipart) must
// bypass the service worker entirely. If the SW wraps them via fetch(event.request),
// the browser treats the response as same-origin and CORS headers are stripped,
// causing ERR_FAILED / CORS errors on the actual upload PUT.
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Bypass: let DigitalOcean Spaces requests go directly to the network
  // without SW interception. This preserves CORS headers on the response.
  if (
    url.includes('.digitaloceanspaces.com') ||
    url.includes('.cdn.digitaloceanspaces.com') ||
    url.includes('digitalocean.com/spaces')
  ) {
    return; // Do NOT call event.respondWith — browser handles it natively
  }

  // All other requests: pass straight through (no caching)
  event.respondWith(fetch(event.request));
});
