// The QR code drawn as a vinyl record's label, for the printable poster.
//
// The trick that makes this safe is geometric, not a fudge of the code
// itself. A QR needs a "quiet zone" of at least 4 blank modules around
// the symbol or scanners lose the edges. A circular label around a square
// symbol supplies that for free: a circle drawn through a square's corners
// clears each edge's midpoint by (sqrt(2) - 1) / 2, about 20.7% of the
// square's width. For the 25-module code this poster generates that is
// over 5 modules of blank paper, before any margin is asked for, and the
// record's grooves all sit outside it. Nothing ever overlaps the symbol,
// so the code's error correction is never spent covering for the artwork.
//
// Worth noting this is stricter than the plain poster it sits beside:
// qrcode.mjs's own `margin: 8` at `cellSize: 4` is only 2 modules, half
// the minimum, and gets away with it purely because the code sits in the
// middle of a blank sheet.

const MIN_QUIET_MODULES = 4;

/**
 * Extra blank modules requested between the symbol and the label's edge,
 * on top of the spec minimum. The label is a circle and the symbol is a
 * square, so the real clearance is larger everywhere except at the four
 * corners, which this is measured from.
 */
const QUIET_MODULES = 4;

/**
 * Renders a made `qrcode` instance as a record: grooved disc, blank label,
 * QR symbol centred on the label.
 * @param {{ getModuleCount: () => number, isDark: (r: number, c: number) => boolean }} qr
 *   a qrcode.mjs instance with make() already called
 * @param {{ paper: string, ink: string, groove: string, label: string, rings?: number, spread?: number }} options
 *   spread: the disc's radius as a multiple of the innermost groove's, so
 *   a bigger number is a wider record around the same size code
 * @returns {{ svg: string, geometry: object }}
 */
export function recordQrSvg(qr, options) {
  const { paper, ink, groove, label, rings = 5, spread = 1.5 } = options;
  const modules = qr.getModuleCount();
  const geometry = recordQrGeometry(modules, { spread });
  const { labelRadius, innerGrooveRadius, discRadius, viewBox } = geometry;
  const centre = viewBox / 2;
  const half = modules / 2;

  // Every dark module is a square in one single path, not a <rect> each.
  // Separate rects are anti-aliased edge by edge, so neighbouring modules
  // showed light hairline seams between them on screen and in PDF viewers
  // (the 1.02 overlap each used to carry didn't stop it), a grid laid
  // through the code. One path is filled as one shape, so modules that
  // touch simply merge.
  let cells = '';
  for (let row = 0; row < modules; row++) {
    for (let column = 0; column < modules; column++) {
      if (!qr.isDark(row, column)) continue;
      cells += `M${round(centre - half + column)} ${round(centre - half + row)}h1v1h-1z`;
    }
  }

  const grooves = [];
  for (let i = 0; i < rings; i++) {
    const t = rings === 1 ? 0 : i / (rings - 1);
    grooves.push(innerGrooveRadius + t * (discRadius - innerGrooveRadius - discRadius * 0.05));
  }

  return {
    geometry,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(viewBox)} ${round(viewBox)}" role="img" aria-label="${label}">
  <circle cx="${round(centre)}" cy="${round(centre)}" r="${round(discRadius)}" fill="${ink}" stroke="${ink}" stroke-width="${round(discRadius * 0.028)}"/>
  <g fill="none" stroke="${groove}" stroke-width="${round(discRadius * 0.017)}">
    ${grooves.map((r) => `<circle cx="${round(centre)}" cy="${round(centre)}" r="${round(r)}"/>`).join('\n    ')}
  </g>
  <circle cx="${round(centre)}" cy="${round(centre)}" r="${round(labelRadius)}" fill="${paper}"/>
  <path fill="${ink}" d="${cells}"/>
</svg>`,
  };
}

/**
 * The radii the drawing is built from, in module units, split out so the
 * quiet-zone guarantee can be asserted in tests without parsing SVG.
 * @param {number} modules - the QR's module count per side
 * @param {{ spread?: number }} [options]
 */
export function recordQrGeometry(modules, { spread = 1.5 } = {}) {
  // The circle that passes through the corners of the symbol-plus-quiet-
  // zone square. Everything outside it is free for artwork.
  const quietSide = modules + QUIET_MODULES * 2;
  const labelRadius = (quietSide / 2) * Math.SQRT2;
  const innerGrooveRadius = labelRadius * 1.05;
  const discRadius = innerGrooveRadius * spread;
  return {
    modules,
    quietModules: QUIET_MODULES,
    labelRadius,
    innerGrooveRadius,
    discRadius,
    viewBox: discRadius * 2 + 4,
    // What the label actually guarantees at the symbol's edge midpoints,
    // which is the number a scanner cares about.
    clearanceAtEdge: labelRadius - modules / 2,
    minQuietModules: MIN_QUIET_MODULES,
  };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
