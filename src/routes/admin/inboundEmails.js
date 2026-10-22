import { adminLayout } from '../../templates/admin/layout.js';
import { inboundEmailListPage, inboundEmailViewPage } from '../../templates/admin/inboundEmails.js';
import { generateId } from '../../lib/ids.js';
import { insertEventWithSlug } from '../../lib/eventInsert.js';
import { adminNotFound } from './notFound.js';

function page(admin, title, body) {
  return new Response(String(adminLayout({ title, bodyContent: body, email: admin.email, path: admin.path, siteOrigin: admin.siteOrigin })), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function handleInboundEmailList(request, env, admin) {
  const { results } = await env.DB.prepare('SELECT * FROM inbound_emails ORDER BY received_at DESC').all();
  return page(admin, 'Inbound emails', inboundEmailListPage(results));
}

export async function handleInboundEmailView(request, env, admin, id) {
  const emailRow = await env.DB.prepare('SELECT * FROM inbound_emails WHERE id = ?').bind(id).first();
  if (!emailRow) return adminNotFound(admin);
  return page(admin, emailRow.subject || 'Inbound email', inboundEmailViewPage(emailRow));
}

/**
 * GET /admin/api/inbound-emails/:id/attachments/:index. Section 10.5:
 * attachments are stored raw in R2 but never served publicly; this route
 * is admin-only (gated by the admin router itself).
 */
export async function handleInboundEmailAttachment(request, env, admin, id, index) {
  const emailRow = await env.DB.prepare('SELECT attachments_json FROM inbound_emails WHERE id = ?').bind(id).first();
  if (!emailRow) return adminNotFound(admin);

  const attachments = parseAttachments(emailRow.attachments_json);
  const attachment = attachments[Number(index)];
  if (!attachment) return new Response('Not found', { status: 404 });

  const object = await env.FLYERS.get(attachment.r2_key);
  if (!object) return new Response('Not found', { status: 404 });

  // The content type is whatever the sender claimed, and this is served
  // from the site's own origin to a signed-in admin. An emailed SVG (which
  // counts as image/*) can carry a <script>, and opening its URL directly
  // would run it with the admin's session. The sandbox CSP stops any
  // script in the file, and nosniff stops a browser second-guessing the
  // type. Neither affects the <img> previews the admin pages show.
  return new Response(object.body, {
    headers: {
      'Content-Type': attachment.content_type,
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * POST /admin/inbound-emails/:id/dismiss. A dismissed email's attachments
 * are deleted from R2 too: nothing will ever show them again, and the
 * bucket otherwise keeps every image ever sent to the address.
 */
export async function handleInboundEmailDismiss(request, env, admin, id) {
  const emailRow = await env.DB.prepare('SELECT id, attachments_json FROM inbound_emails WHERE id = ?').bind(id).first();
  if (!emailRow) return adminNotFound(admin);

  const attachments = parseAttachments(emailRow.attachments_json);
  const keys = attachments.map((attachment) => attachment.r2_key).filter(Boolean);
  if (keys.length) {
    try {
      await env.FLYERS.delete(keys);
    } catch (err) {
      // The dismissal still goes through; a stray object is only storage.
      console.error(`Could not delete attachments for ${id}`, err);
    }
  }

  await env.DB.prepare("UPDATE inbound_emails SET state = 'dismissed', attachments_json = '[]' WHERE id = ?").bind(id).run();
  return Response.redirect(new URL('/admin/inbound-emails', request.url), 303);
}

function parseAttachments(json) {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * POST /admin/inbound-emails/:id/convert. Section 10.6: opens the event
 * form pre-filled (subject as title). The first image attachment, if any,
 * is shown for reference on the event edit page -- the flyer itself is
 * always the generated contour map, owner request: uploads are gone.
 *
 * The sender's address goes into submitter_contact, the private field
 * the admin form shows and nothing public ever renders. It used to be
 * written into the notes, which are published with the event, so an
 * email converted and published as-is put the sender's address on the
 * public event page (section 12).
 */
export async function handleInboundEmailConvert(request, env, admin, id) {
  const emailRow = await env.DB.prepare('SELECT * FROM inbound_emails WHERE id = ?').bind(id).first();
  if (!emailRow) return adminNotFound(admin);

  const now = new Date().toISOString();
  const eventId = generateId('evt');
  const submitterContact = emailRow.from_address ? `Emailed from ${emailRow.from_address}`.slice(0, 300) : null;

  await insertEventWithSlug((slug) => env.DB.prepare(
    `INSERT INTO events (id, slug, title, submitter_contact, age_restriction, status, visibility, source, sequence, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'unknown', 'on', 'pending', 'admin', 0, ?, ?)`,
  ).bind(eventId, slug, emailRow.subject || null, submitterContact, now, now), emailRow.subject, null);

  await env.DB.prepare("UPDATE inbound_emails SET state = 'converted', event_id = ? WHERE id = ?")
    .bind(eventId, id).run();

  const attachments = parseAttachments(emailRow.attachments_json);
  const redirectUrl = new URL(`/admin/events/${eventId}/edit`, request.url);
  if (attachments.length) redirectUrl.searchParams.set('from_email', id);

  return Response.redirect(redirectUrl, 303);
}
