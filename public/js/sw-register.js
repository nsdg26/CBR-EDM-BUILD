// Registers the service worker, in an external file because the site's
// CSP blocks inline scripts (see lib/securityHeaders.js). What the worker
// does, and why it does so little, is documented in /sw.js.
(function () {
  if (!('serviceWorker' in navigator)) return;

  // The admin panel loads this too now that it installs as its own app
  // (owner request). It is the same worker at the same "/" scope, which
  // already covered /admin once the public site had been visited, and it
  // leaves every admin request alone: it only ever answers /fonts/ and
  // /textures/ itself (see /sw.js), so Access's sign-in redirects and the
  // no-store admin pages go straight to the network exactly as before.

  // Registration is not urgent and competes with the page's own fonts and
  // data for bandwidth, so it waits for load.
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // A failed registration is not worth bothering anyone about: the
      // site works exactly as it always has without it.
    });
  });
})();
