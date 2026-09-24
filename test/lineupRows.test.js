import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { actsWithHeadliners } from '../src/lib/lineup.js';
import { renderLineupRows } from '../src/templates/lineupRow.js';
import { crewDashboardPage } from '../src/templates/crew.js';

// public/js/lineup-rows.js is a browser script with no build step, so its
// hand-kept mirror of actsWithHeadliners is loaded here in a bare VM and
// checked against the real one.
function loadClientLineupRows() {
  const window = {};
  vm.runInNewContext(readFileSync(new URL('../public/js/lineup-rows.js', import.meta.url), 'utf8'), { window });
  return window.CbrLineupRows;
}

const LINEUPS = [
  ['legacy', 'DJ One\nDJ Two', 0],
  ['legacy, equal billing', 'DJ One\nDJ Two', 1],
  ['new format, headliner', 'DJ One | techno · 11pm | headliner\nDJ Two | ', 0],
  ['new format, none ticked', 'DJ One | \nDJ Two | ', 0],
  ['empty', null, 0],
];

for (const [label, lineup, equalBilling] of LINEUPS) {
  test(`client actsWithHeadliners matches the server's: ${label}`, () => {
    const client = loadClientLineupRows();
    assert.deepEqual(
      JSON.parse(JSON.stringify(client.actsWithHeadliners(lineup, equalBilling))),
      actsWithHeadliners(lineup, equalBilling),
    );
  });
}

test("renderLineupRows ticks a legacy lineup's first act, so an untouched save keeps its headliner", () => {
  const rows = renderLineupRows('DJ One\nDJ Two');
  const ticks = rows.match(/data-lineup-headliner checked/g) || [];
  assert.equal(ticks.length, 1);
  assert.ok(rows.indexOf('checked') < rows.indexOf('DJ Two'));
});

test('renderLineupRows leaves a legacy equal-billing lineup unticked', () => {
  assert.doesNotMatch(renderLineupRows('DJ One\nDJ Two', 1), /checked/);
});

test('the crew dashboard uses the DJ-row editor in both forms, with unique label ids', () => {
  const page = String(crewDashboardPage('site-key'));
  assert.equal((page.match(/data-lineup-rows/g) || []).length, 2);
  assert.match(page, /id="create-lineup-label"/);
  assert.match(page, /id="edit-lineup-label"/);
  // The old plain textarea and standalone Genre box are gone.
  assert.doesNotMatch(page, /data-field="lineup"/);
  assert.doesNotMatch(page, /data-field="genres"/);
});
