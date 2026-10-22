import { layout } from '../templates/layout.js';
import { html } from './escape.js';

/**
 * A plain 404 response, styled with the same page shell. Used for unknown
 * routes and for pending/rejected/removed events (section 8.3), so a
 * private event never reveals its existence through a different error.
 */
export function notFound() {
  // Every other page opens with an h1; this one was a lone paragraph.
  const body = html`<h1>Not found</h1>
    <p>That page does not exist, or is not published.</p>
    <p><a href="/">Back to the board</a></p>`;
  return new Response(String(layout({ title: 'Not found', bodyContent: body })), {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
  });
}

/**
 * The page for an error the Worker didn't expect, section 12: the same
 * shell as every other page, a 500, and nothing about what went wrong
 * (that goes to the log, see src/index.js).
 */
export function serverError() {
  const body = html`<h1>Something went wrong</h1>
    <p>That didn't work. Try again in a minute.</p>
    <p><a href="/">Back to the board</a></p>`;
  return new Response(String(layout({ title: 'Something went wrong', bodyContent: body })), {
    status: 500,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
