import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calendarPage } from '../src/templates/calendarPage.js';
import { homePage } from '../src/templates/home.js';
import { layout } from '../src/templates/layout.js';

const NOW = new Date('2026-09-19T05:00:00Z'); // 2026-09-19 in Canberra
const EVENT = {
  id: 'e1', slug: 'test-event', title: 'Test Event',
  start_at: '2026-09-25T09:00:00Z', end_at: '2026-09-25T15:00:00Z',
  visibility: 'published', status: 'on',
};

test('the calendar page renders the month grid and offers the feed', () => {
  const page = String(calendarPage([EVENT], 2026, 9, NOW));
  assert.match(page, /<h1>Calendar<\/h1>/);
  assert.match(page, /<table>/);
  assert.match(page, /September 2026/);
  assert.match(page, /href="\/calendar\.ics"/);
});

test('month links stay on the calendar page rather than going home', () => {
  const page = String(calendarPage([], 2026, 9, NOW));
  assert.match(page, /href="\/calendar\?month=2026-08"/);
  assert.match(page, /href="\/calendar\?month=2026-10"/);
  // The old links pointed at the home page and carried a view marker to
  // stop a reload dropping the visitor back onto the board.
  assert.doesNotMatch(page, /view=calendar/);
});

test('the home page no longer carries a calendar or its toggle', () => {
  const { body } = homePage([EVENT], NOW);
  const page = String(body);
  assert.match(page, /class="board"/);
  assert.doesNotMatch(page, /class="calendar/);
  assert.doesNotMatch(page, /view-toggle/);
  assert.doesNotMatch(page, /data-panel/);
});

test('the nav offers Calendar as a page, not the raw feed', () => {
  const page = String(layout({ title: null, bodyContent: '' }));
  assert.match(page, /<a href="\/calendar">Calendar<\/a>/);
  assert.doesNotMatch(page, /Subscribe to the calendar<\/a>/);
  // The scripts that only existed for the home page calendar layout.
  assert.doesNotMatch(page, /board-toggle\.js/);
  assert.doesNotMatch(page, /header-height\.js/);
});
