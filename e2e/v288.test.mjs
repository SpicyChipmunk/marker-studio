// v288: the tool row's one-time names on a phone (the tip queue: one line at a time, after the first-time hints);
// Random's words without "pool"; Reset progress with one verb.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, letterGuide, idle, welcome, ROOT, notOnWebKit, WK } from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

const seen = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ms-seen-hints') || '[]'));

test('phone: once the first-time hints are seen, a one-time line names Codes, Greyscale and Full screen; not beside the sample’s line; ✕ closes it', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp({ storage: { 'ms-seen-hints': '["tap","along"]' } });
  await sampleGuide(page);
  assert.equal(await page.isVisible('#sfSampleNote'), true);
  assert.equal(await page.locator('#sfToolTip').count(), 0, 'one line at a time: the sample’s first');
  await letterGuide(page);
  assert.equal(await page.isVisible('#sfToolTip'), true);
  assert.equal((await page.textContent('#sfToolTip > span')).trim(), 'Under the picture: Codes shows the marker codes, Greyscale the picture in greys, and Full screen fills the screen.');
  assert.ok((await seen(page)).includes('tools'));
  // it stays through the visit (other tabs and back), then ✕ closes it
  await page.click('#sfTab-pattern'); await page.click('#sfTab-colours'); await idle(page);
  assert.equal(await page.isVisible('#sfToolTip'), true);
  await page.click('#sfToolTipX'); await idle(page);
  assert.equal(await page.locator('#sfToolTip').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'sfTab-colours');
  await page.click('#sfTab-pattern'); await page.click('#sfTab-colours'); await idle(page);
  assert.equal(await page.locator('#sfToolTip').count(), 0, 'closed stays closed');
  assert.deepEqual(errors, []);
});

test('a guide’s first visit says "Tap a section" first; and where the row has its words (iPad) there’s no tool line', notOnWebKit(WK.photo), async () => {
  {
    const { page, errors } = await openApp();
    await sampleGuide(page); await letterGuide(page);
    assert.equal(await page.locator('#sfToolTip').count(), 0, 'waits for a later visit');
    assert.ok(!(await seen(page)).includes('tools'));
    assert.deepEqual(errors, []);
  }
  {
    const { page, errors } = await openApp({ width: 834, height: 1194, storage: { 'ms-seen-hints': '["tap","along"]' } });
    await sampleGuide(page); await letterGuide(page);
    assert.equal(await page.locator('#sfToolTip').count(), 0);
    assert.equal(await page.isVisible('#sfCodes .sfzw'), true, 'the words are on the row');
    assert.deepEqual(errors, []);
  }
});

test('Random says what is left to draw, and a drawn marker is put back (no "pool")', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#mPalette');
  await page.evaluate(() => { state.mode = 'random'; save(); fullRender(); }); await idle(page);
  await page.click('#draw'); await idle(page);
  const st = await page.textContent('#status');
  assert.match(st, /^1 drawn, \d+ left to draw$/);
  assert.match(await page.getAttribute('#pile .cell', 'aria-label'), /, put it back$/);
  assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /pool/i);
  assert.deepEqual(errors, []);
});

test('Home’s New colouring guide: the first time, the Guide screen’s card; with guides made, the picker straight from Home, which stays until a photo is chosen', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mHome'); await idle(page);
  let opened = false;
  page.on('filechooser', () => { opened = true; });
  await page.click('#homeNew'); await idle(page);
  assert.equal(opened, false, 'first time: no picker');
  assert.equal(await page.isVisible('#sfStart'), true, 'the card');
  // a guide made: the picker opens from Home
  await letterGuide(page);
  await page.waitForFunction(() => state.saved.some((s) => s.type === 'guide'));
  await page.click('#mHome'); await idle(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#homeNew')]);
  await idle(page);
  assert.equal(await page.isVisible('#homeView'), true, 'Home stays while the picker is open');
  const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  await fc.setFiles({ name: 'two.png', mimeType: 'image/png', buffer: buf });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  assert.equal(await page.isVisible('#homeView'), false, 'then the Guide screen, reading the photo');
  assert.deepEqual(errors, []);
});

test('a saved palette chosen for the next guide shows under Home’s New colouring guide, and ✕ there stops using it', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mPalette'); await page.click('#draw'); await idle(page);
  await page.click('#useInGuide');
  await page.waitForFunction(() => __mstest.styleVars.paletteSource === 'saved');
  await page.click('#mHome'); await idle(page);
  assert.match(await page.textContent('#homePalNote'), /^Using “.+”\d+ markers · for your next new guide$/);
  await page.click('#homePalNote [data-clearpal]'); await idle(page);
  assert.equal((await page.textContent('#homePalNote')).trim(), '');
  assert.equal(await page.evaluate(() => __mstest.styleVars.paletteSource), 'owned');
  assert.deepEqual(errors, []);
});

test('the markers on this page: a list lightest first with a Done to close it by touch; a row lights up its sections', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  assert.match(await page.textContent('#sfMkList'), /^16 markers on this page/);
  await page.click('#sfMkList'); await page.waitForSelector('#sfSheet', { state: 'visible' }); await idle(page);
  assert.equal(await page.textContent('#sfSheetT'), '16 markers on this page');
  const rows = await page.$$eval('#sfSheet button.sfmlrow', (b) => b.map((x) => x.dataset.k));
  assert.equal(rows.length, 16);
  await page.click('#sfSheet button.sfmlrow'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.hlKey), rows[0], 'its sections lit up');
  await page.click('#sfSheet [data-ml="done"]'); await idle(page);
  assert.equal(await page.isVisible('#sfSheet'), false, 'Done closes it');
  assert.equal(await page.evaluate(() => __mstest.hlKey), null, 'and the plan shows as before');
  assert.deepEqual(errors, []);
});

test('Focus mode by keyboard: Tab goes through the top bar, Greyscale, −, + (and Fit when zoomed) and the bottom bar, in that order', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfColor'); await idle(page);
  await page.focus('#sfFocus'); await page.keyboard.press('Enter'); await idle(page);
  const seen = [];
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); seen.push(await page.evaluate(() => document.activeElement.id || document.activeElement.className)); }
  for (const id of ['sfVals', 'sfZout', 'sfZin', 'sfFDone']) assert.ok(seen.includes(id), id + ' reached: ' + seen.join(' '));
  assert.ok(seen.indexOf('sfVals') < seen.indexOf('sfZin') && seen.indexOf('sfZin') < seen.indexOf('sfFDone'), 'in order: ' + seen.join(' '));
  assert.deepEqual(errors, []);
});
