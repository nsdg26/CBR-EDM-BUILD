import { canberraDayKey } from './dates.js';

/**
 * Increments a first-party daily counter, section 11.2. No IP addresses,
 * cookies or identifiers are stored, only a day/metric/subject tally.
 *
 * Never throws: a counter is the least important thing on any page, and
 * a failed D1 write here (an outage, or the free tier's daily write
 * quota under a crawler that doesn't call itself a bot) used to turn
 * every public page into a 500.
 * @param {import('../env.js').Env} env
 * @param {string} metric
 * @param {string} [subjectId]
 * @param {Date} [now]
 */
export async function recordCount(env, metric, subjectId = '', now = new Date()) {
  try {
    const day = canberraDayKey(now.toISOString());
    await env.DB.prepare(
      `INSERT INTO daily_counts (day, metric, subject_id, count) VALUES (?, ?, ?, 1)
       ON CONFLICT(day, metric, subject_id) DO UPDATE SET count = count + 1`,
    ).bind(day, metric, subjectId).run();
  } catch (err) {
    console.error(`Analytics count failed for ${metric}`, err);
  }
}

/**
 * The same count, taken off the response path: with an execution
 * context the write runs after the page has been sent (ctx.waitUntil),
 * so a slow D1 never delays a visitor. Without one (tests, or a caller
 * that has no ctx to hand) it simply awaits.
 * @param {ExecutionContext|undefined} ctx
 * @param {import('../env.js').Env} env
 * @param {string} metric
 * @param {string} [subjectId]
 */
export async function countInBackground(ctx, env, metric, subjectId = '') {
  const work = recordCount(env, metric, subjectId);
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(work);
    return;
  }
  await work;
}

const BOT_PATTERN = /bot|crawler|spider/i;

/**
 * Whether a request looks like an obvious bot, section 11.2. Not counted.
 * @param {Request} request
 */
export function isBotRequest(request) {
  return BOT_PATTERN.test(request.headers.get('User-Agent') || '');
}
