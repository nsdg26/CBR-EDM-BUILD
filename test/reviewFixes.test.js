import assert from 'node:assert/strict';
import { test } from 'node:test';
import { router } from '../src/router.js';
import { isCrossSiteWrite } from '../src/routes/admin/router.js';
import { requireAdmin, verifyAccessJwt, isLocalDevHost } from '../src/lib/auth.js';
import { withSecurityHeaders } from '../src/lib/securityHeaders.js';
import { asFormDataLike, publishedFieldErrors, readEventFields } from '../src/lib/eventFields.js';
import { checkVenueRealness, geocodeVenueDetailed } from '../src/lib/geocode.js';
import { insertEventWithSlug } from '../src/lib/eventInsert.js';
import { recordCount, countInBackground } from '../src/lib/analytics.js';
import { handleChangeApprove } from '../src/routes/admin/changes.js';
import { handleCrewLogin } from '../src/routes/crew.js';
import { handleContactApi } from '../src/routes/contact.js';
import { handleInboundEmailConvert } from '../src/routes/admin/inboundEmails.js';
import { hashToken } from '../src/lib/tokens.js';

// Fixes from docs/REVIEW-2026-10-22.md, one test per item that can be
// checked without a real D1.

const ASSETS = { fetch: async () => new Response('Not found', { status: 404 }) };

function withFetch(impl, fn) {
  const original = global.fetch;
  global.fetch = impl;
  return fn().finally(() => { global.fetch = original; });
}

// S1: admin CSRF -------------------------------------------------------------

test('S1: an admin form post from another site is refused, the same post from the admin itself is not', async () => {
  const env = { ASSETS, DEV_BYPASS_ACCESS: 'true' };
  const post = (headers) => router(new Request('http://localhost:8787/admin/no-such-route', { method: 'POST', headers }), env);

  assert.equal((await post({ 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post({ Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post({})).status, 403);
  // Through the guard: the router's own 404, which proves it was not the CSRF 403.
  assert.equal((await post({ 'Sec-Fetch-Site': 'same-origin', Origin: 'http://localhost:8787' })).status, 404);
  assert.equal((await post({ Origin: 'http://localhost:8787' })).status, 404);
});

test('S1: reads are never treated as cross-site writes', () => {
  const url = new URL('https://admin.cbrdance.org/admin');
  assert.equal(isCrossSiteWrite(new Request(url, { headers: { 'Sec-Fetch-Site': 'cross-site' } }), url), false);
});

// S2: dev bypass only on a local host ---------------------------------------

test('S2: DEV_BYPASS_ACCESS opens the admin on localhost only', async () => {
  const env = { DEV_BYPASS_ACCESS: 'true' };
  assert.ok(await requireAdmin(new Request('http://localhost:8787/admin'), env));
  assert.ok(await requireAdmin(new Request('http://admin.localhost:8787/admin'), env));
  assert.equal(await requireAdmin(new Request('https://cbrdance.org/admin'), env), null);
  assert.equal(await requireAdmin(new Request('https://cbr-edm.someone.workers.dev/admin'), env), null);
  assert.equal(isLocalDevHost(new URL('https://localhost.cbrdance.org/')), false);
});

// S7: issuer is an exact match ----------------------------------------------

test('S7: an issuer that merely contains the team domain is rejected', async () => {
  const domain = 'team-7.cloudflareaccess.com';
  // No key fetch should even be attempted: the issuer check comes first.
  await withFetch(async () => { throw new Error('should not fetch'); }, async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      aud: 'test-aud', iss: `https://${domain}.evil.example`, exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const token = `${header}.${payload}.${Buffer.from('sig').toString('base64url')}`;
    const request = new Request('https://cbrdance.org/admin', { headers: { 'Cf-Access-Jwt-Assertion': token } });
    assert.equal(await verifyAccessJwt(request, { ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: 'test-aud' }), null);
  });
});

// S5, S6, B9: security headers -----------------------------------------------

test('S5/S6/B9: CSP carries base-uri, object-src and form-action; a route-set referrer policy survives; the build marker is replaced whole', async () => {
  const page = new Response('<p>CF_VERSION_ID in a note</p><!-- build:CF_VERSION_ID -->', {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'no-referrer' },
  });
  const response = await withSecurityHeaders(page, {}, { CF_VERSION_METADATA: { id: 'abcdef1234567890' } });
  const csp = response.headers.get('Content-Security-Policy');
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /form-action 'self'/);
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.match(response.headers.get('Strict-Transport-Security'), /max-age=/);
  assert.equal(await response.text(), '<p>CF_VERSION_ID in a note</p><!-- build:abcdef12 -->');
});

test('S6: a response with no referrer policy of its own gets the default', async () => {
  const response = await withSecurityHeaders(new Response('x', { headers: { 'Content-Type': 'text/html' } }));
  assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
});

// B1: crew key limit counts failures only -----------------------------------

async function crewLoginDb(crew) {
  const runs = [];
  let count = 0;
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.startsWith('SELECT count FROM rate_limits')) return { count };
              if (sql.startsWith('INSERT INTO rate_limits')) { count += 1; runs.push(sql); return { count }; }
              if (sql.startsWith('SELECT * FROM crews WHERE key_hash = ?')) return args[0] === crew.key_hash ? crew : null;
              throw new Error(`unhandled first(): ${sql}`);
            },
            async run() { runs.push(sql); return {}; },
          };
        },
      };
    },
  };
  return { env: { DB }, runs, count: () => count };
}

