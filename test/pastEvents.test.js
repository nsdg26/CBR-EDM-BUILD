import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homePage } from '../src/templates/home.js';
import { pastIndex, pastYear } from '../src/templates/past.js';
import { layout } from '../src/templates/layout.js';
import { router } from '../src/router.js';

const NOW = new Date('2026-09-19T05:00:00Z');
const base = { visibility: 'published', status: 'on' };
const UPCOMING = { ...base, id: 'u1', slug: 'coming-up', title: 'Coming Up Party', start_at: '2026-09-25T09:00:00Z', end_at: '2026-09-25T15:00:00Z' };
const PAST = { ...base, id: 'p1', slug: 'been-and-gone', title: 'Been And Gone Party', start_at: '2026-08-01T09:00:00Z', end_at: '2026-08-01T15:00:00Z' };

test('the home page shows upcoming events only, and links to past events', () => {
  const page = String(homePage([UPCOMING, PAST], NOW).body);
  assert.match(page, /Coming Up Party/);
  assert.doesNotMatch(page, /Been And Gone Party/);
  assert.match(page, /href="\/past"/);
  assert.doesNotMatch(page, /\/archive/);
});

test('/past lists the past events themselves, then the years', () => {
  const page = String(pastIndex([PAST], [2026, 2025], NOW));
  assert.match(page, /<h1>Past events<\/h1>/);
  assert.match(page, /Been And Gone Party/);
  assert.match(page, /href="\/past\/2025"/);
});

test('a /past year page links back to all past events', () => {
  const page = String(pastYear(2026, [PAST], NOW));
  assert.match(page, /<h1>Past events: 2026<\/h1>/);
  assert.match(page, /href="\/past"/);
});

test('the nav says Past events, not Archive', () => {
  const page = String(layout({ title: null, bodyContent: '' }));
  assert.match(page, /<a href="\/past">Past events<\/a>/);
  assert.doesNotMatch(page, />Archive</);
});

test('old /archive addresses redirect permanently to /past', async () => {
  for (const [from, to] of [['/archive', '/past'], ['/archive/2025', '/past/2025']]) {
    const response = await router(new Request(`https://cbrdance.org${from}`), {}, {});
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('Location'), `https://cbrdance.org${to}`);
  }
});
