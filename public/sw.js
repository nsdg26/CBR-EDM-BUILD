// Service worker, deliberately minimal.
//
// This exists for two reasons, in this order:
//
// 1. The fonts. They are 106KB, comfortably the heaviest thing the site
//    ships, and their bytes never change for a given file. Serving them
//    from cache is what makes a second visit paint immediately.
// 2. Chrome wants a registered worker with a fetch handler before it will
//    offer to install a site to the home screen.
//
// It is NOT an offline mode, on purpose. The site's whole value is
// listings that change, and a cached board is worse than no board: you
// would open it, see last week's events, and have nothing telling you
// they were stale. So this worker touches an allowlist of two immutable
// asset directories and passes literally everything else straight to the
// network. Consequences worth knowing, all of them deliberate:
//
//   - No HTML is ever cached, so nobody is ever shown a stale page.
//   - Server-side page view counts (lib/analytics.js) stay accurate,
//     because every navigation still reaches the Worker.
//   - Nothing private can be cached by accident. This is an allowlist,
//     not a blocklist, so /admin, /crew, /edit and every /api route are
//     untouched without needing to name them, and stay untouched if new
//     routes are added later.
//   - Turnstile (challenges.cloudflare.com) is cross origin and never
//     intercepted.
//
// If someone needs an event's address somewhere with no reception, the
// answer is the "Add to calendar" link on the event page. An .ics in the
// phone's own calendar beats anything a browser cache can promise.
//
// TO KILL THIS WORKER, if it ever misbehaves: replace this file's whole
// body with the two lines below and deploy. Every client picks it up on
// its next update check, unregisters itself and drops its caches.
//
//     self.addEventListener('install', () => self.skipWaiting());
//     self.addEventListener('activate', (e) => e.waitUntil(
//       caches.keys().then((k) => Promise.all(k.map((n) => caches.delete(n))))
//         .then(() => self.registration.unregister())
//         .then(() => self.clients.matchAll())
//         .then((cs) => cs.forEach((c) => c.navigate(c.url)))));

// Bump this ONLY when a file inside the cached directories below is
// replaced in place, keeping its name (a re-cut woff2, a redrawn
// texture). Everything else on the site is uncached, so a normal deploy
// needs no change here. Old caches are deleted on activate.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `cbredm-static-${CACHE_VERSION}`;

// Immutable, same-origin, safe to serve from cache indefinitely. CSS and
// JS are deliberately absent: they are small (28KB and 38KB), they are
// unversioned filenames, and caching them would mean one stale load with
// the wrong stylesheet after every deploy. Not worth it for the bytes.
const CACHEABLE_PREFIXES = ['/fonts/', '/textures/'];

function isCacheable(url) {
  return url.origin === self.location.origin
    && CACHEABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener('install', () => {
  // Nothing is precached: the browser will ask for whatever fonts a page
  // actually uses, and only those get stored. Activate straight away
  // rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isCacheable(url)) return; // Straight to the network, untouched.

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        // Only store a clean same-origin 200. An opaque or error response
        // cached here would be served back as the real thing forever.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
