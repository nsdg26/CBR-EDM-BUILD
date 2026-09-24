import { html } from '../lib/escape.js';

/**
 * The "put it on your home screen" notice, owner request: on the public
 * home page, and on the admin queue for the admin panel's own app. Rendered
 * hidden, with its script alongside it so a page that includes this needs
 * nothing else; public/js/install-prompt.js decides whether to show it and
 * which half. Browsers never let a page install itself, so there are two
 * versions:
 *
 * - Chrome, Edge, Samsung Internet (Android and desktop) fire
 *   beforeinstallprompt when the page's app is installable. The script
 *   holds that event and the Install button hands it back, which opens the
 *   browser's own install dialog -- for whichever manifest the page links,
 *   so the admin queue offers the admin app, not the public one.
 * - iPhone and iPad have no such event and no install prompt of any kind,
 *   so the only thing a page can do is say where Add to Home Screen is.
 *
 * Never shown inside the installed app, and gone for good on that device
 * once dismissed. storageKey keeps that per app, so dismissing the public
 * site's notice doesn't also hide the admin's.
 * @param {{ appName: string, blurb: string, icon: string, storageKey: string }} options
 */
export function installPrompt({ appName, blurb, icon, storageKey }) {
  return html`<aside class="install-prompt" data-install-prompt data-install-key="${storageKey}" hidden aria-label="Install the app">
    <span class="scrap-tape" aria-hidden="true"></span>
    <img class="install-prompt-mark" src="${icon}" alt="" width="48" height="48">
    <div class="install-prompt-body">
      <p class="install-prompt-title">Put ${appName} on your home screen</p>
      <p data-install-variant="prompt" hidden>${blurb}</p>
      <p data-install-variant="ios" hidden>Tap
        <svg class="install-prompt-share" viewBox="0 0 20 24" width="16" height="19" aria-hidden="true" focusable="false"><path d="M10 1v14M5 6l5-5 5 5M4 10H2v13h16V10h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</p>
      <div class="install-prompt-actions">
        <button type="button" data-install-accept data-install-variant="prompt" hidden>Install</button>
        <button type="button" class="secondary" data-install-dismiss>Not now</button>
      </div>
    </div>
  </aside>
  <script src="/js/install-prompt.js" defer></script>`;
}
