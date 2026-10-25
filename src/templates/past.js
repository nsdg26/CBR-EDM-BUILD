import { html } from '../lib/escape.js';
import { eventCard } from './eventCard.js';
import { config } from '../config.js';

// How many of the most recent past events /past shows before handing the
// rest over to the year pages.
export const PAST_LIMIT = 24;

const TITLE = config.boardColumns.past;

/**
 * /past: the most recent past events, then every year that has any,
 * section 6. This used to be /archive and showed only the year list;
 * owner decision, past events left the home page and are shown here
 * directly instead.
 * @param {object[]} events - the most recent past events, at most PAST_LIMIT
 * @param {number[]} years - every year with a past event, descending
 * @param {Date} [now]
 */
export function pastIndex(events, years, now = new Date()) {
  const sorted = [...events].sort((a, b) => new Date(b.start_at || 0) - new Date(a.start_at || 0));
  return html`
    <h1>${TITLE}</h1>
    ${sorted.length
      ? html`<ul class="card-list">${sorted.map((event) => eventCard(event, now))}</ul>`
      : html`<p>No past events yet.</p>`}
    ${years.length
      ? html`<h2>By year</h2><ul class="link-list">${years.map((year) => html`<li><a href="/past/${year}">${year}</a></li>`)}</ul>`
      : ''}
  `;
}

/**
 * /past/:year: every past published event that started in that year,
 * most recent first, section 6.
 * @param {number} year
 * @param {object[]} events
 * @param {Date} [now]
 */
export function pastYear(year, events, now = new Date()) {
  const sorted = [...events].sort((a, b) => new Date(b.start_at || 0) - new Date(a.start_at || 0));
  return html`
    <h1>${TITLE}: ${year}</h1>
    ${sorted.length
      ? html`<ul class="card-list">${sorted.map((event) => eventCard(event, now))}</ul>`
      : html`<p>No events found for ${year}.</p>`}
    <p><a href="/past">All ${TITLE.toLowerCase()}</a></p>
  `;
}
