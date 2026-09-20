import { config } from '../config.js';

/**
 * GET /manifest.webmanifest: the web app manifest, which is what makes
 * the site installable to a home screen.
 *
 * Served from the Worker rather than sat in public/ as a static file for
 * two reasons. The name, short name and description come straight from
 * config.js, which asks to be the one place site identity lives, and a
 * static copy would be a second one to drift out of sync with it. And
 * building the response here means the Content-Type is exactly
 * application/manifest+json, rather than whatever the asset server infers
 * from an unusual file extension.
 *
 * Icons are the fixed part and stay in public/icons/, alongside the SVG
 * sources they are generated from.
 */
export function handleManifest() {
  const manifest = {
    name: config.siteName,
    short_name: config.shortName,
    description: config.slogan,
    lang: 'en-AU',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: config.themeColour,
    theme_color: config.themeColour,
    categories: ['music', 'events', 'entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android crops an icon to the launcher's own shape, so the
      // maskable variant keeps the record inside the safe circle.
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    // Long-press the installed icon. Deliberately not "Submit an event":
    // these are for reading, and the submit form needs Turnstile anyway.
    shortcuts: [
      { name: config.harmReductionTitle, short_name: 'Harm reduction', url: '/look-after-each-other' },
      { name: 'Crews', short_name: 'Crews', url: '/crews' },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
