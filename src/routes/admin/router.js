import { requireAdmin } from '../../lib/auth.js';
import { adminNotFound } from './notFound.js';
import { isAdminHost, publicOriginFor } from '../../lib/hosts.js';
import { handleAdminQueue } from './queue.js';
import {
  handleEventList, handleEventNewForm, handleEventEditForm, handleEventCreate, handleEventUpdate,
  handleEventPublish, handleEventReject, handleEventRemove, handleEventRestore, handleEventDelete,
  handleEventReissueEditLink, handleEventRevokeEditLink, handleEventRerollFlyer, handleEventSetFlyerTemplate,
} from './events.js';
import { handleChangeList, handleChangeApprove, handleChangeReject } from './changes.js';
import { handleContactMessageList, handleContactMessageMarkDone } from './contactMessages.js';
import {
  handleCrewList, handleCrewNewForm, handleCrewEditForm, handleCrewCreate, handleCrewUpdate,
  handleCrewIssueKey, handleCrewRevokeKey,
} from './crews.js';
import {
  handleHarmReductionList, handleHarmReductionCreate, handleHarmReductionUpdate, handleHarmReductionIntroUpdate,
} from './harmReduction.js';
import { handleStats } from './stats.js';
import {
  handleInboundEmailList, handleInboundEmailView, handleInboundEmailAttachment,
  handleInboundEmailDismiss, handleInboundEmailConvert,
} from './inboundEmails.js';

/**
 * Cross-site request forgery guard for the admin's forms. Every admin
 * write is a plain form POST, and the Access session cookie is sent on
 * cross-site requests by default (its SameSite attribute is "None"
 * unless changed in the Access application), so a hidden form on any
 * other site could delete an event or rotate a crew key while the admin
 * is signed in. A browser's own form posts carry Sec-Fetch-Site
 * (same-origin) and Origin (this origin); anything else is refused.
 * Reads are unaffected.
 * @param {Request} request
 * @param {URL} url
 */
export function isCrossSiteWrite(request, url) {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return false;
  const site = request.headers.get('Sec-Fetch-Site');
  if (site) return site !== 'same-origin' && site !== 'none';
  const origin = request.headers.get('Origin');
  if (origin) return origin !== url.origin;
  // Neither header: not a browser form post, or an old browser. Refuse
  // rather than guess; the admin is only ever used from a browser.
  return true;
}

/**
 * Handles every /admin* and /admin/api* route. Section 10.1: Access
 * protects these paths at the edge, but the Worker independently verifies
 * the JWT and rejects the request if that verification fails, even if
 * Access is misconfigured.
 * @param {Request} request
 * @param {import('../../env.js').Env} env
 */
