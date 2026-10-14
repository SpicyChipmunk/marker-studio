// v318 review: Back across the main tabs. Guide, Markers and Palette sit one Back step above Home (the way a phone's
// apps with tabs go back): Back from any of them is Home, however many tabs were visited; from Home it leaves the app as
// before. What is open on top closes first, one each; Random goes back to Markers first; Escape never changes tabs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, notOnWebKit, WK } from './helpers.mjs';

before(setup);
after(teardown);

const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
const mode = (page) => page.evaluate(() => state.mode);
const layer = (page) => page.evaluate(() => (history.state && history.state.msLayer) || 0);
const back = async (page) => {
  await page.goBack({ waitUntil: 'commit' }).catch(() => {});
  await page.waitForTimeout(150);
  await idle(page);
};
// (the entries are made a frame after a change)
const settled = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test('Back from Markers, Palette or Guide is Home, one step whatever was visited; then nothing left', notOnWebKit(WK.back), async () => {
  const { page, errors } = await openApp({ storage: ONB });
  const url = page.url();
  assert.equal(await mode(page), 'home');
  for (const go of [['#mCollection'], ['#mPalette'], ['#mCollection', '#mPalette', '#mSections']]) {
    for (const s of go) {
      await page.click(s);
      await idle(page);
    }
    await settled(page);
    assert.equal(await layer(page), 1, go.join(' › ') + ': one entry');
    await back(page);
    assert.equal(await mode(page), 'home', go.join(' › ') + ' then Back: Home');
    assert.equal(page.url(), url, 'still in the app');
    assert.equal(await layer(page), 0, 'nothing left for Back');
  }
  assert.deepEqual(errors, []);
});

test('what is open on a tab closes first: a dialog over Palette, Colour along over the Plan; Random goes to Markers', notOnWebKit(WK.back), async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ONB });
  // the Library over Palette
  await page.click('#mPalette');
  await idle(page);
  await page.evaluate(() => openLibrary());
  await idle(page);
  await settled(page);
  assert.equal(await layer(page), 2);
  await back(page);
  assert.equal(await page.isVisible('#savedOverlay'), false, 'the Library first');
  assert.equal(await mode(page), 'palette');
  await back(page);
  assert.equal(await mode(page), 'home', 'then Home');
  // Colour along, then the Plan, then Home
  await page.click('#mSections');
  await idle(page);
  await page.evaluate(() => SF.loadSample());
  await page.waitForFunction(() => window.__mstest && __mstest.assignData && __mstest.sfmode === 'guide');
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await settled(page);
  await back(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide', 'Colour along first, to the Plan');
  assert.equal(await mode(page), 'sections');
  await back(page);
  assert.equal(await mode(page), 'home');
  // Random, opened from Markers
  await page.click('#mCollection');
  await idle(page);
  await page.click('#mkDrawBtn');
  await idle(page);
  assert.equal(await mode(page), 'random');
  await back(page);
  assert.equal(await mode(page), 'collection', 'Random goes back to Markers');
  await back(page);
  assert.equal(await mode(page), 'home');
  assert.deepEqual(errors, []);
});

test('Escape never changes tabs', async () => {
  const { page, errors } = await openApp({ storage: ONB });
  await page.click('#mCollection');
  await idle(page);
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await mode(page), 'collection');
  assert.deepEqual(errors, []);
});

test('reloaded on Markers (which the app opens on again): Back is Home, and then nothing is left, with no step that does nothing', notOnWebKit(WK.back), async () => {
  const { page, errors } = await openApp({ storage: ONB });
  const url = page.url();
  await page.click('#mCollection');
  await idle(page);
  await settled(page);
  await page.reload();
  await idle(page);
  await settled(page);
  assert.equal(await mode(page), 'collection');
  assert.equal(await layer(page), 1, 'the entry it was on is Markers’, not one more on top');
  await back(page);
  assert.equal(await mode(page), 'home');
  assert.equal(page.url(), url);
  assert.equal(await layer(page), 0, 'nothing left for Back');
  assert.deepEqual(errors, []);
});
