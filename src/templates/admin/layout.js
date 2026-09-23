import { html, raw } from '../../lib/escape.js';
import { config } from '../../config.js';
import { isCurrentNav } from '../layout.js';

const NAV = [
  ['/admin', 'Queue'],
  ['/admin/events', 'Events'],
  ['/admin/changes', 'Changes'],
  ['/admin/inbound-emails', 'Inbound emails'],
  ['/admin/crews', 'Crews'],
  ['/admin/contact-messages', 'Messages'],
  ['/admin/harm-reduction', 'Harm reduction links'],
  ['/admin/stats', 'Stats'],
  ['/poster', 'Poster'],
];

/**
 * The Queue link is /admin itself, which every other admin path starts
 * with, so it only counts as current on an exact match.
 * @param {string} href
 * @param {string} path
 */
function isAdminNavCurrent(href, path) {
  return href === '/admin' ? path === '/admin' : isCurrentNav(href, path);
}

/**
 * The admin panel shell. Section 10.2 asks for plain and functional, and
 * it still is -- tables, forms and stacked records, nothing decorative
 * that gets in the way of a job. What changed (owner request) is that it
 * now wears the public site's design instead of a second, unrelated one:
 * it loads style.css first and admin.css only as an overlay, so the
 * tokens, the two self-hosted faces, the concrete wall, the paper inputs
 * and the buttons are literally the same rules the public pages use, and
 * the header is built from the same .site-header / .site-nav markup.
 * That also means admin.css no longer keeps its own copy of the fonts,
 * the colours or the form and lineup-row styling to drift out of step.
 * Still no-store, still no public-site scripts it has no use for.
 * @param {{ title: string, bodyContent: string, email: string, path?: string, now?: Date }} options
 */
export function adminLayout({ title, bodyContent, email, path = '', now = new Date() }) {
  // Date and copy both come from config.reminderBanner (config.js), which
  // used to declare them while this file hardcoded its own copy of each --
  // so editing the config did nothing.
  const banner = config.reminderBanner;
  const showReminderBanner = Boolean(banner?.text)
    && now >= new Date(`${banner.fromDate}T00:00:00Z`);

  return html`<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - ${config.siteName} admin</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate icon" href="/favicon-32.png" sizes="32x32" type="image/png">
  <meta name="theme-color" content="${config.themeColour}">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/admin.css">
</head>
<body class="page-admin">
  <header class="site-header">
    <div class="site-header-inner">
      <div class="hero-name-row">
        <a href="/admin" class="site-name">
          <img class="site-name-mark" src="/icons/record.svg" alt="" width="512" height="512">
          <span>${config.siteName}</span>
        </a>
        <p class="slogan-strip">Admin</p>
      </div>
      <nav aria-label="Admin">
        <ul class="site-nav">
          ${NAV.map(([href, label]) => html`<li><a href="${href}"${isAdminNavCurrent(href, path) ? raw(' aria-current="page"') : ''}>${label}</a></li>`)}
          <li><a href="/" class="admin-nav-site">View the site</a></li>
        </ul>
      </nav>
      <p class="admin-signed-in">Signed in as ${email}</p>
    </div>
  </header>
  ${showReminderBanner
    ? html`<p class="admin-banner">${banner.text}</p>`
    : ''}
  <main>
    ${raw(bodyContent)}
  </main>
  <script src="/js/header-height.js" defer></script>
  <script src="/js/admin-confirm.js" defer></script>
  <script src="/js/lineup-rows.js" defer></script>
  <script src="/js/admin-events-form.js" defer></script>
</body>
</html>`;
}
