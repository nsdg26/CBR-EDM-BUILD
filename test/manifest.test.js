import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleManifest, handleAdminManifest } from '../src/routes/manifest.js';
import { adminLayout } from '../src/templates/admin/layout.js';

test('the public and admin manifests are separate apps: own id, start_url and scope', async () => {
  const site = await handleManifest().json();
  const admin = await handleAdminManifest().json();
  assert.equal(site.id, '/');
  assert.equal(admin.id, '/admin');
  assert.equal(admin.start_url, '/admin');
  assert.equal(admin.scope, '/admin');
  assert.notEqual(admin.short_name, site.short_name);
  assert.ok(admin.short_name.length <= 12, 'a launcher truncates much past 12 characters');
  assert.ok(admin.icons.every((icon) => icon.src.includes('admin')), 'admin icons are the red label set');
  assert.ok(admin.icons.some((icon) => icon.purpose === 'maskable'));
});

test('the admin manifest is served as a manifest', () => {
  assert.match(handleAdminManifest().headers.get('Content-Type'), /^application\/manifest\+json/);
});

test('the admin shell links a manifest outside /admin, where Access would block the fetch', () => {
  const page = String(adminLayout({ title: 'Queue', bodyContent: '', email: 'a@b.c' }));
  const href = page.match(/<link rel="manifest" href="([^"]+)">/)[1];
  assert.equal(href, '/manifest-admin.webmanifest');
  assert.ok(href !== '/admin' && !href.startsWith('/admin/'));
  assert.match(page, /\/js\/sw-register\.js/);
  assert.match(page, /apple-touch-icon-admin\.png/);
});
