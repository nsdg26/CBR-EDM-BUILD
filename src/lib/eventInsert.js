import { eventSlugFor } from './ids.js';

const SLUG_ATTEMPTS = 3;

/**
 * Whether a D1 error is the events.slug UNIQUE index refusing a row.
 * @param {unknown} err
 */
export function isSlugCollision(err) {
  return /UNIQUE constraint failed: events\.slug/i.test(String(err?.message || err));
}

/**
 * Runs an INSERT INTO events with a fresh slug, and once more with a new
 * suffix if the slug collides. The slug's random suffix is four hex
 * characters, so two events with the same title on the same day collide
 * about once in 65,000 submissions, and a collision used to surface as a
 * 500 after the visitor had already passed the Turnstile check.
 * @param {(slug: string) => { run: () => Promise<unknown> }} prepare -
 *   builds the bound statement for a given slug
 * @param {string|null} title
 * @param {string|null} startAt
 * @returns {Promise<string>} the slug that was stored
 */
export async function insertEventWithSlug(prepare, title, startAt) {
  for (let attempt = 1; ; attempt++) {
    const slug = eventSlugFor(title, startAt);
    try {
      await prepare(slug).run();
      return slug;
    } catch (err) {
      if (!isSlugCollision(err) || attempt >= SLUG_ATTEMPTS) throw err;
    }
  }
}
