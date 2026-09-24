import assert from 'node:assert/strict';
import { test } from 'node:test';
import { posterPage } from '../src/templates/poster.js';

test('posterPage embeds a real SVG QR code pointing at the home URL', () => {
  // Both artworks encode the same URL, they just draw it differently:
  // the record as one path of module squares, the plain QR as
  // qrcode.mjs's own single <path>.
  const record = String(posterPage('https://example.com/', 'a4'));
  assert.match(record, /<svg/);
  assert.match(record, /h1v1h-1z/);
  assert.match(record, /example\.com/);

  const plain = String(posterPage('https://example.com/', 'a4', 'plain'));
  assert.match(plain, /<svg/);
  assert.match(plain, /<path d="/);
  assert.match(plain, /example\.com/);
});

test('A6 prints four copies to an A4 sheet, with cut lines', () => {
  const page = String(posterPage('https://example.com/', 'a6'));
  // The page is A4 (in mm: Chrome doesn't know the A6 keyword, and the
  // old A6 page rule was dropped for the printer's default paper).
  assert.match(page, /@page \{ size: 210mm 297mm; margin: 0; \}/);
  assert.match(page, /width: 210mm/);
  assert.match(page, /height: 297mm/);
  assert.match(page, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.equal((page.match(/<div class="poster"/g) || []).length, 4);
  // One copy for screen readers, not four.
  assert.equal((page.match(/<div class="poster" aria-hidden="true">/g) || []).length, 3);
  assert.match(page, /class="cut cut--down"/);
  assert.match(page, /class="cut cut--across"/);
});

test('posterPage sizes the sheet and @page rule for A4', () => {
  const page = String(posterPage('https://example.com/', 'a4'));
  assert.match(page, /width: 210mm/);
  assert.match(page, /height: 297mm/);
  assert.match(page, /@page \{ size: 210mm 297mm; margin: 0; \}/);
  assert.equal((page.match(/<div class="poster"/g) || []).length, 1);
  assert.doesNotMatch(page, /class="cut /);
});

test('posterPage defaults to the record artwork and can switch to plain', () => {
  const recordPage = String(posterPage('https://example.com/', 'a4'));
  const plainPage = String(posterPage('https://example.com/', 'a4', 'plain'));

  // The record draws its symbol as one path of module squares and its
  // grooves as <circle>s; the plain QR is qrcode.mjs's own single <path>.
  assert.match(recordPage, /<circle/);
  assert.match(recordPage, /h1v1h-1z/);
  assert.doesNotMatch(plainPage, /<circle/);
  assert.match(plainPage, /<path d="/);

  // Each offers the other, keeping the chosen paper size.
  assert.match(recordPage, /href="\/poster\?size=a4&amp;style=plain"/);
  assert.match(plainPage, /href="\/poster\?size=a4&amp;style=record"/);
});

test('posterPage keeps the chosen artwork when switching paper size', () => {
  const page = String(posterPage('https://example.com/', 'a6', 'plain'));
  assert.match(page, /href="\/poster\?size=a4&amp;style=plain"/);
});

test('posterPage falls back to the record for an unknown style', () => {
  const page = String(posterPage('https://example.com/', 'a4', 'hologram'));
  assert.match(page, /Artwork: Record\./);
});

test("the plain QR is drawn in the sheet's paper and toner, not a white box", () => {
  const page = String(posterPage('https://example.com/', 'a4', 'plain'));
  assert.doesNotMatch(page, /fill="white"/);
  assert.doesNotMatch(page, /fill="black"/);
  assert.match(page, /fill="#d9d8d2"/);
  assert.match(page, /fill="#141312"/);
});
