import { html } from '../lib/escape.js';
import { isEventPast } from '../lib/dates.js';
import { eventCard } from './eventCard.js';
import { config } from '../config.js';
import { installPrompt } from './installPrompt.js';

const PAST_LIMIT = 12;

/**
 * The home page: the board, section 7. Two columns of paper scraps,
 * coming up and past.
 *
 * The month calendar used to sit beside this in a desktop grid, with a
 * Board/Calendar toggle standing in for it on narrow screens. Owner
 * decision: the home page is the board and nothing else, and the calendar
 * has its own page at /calendar, reached from the nav. That took the
 * toggle, the panel wrappers and the page-level grid with it.
 * @param {object[]} events - published events, visibility already filtered by the caller
 * @param {Date} [now]
 */
export function homePage(events, now = new Date()) {
  const upcoming = events
    .filter((event) => !isEventPast(event, now))
    .sort((a, b) => new Date(a.start_at || 0) - new Date(b.start_at || 0));

  const past = events
    .filter((event) => isEventPast(event, now))
    .sort((a, b) => new Date(b.start_at || 0) - new Date(a.start_at || 0));

  const pastShown = past.slice(0, PAST_LIMIT);

  const body = html`
    <div class="board">
      <div class="board-column">
        <h2>${config.boardColumns.upcoming}</h2>
        ${upcoming.length
          ? html`<ul>${upcoming.map((event) => eventCard(event, now))}</ul>`
          : emptyUpcoming()}
      </div>
      <div class="board-column">
        <h2>${config.boardColumns.past}</h2>
        ${pastShown.length
          ? html`<ul>${pastShown.map((event) => eventCard(event, now))}</ul>`
          : ''}
        ${past.length > PAST_LIMIT ? html`<p><a href="/archive">See the full archive</a></p>` : ''}
      </div>
    </div>
  `;

  // The install notice, see templates/installPrompt.js.
  const notice = installPrompt({
    appName: config.shortName,
    blurb: 'Opens straight to the board, like an app. No app store, no account.',
    icon: '/icons/record.svg',
    storageKey: 'cbr_install_prompt_dismissed',
  });

  return { body: html`${body}${notice}`, hasUpcoming: upcoming.length > 0 };
}

function emptyUpcoming() {
  return html`<p class="empty-scrap">Nothing on the wall right now. Quiet month. Know of something? <a href="/submit">Put it up</a>.</p>`;
}
