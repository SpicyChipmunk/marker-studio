// One save model for guides: a new guide needs one Save to enter the Library (until then the autosave slot keeps it
// and offers to resume it); from then on every change saves itself into that same Library entry. "Save a copy" makes
// a second entry and carries on with the copy. A stale guide is never saved, a guide deleted in the Library while open
// is not brought back, and a full storage says so once. Also: the Resume slot is never dropped, and a failed save
// (the first Save, or an auto-save) loses nothing.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, openMenu, saveCopy, rename, guideName, scrollTop, toolStatus } from './helpers.mjs';

before(setup);
after(teardown);

const AUTO = 2300; // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
// Save now instead of waiting for the auto-save timer, where a test isn't about the timer itself: the Library save
// (resolves once it is stored), or SF.flushSave() for a guide not in the Library yet (waits for the Resume slot too)
const flushSave = (page) => page.evaluate(() => __mstest.flushSave());
const flushSlot = (page) => page.evaluate(() => SF.flushSave());
const guides = (page) => page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, done: s.done, n: s.n })));
const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && { shape: p.style.gradShape, prog: (p.prog || []).length, lmap: p.lmap, assign: JSON.stringify(p.assign) }), id);
const status = (page) => page.evaluate(() => { const el = document.getElementById('sfSaveSt'); return el && el.style.display !== 'none' ? el.textContent : ''; });
// the header's Save shows only for a guide not in the Library; Save a copy is in the ⋯ menu once it is
const saveShown = (page) => page.isVisible('#sfSave');
async function copyOffered(page) { await openMenu(page); const on = await page.isVisible('#sfSaveCopy'); await page.keyboard.press('Escape'); return on; }
const row = (id) => `#savedList .srow[data-id="${id}"]`;
async function openLibrary(page) { await page.click('#mHome'); await page.click('#homeLibCard'); await idle(page); }
async function tick(page, ls) {
  await scrollTop(page);
  for (const l of ls) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); }
}
// a change the way the app makes one (ticked in code, then drawn, which schedules the save)
const tickInCode = (page, i) => page.evaluate((i) => { const t = __mstest; t.colored[t.assignData.order[i]] = 1; t.guideDirty = true; t.renderGuide(); }, i);

test('a new guide needs one Save; after that a pattern change, ticks and a rename save themselves into the same entry', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  assert.equal(await page.textContent('#sfSave'), 'Save');
  assert.equal(await status(page), 'Not saved yet', 'the header says so before the first Save');
  assert.equal(await copyOffered(page), false, 'no Save a copy before the first Save');
  await idle(page, AUTO);
  assert.equal((await guides(page)).length, 0, 'nothing goes into the Library by itself');
  assert.ok(await page.evaluate(() => !!localStorage.getItem('ms-guide-auto')), 'the autosave slot keeps the new guide');

  await page.click('#sfSave'); await idle(page);
  const [g] = await guides(page);
  assert.ok(g, 'in the Library after one Save');
  assert.equal(await page.evaluate(() => __mstest.curId), g.id);
  assert.equal(await saveShown(page), false, 'Save goes once the guide is in the Library');
  assert.equal(await copyOffered(page), true, '⋯ offers Save a copy');
  assert.equal(await status(page), 'Saved in your Library ✓');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-guide-auto')), null, 'the slot is cleared');
  assert.match(await page.textContent('#sfLive'), /Saved in your Library/, 'announced for screen readers');

  // a pattern change: "Saving…" at once, then saved without pressing anything
  const shape0 = (await stored(page, g.id)).shape;
  await page.click('.sftabbtn[data-t="pattern"]');
  const shape = await page.getAttribute('#sfShape .sfedit:not(.on)', 'data-v');
  await page.click(`#sfShape [data-v="${shape}"]`);
  assert.equal(await status(page), 'Saving…');
  await idle(page, AUTO);
  assert.equal(await status(page), 'Saved in your Library ✓');
  assert.notEqual(shape, shape0);
  assert.equal((await stored(page, g.id)).shape, shape, 'the new pattern is in the Library entry');

  // ticks while colouring along
  await page.click('#sfColor'); await idle(page);
  const ls = await page.evaluate(() => __mstest.assignData.order.slice(0, 3));
  await tick(page, ls); await idle(page, AUTO);
  assert.equal((await stored(page, g.id)).prog, 3);
  assert.equal((await guides(page))[0].done, 3, 'the Library knows how much is coloured');

  // a new name, renamed in the header
  await rename(page, 'Autosaved Garden');
  await idle(page, AUTO);
  assert.equal((await guides(page))[0].name, 'Autosaved Garden');
  assert.equal((await guides(page)).length, 1, 'always the same entry');

  // after a reload, the Library shows the progress and the guide opens as it was left
  await page.reload(); await idle(page);
  await openLibrary(page);
  const pct = Math.floor((3 * 100) / g.n);
  assert.match(await page.textContent(row(g.id) + ' .smeta'), new RegExp(`${Math.max(1, pct)}% coloured`));
  assert.match(await page.textContent(row(g.id) + ' .sname'), /Autosaved Garden/);
  await page.click(row(g.id) + ' .sname');
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, g.id); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)), 3);
  assert.equal(await page.getAttribute('#sfShape .sfedit.on', 'data-v'), shape);
  assert.equal(await guideName(page), 'Autosaved Garden');
  assert.equal(await status(page), 'Saved in your Library ✓');
  // just opening it changes nothing in the Library (no new date, no save)
  const ts = await page.evaluate((id) => state.saved.find((s) => s.id === id).ts, g.id);
  await idle(page, AUTO);
  assert.equal(await page.evaluate((id) => state.saved.find((s) => s.id === id).ts, g.id), ts, 'opening is not a change');
  assert.deepEqual(errors, []);
});

