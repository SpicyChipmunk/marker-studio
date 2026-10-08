// v305: a marker that becomes yours leaves To buy (ticked in the grid or its details, or by Tick all shown), unless
// it's marked Running low or dry (that entry is its replacement). Only the toast's Undo puts it back, in its old place;
// unticking it later leaves the list alone. A marker you own that is on the list (from before, or from a backup) says
// "already yours".
// (v308.3: a marker added by hand loses its Running low or Dry mark first, so it leaves the list too.)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v305', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const WISH = ['Ohuhu|G43', 'Ohuhu|Y26', 'Ohuhu|R28'].map((k, j) => ({ k, why: 'from Match a colour', ts: j + 1 }));
const appState = (extra = {}) =>
  JSON.stringify({ mode: 'collection', collView: 'all', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], wish: WISH, ink: {}, ...extra });
const wishKeys = (page) => page.evaluate(() => state.wish.map((w) => w.k));
const stored = (page) => page.evaluate((KEY) => { const v = JSON.parse(localStorage.getItem(KEY)); return { wish: v.wish.map((w) => w.k), owned: v.owned }; }, KEY);
const idx = (page, k) => page.evaluate((k) => keyIdx(k), k);
const toastText = (page) => page.evaluate(() => document.getElementById('msToast').textContent.replace(/\s*Undo$/, ''));
async function tapCell(page, code) {
  await page.fill('#q', code); await idle(page);
  const i = await idx(page, 'Ohuhu|' + code);
  await page.click(`#results .cell[data-i="${i}"]`); await idle(page);
}
const undo = async (page) => { await page.click('#toastAct'); await idle(page); };

test('To buy: ticking a marker in the grid takes it off the list; Undo puts it back in its place; unticking later doesn’t', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState() }) });
  await page.click('#mCollection'); await idle(page);
  assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy (3)');
  await tapCell(page, 'Y26');
  assert.equal(await toastText(page), 'Added Ohuhu Y26 · taken off To buy');
  assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28']);
  assert.deepEqual((await stored(page)).wish, ['Ohuhu|G43', 'Ohuhu|R28'], 'saved');
  assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy (2)');
  // Undo: not yours, and back where it was
  await undo(page);
  assert.equal(await page.evaluate((i) => isOwned(i), await idx(page, 'Ohuhu|Y26')), false);
  assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|Y26', 'Ohuhu|R28']);
  assert.deepEqual((await stored(page)).wish, ['Ohuhu|G43', 'Ohuhu|Y26', 'Ohuhu|R28']);
  // ticked again, then unticked by a tap (not Undo): the list stays as it is
  await tapCell(page, 'Y26');
  assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28']);
  await page.click(`#results .cell[data-i="${await idx(page, 'Ohuhu|Y26')}"]`); await idle(page);
  assert.equal(await toastText(page), 'Removed Ohuhu Y26');
  assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28'], 'unticking doesn’t put it back');
  // and that untick's Undo makes it yours again without touching the list
  await undo(page);
  assert.equal(await page.evaluate((i) => isOwned(i), await idx(page, 'Ohuhu|Y26')), true);
  assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28']);
  // a marker not on the list: the toast is as before
  await tapCell(page, 'Y06');
  assert.equal(await toastText(page), 'Added Ohuhu Y06 to your collection');
  assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28']);
  // the marker's details tick box does the same
  await page.evaluate((i) => openMarkerSheet(i), await idx(page, 'Ohuhu|R28'));
  await page.waitForSelector('#mkOverlay.on');
  await page.click('#mkOwn'); await idle(page);
  assert.equal(await toastText(page), 'Added Ohuhu R28 · taken off To buy');
  assert.deepEqual(await wishKeys(page), ['Ohuhu|G43']);
  await undo(page);
  assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28']);
  assert.equal(await page.isChecked('#mkOwn'), false);
  assert.deepEqual(errors, []);
});

test('To buy: a dry marker you had unticked, ticked again by hand, is fresh: its mark goes and it leaves the list; Undo puts both back', async () => {
  // (v308.3, Ben's decision: ticking a marker back clears its Running low or Dry mark, so it leaves To buy as any added
  // marker does. Before, the mark was kept and the entry stayed as its replacement. An owned marker marked dry still
  // says why it's on the list.)
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState({ ink: { 'Ohuhu|Y26': 'dry' } }) }) });
  await page.click('#mCollection'); await idle(page);
  await tapCell(page, 'Y26');
  assert.equal(await toastText(page), 'Added Ohuhu Y26 · taken off To buy');
  assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28']);
  assert.equal(await page.evaluate(() => state.ink['Ohuhu|Y26'] || ''), '');
  await undo(page);
  assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|Y26', 'Ohuhu|R28']);
  assert.equal(await page.evaluate(() => state.ink['Ohuhu|Y26']), 'dry');
  // one you own, marked dry: its row says why it's there, not "already yours"
  await page.evaluate(() => { state.owned.add('Ohuhu|Y26'); save(); });
  await page.click('#ownView [data-v="wish"]'); await idle(page);
  assert.match(await page.textContent('#wishView .wrow[data-k="Ohuhu|Y26"] .wwhy'), /· yours is dry$/);
  assert.deepEqual(errors, []);
});

