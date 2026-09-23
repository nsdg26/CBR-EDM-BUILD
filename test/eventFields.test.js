import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateEventFields, isHttpUrl, asFormDataLike, readEventFields, pickFields, locationRevealedAtFor, EDIT_LINK_FIELDS,
} from '../src/lib/eventFields.js';

test('validateEventFields rejects overly long fields', () => {
  const errors = validateEventFields({ title: 'a'.repeat(201) });
  assert.equal(errors.length, 1);
});

test('validateEventFields rejects a non-http(s) ticket URL', () => {
  const errors = validateEventFields({ ticket_url: 'javascript:alert(1)' });
  assert.ok(errors.some((e) => e.includes('Ticket URL')));
});

test('validateEventFields accepts valid fields', () => {
  const errors = validateEventFields({ title: 'Deep Signal', ticket_url: 'https://example.com/tickets' });
  assert.deepEqual(errors, []);
});

test('isHttpUrl accepts http/https and rejects other schemes', () => {
  assert.equal(isHttpUrl('https://example.com'), true);
  assert.equal(isHttpUrl('http://example.com'), true);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
  assert.equal(isHttpUrl('not a url'), false);
});

test('asFormDataLike lets a plain object be read with readEventFields', () => {
  const fields = readEventFields(asFormDataLike({ title: 'From JSON', start_at_local: '2026-03-14T22:00' }));
  assert.equal(fields.title, 'From JSON');
  assert.equal(fields.start_at, '2026-03-14T11:00:00.000Z');
});

test('readEventFields assumes https:// for a ticket URL typed without a scheme', () => {
  const fields = readEventFields(asFormDataLike({ ticket_url: 'cbredm.org' }));
  assert.equal(fields.ticket_url, 'https://cbredm.org');
});

test('readEventFields leaves an explicit scheme alone, http included', () => {
  assert.equal(readEventFields(asFormDataLike({ ticket_url: 'https://example.com' })).ticket_url, 'https://example.com');
  assert.equal(readEventFields(asFormDataLike({ ticket_url: 'http://example.com' })).ticket_url, 'http://example.com');
});

test('readEventFields leaves an empty ticket URL as null', () => {
  assert.equal(readEventFields(asFormDataLike({ ticket_url: '' })).ticket_url, null);
});

test('validateEventFields names the field that is too long', () => {
  const errors = validateEventFields({ venue_name: 'a'.repeat(201) });
  assert.deepEqual(errors, ['Venue name is too long (max 200 characters).']);
});

test('validateEventFields rejects an age restriction or status outside the CHECK constraints', () => {
  const fields = readEventFields(asFormDataLike({ age_restriction: 'over 21', status: 'maybe' }));
  assert.equal(validateEventFields(fields).length, 2);
});

test('pickFields keeps only the listed keys that are present', () => {
  assert.deepEqual(pickFields({ title: 'A', status: 'on', crew_id: null }, ['title', 'notes']), { title: 'A' });
});

test('an edit link change never carries status or crew_id', () => {
  const fields = readEventFields(asFormDataLike({ title: 'A' }));
  const stored = pickFields(fields, EDIT_LINK_FIELDS);
  assert.equal('status' in stored, false);
  assert.equal('crew_id' in stored, false);
  assert.equal(stored.title, 'A');
});

test('locationRevealedAtFor stamps a published TBA event getting a real venue', () => {
  const now = '2026-09-23T00:00:00.000Z';
  const existing = { visibility: 'published', location_tba: 1, location_revealed_at: null };
  assert.equal(locationRevealedAtFor(existing, { location_tba: 0, venue_name: 'Sideway' }, now), now);
  // Still TBA, not yet published, or no venue given: nothing to reveal.
  assert.equal(locationRevealedAtFor(existing, { location_tba: 1, venue_name: 'Sideway' }, now), null);
  assert.equal(locationRevealedAtFor({ ...existing, visibility: 'pending' }, { location_tba: 0, venue_name: 'Sideway' }, now), null);
  assert.equal(locationRevealedAtFor(existing, { location_tba: 0 }, now), null);
  // A status-only change leaves an earlier reveal alone.
  const earlier = '2026-09-20T00:00:00.000Z';
  assert.equal(locationRevealedAtFor({ ...existing, location_tba: 0, location_revealed_at: earlier }, { status: 'sold_out' }, now), earlier);
});