test('an unsaved new guide can still be resumed after a reload, and still needs its Save', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfColor');
  await tick(page, await page.evaluate(() => __mstest.assignData.order.slice(0, 2)));
  await flushSlot(page);
  await page.reload();
  await page.waitForSelector('#sfResume', { state: 'visible' });
  await page.click('#sfResumeGo');
  await page.waitForFunction(() => __mstest.assignData); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)), 2);
  assert.equal(await page.evaluate(() => __mstest.curId), null);
  assert.equal((await guides(page)).length, 0);
  assert.equal(await page.textContent('#sfSave'), 'Save');
  assert.deepEqual(errors, []);
});

test('Save a copy makes a second entry, and the open guide becomes the copy', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfSave'); await idle(page);
  const [orig] = await guides(page);
  await tickInCode(page, 0); // a change not saved yet: it belongs to the original
  await saveCopy(page); await idle(page);
  const gs = await guides(page);
  assert.equal(gs.length, 2);
  const copy = gs.find((x) => x.id !== orig.id);
  assert.equal(copy.name, orig.name + ' (copy)');
  assert.equal(await page.evaluate(() => __mstest.curId), copy.id, 'the copy is what is open');
  assert.equal(await guideName(page), copy.name);
  assert.match(await page.textContent('#msToast'), /Saved a copy, “.+ \(copy\)”\. You’re now working on the copy/);
  assert.equal((await stored(page, orig.id)).prog, 1, 'the original kept the change made before copying');
  // changes now go into the copy only
  await tickInCode(page, 1); await flushSave(page);
  assert.equal((await stored(page, copy.id)).prog, 2);
  assert.equal((await stored(page, orig.id)).prog, 1);
  // a copy of the copy is numbered
  await saveCopy(page); await idle(page);
  assert.ok((await guides(page)).some((x) => x.name === orig.name + ' (copy 2)'));
  assert.deepEqual(errors, []);
});

test('the Library row shows progress as the open guide saves itself', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfSave'); await idle(page);
  const [g] = await guides(page);
  await openLibrary(page);
  assert.doesNotMatch(await page.textContent(row(g.id) + ' .smeta'), /coloured/);
  // while the Library is showing, the open guide gets ticks and saves itself
  const d = await page.evaluate(() => { const t = __mstest, N = t.assignData.N; let d = 1; while (Math.floor((d * 100) / N) < 30) d++; t.assignData.order.slice(0, d).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); return d; });
  await flushSave(page);
  assert.match(await page.textContent(row(g.id) + ' .smeta'), new RegExp(`${Math.floor((d * 100) / g.n)}% coloured`));
  assert.deepEqual(errors, []);
});

