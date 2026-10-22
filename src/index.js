import { config } from './config.js';
import { router } from './router.js';
import { withSecurityHeaders } from './lib/securityHeaders.js';
import { handleInboundEmail } from './lib/inboundEmail.js';
import { serverError } from './lib/http.js';
import { pruneRateLimits } from './lib/rateLimit.js';

/**
 * Worker entry point.
 * @type {ExportedHandler}
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/health') {
        const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM events').first();
        return new Response(
          JSON.stringify({ ok: true, site: config.siteName, events: row.count }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }

      const response = await router(request, env, ctx);
      return withSecurityHeaders(response, {}, env);
    } catch (err) {
      // Anything a route didn't expect: logged in full here, shown to the
      // visitor as the site's own page rather than the runtime's bare
      // "Internal Server Error", with nothing about the cause on it.
      console.error(`Unhandled error on ${request.method} ${url.pathname}`, err);
      return withSecurityHeaders(serverError(), {}, env);
    }
  },

  /**
   * Handles mail arriving at events@domain via Email Routing, section 10.6.
   */
  async email(message, env) {
    await handleInboundEmail(message, env);
  },

  /**
   * Nightly housekeeping (wrangler.jsonc triggers.crons): rate_limits rows
   * are per Canberra day and useless once that day is over, and they
   * carry hashed IPs, so they are deleted after two days. daily_counts is
   * left alone: it is the all-time stats on /admin/stats.
   */
  async scheduled(event, env) {
    const deleted = await pruneRateLimits(env);
    console.log(`Pruned ${deleted} expired rate_limits rows`);
  },
};