function loginRequest(key) {
  return new Request('https://cbrdance.org/api/crew/login', { method: 'POST', body: JSON.stringify({ key }) });
}

test('B1: a stored key re-checked on every dashboard load never spends the wrong-key budget', async () => {
  const key = 'right-key';
  const { env, count } = await crewLoginDb({ id: 'crw_1', name: 'Crew', trusted: 1, key_hash: await hashToken(key), links_json: '[]' });
  for (let i = 0; i < 15; i++) {
    const response = await handleCrewLogin(loginRequest(key), env);
    assert.equal(response.status, 200, `load ${i + 1}`);
  }
  assert.equal(count(), 0);
});

test('B1: wrong keys are counted, and the eleventh is refused before any lookup', async () => {
  const { env, count } = await crewLoginDb({ id: 'crw_1', name: 'Crew', trusted: 1, key_hash: await hashToken('right-key') });
  for (let i = 0; i < 10; i++) {
    assert.equal((await handleCrewLogin(loginRequest('wrong'), env)).status, 401);
  }
  assert.equal(count(), 10);
  assert.equal((await handleCrewLogin(loginRequest('wrong'), env)).status, 429);
  // Even the right key is refused once the client is over the limit.
  assert.equal((await handleCrewLogin(loginRequest('right-key'), env)).status, 429);
});

// B2: analytics never throws -------------------------------------------------

test('B2: a failing counter write is logged, not thrown, and runs after the response when there is a ctx', async () => {
  const env = { DB: { prepare() { return { bind() { return { async run() { throw new Error('D1 quota'); } }; } }; } } };
  await assert.doesNotReject(() => recordCount(env, 'home_view'));

  const waited = [];
  const ctx = { waitUntil: (promise) => waited.push(promise) };
  await countInBackground(ctx, env, 'home_view');
  assert.equal(waited.length, 1);
  await assert.doesNotReject(() => waited[0]);
});

// B3: geocoder outages fail open --------------------------------------------

test('B3: checkVenueRealness tells an outage apart from an unknown address', async () => {
  const fields = { location_tba: 0, venue_name: 'Sideway', venue_address: '1 Lonsdale St' };

  await withFetch(async () => { throw new Error('timeout'); }, async () => {
    const result = await checkVenueRealness(fields);
    assert.equal(result.ok, false);
    assert.equal(result.unavailable, true);
  });
  await withFetch(async () => ({ ok: false, status: 503 }), async () => {
    assert.equal((await geocodeVenueDetailed('Sideway', null)).status, 'unavailable');
  });
  await withFetch(async () => ({ ok: true, json: async () => [] }), async () => {
    const result = await checkVenueRealness(fields);
    assert.equal(result.ok, false);
    assert.equal(result.unavailable, false);
  });
  await withFetch(async () => ({ ok: true, json: async () => [{ lat: '-35.3', lon: '149.1', place_rank: 30 }] }), async () => {
    const result = await checkVenueRealness(fields);
    assert.equal(result.ok, true);
    assert.deepEqual(result.location, { lat: -35.3, lng: 149.1 });
  });
});

test('B3: the site-wide geocoder cap reads as unavailable, not as a bad address', async () => {
  const env = { DB: { prepare() { return { bind() { return { async first() { return { count: 999 }; } }; } }; } } };
  await withFetch(async () => { throw new Error('should not be called'); }, async () => {
    assert.equal((await geocodeVenueDetailed('Sideway', null, env)).status, 'unavailable');
  });
});

// B4: a published event keeps its title and start -----------------------------

