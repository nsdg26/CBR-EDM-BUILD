import assert from 'node:assert/strict';
import { test } from 'node:test';
import qrcode from '../src/vendor/qrcode.mjs';
import { recordQrSvg, recordQrGeometry } from '../src/lib/recordQr.js';

function madeQr(data = 'https://example.com/') {
  const qr = qrcode(0, 'M');
  qr.addData(data);
  qr.make();
  return qr;
}

// This is the property the whole design rests on: the blank label has to
// clear the symbol by at least the 4 modules a scanner needs, on every
// side, or the grooves start eating the code's quiet zone. It holds for
// any module count because the label circle passes through the corners of
// the symbol-plus-quiet-zone square, so the edge midpoints get more.
test('the label always clears the symbol by more than the minimum quiet zone', () => {
  for (const modules of [21, 25, 29, 33, 57, 177]) {
    const g = recordQrGeometry(modules);
    assert.ok(
      g.clearanceAtEdge >= g.minQuietModules,
      `${modules} modules: ${g.clearanceAtEdge} < ${g.minQuietModules}`,
    );
  }
});

test('the grooves all sit outside the label, never over the symbol', () => {
  const g = recordQrGeometry(25);
  assert.ok(g.innerGrooveRadius > g.labelRadius, 'innermost groove overlaps the label');
  assert.ok(g.discRadius > g.innerGrooveRadius, 'disc is smaller than its own grooves');
});

test('recordQrSvg draws one cell per dark module', () => {
  const qr = madeQr();
  const { svg } = recordQrSvg(qr, { paper: '#fff', ink: '#000', groove: '#888', label: 'Scan me' });

  let dark = 0;
  const n = qr.getModuleCount();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark++;

  const cells = svg.match(/M[-\d.]+ [-\d.]+h1v1h-1z/g) || [];
  assert.equal(cells.length, dark);
  // One path, not a shape per module, so touching modules merge instead
  // of showing anti-aliasing seams between them.
  assert.doesNotMatch(svg, /<rect /);
  assert.match(svg, /aria-label="Scan me"/);
});

test('recordQrSvg centres the symbol on the label', () => {
  const qr = madeQr();
  const { svg, geometry } = recordQrSvg(qr, { paper: '#fff', ink: '#000', groove: '#888', label: 'x' });
  const centre = geometry.viewBox / 2;
  const cells = [...svg.matchAll(/M([-\d.]+) ([-\d.]+)h1v1h-1z/g)];
  const xs = cells.map((m) => Number(m[1]));
  const ys = cells.map((m) => Number(m[2]));
  const span = (v) => (Math.min(...v) + Math.max(...v) + 1) / 2;
  assert.ok(Math.abs(span(xs) - centre) < 0.01, 'symbol is off centre horizontally');
  assert.ok(Math.abs(span(ys) - centre) < 0.01, 'symbol is off centre vertically');
});
