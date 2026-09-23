import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashToken } from '../src/lib/tokens.js';
import { handleCrewEventUpdate } from '../src/routes/crew.js';

// Answers the crew and owned-event lookups, and records every write.
async function setup(eventOverrides = {}) {
  const key = 'test-crew-key';
  const crew = { id: 'crw_1', name: 'Low Frequency Society', trusted: 1, key_hash: await hashToken(key) };
  const event = {
    id: 'evt_1', crew_id: 'crw_1', title: 'Deep Signal', visibility: 'published',
    age_restriction: '18+', location_tba: 1, lineup_equal_billing: 1, location_revealed_at: null,
    venue_lat: null, venue_lng: null, elevation_grid: null, ...eventOverrides,
  };
  const runs = [];
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.startsWith('SELECT * FROM crews WHERE key_hash = ?')) return args[0] === crew.key_hash ? crew : null;
              if (sql.includes('FROM events LEFT JOIN crews')) return { ...event, crew_name: crew.name };
              throw new Error(`unhandled first(): ${sql}`);
            },
            async run() {
              runs.push({ sql, args });
              return {};
            },
          };
        },
      };
    },
  };
  return { env: { DB }, key, runs };
}

function request(body) {
  return new Request('https://example.test/api/crew/events/evt_1/update', { method: 'POST', body: JSON.stringify(body) });
}

test("a crew edit keeps the event's age restriction, TBA and equal billing, which its form never sends", async () => {
  const { env, key, runs } = await setup();
  // Exactly the fields public/js/crew-dashboard.js sends.
  const body = { key, title: 'Deep Signal II', start_at_local: '2026-10-03T22:00', end_at_local: '', venue_name: '', venue_address: '', genres: '', lineup: '', ticket_url: '', notes: 'New notes' };
  const response = await handleCrewEventUpdate(request(body), env, 'evt_1');
  assert.equal((await response.json()).applied, 'direct');

  const update = runs.find((r) => r.sql.startsWith('UPDATE events SET title'));
  const columns = update.sql.match(/(\w+) = (\?|sequence)/g).map((c) => c.split(' ')[0]).filter((c) => c !== 'sequence');
  const row = Object.fromEntries(columns.map((c, i) => [c, update.args[i]]));
  assert.equal(row.title, 'Deep Signal II');
  assert.equal(row.age_restriction, '18+');
  assert.equal(row.location_tba, 1);
  assert.equal(row.lineup_equal_billing, 1);
});

test('a crew edit that does send age_restriction still changes it', async () => {
  const { env, key, runs } = await setup();
  await handleCrewEventUpdate(request({ key, title: 'Deep Signal', age_restriction: 'all_ages' }), env, 'evt_1');
  const update = runs.find((r) => r.sql.startsWith('UPDATE events SET title'));
  assert.ok(update.args.includes('all_ages'));
});
