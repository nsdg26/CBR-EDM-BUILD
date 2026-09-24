import { adminLayout } from '../../templates/admin/layout.js';
import { html } from '../../lib/escape.js';
import { config } from '../../config.js';
import { installPrompt } from '../../templates/installPrompt.js';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * GET /admin. The queue, section 10.2: newest first, with counts.
 */
export async function handleAdminQueue(request, env, admin) {
  const [pendingEvents, pendingChanges, newEmails, newMessages, staleLinks] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE visibility = 'pending'").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM event_changes WHERE state = 'pending'").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM inbound_emails WHERE state = 'new'").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE state = 'new'").first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM harm_reduction_links WHERE last_checked_at < ?')
      .bind(new Date(Date.now() - NINETY_DAYS_MS).toISOString()).first(),
  ]);

  const body = html`
    <h1>Queue</h1>
    ${staleLinks.n > 0
      ? html`<p class="error">${staleLinks.n} harm reduction link${staleLinks.n === 1 ? '' : 's'} ${staleLinks.n === 1 ? 'has' : 'have'} not been checked in over 90 days. <a href="/admin/harm-reduction">Review ${staleLinks.n === 1 ? 'it' : 'them'}</a>.</p>`
      : ''}
    <table>
      <tbody>
        <tr><td><a href="/admin/events?visibility=pending">Pending submissions</a></td><td>${pendingEvents.n}</td></tr>
        <tr><td><a href="/admin/changes">Pending changes and requests</a></td><td>${pendingChanges.n}</td></tr>
        <tr><td><a href="/admin/inbound-emails">New inbound emails</a></td><td>${newEmails.n}</td></tr>
        <tr><td><a href="/admin/contact-messages">New contact messages</a></td><td>${newMessages.n}</td></tr>
      </tbody>
    </table>
    ${installPrompt({
      appName: config.adminShortName,
      blurb: 'Opens straight to the queue, like an app. Sign-in stays with Cloudflare Access.',
      icon: '/icons/record-admin.svg',
      // Its own key: dismissing the public site's notice on this phone
      // shouldn't also hide this one, or the other way round.
      storageKey: 'cbr_admin_install_prompt_dismissed',
    })}
  `;

  return new Response(String(adminLayout({ title: 'Queue', bodyContent: body, email: admin.email, path: admin.path, siteOrigin: admin.siteOrigin })), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
