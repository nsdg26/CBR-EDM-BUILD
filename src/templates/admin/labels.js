// Plain-English labels for the enum values stored in D1, so admin screens
// say "Sold out" and "Start" rather than printing sold_out and start_at
// straight out of the database. Anything missing from a map falls back to
// the raw value, so a new value still shows up rather than going blank.

const LABELS = {
  status: { on: 'On', cancelled: 'Cancelled', sold_out: 'Sold out', postponed: 'Postponed' },
  visibility: { pending: 'Pending', published: 'Published', rejected: 'Rejected', removed: 'Removed' },
  age_restriction: { '18+': '18+', all_ages: 'All ages', unknown: 'Not stated' },
  inbound_state: { new: 'New', converted: 'Converted', dismissed: 'Dismissed' },
  via: { edit_link: 'edit link', crew_key: 'crew key', public_report: 'public report' },
};

// Field names as the admin sees them in a before/after comparison.
const FIELD_LABELS = {
  title: 'Title',
  presented_by: 'Presented by',
  start_at: 'Start',
  end_at: 'End',
  venue_name: 'Venue name',
  venue_address: 'Venue address',
  location_tba: 'Location TBA',
  location_reveal_at: 'Location announced',
  location_how_to_find: 'How to find out',
  genres: 'Genres',
  lineup: 'Lineup',
  lineup_equal_billing: 'Equal billing',
  ticket_url: 'Ticket URL',
  notes: 'Notes',
  age_restriction: 'Age',
  status: 'Status',
};

/**
 * @param {keyof LABELS} kind
 * @param {string|null} value
 */
export function labelFor(kind, value) {
  if (value === null || value === undefined) return '';
  return LABELS[kind]?.[value] ?? value;
}

/** @param {string} field */
export function fieldLabel(field) {
  return FIELD_LABELS[field] ?? field;
}

export const STATUS_VALUES = Object.keys(LABELS.status);
