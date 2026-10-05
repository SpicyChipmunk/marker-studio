// The welcome (first run): picking a set, the brand tabs, not coming back after the first run, its layout at large
// text sizes, and where focus goes after Try the sample.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, welcome, shot, ROOT, idle, openAtScale } from './helpers.mjs';

before(setup);
after(teardown);

test('first run: pick a set, then Home shows the collection, Library and the build number', async () => {
  const { page, errors } = await openApp();
  assert.ok(await page.isVisible('#welcome'));
  await welcome(page, 'look');
  assert.ok(!(await page.isVisible('#welcome')));
  assert.ok(await page.evaluate(() => state.owned.size) > 100);
  await page.click('#mHome');
  assert.equal(await page.textContent('#homeLibSub'), 'Nothing yet');
  const sw = (await readFile(join(ROOT, 'service-worker.js'), 'utf8')).match(/marker-studio-(v\d+(?:\.\d+)?)/)[1];
  assert.equal(await page.textContent('#appVer'), sw);
  await page.click('#homeLibCard');
  assert.ok(await page.evaluate(() => savedOverlay.classList.contains('on')));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#homeImport')]);
  assert.ok(fc, 'Import a guide file opens the file picker');
  await shot(page, 'library-empty');
  assert.deepEqual(errors, []);
});

test('the welcome dialog does not come back after the first run', async () => {
  const { page } = await openApp();
  await welcome(page, 'look');
  await page.reload();
  assert.ok(!(await page.isVisible('#welcome')));
});

// ---- From UX release 1 (v260) ----
test('Welcome: the Copic tab jumps to the Copic sets', async () => {
  const { page, errors } = await openApp();
  await page.click('.wcbrands [data-b="Copic"]'); await idle(page);
  const r = await page.evaluate(() => { const s = document.getElementById('wcSets'), h = [...s.querySelectorAll('.presetbrand')].find((x) => x.textContent === 'Copic'), a = h.getBoundingClientRect(), b = s.getBoundingClientRect(); return { top: a.top - b.top, on: document.querySelector('.wcbrands button.on').dataset.b }; });
  assert.ok(r.top >= -2 && r.top < 30, `Copic heading at the top of the list (${r.top})`);
  assert.equal(r.on, 'Copic');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (guide screen) ----
test('after the welcome\'s Try the sample, focus is on the guide\'s name, not the page', async () => {
  const { page, errors } = await openApp();
  await page.check('#wcSets input[data-i="3"]'); await page.click('#wcAdd');
  await page.focus('#wcSample'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData)); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfGTitle');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), await page.textContent('#sfGTitle'));
  // Tab goes on from there into the header
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfRename');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const SHOTS = process.env.SHOTS || '';// a folder: the layout tests save their screenshots there
async function shotToDir(page, name) { if (!SHOTS) return; await mkdir(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/g3-${name}.png` }); }

for (const [w, h, scale] of [[844, 390, 1], [375, 667, 1.6], [360, 740, 1.6]]) {
  test(`Welcome at ${w}×${h}, ${scale}x: its buttons are on screen without scrolling; brands are a boxed group`, async () => {
    const { page, errors } = await openAtScale(scale, { width: w, height: h });
    await page.waitForSelector('#welcome.on');
    const vis = await page.evaluate(() => { const card = document.querySelector('.wcard').getBoundingClientRect(); return ['wcAdd', 'wcSkip', 'wcRestore'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { id, ok: r.top >= card.top && r.bottom <= card.bottom + 0.5 && r.bottom <= innerHeight && r.height > 0 }; }); });
    for (const v of vis) assert.ok(v.ok, v.id + ' is visible');
    assert.equal(await page.evaluate(() => document.querySelector('.wcard').scrollTop), 0);
    const st = await page.evaluate(() => { const g = getComputedStyle(document.querySelector('.wcbrands')), b = getComputedStyle(document.querySelector('.wcbrands button')); return { gb: g.borderTopWidth, bb: b.borderTopWidth, br: b.borderTopLeftRadius }; });
    assert.deepEqual(st, { gb: '1px', bb: '0px', br: '8px' }, 'like .segs');
    assert.match(await page.getAttribute('#wcFile', 'accept'), /\.txt/);
    await shotToDir(page, `welcome-${w}x${h}-${scale}x`);
    // the list scrolls above the pinned buttons
    await page.check('#wcSets input[data-i="3"]');
    assert.match(await page.textContent('#wcAdd'), /^Add \d+ markers$/);
    assert.deepEqual(errors, []);
  });
}
