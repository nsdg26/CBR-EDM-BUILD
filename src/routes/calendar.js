import { layout } from '../templates/layout.js';
import { calendarPage } from '../templates/calendarPage.js';
import { currentCanberraMonth, canberraLocalInputToUtc } from '../lib/dates.js';
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

  // Only the month on show, and only the columns the grid and its day
  // lists use: this used to load every published event there has ever
  // been, terrain and all, to draw one month. The template still does the
  // exact Canberra-day grouping, so this range is that month's Canberra
  // midnights in UTC with a day's slack either side, which keeps it right
  // for a hand-entered timestamp in another ISO shape. Events without a
  // start_at never land on a grid.
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const pad = (n) => String(n).padStart(2, '0');
  const slack = (iso, days) => new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  const fromUtc = slack(canberraLocalInputToUtc(`${year}-${pad(month)}-01T00:00`), -1);
  const toUtc = slack(canberraLocalInputToUtc(`${next.year}-${pad(next.month)}-01T00:00`), 1);
  const { results } = await env.DB.prepare(
    `SELECT id, slug, title, start_at FROM events
     WHERE visibility = 'published' AND start_at >= ? AND start_at < ?
     ORDER BY start_at`,
  ).bind(fromUtc, toUtc).all();

  if (!isBotRequest(request)) await recordCount(env, 'calendar_view');

  const body = String(calendarPage(results, year, month));
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
