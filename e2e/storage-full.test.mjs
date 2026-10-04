// Storage that is full or blocked: Save, ticking a marker, changing the collection, Use in a guide and renaming say so,
// keep nothing and offer no Undo; blocked storage shows one clear banner.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, welcome, idle, libItem } from './helpers.mjs';

before(setup);
after(teardown);

test('when storage is full, a new guide’s first save says so, Save tries again and says so too, and the guide stays unsaved', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.evaluate(() => { IDB.put = () => Promise.reject(new DOMException('full', 'QuotaExceededError')); });
  // (v285: a change to the sample is its first save)
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="random"]');
  await page.evaluate(() => __mstest.flushSave()); await idle(page);
  assert.equal(await page.textContent('#sfSaveSt'), 'Not saved — storage is full');
  await page.click('#sfSave');
  await page.waitForFunction(() => /Couldn.t save/.test(document.getElementById('sfSave').textContent));
  assert.equal(await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 0, 'nothing half-saved in the Library');
  assert.equal(await page.evaluate(() => __mstest.guideDirty), true, 'still marked unsaved');
  assert.deepEqual(errors, []);
});

test('when the settings storage is full, changing the collection warns once', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.evaluate(() => { const orig = Storage.prototype.setItem; window.__origSet = orig; Storage.prototype.setItem = function (k, v) { if (k === 'ohuhu-hb320-picker-v3') throw new DOMException('full', 'QuotaExceededError'); return orig.call(this, k, v); }; });
  const r = await page.evaluate(() => { state.owned.add('Copic|B26'); const ok = save(); return ok; });
  assert.equal(r, false);
  await idle(page);
  assert.match(await page.textContent('#msToast'), /storage is full/);
  await page.evaluate(() => { Storage.prototype.setItem = window.__origSet; });
  assert.equal(await page.evaluate(() => save()), true, 'saves again once there is room');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });
// the next writes of the app's state fail as if the storage were full
const fillStorage = (page) => page.evaluate((KEY) => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === KEY) throw new DOMException('full', 'QuotaExceededError'); return o.call(this, k, v); }; }, KEY);
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t && t.classList.contains('on') ? t.textContent : ''; });

test('storage full: Save and ticking a marker say so, keep nothing and offer no Undo', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  await page.click('#mPalette'); await page.click('#draw'); await idle(page);
  await fillStorage(page);
  await page.click('#saveBtn'); await idle(page);
  assert.notEqual(await page.textContent('#saveBtn'), 'Saved ✓');
  assert.equal(await page.evaluate(() => state.saved.length), 0, 'not listed in the Library');
  assert.match(await toastText(page), /storage is full/);
  // ticking a marker: the full-storage message, not "Removed … Undo"
  await page.click('#mCollection'); await idle(page);
  const i = await page.evaluate(() => +document.querySelector('#results .cell').dataset.i);
  await page.click(`#results .cell[data-i="${i}"]`); await page.waitForSelector('#msToast.on');
  assert.match(await toastText(page), /storage is full/);
  assert.equal(await page.evaluate(() => !!document.getElementById('toastAct')), false, 'no Undo');
  assert.equal(await page.evaluate((i) => isOwned(i), i), true, 'still owned');
  // (v305: the Owned view has no tick badges, every marker in it being yours; the cell is still shown as owned)
  assert.equal(await page.evaluate((i) => document.querySelector(`#results .cell.own[data-i="${i}"]`) != null, i), true, 'and still shown as owned');
  // Own all / Clear / the shopping list / ink leave things as they were too
  await page.click('#ownView [data-v="all"]'); await idle(page);
  await page.click('#ownAll'); await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 8);
  await page.evaluate(() => openMarkerSheet(COLORS.findIndex((c, j) => isOwned(j)))); await page.waitForSelector('#mkOverlay.on');
  await page.click('#mkInk button[data-ink="dry"]'); await idle(page);
  assert.equal(await page.evaluate(() => Object.keys(state.ink).length), 0);
  assert.match(await toastText(page), /storage is full/);
  assert.deepEqual(errors, []);
});

test('blocked storage: one clear banner, the welcome still shows, no storage-full toasts', async () => {
  const block = () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } }); };
  const { page, errors } = await openApp({ init: block });
  await page.waitForSelector('#welcome.on');
  assert.match(await page.textContent('.msblocked'), /isn’t letting Marker Studio save — nothing will be kept/);
  await page.click('#wcSkip'); await page.click('#wcLook');
  for (const m of ['#mCollection', '#mPalette', '#mHome']) { await page.click(m); await idle(page); assert.doesNotMatch(await toastText(page), /storage is full/); }
  assert.ok(await page.isVisible('.msblocked'), 'the banner stays on every screen');
  // changes still work for this visit
  await page.click('#mCollection'); await page.click('#ownView [data-v="all"]'); await idle(page);
  await page.click('#results .cell'); await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 1);
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const onboardedV265 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });
const pal = (keys, id, name) => ({ id, type: 'palette', name: name || 'Pal ' + id, keys, ts: id });

test('Use in a guide and a Library rename with storage full: nothing changes and the message stays', async () => {
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState({ saved: [pal(['Ohuhu|R014', 'Ohuhu|B08'], 5, 'Old name')] }) }) });
  await page.click('#mPalette'); await page.click('#draw'); await idle(page);
  await fillStorage(page);
  await page.click('#useInGuide'); await idle(page);
  assert.equal(await page.evaluate(() => state.mode), 'palette', 'still on Palette');
  assert.match(await toastText(page), /storage is full/, 'the message is still showing');
  assert.equal(await page.evaluate(() => state.saved.length), 1, 'the palette is not in the Library in memory only');
  // rename
  await page.click('#libMore'); await page.click('#savedBtn'); await libItem(page, '#savedList .srow[data-id="5"]', 'sren');
  await page.fill('#savedList .sname-in', 'New name'); await page.press('#savedList .sname-in', 'Enter'); await idle(page);
  assert.equal(await page.evaluate(() => state.saved[0].name), 'Old name', 'the old name is back');
  assert.equal(await page.textContent('#savedList .srow[data-id="5"] .sname'), 'Old name');
  assert.match(await toastText(page), /storage is full/);
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (data safety) ----
test('with storage blocked, the guide’s header says to keep it as a guide file', async () => {
  const { page, errors } = await openApp({ init: () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } }); } });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="random"]');
  await page.evaluate(() => __mstest.flushSave()); await idle(page);
  assert.equal(await page.textContent('#sfSaveSt'), 'Not saved — use Share › Guide file');
  assert.match(await page.evaluate(() => document.body.innerText), /isn’t letting Marker Studio save/);
  assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /storage may be full/);
  assert.deepEqual(errors, []);
});
