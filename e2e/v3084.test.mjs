// v308.4: the page lock under an open dialog (v308.1) lets go while a box in the dialog is being typed in. On an
// iPad the keyboard, or Scan Text's camera in its place, needs the page free: held, Scan Text stopped after the first
// cap it read, until Scan was closed and opened again.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle } from './helpers.mjs';

before(setup);
after(teardown);

const held = (page) => page.evaluate(() => document.documentElement.classList.contains('ms-ovl'));
const scanText = (page, t) =>
  page.evaluate((t) => {
    const b = document.getElementById('scBox');
    b.value = t;
    b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
  }, t);

test('Scan: the page is not held while its box has the keyboard, cap after cap; held again when the box is let go of', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-scan-brand': '' } });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await idle(page);
  await page.click('#scanOpen');
  await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'scBox', 'straight into the box');
  assert.equal(await held(page), false, 'not held while the box has the keyboard');
  await scanText(page, 'B015 Celadon Blue');
  await page.waitForTimeout(1200);
  assert.equal(await held(page), false, 'still free after the first cap');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'scBox');
  await scanText(page, 'E19 Dried Sage');
  await page.waitForTimeout(1200);
  assert.deepEqual(
    await page.$$eval('#scList .sccode', (l) => l.map((x) => x.textContent)),
    ['E19', 'B015'],
    'the second cap read too',
  );
  // the box let go of (a tap on the dialog's title): held, as any dialog is
  await page.evaluate(() => document.getElementById('scBox').blur());
  await page.waitForTimeout(50);
  assert.equal(await held(page), true, 'held once the box is let go of');
  await page.focus('#scBox');
  assert.equal(await held(page), false, 'free again in the box');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await held(page), false, 'let go when Scan closes');
  assert.deepEqual(errors, []);
});

test('the Library still holds the page; its search box, while typed in, does not', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#savedOverlay.on');
  await idle(page);
  if (await page.evaluate(() => document.activeElement && document.activeElement.tagName === 'INPUT'))
    await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(50);
  assert.equal(await held(page), true);
  const search = await page.$('#savedOverlay input[type="search"], #savedOverlay input[type="text"]');
  if (search) {
    await search.focus();
    assert.equal(await held(page), false);
  }
  assert.deepEqual(errors, []);
});
