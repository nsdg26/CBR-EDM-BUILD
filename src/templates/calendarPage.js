import { html } from '../lib/escape.js';
import { calendar } from './calendar.js';
import { monthLabel } from '../lib/dates.js';

/**
 * GET /calendar. The month calendar on a page of its own, with the
 * subscribable feed offered underneath it.
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
      <h2>Subscribe</h2>
      <p>Add every gig to your own calendar and it stays up to date on its own, no app and no account.</p>
      <div class="actions">
        <a class="button" href="/calendar.ics">Subscribe to the calendar</a>
      </div>
      <p class="muted">Opens in whatever calendar app you use. If nothing happens, copy that link into your calendar's "add by URL" option.</p>
    </div>
  `;
}
