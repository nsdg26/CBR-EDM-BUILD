import { posterPage } from '../templates/poster.js';

/**
 * GET /poster?size=a4|a6&style=record|plain. Section 17 phase 4.
 * Unknown values fall back to the defaults rather than 404ing: this is a
 * page people reach by editing a link, not an API.
 */
export async function handlePoster(request, env) {
  const url = new URL(request.url);
  const size = url.searchParams.get('size') === 'a6' ? 'a6' : 'a4';
  const style = url.searchParams.get('style') === 'plain' ? 'plain' : 'record';
  const homeUrl = `${url.origin}/`;

  const page = String(posterPage(homeUrl, size, style));

  return new Response(page, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