test('B4: publishedFieldErrors only bites on a published event, and only for fields the edit carries', () => {
  assert.deepEqual(publishedFieldErrors({ visibility: 'pending' }, { title: null, start_at: null }), []);
  assert.deepEqual(publishedFieldErrors({ visibility: 'published' }, { notes: 'x' }), []);
  assert.equal(publishedFieldErrors({ visibility: 'published' }, { title: null, start_at: '2026-10-03T11:00:00Z' }).length, 1);
  assert.equal(publishedFieldErrors({ visibility: 'published' }, { title: 'T', start_at: null }).length, 1);
});

test('B4: approving an edit that blanks a published event\'s title or start keeps the live values', async () => {
  const runs = [];
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.startsWith('SELECT * FROM event_changes')) {
                return { id: 'chg_1', event_id: 'evt_1', kind: 'edit', via: 'edit_link', state: 'pending',
                  proposed_json: JSON.stringify({ title: null, start_at: null, notes: 'New notes', location_tba: 0 }) };
              }
              if (sql.startsWith('SELECT visibility')) {
                return { visibility: 'published', location_tba: 0, location_revealed_at: null, venue_lat: null, venue_lng: null, elevation_grid: null };
              }
              throw new Error(`unhandled first(): ${sql}`);
            },
            async run() { runs.push({ sql, args }); return {}; },
          };
        },
      };
    },
  };
  await handleChangeApprove(new Request('https://cbrdance.org/admin/changes/chg_1/approve', { method: 'POST' }), { DB }, {}, 'chg_1');
  const update = runs.find((r) => r.sql.startsWith('UPDATE events SET'));
  assert.doesNotMatch(update.sql, /\btitle = \?/);
  assert.doesNotMatch(update.sql, /\bstart_at = \?/);
  assert.match(update.sql, /notes = \?/);
});

// B6: slug collisions retry --------------------------------------------------

test('B6: a slug collision is retried with a fresh suffix, any other error is thrown', async () => {
  const seen = [];
  const slug = await insertEventWithSlug((candidate) => ({
    async run() {
      seen.push(candidate);
      if (seen.length === 1) throw new Error('D1_ERROR: UNIQUE constraint failed: events.slug: SQLITE_CONSTRAINT');
    },
  }), 'Deep Signal', '2026-10-03T11:00:00Z');
  assert.equal(seen.length, 2);
  assert.notEqual(seen[0], seen[1]);
  assert.equal(slug, seen[1]);

  await assert.rejects(() => insertEventWithSlug(() => ({ async run() { throw new Error('D1_ERROR: no such table'); } }), 'T', null), /no such table/);
});

// B7: JSON fields that aren't strings ----------------------------------------

test('B7: non-string JSON fields are coerced or dropped rather than reaching .trim()', () => {
  const fields = readEventFields(asFormDataLike({ title: { bad: true }, ticket_url: 42, notes: ['x'], location_tba: true, genres: false }));
  assert.equal(fields.title, null);
  assert.equal(fields.ticket_url, 'https://42');
  assert.equal(fields.notes, null);
  assert.equal(fields.location_tba, 1);
  assert.equal(fields.genres, null);
});

// I4: Turnstile after validation ---------------------------------------------

test('I4: an empty contact message is refused before the Turnstile token is spent', async () => {
  let verified = false;
  await withFetch(async () => { verified = true; return { json: async () => ({ success: true }) }; }, async () => {
    const body = new FormData();
    body.set('message', '   ');
    body.set('cf-turnstile-response', 'token');
    const response = await handleContactApi(
      new Request('https://cbrdance.org/api/contact', { method: 'POST', body }),
      { DB: { prepare() { return { bind() { return { async first() { return { count: 1 }; }, async run() { return {}; } }; } }; } }, TURNSTILE_SECRET_KEY: 's' },
    );
    assert.equal(response.status, 400);
  });
  assert.equal(verified, false);
});

// S4: email sender stays private --------------------------------------------

test('S4: converting an email puts the sender in submitter_contact, never in the public notes', async () => {
  const runs = [];
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.startsWith('SELECT * FROM inbound_emails')) {
                return { id: 'mail_1', from_address: 'crew@example.com', subject: 'Deep Signal', attachments_json: '[]' };
              }
              throw new Error(`unhandled first(): ${sql}`);
            },
            async run() { runs.push({ sql, args }); return {}; },
          };
        },
      };
    },
  };
  await handleInboundEmailConvert(new Request('https://cbrdance.org/admin/inbound-emails/mail_1/convert', { method: 'POST' }), { DB }, { email: 'a' }, 'mail_1');
  const insert = runs.find((r) => r.sql.startsWith('INSERT INTO events'));
  assert.match(insert.sql, /submitter_contact/);
  assert.doesNotMatch(insert.sql, /notes/);
  assert.ok(insert.args.some((arg) => typeof arg === 'string' && arg.includes('crew@example.com')));
});
