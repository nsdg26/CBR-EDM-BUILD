// Security headers, section 12. Applied to HTML responses only, since
// forcing these onto an image or calendar file response serves no purpose
// and risks breaking their own Content-Type handling.

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  // The Turnstile widget injects its own inline styles into its iframe/host
  // elements, so style-src needs 'unsafe-inline'. This is far lower risk
  // than allowing inline scripts (still fully blocked above): styles can't
  // execute code or exfiltrate data on their own.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  // challenges.cloudflare.com is also needed here, not just in frame-src
  // and script-src: the Turnstile widget's own JS makes fetch/XHR calls
  // back to its origin for parts of the challenge flow, which connect-src
  // (not frame-src) governs. Without it those calls are silently blocked,
  // which can present as "the widget looks fine, but the check keeps
  // failing" without a proper error message on screen.
  "connect-src 'self' https://cloudflareinsights.com https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  // Nothing on the site uses <base>, plugins or a form that posts
  // elsewhere, so an injected one is simply refused.
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

// The footer comment layout.js leaves in every page, filled in here with
// the deployment id. The whole marker is matched, not the bare id, so a
// title or note that happens to contain the id's text is left alone.
const BUILD_MARKER = '<!-- build:CF_VERSION_ID -->';

/**
 * @param {Response} response
 * @param {{ noReferrer?: boolean }} [options] - pass noReferrer on edit and crew pages, section 12
 * @param {import('../env.js').Env} [env] - used to fill in the build comment, see layout.js
 */
export async function withSecurityHeaders(response, options = {}, env) {
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) return response;

  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', CSP);
  headers.set('X-Content-Type-Options', 'nosniff');
  // A route that has already chosen its own policy (no-referrer on the
  // edit and crew pages, section 12) keeps it; this used to overwrite it.
  if (options.noReferrer) headers.set('Referrer-Policy', 'no-referrer');
  else if (!headers.has('Referrer-Policy')) headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
  // Browsers ignore this over plain http, so local wrangler dev is
  // unaffected; on the real domains it pins https for a year.
  headers.set('Strict-Transport-Security', 'max-age=31536000');

  // layout.js leaves this placeholder in every page; filled in here, in the
  // one place all HTML responses pass through, rather than threading env
  // into every route just to render an HTML comment.
  const buildId = env?.CF_VERSION_METADATA?.id ? env.CF_VERSION_METADATA.id.slice(0, 8) : 'dev';

  // A 304 (or 204) must not be given a body, even an empty string: the
  // Response constructor throws for one, which turned a conditional
  // request for an HTML asset into a 500.
  if (response.body === null || [101, 204, 205, 304].includes(response.status)) {
    return new Response(null, { status: response.status, statusText: response.statusText, headers });
  }

  return new Response(
    (await response.text()).replace(BUILD_MARKER, `<!-- build:${buildId} -->`),
    { status: response.status, statusText: response.statusText, headers },
  );
}
