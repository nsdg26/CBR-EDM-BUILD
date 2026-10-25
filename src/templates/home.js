import { html } from '../lib/escape.js';
import { isEventPast } from '../lib/dates.js';
import { eventCard } from './eventCard.js';
import { config } from '../config.js';
import { installPrompt } from './installPrompt.js';

/**
 * The home page: the board, section 7. One column of paper scraps, the
 * events coming up.
 *
 * Owner decision: past events used to fill a second column here (the
 * most recent dozen, with a link to the archive for the rest). They moved
 * to /past, which shows them directly, and the board is upcoming only.
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

  const body = html`
    <div class="board">
      <div class="board-column">
        <h2>${config.boardColumns.upcoming}</h2>
        ${upcoming.length
          ? html`<ul>${upcoming.map((event) => eventCard(event, now))}</ul>`
          : emptyUpcoming()}
      </div>
    </div>
    <p class="board-more"><a href="/past">${config.boardColumns.past}</a></p>
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
