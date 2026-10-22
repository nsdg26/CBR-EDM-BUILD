// Cloudflare Access JWT verification, section 10.1. Access itself protects
// /admin* at the edge, but the Worker must independently verify the
// Cf-Access-Jwt-Assertion header against the Access team's public keys and
// the application audience tag, and reject the request if verification
// fails, even if Access is misconfigured. No JWT library: Workers' Web
// Crypto API can verify RS256 directly.

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
// How often an unknown key id may force a refetch of the certs. Access
// rotates keys rarely, so once a minute covers a real rotation, and a
// stream of requests carrying made-up key ids can't turn into a certs
// fetch per request.
const JWKS_REFRESH_COOLDOWN_MS = 60 * 1000;
// Tolerance for clock skew on nbf, in seconds.
const CLOCK_SKEW_S = 60;

// Module-level cache: persists across requests on a warm isolate, refetched
// on cold start or once the TTL passes. An imperfect cache (Workers can
// spin up fresh isolates at any time) but it keeps steady-state traffic
// from fetching the certs endpoint on every admin request.
let jwksCache = null;
let lastRefreshAt = 0;

async function getJwks(teamDomain, { refresh = false } = {}) {
  if (!refresh && jwksCache && jwksCache.teamDomain === teamDomain && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.keys;
  }
  if (refresh) {
    if (Date.now() - lastRefreshAt < JWKS_REFRESH_COOLDOWN_MS) return jwksCache?.keys || [];
    lastRefreshAt = Date.now();
  }
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error('Failed to fetch Access certs');
  const data = await response.json();
  jwksCache = { keys: data.keys, teamDomain, fetchedAt: Date.now() };
  return data.keys;
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJwt(token) {
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !signatureB64) throw new Error('Malformed JWT');
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  const signature = base64UrlDecode(signatureB64);
  return { header, payload, signature, signedData: `${headerB64}.${payloadB64}` };
}

/**
 * Verifies the Access JWT on a request. Returns the token payload (which
 * includes the signed-in email) if valid, or null if missing, malformed,
 * expired, wrongly addressed, or signed by an unrecognised key.
 * @param {Request} request
 * @param {{ ACCESS_TEAM_DOMAIN: string, ACCESS_AUD: string }} env
 */
export async function verifyAccessJwt(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;

  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  if (!teamDomain || !audience) return null;

  let header, payload, signature, signedData;
  try {
    ({ header, payload, signature, signedData } = decodeJwt(token));
  } catch {
    return null;
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(audience)) return null;
  const nowSeconds = Date.now() / 1000;
  if (!payload.exp || nowSeconds > payload.exp) return null;
  if (typeof payload.nbf === 'number' && nowSeconds < payload.nbf - CLOCK_SKEW_S) return null;
  // Exactly the team's issuer, not any string that happens to contain the
  // team domain somewhere in it.
  if (payload.iss !== `https://${teamDomain}`) return null;

  let keys;
  try {
    keys = await getJwks(teamDomain);
  } catch {
    return null;
  }

  let jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    // Access rotates its signing keys. A token signed with a key newer than
    // the cached set used to be refused until the cache aged out, locking
    // the admin out for up to an hour; refetch once before giving up.
    try {
      keys = await getJwks(teamDomain, { refresh: true });
    } catch {
      return null;
    }
    jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) return null;
  }

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signature,
      new TextEncoder().encode(signedData),
    );

    return valid ? payload : null;
  } catch {
    // A key or signature Web Crypto can't use is a failed check, not a 500.
    return null;
  }
}

/**
 * Whether a request is to a local development address: localhost,
 * 127.0.0.1, ::1 or anything under .localhost (admin.localhost, say).
 * @param {URL} url
 */
export function isLocalDevHost(url) {
  const host = url.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');
}

/**
 * Admin auth guard for /admin* routes. In local development only,
 * DEV_BYPASS_ACCESS lets you exercise the admin panel without a real
 * Access application. Set it in .dev.vars, which is gitignored and never
 * deployed. It is also only honoured on a local hostname, so the same
 * variable arriving in a deployed Worker by mistake (a copied .dev.vars,
 * a stray dashboard variable) opens nothing.
 * @param {Request} request
 * @param {import('../env.js').Env} env
 * @returns {Promise<{ email: string }|null>}
 */
export async function requireAdmin(request, env) {
  if (env.DEV_BYPASS_ACCESS === 'true' && isLocalDevHost(new URL(request.url))) {
    return { email: 'dev@localhost' };
  }
  const payload = await verifyAccessJwt(request, env);
  return payload ? { email: payload.email } : null;
}
