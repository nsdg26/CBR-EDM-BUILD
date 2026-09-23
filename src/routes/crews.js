import { layout } from '../templates/layout.js';
import { crewsDirectoryPage, crewProfilePage } from '../templates/crews.js';
import { isEventPast } from '../lib/dates.js';
import { notFound } from '../lib/http.js';

/**
 * GET /crews. Section 16.
 */
export async function handleCrewsDirectory(request, env) {
  const { results } = await env.DB.prepare(
    `SELECT crews.*, COUNT(events.id) AS eventCount
     FROM crews LEFT JOIN events ON events.crew_id = crews.id AND events.visibility = 'published'
     WHERE crews.listed = 1
     GROUP BY crews.id ORDER BY crews.name`,
  ).all();

  const page = String(layout({ path: new URL(request.url).pathname, title: 'Crews', bodyContent: crewsDirectoryPage(results) }));
  return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
}

/**
 * GET /crews/:slug. Section 16.
 */
export async function handleCrewProfile(request, env, slug) {
  const crew = await env.DB.prepare('SELECT * FROM crews WHERE slug = ?').bind(slug).first();
  if (!crew) return notFound();

  const { results } = await env.DB.prepare(
    `SELECT events.*, crews.name AS crew_name, crews.slug AS crew_slug
     FROM events JOIN crews ON crews.id = events.crew_id
     WHERE events.crew_id = ? AND events.visibility = 'published' ORDER BY events.start_at`,
  ).bind(crew.id).all();

  const now = new Date();
  const upcoming = results.filter((event) => !isEventPast(event, now));
  const past = results.filter((event) => isEventPast(event, now)).reverse();

  const page = String(layout({ path: new URL(request.url).pathname, title: crew.name, bodyContent: crewProfilePage(crew, upcoming, past) }));
  return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
}
