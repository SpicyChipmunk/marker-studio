// v318.1: Help › Your data says a private window keeps nothing once it's closed. Fails on v318.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp } from './helpers.mjs';

before(setup);
after(teardown);

test('Help › Your data: a private window keeps nothing once closed', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await page.click('#homeHelp');
  await page.waitForSelector('#helpOverlay.on');
  await page.click('#helpData > summary');
  const t = await page.textContent('#helpData');
  assert.match(t, /In a private window \(Private Browsing\) everything is deleted when you close it\./);
  // (after the seven-day line it belongs with)
  assert.ok(t.indexOf('seven days') < t.indexOf('private window'));
  assert.deepEqual(errors, []);
});
