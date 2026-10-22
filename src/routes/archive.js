import { layout } from '../templates/layout.js';
import { archiveIndex, archiveYear } from '../templates/archive.js';
import { canberraDayKey, canberraLocalInputToUtc, isEventPast } from '../lib/dates.js';

const EVENT_SELECT = `
  SELECT events.*, crews.name AS crew_name, crews.slug AS crew_slug
  FROM events LEFT JOIN crews ON crews.id = events.crew_id
  WHERE events.visibility = 'published' AND events.start_at IS NOT NULL`;

/**
 * GET /archive and GET /archive/:year. Section 6: the forever archive.
 *
 * The index only needs each past event's dates to work out which years
 * have something in them, so it selects just those rather than every
 * column of every event ever (terrain grids included), and a year page
 * only loads the events that started in that Canberra year.
 * @param {Request} request
 * @param {import('../env.js').Env} env
 * @param {number} [year]
 */
export async function handleArchive(request, env, year) {
  const now = new Date();
  let body;

  if (year) {
    const from = canberraLocalInputToUtc(`${year}-01-01T00:00`);
    const to = canberraLocalInputToUtc(`${year + 1}-01-01T00:00`);
    const { results } = await env.DB.prepare(
      `${EVENT_SELECT} AND events.start_at >= ? AND events.start_at < ? ORDER BY events.start_at DESC`,
    ).bind(from, to).all();
    body = archiveYear(year, results.filter((event) => isEventPast(event, now)), now);
  } else {
    // Nothing that starts in the future can be past, whatever its end.
    const { results } = await env.DB.prepare(
      `SELECT start_at, end_at FROM events
       WHERE visibility = 'published' AND start_at IS NOT NULL AND start_at < ?`,
    ).bind(now.toISOString()).all();
    const years = results
      .filter((event) => isEventPast(event, now))
      .map((event) => Number(canberraDayKey(event.start_at).slice(0, 4)));
    body = archiveIndex([...new Set(years)].sort((a, b) => b - a));
  }

  const page = String(layout({ path: new URL(request.url).pathname, title: year ? `Archive: ${year}` : 'Archive', bodyContent: body }));

  return new Response(page, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
  });
}
