import { hashToken } from './tokens.js';
import { canberraDayKey } from './dates.js';

/**
 * The per-request key for a bucket: a daily-rotating salted hash of the
 * client IP, never the raw IP. Section 5 and 12.
 * @param {Request} request
 * @param {import('../env.js').Env} env
 * @param {string} bucket
 * @param {string} day
 */
async function clientKeyHash(request, env, bucket, day) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const salt = env.RATE_LIMIT_SALT || 'local-dev-salt-not-for-production';
  return hashToken(`${salt}:${day}:${bucket}:${ip}`);
}

function today() {
  return canberraDayKey(new Date().toISOString());
}

/**
 * Increments a bucket and reports whether it is still within its limit.
 * @param {import('../env.js').Env} env
 * @param {string} bucket
 * @param {string} keyHash
 * @param {string} day
 * @param {number} limit
 */
async function bump(env, bucket, keyHash, day, limit) {
  // Increment and read back in one statement: one D1 round trip instead of
  // a SELECT then an INSERT, and no gap between the two for a burst of
  // parallel requests to all read the same under-limit count.
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (bucket, key_hash, day, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(bucket, key_hash, day) DO UPDATE SET count = count + 1
     RETURNING count`,
  ).bind(bucket, keyHash, day).first();

  return (row?.count ?? 1) <= limit;
}

/**
 * Checks and increments a rate limit bucket for the client making this
 * request. Every call counts, so use it for actions that should be
 * limited however they turn out (a submission, a contact message), and
 * rateLimitExceeded plus a failure-only count for sign-in style checks.
 * @param {Request} request
 * @param {import('../env.js').Env} env
 * @param {string} bucket - e.g. "submit", "crew_key", "contact"
 * @param {number} limit - max allowed within the current Canberra day
 * @returns {Promise<boolean>} true if the request is allowed
 */
export async function checkRateLimit(request, env, bucket, limit) {
  const day = today();
  const keyHash = await clientKeyHash(request, env, bucket, day);
  return bump(env, bucket, keyHash, day, limit);
}

/**
 * Whether the client is already at or over a bucket's limit, without
 * counting this request. Pair it with checkRateLimit on the failure path
 * so that only wrong attempts spend the budget: the crew dashboard
 * re-checks a stored key on every page load, and counting those locked a
 * crew out of its own dashboard after ten reloads in a day.
 * @param {Request} request
 * @param {import('../env.js').Env} env
 * @param {string} bucket
 * @param {number} limit
 */
export async function rateLimitExceeded(request, env, bucket, limit) {
  const day = today();
  const keyHash = await clientKeyHash(request, env, bucket, day);
  const row = await env.DB.prepare(
    'SELECT count FROM rate_limits WHERE bucket = ? AND key_hash = ? AND day = ?',
  ).bind(bucket, keyHash, day).first();
  return (row?.count ?? 0) >= limit;
}

/**
 * A site-wide bucket, not per client: a cap on how often the whole site
 * does something within a window. Used to keep calls to the free
 * geocoding services inside their usage policies whatever the public
 * forms are asked to do, and to cap how many inbound emails a day are
 * stored. "minute" windows still live under today's day column so the
 * nightly prune (src/index.js scheduled) clears them with everything else.
 * @param {import('../env.js').Env} env
 * @param {string} bucket
 * @param {number} limit
 * @param {'minute'|'day'} [window]
 * @returns {Promise<boolean>} true if allowed
 */
export async function checkGlobalRateLimit(env, bucket, limit, window = 'day') {
  const day = today();
  const minute = window === 'minute' ? new Date().toISOString().slice(0, 16) : 'day';
  const keyHash = await hashToken(`global:${bucket}:${minute}`);
  return bump(env, bucket, keyHash, day, limit);
}

/**
 * Deletes rate_limits rows older than the given number of days. The rows
 * are useless once their day has passed (every bucket is per Canberra
 * day), and they hold hashed IPs that are better gone than kept.
 * @param {import('../env.js').Env} env
 * @param {number} [keepDays]
 */
export async function pruneRateLimits(env, keepDays = 2) {
  const cutoff = canberraDayKey(new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000).toISOString());
  const result = await env.DB.prepare('DELETE FROM rate_limits WHERE day < ?').bind(cutoff).run();
  return result?.meta?.changes ?? 0;
}
