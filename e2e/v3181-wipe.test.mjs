// v318.1: Delete all my data takes the photo reader's download (its own cache, about 22 MB) with it; the app's own
// files and PDF.js's stay, for the welcome it starts again at. Fails on v318.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = {
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  [KEY]: JSON.stringify({
    mode: 'home',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned: ['Ohuhu|R014'],
    saved: [],
  }),
};

test('Delete all my data: the photo reader’s cache goes too; the app’s and PDF.js’s stay', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded });
  const names = await page.evaluate(async () => {
    for (const n of [OCR_CACHE, 'marker-studio-v318', 'marker-studio-pdfjs-test']) {
      const c = await caches.open(n);
      await c.put(new Request(location.origin + '/' + n + '.bin'), new Response('x'));
    }
    return caches.keys();
  });
  assert.ok(names.includes('marker-studio-ocr-1'), names.join(' '));
  await page.click('#homeHelp');
  await page.waitForSelector('#helpOverlay.on');
  await page.click('#helpData > summary');
  assert.match(await page.textContent('#helpData'), /and the photo reader if you downloaded it\./);
  await page.click('#helpWipe');
  await page.waitForSelector('#sfEdAsk');
  await page.fill('#wipeWord', 'DELETE');
  await Promise.all([page.waitForEvent('load'), page.click('#wipeGo')]);
  await idle(page);
  const left = await page.evaluate(() => caches.keys());
  assert.ok(!left.includes('marker-studio-ocr-1'), left.join(' '));
  assert.ok(left.includes('marker-studio-v318') && left.includes('marker-studio-pdfjs-test'), left.join(' '));
  assert.equal(await page.evaluate(() => state.owned.size), 0);
  assert.deepEqual(errors, []);
});
