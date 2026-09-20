import { html } from '../lib/escape.js';
import { calendar } from './calendar.js';
import { monthLabel } from '../lib/dates.js';

/**
 * GET /calendar. The month calendar on a page of its own, with the .ics
 * file offered for download underneath it.
 *
 * Download only, deliberately. A webcal:// "subscribe" button was tried
 * here and did not work reliably in practice (owner report), so rather
 * than ship a button that sometimes does nothing, this offers the one
 * thing that always works and says plainly what it is: a snapshot, not a
 * live feed.
 *
 * This used to sit beside the board on the home page, in a two column
 * desktop grid, with a Board/Calendar toggle standing in for it on
 * narrow screens. Owner decision: the home page is the board, and the
 * calendar gets its own page reached from the nav, which also means the
 * feed is offered next to the thing it is a feed of rather than as a bare
 * ".ics" link in the nav.
 * @param {object[]} events - published events with a start_at
 * @param {number} year
 * @param {number} month - 1-indexed
 * @param {Date} [now]
 */
export function calendarPage(events, year, month, now = new Date()) {
  return html`
    <h1>Calendar</h1>

    ${calendar(events, year, month, now)}

    <div class="calendar-subscribe">
      <h2>Add it to your own calendar</h2>
      <div class="actions">
        <a class="button" href="/calendar.ics">Download the calendar file</a>
      </div>
      <p class="muted">
        Opens in whatever calendar app you use. It is a snapshot of what
        is listed right now, so download it again to pick up anything
        added since.
      </p>
    </div>
  `;
}
