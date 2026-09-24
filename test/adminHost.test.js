import assert from 'node:assert/strict';
import { test } from 'node:test';
import { router } from '../src/router.js';
import { adminRedirectFor, publicOriginFor, isAdminHost } from '../src/lib/hosts.js';
import { adminLayout } from '../src/templates/admin/layout.js';

// Static files: /css/style.css exists, anything else is a 404, like the
// real asset binding for a path that isn't a file.
const ASSETS = {
  fetch: async (request) => (new URL(request.url).pathname === '/css/style.css'
    ? new Response('body{}', { headers: { 'Content-Type': 'text/css' } })
    : new Response('Not found', { status: 404 })),
};
const env = (extra = {}) => ({ ASSETS, ...extra });
const get = (url, init) => router(new Request(url, init), env(init?.env));

test('the admin hostname sends its root to the queue', async () => {
  const response = await get('https://admin.cbrdance.org/');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), 'https://admin.cbrdance.org/admin');
});

test('the admin hostname serves the admin (behind Access, like anywhere else)', async () => {
  // No Access JWT in a test, so the admin's own guard answers: this is
  // the admin router, not a redirect or the public site.
  const response = await get('https://admin.cbrdance.org/admin/events');
  assert.equal(response.status, 403);
});

test('the admin hostname serves static files and the admin manifest', async () => {
  assert.equal((await get('https://admin.cbrdance.org/css/style.css')).status, 200);
  const manifest = await get('https://admin.cbrdance.org/manifest-admin.webmanifest');
  assert.equal((await manifest.json()).id, '/admin');
});

test('anything else on the admin hostname goes to the same page on the public site', async () => {
  const response = await get('https://admin.cbrdance.org/e/deep-signal?x=1');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), 'https://cbrdance.org/e/deep-signal?x=1');
});

test('the admin hostname keeps search engines out', async () => {
  assert.match(await (await get('https://admin.cbrdance.org/robots.txt')).text(), /Disallow: \/\n/);
});

test('with ADMIN_HOST unset, /admin stays where it is on both public domains', async () => {
  for (const host of ['cbrdance.org', 'cbredm.org']) {
    const response = await get(`https://${host}/admin`);
    assert.equal(response.status, 403, `${host}: expected the admin itself, not a redirect`);
  }
});

test('with ADMIN_HOST set, GET /admin anywhere else moves to it, keeping path and query', async () => {
  const on = { ADMIN_HOST: 'admin.cbrdance.org' };
  for (const host of ['cbrdance.org', 'cbredm.org']) {
    const response = await get(`https://${host}/admin/events?q=dub`, { env: on });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), 'https://admin.cbrdance.org/admin/events?q=dub');
  }
  // A form posted from a page loaded before the switch still submits.
  const post = await get('https://cbrdance.org/admin/events/new', { method: 'POST', env: on });
  assert.equal(post.status, 403);
  // Public pages never move.
  assert.equal(adminRedirectFor(new Request('https://cbrdance.org/crews'), on), null);
  // And the admin hostname itself never redirects to itself.
  assert.equal(adminRedirectFor(new Request('https://admin.cbrdance.org/admin'), on), null);
});

test('hostname helpers', () => {
  assert.equal(isAdminHost(new URL('https://admin.cbrdance.org/admin')), true);
  assert.equal(isAdminHost(new URL('https://cbrdance.org/admin')), false);
  assert.equal(publicOriginFor(new URL('http://admin.localhost:8787/admin')), 'http://localhost:8787');
});

test('"View the site" goes to the public site from the admin hostname', () => {
  const page = String(adminLayout({ title: 'Queue', bodyContent: '', email: 'a@b.c', siteOrigin: 'https://cbrdance.org' }));
  assert.match(page, /<a href="https:\/\/cbrdance\.org\/" class="admin-nav-site">View the site<\/a>/);
});
