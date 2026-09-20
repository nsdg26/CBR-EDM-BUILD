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
 * @param {string} [host] - this site's hostname, for the webcal address
 */
export function calendarPage(events, year, month, now = new Date(), host = '') {
  // webcal:// is what actually subscribes. Opening the https .ics in a
  // browser just downloads it, and an imported file is a snapshot: it
  // never picks up events added later. The page used to claim the
  // opposite ("stays up to date on its own"), which was simply wrong for
  // anyone who clicked the link (owner report).
  const subscribeUrl = host ? `webcal://${host}/calendar.ics` : '/calendar.ics';

  return html`
    <h1>Calendar</h1>

    ${calendar(events, year, month, now)}

    <div class="calendar-subscribe">
      <h2>Subscribe</h2>
      <p>Adds the gig list to your own calendar app, no account needed.</p>
      <div class="actions">
        <a class="button" href="${subscribeUrl}">Subscribe in your calendar app</a>
        <a class="button secondary" href="/calendar.ics">Download the file instead</a>
      </div>
      <p class="muted">
        Subscribing keeps the list current as events are added. The
        download is a one-off snapshot of what is listed right now, so
        you would need to download it again to see anything added later.
        If subscribing does nothing, copy
        <code>${host ? `https://${host}/calendar.ics` : '/calendar.ics'}</code>
        into your calendar's "add by URL" option.
      </p>
    </div>
  `;
}