export async function adminRouter(request, env) {
  const admin = await requireAdmin(request, env);
  if (!admin) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (isCrossSiteWrite(request, url)) {
    return new Response('Forbidden: cross-site request', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  // Carried on the admin object every handler already receives, so the
  // shell can mark the current nav link without threading the request
  // through each page helper.
  admin.path = path;
  // Where the public site is, for links out of the admin ("View the site",
  // a new edit link): the same origin as before, or the public one when
  // the admin is on its own hostname (lib/hosts.js).
  admin.siteOrigin = isAdminHost(url) ? publicOriginFor(url) : url.origin;

  if (path === '/admin' && method === 'GET') return handleAdminQueue(request, env, admin);

  if (path === '/admin/events' && method === 'GET') return handleEventList(request, env, admin);
  if (path === '/admin/events/new' && method === 'GET') return handleEventNewForm(request, env, admin);
  if (path === '/admin/events/new' && method === 'POST') return handleEventCreate(request, env, admin);

  const eventEdit = path.match(/^\/admin\/events\/([^/]+)\/edit$/);
  if (eventEdit && method === 'GET') return handleEventEditForm(request, env, admin, eventEdit[1]);
  if (eventEdit && method === 'POST') return handleEventUpdate(request, env, admin, eventEdit[1]);

  const eventAction = path.match(/^\/admin\/events\/([^/]+)\/(publish|reject|remove|restore|delete|reissue-edit-link|revoke-edit-link|reroll-flyer|flyer-template)$/);
  if (eventAction && method === 'POST') {
    const [, id, action] = eventAction;
    const handlers = {
      publish: handleEventPublish, reject: handleEventReject, remove: handleEventRemove,
      restore: handleEventRestore, delete: handleEventDelete,
      'reissue-edit-link': handleEventReissueEditLink, 'revoke-edit-link': handleEventRevokeEditLink,
      'reroll-flyer': handleEventRerollFlyer, 'flyer-template': handleEventSetFlyerTemplate,
    };
    return handlers[action](request, env, admin, id);
  }

  if (path === '/admin/changes' && method === 'GET') return handleChangeList(request, env, admin);
  const changeAction = path.match(/^\/admin\/changes\/([^/]+)\/(approve|reject)$/);
  if (changeAction && method === 'POST') {
    const [, id, action] = changeAction;
    return action === 'approve' ? handleChangeApprove(request, env, admin, id) : handleChangeReject(request, env, admin, id);
  }

  if (path === '/admin/contact-messages' && method === 'GET') return handleContactMessageList(request, env, admin);
  const contactMessageDone = path.match(/^\/admin\/contact-messages\/([^/]+)\/done$/);
  if (contactMessageDone && method === 'POST') return handleContactMessageMarkDone(request, env, admin, contactMessageDone[1]);

  if (path === '/admin/crews' && method === 'GET') return handleCrewList(request, env, admin);
  if (path === '/admin/crews/new' && method === 'GET') return handleCrewNewForm(request, env, admin);
  if (path === '/admin/crews/new' && method === 'POST') return handleCrewCreate(request, env, admin);

  const crewEdit = path.match(/^\/admin\/crews\/([^/]+)\/edit$/);
  if (crewEdit && method === 'GET') return handleCrewEditForm(request, env, admin, crewEdit[1]);
  if (crewEdit && method === 'POST') return handleCrewUpdate(request, env, admin, crewEdit[1]);

  const crewKeyAction = path.match(/^\/admin\/crews\/([^/]+)\/(issue-key|revoke-key)$/);
  if (crewKeyAction && method === 'POST') {
    const [, id, action] = crewKeyAction;
    return action === 'issue-key' ? handleCrewIssueKey(request, env, admin, id) : handleCrewRevokeKey(request, env, admin, id);
  }

  if (path === '/admin/harm-reduction' && method === 'GET') return handleHarmReductionList(request, env, admin);
  if (path === '/admin/harm-reduction/new' && method === 'POST') return handleHarmReductionCreate(request, env, admin);
  if (path === '/admin/harm-reduction/intro' && method === 'POST') return handleHarmReductionIntroUpdate(request, env, admin);

  const harmReductionEdit = path.match(/^\/admin\/harm-reduction\/([^/]+)$/);
  if (harmReductionEdit && method === 'POST') return handleHarmReductionUpdate(request, env, admin, harmReductionEdit[1]);

  if (path === '/admin/stats' && method === 'GET') return handleStats(request, env, admin);

  if (path === '/admin/inbound-emails' && method === 'GET') return handleInboundEmailList(request, env, admin);

  const inboundEmailAttachment = path.match(/^\/admin\/api\/inbound-emails\/([^/]+)\/attachments\/(\d+)$/);
  if (inboundEmailAttachment && method === 'GET') {
    return handleInboundEmailAttachment(request, env, admin, inboundEmailAttachment[1], inboundEmailAttachment[2]);
  }

  const inboundEmailAction = path.match(/^\/admin\/inbound-emails\/([^/]+)\/(dismiss|convert)$/);
  if (inboundEmailAction && method === 'POST') {
    const [, id, action] = inboundEmailAction;
    return action === 'dismiss' ? handleInboundEmailDismiss(request, env, admin, id) : handleInboundEmailConvert(request, env, admin, id);
  }

  const inboundEmailView = path.match(/^\/admin\/inbound-emails\/([^/]+)$/);
  if (inboundEmailView && method === 'GET') return handleInboundEmailView(request, env, admin, inboundEmailView[1]);

  return adminNotFound(admin);
}
