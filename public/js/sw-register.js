// Registers the service worker, in an external file because the site's
// CSP blocks inline scripts (see lib/securityHeaders.js). What the worker
// does, and why it does so little, is documented in /sw.js.
(function () {
  if (!('serviceWorker' in navigator)) return;

  // The admin panel is behind Cloudflare Access and served no-store. It
  // has no business being installable or having a worker in front of its
  // sign-in redirects, and its own shell doesn't load this file -- this
  // is belt and braces in case that ever changes.
  if (location.pathname === '/admin' || location.pathname.indexOf('/admin/') === 0) return;

  // Registration is not urgent and competes with the page's own fonts and
  // data for bandwidth, so it waits for load.
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // A failed registration is not worth bothering anyone about: the
      // site works exactly as it always has without it.
    });
  });
})();
