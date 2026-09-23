import { html } from '../../lib/escape.js';
import { formatShortDate, formatDateTime } from '../../lib/dates.js';
import { parseLineupText } from '../../lib/lineup.js';
import { labelFor, fieldLabel } from './labels.js';

const LABELS = {
  edit: 'Proposed edit',
  cancel_request: 'Cancellation request',
  removal_request: 'Removal request',
};

// Every field an edit link or a crew key can propose (EDIT_LINK_FIELDS and
// CREW_EDIT_FIELDS in lib/eventFields.js), plus status for a crew's
// status-only request. The presenter, the location fields and equal
// billing used to be missing here, so a change to them was approved
// without ever being shown.
const COMPARE_FIELDS = [
  'title', 'presented_by', 'start_at', 'end_at', 'venue_name', 'venue_address',
  'location_tba', 'location_reveal_at', 'location_how_to_find', 'genres',
  'lineup', 'lineup_equal_billing', 'ticket_url', 'notes', 'age_restriction', 'status',
];

/**
 * GET /admin/changes. Section 10.2: pending changes and requests, with a
 * clear before/after comparison for edits.
 * @param {object[]} changes - event_changes rows joined with event title/slug
 */
export function changeListPage(changes) {
  return html`
    <h1>Pending changes and requests</h1>
    ${changes.length ? '' : html`<p class="muted">Nothing pending.</p>`}
    ${changes.map((change) => html`<div class="admin-record">
      <h2>${LABELS[change.kind] || change.kind}: ${change.event_title || 'Untitled'}</h2>
      <p class="muted">Via ${labelFor('via', change.via)}, ${formatShortDate(change.created_at)}</p>
      ${change.reason ? html`<p>Reason given: ${change.reason}</p>` : ''}
      ${change.kind === 'edit' ? renderComparison(change) : ''}
      <div class="actions">
        <form method="post" action="/admin/changes/${change.id}/approve"><button type="submit">Approve</button></form>
        <form method="post" action="/admin/changes/${change.id}/reject"><button type="submit" class="secondary">Reject</button></form>
        <a href="/admin/events/${change.event_id}/edit" class="button secondary">View event</a>
      </div>
    </div>`)}
  `;
}

/**
 * A stored value as the admin should read it: dates in Canberra time, the
 * lineup one act per line rather than its raw "Name | note | headliner"
 * storage format, flags as Yes/No and enum values in plain English.
 * @param {string} field
 * @param {*} value
 */
function displayValue(field, value) {
  if (value === null || value === undefined || value === '') return '';
  if (field === 'start_at' || field === 'end_at') return formatDateTime(value);
  if (field === 'location_tba' || field === 'lineup_equal_billing') return value ? 'Yes' : 'No';
  if (field === 'age_restriction' || field === 'status') return labelFor(field, value);
  if (field === 'lineup') {
    return parseLineupText(value)
      .map((act) => `${act.name}${act.note ? ` (${act.note})` : ''}${act.headliner ? ' - headliner' : ''}`)
      .join('\n');
  }
  return String(value);
}

function renderComparison(change) {
  let proposed;
  try {
    proposed = JSON.parse(change.proposed_json || '{}');
  } catch {
    proposed = {};
  }

  // Only what would actually change: an edit link or crew form sends its
  // whole form back, so a one-field fix used to arrive as a table of
  // fifteen rows with the one real difference somewhere among them.
  const fields = COMPARE_FIELDS.filter((field) => field in proposed);
  const changed = fields.filter(
    (field) => displayValue(field, change[`current_${field}`]) !== displayValue(field, proposed[field]),
  );
  const unchanged = fields.length - changed.length;

  if (!changed.length) return html`<p class="muted">No differences from the live listing.</p>`;

  return html`<table class="change-comparison">
    <thead><tr><th>Field</th><th>Current</th><th>Proposed</th></tr></thead>
    <tbody>
      ${changed.map((field) => html`<tr>
        <td>${fieldLabel(field)}</td>
        <td>${displayValue(field, change[`current_${field}`])}</td>
        <td>${displayValue(field, proposed[field])}</td>
      </tr>`)}
    </tbody>
  </table>
  ${unchanged ? html`<p class="muted">${unchanged} unchanged field${unchanged === 1 ? '' : 's'} not shown.</p>` : ''}`;
}
