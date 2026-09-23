import { adminLayout } from '../../templates/admin/layout.js';
import { changeListPage } from '../../templates/admin/changes.js';
import { notFound } from '../../lib/http.js';
import { terrainFieldsFor } from '../../lib/geocode.js';
import { pickFields, locationRevealedAtFor, EDIT_LINK_FIELDS, CREW_EDIT_FIELDS } from '../../lib/eventFields.js';

/**
 * The columns an approved edit may write: the same set its path lets it
 * propose. proposed_json keys become column names in the UPDATE below, so
 * they are whitelisted here rather than trusted. Rows queued before
 * edit.js and crew.js stopped storing them can still carry readEventFields'
 * defaults for fields the form never sent (crew_id: null, status: 'on',
 * and for a crew edit presented_by: null), which would detach the event
 * from its crew, un-cancel it and blank its presenter -- so status only
 * counts on its own, which is the crew dashboard's "Mark cancelled/sold
 * out/postponed" request.
 * @param {object} proposed
 * @param {string} via - event_changes.via
 */
function approvedColumns(proposed, via) {
  if (Object.keys(proposed).length === 1 && 'status' in proposed) return pickFields(proposed, ['status']);
  return pickFields(proposed, via === 'crew_key' ? CREW_EDIT_FIELDS : EDIT_LINK_FIELDS);
}

const LIST_SQL = `
  SELECT event_changes.*, events.title AS event_title,
    events.title AS current_title, events.start_at AS current_start_at, events.end_at AS current_end_at,
    events.venue_name AS current_venue_name, events.venue_address AS current_venue_address,
    events.genres AS current_genres, events.lineup AS current_lineup,
    events.ticket_url AS current_ticket_url, events.notes AS current_notes,
    events.age_restriction AS current_age_restriction, events.status AS current_status
  FROM event_changes JOIN events ON events.id = event_changes.event_id
  WHERE event_changes.state = 'pending'
  ORDER BY event_changes.created_at
`;

export async function handleChangeList(request, env, admin) {
  const { results } = await env.DB.prepare(LIST_SQL).all();
  const body = changeListPage(results);
  return new Response(String(adminLayout({ title: 'Pending changes', bodyContent: body, email: admin.email })), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/**
 * POST /admin/changes/:id/approve. Applies an edit's proposed_json to the
 * live event, or actions a cancel/removal request, section 10.2.
 */
export async function handleChangeApprove(request, env, admin, id) {
  const change = await env.DB.prepare('SELECT * FROM event_changes WHERE id = ?').bind(id).first();
  if (!change) return notFound();
  // A double-submitted Approve (or a stale tab) must not apply the change a
  // second time over whatever has been edited since.
  if (change.state !== 'pending') return Response.redirect(new URL('/admin/changes', request.url), 303);

  const now = new Date().toISOString();

  if (change.kind === 'edit') {
    const proposed = approvedColumns(JSON.parse(change.proposed_json || '{}'), change.via);

    // The proposed edit's venue/location_tba fields decide real terrain
    // just like a direct save does (owner request: always fetch real
    // terrain unless TBA) -- this is the point the venue actually
    // changes on the live event, so it's fetched here too, not only on
    // handleEventCreate/handleEventUpdate's direct-write paths.
    const existing = await env.DB.prepare(
      'SELECT visibility, location_tba, location_revealed_at, venue_lat, venue_lng, elevation_grid FROM events WHERE id = ?',
    ).bind(change.event_id).first();
    if (!existing) return notFound();
    const terrain = await terrainFieldsFor(proposed, existing);
    Object.assign(proposed, terrain, { location_revealed_at: locationRevealedAtFor(existing, proposed, now) });

    const setClauses = Object.keys(proposed).map((field) => `${field} = ?`);
    const values = Object.values(proposed);
    await env.DB.prepare(
      `UPDATE events SET ${setClauses.join(', ')}, sequence = sequence + 1, updated_at = ? WHERE id = ?`,
    ).bind(...values, now, change.event_id).run();
  } else if (change.kind === 'cancel_request') {
    await env.DB.prepare("UPDATE events SET status = 'cancelled', sequence = sequence + 1, updated_at = ? WHERE id = ?")
      .bind(now, change.event_id).run();
  } else if (change.kind === 'removal_request') {
    await env.DB.prepare("UPDATE events SET visibility = 'removed', updated_at = ? WHERE id = ?")
      .bind(now, change.event_id).run();
  }

  await env.DB.prepare("UPDATE event_changes SET state = 'approved', decided_at = ? WHERE id = ?").bind(now, id).run();

  return Response.redirect(new URL('/admin/changes', request.url), 303);
}

export async function handleChangeReject(request, env, admin, id) {
  const change = await env.DB.prepare('SELECT id FROM event_changes WHERE id = ?').bind(id).first();
  if (!change) return notFound();

  await env.DB.prepare("UPDATE event_changes SET state = 'rejected', decided_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), id).run();

  return Response.redirect(new URL('/admin/changes', request.url), 303);
}
