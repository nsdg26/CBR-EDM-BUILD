import { layout } from '../templates/layout.js';
import { homePage } from '../templates/home.js';
import { recordCount, isBotRequest } from '../lib/analytics.js';

/**
 * GET /. Section 6 and 7: the board.
 *
 * The ?month= parameter this used to take belonged to the calendar that
 * sat beside the board; it moved to /calendar with it. A stale link
 * carrying ?month= still lands on a perfectly good home page, the
 * parameter is simply ignored.
 * @param {Request} request
 * @param {import('../env.js').Env} env
 */
export async function handleHome(request, env) {
  const { results } = await env.DB.prepare(
    `SELECT events.*, crews.name AS crew_name, crews.slug AS crew_slug
     FROM events LEFT JOIN crews ON crews.id = events.crew_id
     WHERE events.visibility = 'published' ORDER BY events.start_at`,
  ).all();

  if (!isBotRequest(request)) await recordCount(env, 'home_view');

  const { body } = homePage(results);

  // The install notice's script, home page only (see installPrompt in
  // templates/home.js). Deferred, so it never holds up the board.
  const extraHead = '<script src="/js/install-prompt.js" defer></script>';
  const page = String(layout({ path: new URL(request.url).pathname, title: null, bodyContent: body, bodyClass: 'page-home', extraHead }));

  return new Response(page, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
