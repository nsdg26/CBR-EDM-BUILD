import { html, raw } from '../../lib/escape.js';
import { formatShortDate } from '../../lib/dates.js';

const REGIONS = ['ACT', 'NSW', 'National'];

/**
 * GET /admin/harm-reduction. Section 10.2: edit the page's own intro
 * copy, and edit/reorder/mark-as-checked the links list below it.
 * @param {object[]} links
 * @param {string} intro
 */
export function harmReductionAdminPage(links, intro) {
  const sorted = [...links].sort((a, b) => a.sort_order - b.sort_order);

  return html`
    <h1>Harm reduction links</h1>

    <h2>Intro text</h2>
    <p class="muted">Shown at the top of /look-after-each-other, above the links below. One paragraph per line.</p>
    <form method="post" action="/admin/harm-reduction/intro" class="admin-record">
      <div class="field"><label for="intro">Intro</label><textarea id="intro" name="intro" rows="4">${intro}</textarea></div>
      <button type="submit">Save intro text</button>
    </form>

    <h2>Links</h2>
    ${sorted.map((link) => html`<form method="post" action="/admin/harm-reduction/${link.id}" class="admin-record">
      <div class="field"><label for="title-${link.id}">Title</label><input type="text" id="title-${link.id}" name="title" value="${link.title}" required></div>
      <div class="field"><label for="url-${link.id}">URL</label><input type="url" id="url-${link.id}" name="url" value="${link.url || ''}"></div>
      <div class="field"><label for="phone-${link.id}">Phone</label><input type="text" id="phone-${link.id}" name="phone" value="${link.phone || ''}"></div>
      <div class="field"><label for="description-${link.id}">Description</label><textarea id="description-${link.id}" name="description">${link.description || ''}</textarea></div>
      <div class="field"><label for="region-${link.id}">Region</label>
        <select id="region-${link.id}" name="region">
          ${REGIONS.map((region) => html`<option value="${region}" ${region === link.region ? raw('selected') : ''}>${region}</option>`)}
        </select>
      </div>
      <div class="field"><label for="sort-order-${link.id}">Sort order</label><input type="number" id="sort-order-${link.id}" name="sort_order" value="${link.sort_order}"></div>
      <p class="muted">Last checked: ${formatShortDate(link.last_checked_at)}</p>
      <div class="actions">
        <button type="submit">Save</button>
        <button type="submit" name="mark_checked" value="1">Save and mark checked today</button>
      </div>
    </form>`)}

    <h2>Add a link</h2>
    <form method="post" action="/admin/harm-reduction/new">
      <div class="field"><label for="new-title">Title</label><input type="text" id="new-title" name="title" required></div>
      <div class="field"><label for="new-url">URL</label><input type="url" id="new-url" name="url"></div>
      <div class="field"><label for="new-phone">Phone</label><input type="text" id="new-phone" name="phone"></div>
      <div class="field"><label for="new-description">Description</label><textarea id="new-description" name="description"></textarea></div>
      <div class="field"><label for="new-region">Region</label>
        <select id="new-region" name="region">
          ${REGIONS.map((region) => html`<option value="${region}">${region}</option>`)}
        </select>
      </div>
      <div class="field"><label for="new-sort-order">Sort order</label><input type="number" id="new-sort-order" name="sort_order" value="0"></div>
      <button type="submit">Add link</button>
    </form>
  `;
}
