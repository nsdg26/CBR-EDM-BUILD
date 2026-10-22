import { layout } from '../templates/layout.js';
import { homePage, PAST_LIMIT } from '../templates/home.js';
import { countInBackground, isBotRequest } from '../lib/analytics.js';

const EVENT_SELECT = `
  SELECT events.*, crews.name AS crew_name, crews.slug AS crew_slug
  FROM events LEFT JOIN crews ON crews.id = events.crew_id
  WHERE events.visibility = 'published'`;

// Section 3.5: an event with no end time is past from 6am the morning
// after it starts, so anything that started more than two days ago and
// has no end time still in the future is certainly past. The board only
// needs the most recent dozen of those; the archive has the rest.
const RECENT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * GET /. Section 6 and 7: the board.
 *
 * Two bounded queries rather than every published event ever (which this
 * used to load, elevation grids and all, and render a flyer for, before
 * keeping twelve of the past ones): the events that could still be
 * coming up, and the most recent past ones. homePage still decides
 * past/upcoming exactly, at render time, from the rows it is given.
 *
 * The ?month= parameter this used to take belonged to the calendar that
 * sat beside the board; it moved to /calendar with it. A stale link
 * carrying ?month= still lands on a perfectly good home page, the
 * parameter is simply ignored.
 * @param {Request} request
 * @param {import('../env.js').Env} env
 * @param {ExecutionContext} [ctx]
 */
export async function handleHome(request, env, ctx) {
  const now = new Date();
  const nowIso = now.toISOString();
  const windowStart = new Date(now.getTime() - RECENT_WINDOW_MS).toISOString();

  const [current, recentPast] = await Promise.all([
    env.DB.prepare(
      `${EVENT_SELECT} AND (events.start_at IS NULL OR events.start_at >= ? OR events.end_at >= ?)
       ORDER BY events.start_at`,
    ).bind(windowStart, nowIso).all(),
    env.DB.prepare(
      `${EVENT_SELECT} AND events.start_at < ? AND (events.end_at IS NULL OR events.end_at < ?)
       ORDER BY events.start_at DESC LIMIT ?`,
    ).bind(windowStart, nowIso, PAST_LIMIT + 1).all(),
  ]);

  const seen = new Set();
  const events = [...current.results, ...recentPast.results].filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });

  if (!isBotRequest(request)) await countInBackground(ctx, env, 'home_view');

  const { body } = homePage(events, now);

  const page = String(layout({ path: new URL(request.url).pathname, title: null, bodyContent: body, bodyClass: 'page-home' }));

  return new Response(page, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
