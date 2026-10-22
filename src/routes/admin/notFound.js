import { adminLayout } from '../../templates/admin/layout.js';
import { html } from '../../lib/escape.js';

/**
 * A 404 inside the admin: the admin shell, and never cacheable. The
 * public notFound() this used to borrow wore the public site's chrome
 * and was marked `public, max-age=60`, which is wrong for anything
 * behind Access.
 * @param {{ email: string, path?: string, siteOrigin?: string }} admin
 */
export function adminNotFound(admin) {
  const body = html`<h1>Not found</h1>
    <p>There's nothing at that address. It may have been deleted.</p>
    <p><a href="/admin">Back to the queue</a></p>`;
  return new Response(String(adminLayout({ title: 'Not found', bodyContent: body, email: admin.email, path: admin.path, siteOrigin: admin.siteOrigin })), {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
