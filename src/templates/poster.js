import { html, raw } from '../lib/escape.js';
import qrcode from '../vendor/qrcode.mjs';
import { config } from '../config.js';
import { recordQrSvg } from '../lib/recordQr.js';

const SIZES = {
  a4: { label: 'A4', widthMm: 210, heightMm: 297 },
  a6: { label: 'A6', widthMm: 105, heightMm: 148 },
};

// The sheet's own two colours, also passed to the record drawing so it
// prints in the same ink as everything else on the page.
const PAPER = '#d9d8d2';
const TONER = '#141312';
const GROOVE = '#63615a';

const STYLES = {
  record: { label: 'Record' },
  plain: { label: 'Plain QR' },
};

/**
 * GET /poster. Section 17 phase 4: a printable poster with the site name,
 * slogan and a QR code to the home page, in the site's visual style, for
 * stickers and record shop walls. Works without JavaScript; size is
 * chosen with plain links.
 * Two artworks, chosen with ?style=. "record" draws the QR as a vinyl
 * record's label, which is the default; "plain" is the original bare QR,
 * kept because the record shrinks the code to about a third of the
 * record's width and a poster read from across a room may want the
 * bigger symbol. Neither is more or less scannable at a given symbol
 * size: see the quiet-zone note in lib/recordQr.js.
 * @param {string} homeUrl - absolute URL to the site's home page
 * @param {'a4'|'a6'} size
 * @param {'record'|'plain'} [style]
 */
export function posterPage(homeUrl, size, style = 'record') {
  const dimensions = SIZES[size] || SIZES.a4;
  const otherSize = size === 'a6' ? 'a4' : 'a6';
  const artwork = STYLES[style] ? style : 'record';
  const otherStyle = artwork === 'record' ? 'plain' : 'record';
  // A6 is the hand-tuned baseline (owner feedback: its margins and fill
  // are right). Content scaled off a plain size ternary (as this used to)
  // grows slower than the page itself -- A4 is exactly 2x A6 linearly, but
  // a hardcoded "a4 is a bit bigger" font size was only ~1.5-1.8x, so A4
  // read as mostly blank page around small text. Scaling every content
  // dimension by the same real-world size ratio keeps A4 filled the same
  // proportion of the page as A6, at any size added to SIZES later too.
  const scale = dimensions.widthMm / SIZES.a6.widthMm;
  const mm = (value) => `${value * scale}mm`;

  const qr = qrcode(0, 'M');
  qr.addData(homeUrl);
  qr.make();
  const qrSvg = artwork === 'record'
    ? recordQrSvg(qr, {
      paper: PAPER,
      ink: TONER,
      groove: GROOVE,
      label: `Scan to open ${config.siteName}`,
    }).svg
    : qr.createSvgTag({ cellSize: 4, margin: 8, scalable: true });

  return html`<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Poster - ${config.siteName}</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate icon" href="/favicon-32.png" sizes="32x32" type="image/png">
  <style>
    @font-face {
      font-family: 'Big Shoulders Display';
      src: url('/fonts/big-shoulders-display.woff2') format('woff2-variations');
      font-weight: 700 900;
    }
    @font-face {
      font-family: 'Archivo';
      src: url('/fonts/archivo.woff2') format('woff2-variations');
      font-weight: 400 600;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: #2b2a27;
      font-family: 'Archivo', Arial, sans-serif;
      color: #d9d8d2;
    }

    .screen-only {
      padding: 1.5rem;
      text-align: center;
    }

    .screen-only a, .screen-only button {
      font: inherit;
      color: inherit;
      background: transparent;
      border: 2px solid #d9d8d2;
      padding: 0.5rem 1rem;
      text-decoration: none;
      display: inline-block;
      margin: 0.25rem;
      cursor: pointer;
    }

    .sheet {
      background: #d9d8d2;
      color: #141312;
      width: ${dimensions.widthMm}mm;
      height: ${dimensions.heightMm}mm;
      margin: 0 auto;
      padding: 12mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: ${mm(8)};
    }

    .sheet h1 {
      font-family: 'Big Shoulders Display', sans-serif;
      font-weight: 900;
      text-transform: uppercase;
      font-size: ${mm(9)};
      line-height: 1.05;
      margin: 0;
    }

    .sheet p {
      font-size: ${mm(4)};
      line-height: 1.3;
      margin: 0;
      max-width: 42ch;
    }

    .sheet svg {
      width: ${mm(artwork === 'record' ? 76 : 45)};
      height: ${mm(artwork === 'record' ? 76 : 45)};
    }

    /* On screen only: the sheet is a fixed real-world width (A4 is 210mm,
       roughly 794px), so on a phone it ran well off the right edge and put
       a horizontal scrollbar on the page. Scaling it down to fit the
       viewport keeps the whole poster visible as a preview. The print
       rules below are untouched, so what actually prints is still the
       sheet at its true size. */
    @media screen {
      /* Everything here is scoped to .is-scaled, which poster-scale.js
         adds only when the sheet is actually too wide for the viewport.
         It used to apply unconditionally, and its margin-left/right of 0
         cancelled the sheet's own "margin: 0 auto" -- so on any screen
         big enough to fit the sheet, where no scaling happens at all, the
         poster sat hard against the left edge with all the slack on the
         right. Left as it comes on a screen that fits, the sheet just
         centres itself the way it always did. */
      .sheet-scaler.is-scaled {
        overflow: hidden;
      }

      .sheet-scaler.is-scaled .sheet {
        /* top left, not top center: the sheet's layout box is wider than
           the viewport it's being scaled into, so scaling about its centre
           leaves the shrunken sheet sitting out to the right of the
           container, where overflow: hidden then clips it. Scaled from
           the left edge it lands flush at x=0 and, since the scale is
           exactly viewport/sheet, fills the width precisely. */
        transform: scale(var(--sheet-scale, 1));
        transform-origin: top left;
        margin-left: 0;
        margin-right: 0;
      }
    }

    @media print {
      @page { size: ${dimensions.label}; margin: 0; }
      body { background: none; }
      .screen-only { display: none; }
      .sheet { margin: 0; }
      /* poster-scale.js sets an inline height on the scaler to match the
         shrunken on-screen sheet. That height is meaningless once the
         transform is gone, so clear it rather than let it drive page
         breaks. */
      .sheet-scaler { overflow: visible; height: auto !important; }
    }
  </style>
</head>
<body>
  <div class="screen-only">
    <p>Print size: ${dimensions.label}. <a href="/poster?size=${otherSize}&amp;style=${artwork}">Switch to ${SIZES[otherSize].label}</a></p>
    <p>Artwork: ${STYLES[artwork].label}. <a href="/poster?size=${size}&amp;style=${otherStyle}">Switch to ${STYLES[otherStyle].label}</a></p>
    <button type="button" data-print-button>Print</button>
  </div>
  <div class="sheet-scaler">
    <div class="sheet">
      <h1>${config.siteName}</h1>
      <p>${config.slogan}</p>
      ${raw(qrSvg)}
      <p>${homeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
    </div>
  </div>
  <script src="/js/poster-scale.js" defer></script>
  <script src="/js/poster-print.js" defer></script>
</body>
</html>`;
}
