// The admin panel's own address, owner request: admin.cbrdance.org, so the
// installed admin app lives on a separate origin from the public site.
// On one origin, the public app's "/" scope contains /admin, and Android
// Chrome won't offer to install an app whose start page already belongs
// to an installed one -- so with the public app installed, the admin app
// couldn't be.
//
// Two independent steps, so the code can ship before the Cloudflare side
// is set up without changing anything:
//
// 1. Any "admin." hostname serves the admin panel, whenever a request
//    arrives on one. Until admin.cbrdance.org is added to the Worker in
//    Cloudflare, none do, so this is dormant.
// 2. env.ADMIN_HOST, unset by default, is the switch-over: once set, a GET
//    for /admin on any other hostname is redirected there. Unset, /admin
//    keeps working on cbrdance.org and cbredm.org exactly as before.

/**
 * Whether a request is on the admin panel's own hostname.
 * @param {URL} url
 */
export function isAdminHost(url) {
  return url.hostname.startsWith('admin.');
}

/**
 * The public site's origin for a request on the admin hostname:
 * admin.cbrdance.org -> https://cbrdance.org (keeping the port, for local
 * development on admin.localhost).
 * @param {URL} url
 */
export function publicOriginFor(url) {
  return `${url.protocol}//${url.host.replace(/^admin\./, '')}`;
}

/**
 * Whether a path belongs to the admin panel.
 * @param {string} path
 */
export function isAdminPath(path) {
  return path === '/admin' || path.startsWith('/admin/');
}

/**
 * Where to send a request for /admin on the public hostname once the
 * switch-over is on, or null to serve it here as before. Only GET and
 * HEAD move: a form posted from an admin page that was loaded just
 * before the switch still submits where it came from rather than being
 * turned into a GET by the redirect and losing its body.
 * @param {Request} request
 * @param {{ ADMIN_HOST?: string }} env
 */
export function adminRedirectFor(request, env) {
  const target = (env.ADMIN_HOST || '').trim();
  if (!target) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  if (url.hostname === target || !isAdminPath(url.pathname)) return null;
  return `https://${target}${url.pathname}${url.search}`;
}
