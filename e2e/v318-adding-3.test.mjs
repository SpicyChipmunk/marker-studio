// v318 review (adding markers, 3 and 4): the welcome's Scan the caps says iPad or iPhone (Scan Text is on both), and on
// Android Gboard's Scan text, as Markers' Scan or type codes does; the privacy lines name photographing caps too.
// Fails on v318.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

test('Scan the caps: iPad or iPhone; the privacy line names photographing caps', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  assert.match(
    await page.textContent('.wcpriv'),
    /the camera is used only to scan or photograph caps, or to Match a colour\./,
  );
  await page.click('#wcOneByOne');
  assert.match(await page.textContent('#wcOneScan'), /On an iPad or iPhone: hold up each cap/);
  assert.deepEqual(errors, []);
});

test('Android: Gboard’s Scan text on the welcome and in Markers’ Add markers', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844, userAgent: ANDROID });
  await page.click('#wcOneByOne');
  assert.match(
    await page.textContent('#wcOneScan'),
    /With Gboard’s Scan text: photograph each cap and tap Insert/,
  );
  const m = await openApp({
    width: 820,
    height: 1180,
    userAgent: ANDROID,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await m.page.click('#mCollection');
  await idle(m.page);
  assert.match(await m.page.textContent('#mkcScan'), /scan caps with Gboard’s Scan text/);
  assert.deepEqual(errors.concat(m.errors), []);
});
