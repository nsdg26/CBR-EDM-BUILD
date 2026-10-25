import { layout } from '../templates/layout.js';
import { pastIndex, pastYear, PAST_LIMIT } from '../templates/past.js';
import { config } from '../config.js';
import { canberraDayKey, canberraLocalInputToUtc, isEventPast } from '../lib/dates.js';

const EVENT_SELECT = `
  SELECT events.*, crews.name AS crew_name, crews.slug AS crew_slug
  FROM events LEFT JOIN crews ON crews.id = events.crew_id
  WHERE events.visibility = 'published' AND events.start_at IS NOT NULL`;

/**
 * GET /past and GET /past/:year. Section 6: the forever archive, which
 * used to live at /archive (router.js redirects the old addresses here).
 *
 * The index works out which years have something in them from just each
 * past event's dates, rather than every column of every event ever
 * (terrain grids included), and loads full rows only for the most recent
 * PAST_LIMIT. A year page only loads the events that started in that
 * Canberra year.
 * @param {Request} request
 * @param {import('../env.js').Env} env
 * @param {number} [year]
 */
export async function handlePast(request, env, year) {
  const now = new Date();
  const nowIso = now.toISOString();
  let body;

  if (year) {
    const from = canberraLocalInputToUtc(`${year}-01-01T00:00`);
    const to = canberraLocalInputToUtc(`${year + 1}-01-01T00:00`);
    const { results } = await env.DB.prepare(
      `${EVENT_SELECT} AND events.start_at >= ? AND events.start_at < ? ORDER BY events.start_at DESC`,
    ).bind(from, to).all();
    body = pastYear(year, results.filter((event) => isEventPast(event, now)), now);
  } else {
    // Nothing that starts in the future can be past, whatever its end.
    // The recent query takes a few more than it shows because the newest
    // rows can still be on (no end time, started last night, or a
    // multi-day event), and isEventPast is what decides.
    const [dates, recent] = await Promise.all([
      env.DB.prepare(
        `SELECT start_at, end_at FROM events
         WHERE visibility = 'published' AND start_at IS NOT NULL AND start_at < ?`,
      ).bind(nowIso).all(),
      env.DB.prepare(
        `${EVENT_SELECT} AND events.start_at < ? ORDER BY events.start_at DESC LIMIT ?`,
      ).bind(nowIso, PAST_LIMIT + 6).all(),
    ]);
    const years = dates.results
      .filter((event) => isEventPast(event, now))
      .map((event) => Number(canberraDayKey(event.start_at).slice(0, 4)));
    const events = recent.results.filter((event) => isEventPast(event, now)).slice(0, PAST_LIMIT);
    body = pastIndex(events, [...new Set(years)].sort((a, b) => b - a), now);
  }

  const title = year ? `${config.boardColumns.past}: ${year}` : config.boardColumns.past;
  const page = String(layout({ path: new URL(request.url).pathname, title, bodyContent: body }));

  return new Response(page, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
  });
}
