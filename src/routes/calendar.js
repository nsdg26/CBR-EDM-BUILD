import { layout } from '../templates/layout.js';
import { calendarPage } from '../templates/calendarPage.js';
import { currentCanberraMonth } from '../lib/dates.js';
import { recordCount, isBotRequest } from '../lib/analytics.js';

/**
 * GET /calendar and GET /calendar?month=YYYY-MM. The month grid on its
 * own page, with the .ics feed offered under it. The feed itself is still
 * /calendar.ics (routes/calendarFeed.js); this is the page that points at
 * it.
 * @param {Request} request
 * @param {import('../env.js').Env} env
 */
export async function handleCalendarPage(request, env) {
  const url = new URL(request.url);
  const { year, month } = parseMonthParam(url.searchParams.get('month'));

  // Only events with a start_at can land on a grid of days at all, so
  // they are filtered here rather than in the template.
  const { results } = await env.DB.prepare(
    `SELECT events.*, crews.name AS crew_name, crews.slug AS crew_slug
     FROM events LEFT JOIN crews ON crews.id = events.crew_id
     WHERE events.visibility = 'published' AND events.start_at IS NOT NULL
     ORDER BY events.start_at`,
  ).all();

  if (!isBotRequest(request)) await recordCount(env, 'calendar_view');

  const body = String(calendarPage(results, year, month, new Date(), url.host));
  const page = String(layout({ title: 'Calendar', bodyContent: body }));

  return new Response(page, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  });
}

/**
 * A valid YYYY-MM wins; anything else falls back to the current Canberra
 * month rather than erroring, since this is a link people edit by hand
 * and a wrong month is not worth a 404.
 * @param {string|null} param
 */
function parseMonthParam(param) {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [year, month] = param.split('-').map(Number);
    if (month >= 1 && month <= 12) return { year, month };
  }
  return currentCanberraMonth();
}
