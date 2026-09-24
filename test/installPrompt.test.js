import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homePage } from '../src/templates/home.js';
import { layout } from '../src/templates/layout.js';
import { handleAdminQueue } from '../src/routes/admin/queue.js';

const noticeKey = (html) => (html.match(/data-install-prompt data-install-key="([^"]+)" hidden/) || [])[1];

test('the home page carries the install notice and its script, hidden until the script decides', () => {
  const body = String(homePage([]).body);
  assert.equal(noticeKey(body), 'cbr_install_prompt_dismissed');
  assert.match(body, /data-install-variant="prompt"/);
  assert.match(body, /data-install-variant="ios"/);
  assert.match(body, /Add to Home Screen/);
  assert.match(body, /\/js\/install-prompt\.js/);
});

test('other public pages get neither the notice nor its script', () => {
  const page = String(layout({ title: 'Crews', bodyContent: '<h1>Crews</h1>', path: '/crews' }));
  assert.doesNotMatch(page, /data-install-prompt/);
  assert.doesNotMatch(page, /install-prompt\.js/);
});

test('the admin queue offers the admin app, with its own name, icon and dismissal key', async () => {
  const count = { first: async () => ({ n: 0 }) };
  const env = { DB: { prepare: () => ({ ...count, bind: () => count }) } };
  const response = await handleAdminQueue(new Request('https://example.test/admin'), env, { email: 'a@b.c', path: '/admin' });
  const page = await response.text();
  assert.equal(noticeKey(page), 'cbr_admin_install_prompt_dismissed');
  assert.match(page, /Put CBR ADMIN on your home screen/);
  assert.match(page, /class="install-prompt-mark" src="\/icons\/record-admin\.svg"/);
  assert.match(page, /\/js\/install-prompt\.js/);
});
