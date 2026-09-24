import { html } from '../lib/escape.js';
import { isEventPast } from '../lib/dates.js';
import { eventCard } from './eventCard.js';
import { config } from '../config.js';

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

  return { body: html`${body}${installPrompt()}`, hasUpcoming: upcoming.length > 0 };
}

/**
 * The "put it on your home screen" notice, owner request: home page only,
 * from the first visit. Rendered hidden; public/js/install-prompt.js
 * decides whether to show it and which half. Browsers never let a page
 * install itself, so there are two versions:
 *
 * - Chrome, Edge, Samsung Internet (Android and desktop) fire
 *   beforeinstallprompt when the site is installable. The script holds
 *   that event and the Install button hands it back, which opens the
 *   browser's own install dialog.
 * - iPhone and iPad have no such event and no install prompt of any kind,
 *   so the only thing a page can do is say where Add to Home Screen is.
 *
 * Never shown inside the installed app, and gone for good on that device
 * once dismissed.
 */
function installPrompt() {
  return html`<aside class="install-prompt" data-install-prompt hidden aria-label="Install the app">
    <span class="scrap-tape" aria-hidden="true"></span>
    <img class="install-prompt-mark" src="/icons/record.svg" alt="" width="48" height="48">
    <div class="install-prompt-body">
      <p class="install-prompt-title">Put ${config.shortName} on your home screen</p>
      <p data-install-variant="prompt" hidden>Opens straight to the board, like an app. No app store, no account.</p>
      <p data-install-variant="ios" hidden>Tap
        <svg class="install-prompt-share" viewBox="0 0 20 24" width="16" height="19" aria-hidden="true" focusable="false"><path d="M10 1v14M5 6l5-5 5 5M4 10H2v13h16V10h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</p>
      <div class="install-prompt-actions">
        <button type="button" data-install-accept data-install-variant="prompt" hidden>Install</button>
        <button type="button" class="secondary" data-install-dismiss>Not now</button>
      </div>
    </div>
  </aside>`;
}

function emptyUpcoming() {
  return html`<p class="empty-scrap">Nothing on the wall right now. Quiet month. Know of something? <a href="/submit">Put it up</a>.</p>`;
}
