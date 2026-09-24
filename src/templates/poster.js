import { html, raw } from '../lib/escape.js';
import qrcode from '../vendor/qrcode.mjs';
import { config } from '../config.js';
import { recordQrSvg } from '../lib/recordQr.js';

// Everything prints on A4 (owner request): an A4 poster fills the page,
// and A6 is four copies to a sheet, 2 x 2 with cut lines, so one sheet of
// ordinary paper makes four small flyers. A6 is exactly a quarter of A4,
// so each copy gets a 105 x 148.5mm cell with nothing wasted.
const PAGE = { widthMm: 210, heightMm: 297 };

const SIZES = {
  a4: { label: 'A4', widthMm: 210, heightMm: 297, copies: 1 },
  a6: { label: 'A6', widthMm: 105, heightMm: 148, copies: 4 },
};

// The sheet's own two colours, also passed to the record drawing so it
// prints in the same ink as everything else on the page.
const PAPER = '#d9d8d2';
const TONER = '#141312';
const GROOVE = '#63615a';

// Open scissors, blades pointing right along the cut, drawn rather than
// the U+2702 character so they print the same whatever fonts the printer's
// machine has. currentColor, so .cut svg sets the ink.
const SCISSORS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + '<g fill="none" stroke="currentColor" stroke-width="1.6">'
  + '<circle cx="5" cy="7" r="3"/><circle cx="5" cy="17" r="3"/>'
  + '<path d="M7.6 8.6 21 17M7.6 15.4 21 7"/></g></svg>';

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
  const fourUp = dimensions.copies === 4;
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
    // The library paints its own white square and pure black modules;
    // recoloured to the sheet's paper and toner like the record, so the
    // code no longer sits in a white box on the grey paper, and its quiet
    // zone runs straight on into the blank sheet around it.
    : qr.createSvgTag({ cellSize: 4, margin: 8, scalable: true })
      .replace('fill="white"', `fill="${PAPER}"`)
      .replace('fill="black"', `fill="${TONER}"`);

  const displayUrl = homeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

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

    /* The printed page, always A4. */
    .sheet {
      position: relative;
      background: #d9d8d2;
      color: #141312;
      width: ${PAGE.widthMm}mm;
      height: ${PAGE.heightMm}mm;
      margin: 0 auto;
      display: grid;
      /* minmax(0, ...) holds every cell to exactly its share of the page:
         a plain 1fr row grows to fit its content, and a copy a millimetre
         taller than its cell pushed the sheet onto a second page. */
      grid-template-columns: repeat(${fourUp ? 2 : 1}, minmax(0, 1fr));
      grid-template-rows: repeat(${fourUp ? 2 : 1}, minmax(0, 1fr));
    }

    /* One copy of the poster: the whole page for A4, a quarter of it for
       A6. Everything inside is sized off the copy, not the page. */
    .poster {
      min-width: 0;
      min-height: 0;
      /* 10mm on the four-up sheet: the record copy measures about 149mm
         with 12mm of padding, over its 148.5mm cell, and once cut apart
         each flyer still has a clear border. */
      padding: ${fourUp ? 10 : 12}mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: ${mm(8)};
    }

    /* The A6 sheet's cut lines: one down the middle, one across, over the
       copies, with a pair of scissors on each. Dashed in the record's
       groove grey so they read as guides rather than part of the poster,
       and the scissors sit 6mm in from the edge, inside the strip most
       home printers can't print. */
    .cut {
      position: absolute;
      pointer-events: none;
    }

    .cut--down {
      top: 0;
      bottom: 0;
      left: 50%;
      border-left: 0.3mm dashed ${GROOVE};
    }

    .cut--across {
      left: 0;
      right: 0;
      top: 50%;
      border-top: 0.3mm dashed ${GROOVE};
    }

    .cut svg {
      position: absolute;
      width: 6mm;
      height: 6mm;
      color: ${GROOVE};
      background: #d9d8d2;
    }

    .cut--down svg {
      top: 6mm;
      left: -3.15mm;
      transform: rotate(90deg);
    }

    .cut--across svg {
      left: 6mm;
      top: -3.15mm;
    }

    .poster h1 {
      font-family: 'Big Shoulders Display', sans-serif;
      font-weight: 900;
      text-transform: uppercase;
      font-size: ${mm(9)};
      line-height: 1.05;
      margin: 0;
    }

    .poster p {
      font-size: ${mm(4)};
      line-height: 1.3;
      margin: 0;
      max-width: 42ch;
    }

    .poster svg {
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
      /* A4 for both sizes, in millimetres rather than the "A4" keyword so
         it's stated the same way as the sheet it matches. */
      @page { size: ${PAGE.widthMm}mm ${PAGE.heightMm}mm; margin: 0; }
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
    <p>Print size: ${fourUp ? 'A6, four to a sheet of A4 with cut lines' : 'A4'}. <a href="/poster?size=${otherSize}&amp;style=${artwork}">Switch to ${otherSize === 'a6' ? 'A6 (four per A4 sheet)' : 'A4'}</a></p>
    <p>Artwork: ${STYLES[artwork].label}. <a href="/poster?size=${size}&amp;style=${otherStyle}">Switch to ${STYLES[otherStyle].label}</a></p>
    <button type="button" data-print-button>Print</button>
  </div>
  <div class="sheet-scaler">
    <div class="sheet">
      ${Array.from({ length: dimensions.copies }, (_, i) => html`<div class="poster"${i ? raw(' aria-hidden="true"') : ''}>
        <h1>${config.siteName}</h1>
        <p>${config.slogan}</p>
        ${raw(qrSvg)}
        <p>${displayUrl}</p>
      </div>`)}
      ${fourUp ? raw(`<div class="cut cut--down" aria-hidden="true">${SCISSORS}</div><div class="cut cut--across" aria-hidden="true">${SCISSORS}</div>`) : ''}
    </div>
  </div>
  <script src="/js/poster-scale.js" defer></script>
  <script src="/js/poster-print.js" defer></script>
</body>
</html>`;
}
