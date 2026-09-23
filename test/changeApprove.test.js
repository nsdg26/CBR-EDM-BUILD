import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleChangeApprove } from '../src/routes/admin/changes.js';

// Records every statement handleChangeApprove runs, answering the two
// SELECTs it makes from the rows given.
function recordingDb({ change, event }) {
  const runs = [];
  return {
    runs,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.startsWith('SELECT * FROM event_changes')) return change;
              if (sql.startsWith('SELECT visibility')) return event;
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
}

const request = new Request('https://example.test/admin/changes/chg_1/approve', { method: 'POST' });
const publishedEvent = { visibility: 'published', location_tba: 0, location_revealed_at: null, venue_lat: null, venue_lng: null, elevation_grid: null };

test('approving an edit queued with the old full field set never writes status or crew_id', async () => {
  // What edit.js used to store: readEventFields' output, including the
  // defaults for fields the public edit form never sends.
  const proposed = { title: 'New name', crew_id: null, status: 'on', presented_by: 'Someone', location_tba: 0 };
  const db = recordingDb({ change: { id: 'chg_1', event_id: 'evt_1', kind: 'edit', via: 'edit_link', state: 'pending', proposed_json: JSON.stringify(proposed) }, event: publishedEvent });
  await handleChangeApprove(request, { DB: db }, {}, 'chg_1');

  const update = db.runs.find((r) => r.sql.startsWith('UPDATE events SET'));
  assert.match(update.sql, /title = \?/);
  assert.match(update.sql, /presented_by = \?/);
  assert.doesNotMatch(update.sql, /\bstatus = \?/);
  assert.doesNotMatch(update.sql, /crew_id = \?/);
});

test('approving an old crew edit does not blank the presenter', async () => {
  const proposed = { title: 'New name', presented_by: null, crew_id: null, status: 'on' };
  const db = recordingDb({ change: { id: 'chg_1', event_id: 'evt_1', kind: 'edit', via: 'crew_key', state: 'pending', proposed_json: JSON.stringify(proposed) }, event: publishedEvent });
  await handleChangeApprove(request, { DB: db }, {}, 'chg_1');
  const update = db.runs.find((r) => r.sql.startsWith('UPDATE events SET'));
  assert.doesNotMatch(update.sql, /presented_by = \?/);
});

test("a crew's status-only request still applies its status", async () => {
  const db = recordingDb({ change: { id: 'chg_1', event_id: 'evt_1', kind: 'edit', via: 'crew_key', state: 'pending', proposed_json: '{"status":"sold_out"}' }, event: publishedEvent });
  await handleChangeApprove(request, { DB: db }, {}, 'chg_1');
  const update = db.runs.find((r) => r.sql.startsWith('UPDATE events SET'));
  assert.match(update.sql, /^UPDATE events SET status = \?/);
  assert.equal(update.args[0], 'sold_out');
});

test('an already decided change is not applied again', async () => {
  const db = recordingDb({ change: { id: 'chg_1', event_id: 'evt_1', kind: 'cancel_request', via: 'edit_link', state: 'rejected' }, event: publishedEvent });
  const response = await handleChangeApprove(request, { DB: db }, {}, 'chg_1');
  assert.equal(response.status, 303);
  assert.equal(db.runs.length, 0);
});