test('To buy: a marker you own that is on the list (older data, or a backup) says "already yours"', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState({ owned: [...OWN, 'Ohuhu|G43'], collView: 'wish' }) }) });
  await page.click('#mCollection'); await idle(page);
  await page.click('#ownView [data-v="wish"]'); await idle(page);
  assert.equal(await page.textContent('#wishView .wrow[data-k="Ohuhu|G43"] .wwhy'), 'from Match a colour · already yours');
  assert.equal(await page.textContent('#wishView .wrow[data-k="Ohuhu|Y26"] .wwhy'), 'from Match a colour');
  assert.deepEqual(errors, []);
});

test('To buy: Tick all shown takes the markers it adds off the list, says how many, and Undo puts them back', async () => {
  const wish = ['Ohuhu|R210', 'Ohuhu|Y26', 'Ohuhu|R28', 'Ohuhu|R215'].map((k, j) => ({ k, why: 'from Match a colour', ts: j + 1 }));
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState({ wish, ink: { 'Ohuhu|R28': 'low' } }) }) });
  await page.click('#mCollection'); await idle(page);
  // shown: R210, R28 and R215 among others; Y26 isn't shown
  // (v308.3: R28, unticked and marked low, is added by hand, so its mark goes and it comes off too; it had stayed)
  await page.fill('#q', 'R2'); await idle(page);
  const shown = await page.evaluate(() => shownMatches().map((i) => mkey(i)));
  assert.ok(['Ohuhu|R210', 'Ohuhu|R28', 'Ohuhu|R215'].every((k) => shown.includes(k)) && !shown.includes('Ohuhu|Y26'), shown.join(' '));
  await page.click('#ownAll'); await idle(page);
  assert.match(await toastText(page), /^Added \d+ markers · 3 off To buy$/);
  assert.deepEqual(await wishKeys(page), ['Ohuhu|Y26']);
  assert.deepEqual((await stored(page)).wish, ['Ohuhu|Y26']);
  assert.equal(await page.evaluate(() => state.ink['Ohuhu|R28'] || ''), '');
  await undo(page);
  assert.equal(await page.evaluate(() => state.ink['Ohuhu|R28']), 'low');
  assert.deepEqual(await wishKeys(page), ['Ohuhu|R210', 'Ohuhu|Y26', 'Ohuhu|R28', 'Ohuhu|R215']);
  assert.deepEqual((await stored(page)).wish, ['Ohuhu|R210', 'Ohuhu|Y26', 'Ohuhu|R28', 'Ohuhu|R215']);
  assert.ok(!(await stored(page)).owned.includes('Ohuhu|R210'));
  assert.deepEqual(errors, []);
});

test('To buy: with two tabs open, the other tab’s list follows a tick and its Undo', async () => {
  const a = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState() }) });
  const b = await a.ctx.newPage(),
    errs = [];
  b.on('pageerror', (e) => errs.push(e.message));
  await b.goto(a.page.url()); await idle(b);
  await b.click('#mCollection'); await b.click('#ownView [data-v="wish"]'); await idle(b);
  await a.page.click('#mCollection'); await idle(a.page);
  await tapCell(a.page, 'Y26');
  await b.waitForFunction(() => !state.wish.some((w) => w.k === 'Ohuhu|Y26') && state.owned.has('Ohuhu|Y26'), null, { timeout: 3000 });
  await b.waitForFunction(() => !document.querySelector('#wishView .wrow[data-k="Ohuhu|Y26"]'), null, { timeout: 3000 });
  await undo(a.page);
  await b.waitForFunction(() => state.wish.map((w) => w.k).join() === 'Ohuhu|G43,Ohuhu|Y26,Ohuhu|R28' && !state.owned.has('Ohuhu|Y26'), null, { timeout: 3000 });
  // B's next save keeps the list as it is
  await b.click('#ownView [data-v="all"]'); await idle(b);
  assert.deepEqual((await stored(b)).wish, ['Ohuhu|G43', 'Ohuhu|Y26', 'Ohuhu|R28']);
  assert.deepEqual([...a.errors, ...errs], []);
});
