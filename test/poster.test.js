import assert from 'node:assert/strict';
import { test } from 'node:test';
import { posterPage } from '../src/templates/poster.js';

test('posterPage embeds a real SVG QR code pointing at the home URL', () => {
  // Both artworks encode the same URL, they just draw it differently:
  // the record as one <rect> per dark module, the plain QR as
  // qrcode.mjs's own single <path>.
  const record = String(posterPage('https://example.com/', 'a4'));
  assert.match(record, /<svg/);
  assert.match(record, /<rect /);
  assert.match(record, /example\.com/);

  const plain = String(posterPage('https://example.com/', 'a4', 'plain'));
  assert.match(plain, /<svg/);
  assert.match(plain, /<path d="/);
  assert.match(plain, /example\.com/);
});

test('posterPage sizes the sheet and @page rule for A6', () => {
  const page = String(posterPage('https://example.com/', 'a6'));
  assert.match(page, /width: 105mm/);
  assert.match(page, /height: 148mm/);
  assert.match(page, /@page \{ size: A6/);
});

test('posterPage sizes the sheet and @page rule for A4', () => {
  const page = String(posterPage('https://example.com/', 'a4'));
  assert.match(page, /width: 210mm/);
  assert.match(page, /height: 297mm/);
  assert.match(page, /@page \{ size: A4/);
});

test('posterPage defaults to the record artwork and can switch to plain', () => {
  const recordPage = String(posterPage('https://example.com/', 'a4'));
  const plainPage = String(posterPage('https://example.com/', 'a4', 'plain'));

  // The record draws its symbol as <rect> cells and its grooves as
  // <circle>s; the plain QR is qrcode.mjs's own single <path>.
  assert.match(recordPage, /<circle/);
  assert.match(recordPage, /<rect /);
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