test('a guide whose sections were rebuilt under it is never saved', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfSave'); await idle(page);
  const [g] = await guides(page), before = await stored(page, g.id);
  page.on('dialog', (d) => d.accept());
  await page.click('#sfBack2'); await idle(page);
  await page.click('#sfAdjToggle'); await page.click('#sfRotR'); await idle(page, 1200);
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj()), null, 'stale');
  await page.evaluate(() => { __mstest.guideDirty = true; return __mstest.flushSave(); });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await idle(page, AUTO);
  const now = await stored(page, g.id);
  assert.equal(now.lmap, before.lmap, 'the saved sections are untouched');
  assert.equal(now.assign, before.assign);
  assert.equal((await guides(page)).length, 1);
  assert.deepEqual(errors, []);
});

test('deleting the open guide in the Library stops its auto-save; Undo brings it back and saving carries on', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfSave'); await idle(page);
  const [g] = await guides(page);
  await openLibrary(page);
  await page.click(row(g.id) + ' .sdel'); await idle(page);
  // a change while it is deleted: not saved into the Library, nothing brought back
  await tickInCode(page, 0); await flushSave(page);
  assert.equal((await guides(page)).length, 0, 'not brought back by an auto-save');
  assert.equal(await page.evaluate(() => __mstest.guideDirty), true);
  assert.equal((await stored(page, g.id)).prog, 0, 'its stored copy (kept for Undo) is untouched');
  // Undo: it is back and the change made meanwhile is saved into it
  await page.click('#toastAct'); await flushSave(page);
  assert.equal((await guides(page)).length, 1);
  assert.equal((await stored(page, g.id)).prog, 1);
  await page.click('#savedClose'); await page.click('#mSections'); await idle(page);
  assert.equal(await status(page), 'Saved in your Library ✓');
  assert.equal(await saveShown(page), false);
  assert.deepEqual(errors, []);
});

test('a guide deleted while open (no Undo) is a new unsaved guide again', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfSave'); await idle(page);
  const [g] = await guides(page);
  await openLibrary(page);
  await page.click(row(g.id) + ' .sdel'); await idle(page, 6500); // until the 6 s Undo window has run out
  await page.click('#savedClose'); await page.click('#mSections'); await idle(page);
  assert.equal(await page.textContent('#sfSave'), 'Save');
  assert.equal(await status(page), 'Not saved yet');
  assert.equal(await page.evaluate(() => document.getElementById('sfSaveSt').classList.contains('warn')), true, 'in the warning colour: it was in the Library');
  await tickInCode(page, 0); await flushSave(page);
  assert.equal((await guides(page)).length, 0);
  assert.equal(await page.evaluate((id) => IDB.get('guide-' + id).then((p) => !!p), g.id), false, 'its stored copy stays deleted');
  await page.click('#sfSave'); await idle(page);
  const gs = await guides(page);
  assert.equal(gs.length, 1);
  assert.notEqual(gs[0].id, g.id, 'saved as a new entry');
  assert.equal(await status(page), 'Saved in your Library ✓');
  assert.deepEqual(errors, []);
});

test('when storage is full, a failed auto-save says so once and the guide stays open with its changes', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfSave'); await idle(page);
  const [g] = await guides(page);
  await page.evaluate(() => {
    window.__toasts = []; const t = window.toast; window.toast = function (m, ms) { window.__toasts.push(String(m)); return t(m, ms); };
    window.__put = IDB.put; IDB.put = () => Promise.reject(new DOMException('full', 'QuotaExceededError'));
  });
  for (let i = 0; i < 3; i++) { await tickInCode(page, i); await flushSave(page); }
  const full = await page.evaluate(() => window.__toasts.filter((m) => /storage is full/.test(m)).length);
  assert.equal(full, 1, 'one message, not one per try');
  assert.equal(await status(page), 'Not saved — storage is full');
  assert.equal(await page.evaluate(() => document.getElementById('sfSaveSt').classList.contains('warn')), true);
  assert.equal(await page.evaluate(() => __mstest.guideDirty), true, 'still marked unsaved');
  assert.equal(await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)), 3, 'the guide is still open with its ticks');
  assert.equal((await stored(page, g.id)).prog, 0);
  // space again: the next change saves everything
  await page.evaluate(() => { IDB.put = window.__put; });
  await tickInCode(page, 3); await flushSave(page);
  assert.equal((await stored(page, g.id)).prog, 4);
  assert.equal(await status(page), 'Saved in your Library ✓');
  assert.equal(await page.evaluate(() => __mstest.saveErr), false);
  assert.deepEqual(errors, []);
});

