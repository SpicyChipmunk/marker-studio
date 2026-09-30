// The Markers screen: ticking markers in place, details on press and hold and by keyboard, the marker sheet, the tick
// wording, and the ⓘ hint above the grid.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle, longPress } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From UX release 1 (v260) ----
test('Markers: unticking keeps the marker in place until the list is redrawn; press and hold shows its details', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mCollection'); await idle(page);
  const order = () => page.evaluate(() => [...document.querySelectorAll('#results .cell')].slice(0, 6).map((c) => +c.dataset.i));
  const before = await order();
  await page.click(`#results .cell[data-i="${before[1]}"]`); await idle(page);
  assert.deepEqual(await order(), before, 'nothing moved');
  // (the idle() after the tap has already let any long-press timer run out, so the details would be open by now)
  assert.ok(!(await page.isVisible('#mkOverlay')), 'a quick tap does not open the details');
  assert.ok(await page.evaluate((i) => document.querySelector(`#results .cell[data-i="${i}"]`).classList.contains('notown'), before[1]), 'shown as unticked');
  assert.equal(await page.evaluate((i) => isOwned(i), before[1]), false);
  // tapping it again ticks it back, still in place
  await page.click(`#results .cell[data-i="${before[1]}"]`); await idle(page);
  assert.equal(await page.evaluate((i) => isOwned(i), before[1]), true);
  // untick, then a search redraws the list without it
  await page.click(`#results .cell[data-i="${before[2]}"]`); await idle(page);
  await page.fill('#q', 'r'); await page.fill('#q', ''); await idle(page);
  assert.ok(!(await order()).includes(before[2]), 'gone after the list is redrawn');
  // press and hold opens the details sheet
  const box = await page.locator(`#results .cell[data-i="${before[0]}"]`).boundingBox();
  await longPress(page, box.x + box.width / 2, box.y + box.height / 2); await idle(page);
  assert.ok(await page.isVisible('#mkOverlay'), 'details open');
  assert.equal(await page.evaluate((i) => isOwned(i), before[0]), true, 'holding did not untick it');
  const code = await page.textContent('#mkCode');
  assert.match(code, /Ohuhu /);
  await page.click('#mkOwn'); await idle(page);
  assert.equal(await page.evaluate((i) => isOwned(i), before[0]), false, 'the switch unticks it');
  await page.click('#mkSimilar'); await idle(page);
  assert.ok(await page.isVisible('#matchOverlay'), 'Find similar opens Match a colour');
  assert.ok(await page.evaluate(() => document.getElementById('matchResult').textContent.length > 20), 'with results for that colour');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });

test('marker sheet: after ticking "In my collection", closing it returns focus to the marker', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }) });
  const i = await page.evaluate(() => +document.querySelector('#results .cell').dataset.i);
  await page.focus(`#results .cell[data-i="${i}"]`);
  await page.evaluate((i) => openMarkerSheet(i), i); await page.waitForSelector('#mkOverlay.on');
  await page.click('#mkOwn'); await idle(page);
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.dataset && document.activeElement.dataset.i), String(i));
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const onboardedV265 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });

test('Markers: tick wording, "Showing" or "Matches", and the keyboard way to details', async () => {
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState({ collView: 'all' }) }) });
  await page.click('#mCollection'); await page.waitForSelector('#ownAll', { state: 'visible' });
  assert.equal(await page.textContent('#ownAll'), 'Tick all shown');
  assert.equal(await page.textContent('#ownNone'), 'Untick all shown');
  await page.click('#ownNone');
  assert.match(await page.textContent('#ownNone'), /^Untick \d+\? Tap again$/);
  const head = async () => (await page.textContent('#findResults .pile-head')).replace(/Copy codes/, '').trim();
  assert.match(await head(), /^Showing \d+ markers$/);
  await page.fill('#q', 'blue'); await idle(page);
  assert.match(await head(), /^Matches\s*\(\d+ markers\)$/);
  await page.fill('#q', ''); await page.evaluate(() => { fgTap('brand', 'Copic'); filterChanged(); });
  assert.match(await head(), /^Matches/);
  assert.equal(await page.getAttribute('#results .cell', 'aria-description'), 'Shift+F10 for details');
  assert.doesNotMatch(await page.textContent('#mkHint'), /Shift\+F10/);
  await page.keyboard.press('Tab'); await idle(page);
  assert.match(await page.textContent('#mkHint'), /Shift\+F10/);
  // and Shift+F10 on a cell opens its details
  await page.focus('#results .cell'); await page.keyboard.press('Shift+F10');
  await page.waitForSelector('#mkOverlay.on');
  assert.deepEqual(errors, []);
});

// ---- From v265 ----
const OWN3 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
const appState3 = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN3, saved: [], ...extra });
const onboardedNoVer = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });

test('Markers: the ⓘ hint above the grid, in full the first time, then one line that opens; mouse and touch wording', async () => {
  const { page, errors } = await openApp({ storage: onboardedNoVer({ [KEY]: appState3(), 'ms-seen-hints': '["along"]' }) });
  await page.click('#mCollection'); await page.waitForSelector('#mkHint .sfinfo');
  const hint = '#mkHint .sfinfo';
  assert.equal((await page.textContent(hint)).trim(), 'iTap a marker to tick or untick it. Right-click for details.', 'a mouse: right-click');
  assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'true');
  const r = await page.evaluate(() => [document.getElementById('mkHint').getBoundingClientRect().bottom, document.querySelector('#results .cell').getBoundingClientRect().top]);
  assert.ok(r[0] <= r[1], 'above the grid');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-seen-hints'))), ['along', 'mk-tick'], 'one list with the guide’s');
  // still in full for the rest of this visit
  await page.click('#mHome'); await page.click('#mCollection');
  assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'true');
  // the next visit: one line, which opens and closes
  await page.reload(); await page.click('#mCollection'); await page.waitForSelector(hint);
  assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'false');
  assert.equal((await page.textContent(hint)).trim(), 'iTap to tick · right-click for details');
  await page.click(hint);
  assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'true');
  assert.match(await page.textContent(hint), /Tap a marker to tick or untick it\. Right-click for details\./);
  await page.click(hint);
  assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'false');
  // a tap on the hint doesn't tick anything
  assert.equal(await page.evaluate(() => state.owned.size), OWN3.length);
  // not on other screens
  await page.click('#mPalette');
  assert.equal(await page.isVisible('#mkHint'), false);
  assert.deepEqual(errors, []);

  // a touch screen: press and hold
  const touch = () => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/pointer:\s*fine/.test(q) ? { matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : /pointer:\s*coarse/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q)); };
  const b = await openApp({ init: touch, storage: onboardedNoVer({ [KEY]: appState3() }) });
  await b.page.click('#mCollection'); await b.page.waitForSelector(hint);
  assert.equal((await b.page.textContent(hint)).trim(), 'iTap a marker to tick or untick it. Press and hold (or right-click) for details.');
  await b.page.reload(); await b.page.click('#mCollection'); await b.page.waitForSelector(hint);
  assert.equal((await b.page.textContent(hint)).trim(), 'iTap to tick · press and hold for details');
  assert.deepEqual(b.errors, []);
});
