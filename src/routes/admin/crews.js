import { adminLayout } from '../../templates/admin/layout.js';
import { crewListPage, crewFormPage } from '../../templates/admin/crews.js';
import { generateId, slugify } from '../../lib/ids.js';
import { generateToken, hashToken } from '../../lib/tokens.js';
import { adminNotFound } from './notFound.js';

function page(admin, title, body) {
  return new Response(String(adminLayout({ title, bodyContent: body, email: admin.email, path: admin.path, siteOrigin: admin.siteOrigin })), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function handleCrewList(request, env, admin) {
  const { results } = await env.DB.prepare('SELECT * FROM crews ORDER BY name').all();
  return page(admin, 'Crews', crewListPage(results));
}

export async function handleCrewNewForm(request, env, admin) {
  return page(admin, 'Add a crew', crewFormPage({}));
}

export async function handleCrewEditForm(request, env, admin, id) {
  const crew = await env.DB.prepare('SELECT * FROM crews WHERE id = ?').bind(id).first();
  if (!crew) return adminNotFound(admin);
  return page(admin, `Edit: ${crew.name}`, crewFormPage(crew));
}

function readCrewFields(formData) {
  const name = (formData.get('name') || '').trim().slice(0, 200);
  return {
    name,
    // Always a slug, whatever was typed: a "/" or a space in it made the
    // crew's /crews/:slug page unreachable, and an empty name gave an
    // empty slug that the UNIQUE index refused the second time as a 500.
    slug: slugify(formData.get('slug') || name),
    blurb: (formData.get('blurb') || '').slice(0, 2000) || null,
    trusted: formData.get('trusted') ? 1 : 0,
    listed: formData.get('listed') ? 1 : 0,
  };
}

/**
 * What stops a crew being saved, if anything: a name and a usable slug,
 * and a slug no other crew already has.
 * @param {import('../../env.js').Env} env
 * @param {{ name: string, slug: string }} fields
 * @param {string|null} ownId - the crew being edited, so its own slug doesn't count as taken
 */
async function crewFieldErrors(env, fields, ownId) {
  const errors = [];
  if (!fields.name) errors.push('A crew needs a name.');
  if (!fields.slug) errors.push('The slug needs at least one letter or number.');
  if (fields.slug) {
    const taken = await env.DB.prepare('SELECT id FROM crews WHERE slug = ? AND id != ?').bind(fields.slug, ownId || '').first();
    if (taken) errors.push(`Another crew already uses the slug "${fields.slug}".`);
  }
  return errors;
}

export async function handleCrewCreate(request, env, admin) {
  const formData = await request.formData();
  const fields = readCrewFields(formData);
  const errors = await crewFieldErrors(env, fields, null);
  if (errors.length) return page(admin, 'Add a crew', crewFormPage(fields, { errors }));
  const now = new Date().toISOString();
  const id = generateId('crw');

  await env.DB.prepare(
    'INSERT INTO crews (id, slug, name, blurb, links_json, trusted, listed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, fields.slug, fields.name, fields.blurb, '[]', fields.trusted, fields.listed, now, now).run();

  return Response.redirect(new URL(`/admin/crews/${id}/edit`, request.url), 303);
}

export async function handleCrewUpdate(request, env, admin, id) {
  const crew = await env.DB.prepare('SELECT * FROM crews WHERE id = ?').bind(id).first();
  if (!crew) return adminNotFound(admin);

  const formData = await request.formData();
  const fields = readCrewFields(formData);
  const errors = await crewFieldErrors(env, fields, id);
  if (errors.length) return page(admin, `Edit: ${fields.name || 'crew'}`, crewFormPage({ ...crew, ...fields }, { errors }));

  await env.DB.prepare(
    'UPDATE crews SET name = ?, slug = ?, blurb = ?, trusted = ?, listed = ?, updated_at = ? WHERE id = ?',
  ).bind(fields.name, fields.slug, fields.blurb, fields.trusted, fields.listed, new Date().toISOString(), id).run();

  return Response.redirect(new URL(`/admin/crews/${id}/edit`, request.url), 303);
}

/**
 * POST /admin/crews/:id/issue-key. Also used to rotate: issuing a new key
 * immediately invalidates any previous one, since only the hash is stored.
 */
export async function handleCrewIssueKey(request, env, admin, id) {
  const crew = await env.DB.prepare('SELECT * FROM crews WHERE id = ?').bind(id).first();
  if (!crew) return adminNotFound(admin);

  const key = generateToken();
  const keyHash = await hashToken(key);

  await env.DB.prepare('UPDATE crews SET key_hash = ?, key_issued_at = ?, updated_at = ? WHERE id = ?')
    .bind(keyHash, new Date().toISOString(), new Date().toISOString(), id).run();

  return page(admin, `Edit: ${crew.name}`, crewFormPage({ ...crew, key_hash: keyHash }, { newKey: key }));
}

export async function handleCrewRevokeKey(request, env, admin, id) {
  const crew = await env.DB.prepare('SELECT id FROM crews WHERE id = ?').bind(id).first();
  if (!crew) return adminNotFound(admin);

  await env.DB.prepare('UPDATE crews SET key_hash = NULL, updated_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), id).run();

  return Response.redirect(new URL(`/admin/crews/${id}/edit`, request.url), 303);
}