test('Save puts the guide in the Library and Home counts it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfSave'); await idle(page);
  await page.click('#mHome');
  assert.match(await page.textContent('#homeLibSub'), /^1 saved$/);
  assert.ok(await page.isVisible('#sfRecent'));
  await page.click('.sfSeeAll');
  assert.ok(await page.evaluate(() => savedOverlay.classList.contains('on')));
  assert.equal(await page.locator('#savedList .srow').count(), 1);
  assert.deepEqual(errors, []);
});

test('unsaved colouring survives a reload and can be resumed', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfColor');
  const ls = await page.evaluate(() => __mstest.assignData.order.slice(0, 3));
  await scrollTop(page);
  for (const l of ls) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); }
  assert.match(await toolStatus(page), /^3 of \d+ done$/);
  await idle(page, 2200); // autosave runs 1.5 s after the last change
  await page.reload();
  await page.waitForSelector('#sfResume', { state: 'visible' });
  await page.click('#sfResumeGo');
  await page.waitForFunction(() => __mstest.assignData);
  const done = await page.evaluate(() => [...__mstest.colored].reduce((a, b) => a + b, 0));
  assert.equal(done, 3, 'progress restored');
  assert.deepEqual(errors, []);
});

// ---- From the second full review ----
test('a failed auto-save leaves the saved guide exactly as it was', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await page.click('#sfSave'); await idle(page);
  const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  const before = await page.evaluate((id) => IDB.get('guide-' + id).then((p) => p.style.family), id);
  await page.evaluate(() => { const o = Storage.prototype.setItem; window.__o = o; Storage.prototype.setItem = function (k, v) { if (k === 'ohuhu-hb320-picker-v3') throw new DOMException('full', 'QuotaExceededError'); return o.call(this, k, v); }; });
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="random"]');
  await page.evaluate(() => __mstest.flushSave()); await idle(page);
  await page.evaluate(() => { Storage.prototype.setItem = window.__o; });
  assert.equal(await page.evaluate((id) => IDB.get('guide-' + id).then((p) => p.style.family), id), before, 'stored data rolled back');
  assert.equal(await page.evaluate(() => __mstest.guideDirty), true);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (data safety) ----
const guidesR4 = (page) => page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, thumb: s.thumb, W: s.W, H: s.H })));
const storedR4 = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && { prog: (p.prog || []).length, assign: p.assign, tones: p.tones || {}, ref: p.ref || null, base: p.base || null, style: p.style }), id);
const tickN = (page, n, from = 0) => page.evaluate(([n, from]) => { const t = __mstest; t.assignData.order.slice(from, from + n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, [n, from]);

test('the Resume slot is never dropped: Dismiss only hides it, and the next new guide moves it into the Library', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await tickN(page, 3); await idle(page, AUTO);
  await page.reload();
  await page.waitForSelector('#sfResume', { state: 'visible' });
  await page.click('#sfResumeNo'); await idle(page);
  assert.ok(await page.evaluate(() => IDB.get('guide-autosave').then((d) => !!d)), 'still kept');
  assert.equal((await guidesR4(page)).length, 0);
  await page.evaluate(() => { setMode('sections'); SF.loadSample(); }); await page.waitForFunction(() => __mstest.assignData); await idle(page, AUTO + 500);
  const gs = await guidesR4(page);
  assert.equal(gs.length, 1, 'the dismissed guide is in the Library');
  assert.equal((await storedR4(page, gs[0].id)).prog, 3, 'with its ticks');
  assert.equal(await page.evaluate(() => IDB.get('guide-autosave').then((d) => (d.payload.prog || []).length)), 0, 'the slot now holds the new guide');
  assert.deepEqual(errors, []);
});

test('a first Save that fails is waited for and tried again before anything else opens', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await tickN(page, 3);
  // the first Library write fails (slowly)
  await page.evaluate(() => { const o = IDB.put; let n = 0; IDB.put = function (k, v) { if (/^guide-\d/.test(k) && !n++) return new Promise((_, rej) => setTimeout(() => rej(new Error('full')), 400)); return o.call(IDB, k, v); }; });
  await page.click('#sfSave');
  await page.evaluate(() => SF.loadSample()); await idle(page, 2500);
  const gs = await guidesR4(page);
  assert.equal(gs.length, 1, 'the guide went into the Library before the sample opened');
  assert.equal((await storedR4(page, gs[0].id)).prog, 3);
  assert.deepEqual(errors, []);
});
