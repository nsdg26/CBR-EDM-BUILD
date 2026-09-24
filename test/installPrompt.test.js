import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homePage } from '../src/templates/home.js';
import { layout } from '../src/templates/layout.js';

test('the home page carries the install notice, hidden until the script decides', () => {
  const body = String(homePage([]).body);
  assert.match(body, /<aside class="install-prompt" data-install-prompt hidden/);
  assert.match(body, /data-install-variant="prompt"/);
  assert.match(body, /data-install-variant="ios"/);
  assert.match(body, /Add to Home Screen/);
});

test('other pages get neither the notice nor its script', () => {
  const page = String(layout({ title: 'Crews', bodyContent: '<h1>Crews</h1>', path: '/crews' }));
  assert.doesNotMatch(page, /data-install-prompt/);
  assert.doesNotMatch(page, /install-prompt\.js/);
});
