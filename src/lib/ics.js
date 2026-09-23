// iCalendar (RFC 5545) generation. See SPEC.md section 11.1.

import { parseLineupText } from './lineup.js';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const LINE_LENGTH = 75;

/**
 * Escapes text per RFC 5545 section 3.3.11: backslash, semicolon, comma
 * and newline.
 * @param {string} text
 */
function icsEscape(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n?|\n/g, '\\n');
}

const encoder = new TextEncoder();

/**
 * Folds a single content line to at most 75 octets per output line, with a
 * leading space marking each continuation, per RFC 5545 section 3.1.
 * Counts UTF-8 bytes, not characters, and never splits a character: an act
 * name with accents or an emoji used to push a line past 75 octets, or cut
 * a surrogate pair in half.
 * @param {string} line
 */
function foldLine(line) {
  if (encoder.encode(line).length <= LINE_LENGTH) return line;
  const lines = [];
  let current = '';
  let currentBytes = 0;
  // The first line gets the full 75; each continuation spends one on its
  // leading space.
  let limit = LINE_LENGTH;
  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    if (currentBytes + charBytes > limit) {
      lines.push(current);
      current = '';
      currentBytes = 0;
      limit = LINE_LENGTH - 1;
    }
    current += char;
    currentBytes += charBytes;
  }
  lines.push(current);
  return lines.join('\r\n ');
}

function toIcsDateUtc(isoUtc) {
  return new Date(isoUtc).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Builds one VEVENT block for an event, section 11.1.
 * @param {object} event - a published event row
 * @param {string} domain - the site's domain, for UID and URL
 * @param {Date} [now] - for DTSTAMP
 */
export function eventToVEvent(event, domain, now = new Date()) {
  const dtStart = toIcsDateUtc(event.start_at);
  const dtEnd = event.end_at
    ? toIcsDateUtc(event.end_at)
    : toIcsDateUtc(new Date(new Date(event.start_at).getTime() + SIX_HOURS_MS).toISOString());

  const location = event.location_tba
    ? 'Location TBA, see event page'
    : [event.venue_name, event.venue_address].filter(Boolean).join(', ');

  const lineupNames = parseLineupText(event.lineup).map((act) => act.name).join(', ');

  const descriptionParts = [
    event.crew_name || event.presented_by,
    lineupNames || null,
    `https://${domain}/e/${event.slug}`,
  ].filter(Boolean);

  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.id}@${domain}`,
    `SEQUENCE:${event.sequence || 0}`,
    `DTSTAMP:${toIcsDateUtc(now.toISOString())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${icsEscape(event.title || 'Untitled event')}`,
    location ? `LOCATION:${icsEscape(location)}` : null,
    // Joined with a real newline, which icsEscape turns into the escape.
    // Joining with an already-escaped backslash-n got its backslash
    // escaped a second time, so calendar apps showed a literal "\n"
    // between the parts instead of a line break.
    `DESCRIPTION:${icsEscape(descriptionParts.join('\n'))}`,
    `URL:https://${domain}/e/${event.slug}`,
    event.status === 'cancelled' ? 'STATUS:CANCELLED' : null,
    'END:VEVENT',
  ].filter(Boolean);

  return lines.map(foldLine).join('\r\n');
}

/**
 * Wraps one or more VEVENT blocks in a VCALENDAR, section 11.1.
 * @param {object[]} events
 * @param {string} domain
 * @param {Date} [now]
 */
export function buildCalendar(events, domain, now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CBR EDM//EN',
    'CALSCALE:GREGORIAN',
    ...events.filter((event) => event.start_at).map((event) => eventToVEvent(event, domain, now)),
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
