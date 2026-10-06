// One save model for guides (v285): a guide from your own photo goes into the Library by itself once it's built, and
// from then on every change saves itself into that same Library entry. The sample joins the Library only once it's
// changed ("Sample jellyfish", numbered after the first). "Save a copy" makes a second entry and carries on with the
// copy. A stale guide is never saved; a guide deleted in the Library while open stays out (and out of the autosave
// slot) unless Put back; a full storage says so once, offers Save to try again, and keeps the guide for Resume.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, openMenu, saveCopy, rename, guideName, scrollTop, toolStatus, saveGuide, letterGuide, answerAsks, libItem } from './helpers.mjs';

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
// the header's button: Put back (deleted while open) or Save (after a failed save); Save a copy is in the ⋯ menu
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

test('a guide from your photo goes into the Library once built; then a pattern change, ticks and a rename save themselves into the same entry', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await letterGuide(page);
  await page.waitForFunction(() => __mstest.inLibrary); await idle(page);
  const [g] = await guides(page);
  assert.ok(g, 'in the Library without pressing anything');
  assert.equal(await page.evaluate(() => __mstest.curId), g.id);
  assert.equal(await saveShown(page), false, 'no Save button');
  assert.equal(await copyOffered(page), true, '⋯ offers Save a copy');
  assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-guide-auto')), null, 'nothing in the autosave slot');
  assert.match(await page.textContent('#sfLive'), /Saved in your Library/, 'announced for screen readers');
  assert.equal(await page.evaluate(() => guidesAtRisk()), 0, 'as built, the backup reminder leaves it out');

  // a pattern change: saved without pressing anything (v307: "Saving…" only while it's being written, not at once)
  const shape0 = (await stored(page, g.id)).shape;
  await page.click('.sftabbtn[data-t="pattern"]');
  const shape = await page.getAttribute('#sfShape .sfedit:not(.on)', 'data-v');
  await page.click(`#sfShape [data-v="${shape}"]`);
  assert.notEqual(await status(page), 'Saving…');
  await idle(page, AUTO);
  assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
  assert.notEqual(shape, shape0);
  assert.equal((await stored(page, g.id)).shape, shape, 'the new pattern is in the Library entry');
  assert.equal(await page.evaluate(() => guidesAtRisk()), 1, 'changed: the backup reminder counts it now');

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
  assert.match(await page.textContent(row(g.id) + ' .smeta'), new RegExp(`3 of ${g.n} coloured`));
  assert.match(await page.textContent(row(g.id) + ' .sname'), /Autosaved Garden/);
  await page.click(row(g.id) + ' .sname');
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, g.id); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)), 3);
  // (v284: part-way coloured, it opens in Colour along)
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
  await page.click('#sfDoneBtn'); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  assert.equal(await page.getAttribute('#sfShape .sfedit.on', 'data-v'), shape);
  assert.equal(await guideName(page), 'Autosaved Garden');
  assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
  // just opening it changes nothing in the Library (no new date, no save)
  const ts = await page.evaluate((id) => state.saved.find((s) => s.id === id).ts, g.id);
  await idle(page, AUTO);
  assert.equal(await page.evaluate((id) => state.saved.find((s) => s.id === id).ts, g.id), ts, 'opening is not a change');
  assert.deepEqual(errors, []);
});

test('the sample joins the Library only once it is changed: "Sample", a line under the tabs, nothing kept; looking around is no change', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page, AUTO);
  assert.equal(await status(page), 'Sample');
  assert.equal(await guideName(page), 'Sample jellyfish');
  assert.equal(await saveShown(page), false);
  // (v289) one line at a time: the first-time "Tap a section" first, the sample's line at the next tab
  assert.equal(await page.isVisible('.sfinfo[data-hint="tap"]'), true);
  assert.equal(await page.locator('#sfSampleNote').count(), 0, 'Tap a section first');
  await page.click('.sftabbtn[data-t="pattern"]');
  assert.equal(await page.locator('.sfinfo[data-hint="tap"]').count(), 0);
  assert.match(await page.textContent('#sfSampleNote'), /^This sample isn’t in your Library yet\. Change anything to keep it\./);
  await page.click('.sftabbtn[data-t="colours"]');
  assert.equal(await page.locator('.sfinfo[data-hint="tap"]').count(), 0, 'gone for good');
  assert.equal((await guides(page)).length, 0, 'not in the Library');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-guide-auto')), null, 'nor kept for Resume');
  // looking around: codes, zoom, tabs, Colour along and back, the menu
  await page.click('#sfCodes'); await page.click('#sfZin'); await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfColor'); await idle(page); await page.click('#sfDoneBtn'); await idle(page);
  await openMenu(page); await page.keyboard.press('Escape');
  await page.evaluate(() => __mstest.flushSave()); await idle(page, AUTO);
  assert.equal((await guides(page)).length, 0, 'none of that is a change');
  assert.equal(await status(page), 'Sample');
  // the line closes
  await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
  await page.click('#sfSampleX'); await idle(page);
  assert.equal(await page.locator('#sfSampleNote').count(), 0);
  // a change keeps it, as "Sample jellyfish"
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="random"]'); await idle(page, AUTO);
  let gs = await guides(page);
  assert.deepEqual(gs.map((x) => x.name), ['Sample jellyfish']);
  assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
  // the sample again: a fresh copy; changed, it's "Sample jellyfish 2"
  await page.evaluate(() => SF.loadSample()); await page.waitForFunction(() => document.getElementById('sfSaveSt').textContent === 'Sample'); await idle(page);
  assert.equal((await guides(page)).length, 1);
  await rename(page, 'My jellyfish'); await idle(page, AUTO);
  assert.deepEqual((await guides(page)).map((x) => x.name).sort(), ['My jellyfish', 'Sample jellyfish'], 'a rename alone keeps it');
  await page.evaluate(() => SF.loadSample()); await page.waitForFunction(() => document.getElementById('sfSaveSt').textContent === 'Sample'); await idle(page);
  await page.click('#sfColor'); await tickInCode(page, 0); await idle(page, AUTO);
  assert.ok((await guides(page)).some((x) => x.name === 'Sample jellyfish 2' && x.done === 1), 'a tick keeps it too, numbered');
  assert.deepEqual(errors, []);
});

test('Save a copy makes a second entry, and the open guide becomes the copy', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await saveGuide(page);
  const [orig] = await guides(page);
  await tickInCode(page, 0); // a change not saved yet: it belongs to the original
  await saveCopy(page); await idle(page);
  const gs = await guides(page);
  assert.equal(gs.length, 2);
  const copy = gs.find((x) => x.id !== orig.id);
  assert.equal(copy.name, orig.name + ' (2)'); // (v308: “(2)”, as for every name clash; was “(copy)”)
  assert.equal(await page.evaluate(() => __mstest.curId), copy.id, 'the copy is what is open');
  assert.equal(await guideName(page), copy.name);
  assert.match(await page.textContent('#msToast'), /Saved a copy, “.+ \(2\)”\. You’re now working on the copy/);
  assert.equal((await stored(page, orig.id)).prog, 1, 'the original kept the change made before copying');
  // changes now go into the copy only
  await tickInCode(page, 1); await flushSave(page);
  assert.equal((await stored(page, copy.id)).prog, 2);
  assert.equal((await stored(page, orig.id)).prog, 1);
  // a copy of the copy is numbered
  await saveCopy(page); await idle(page);
  assert.ok((await guides(page)).some((x) => x.name === orig.name + ' (3)'));
  assert.deepEqual(errors, []);
});

test('the Library row shows progress as the open guide saves itself', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await saveGuide(page);
  const [g] = await guides(page);
  await openLibrary(page);
  assert.match(await page.textContent(row(g.id) + ' .smeta'), /not started/);
  // while the Library is showing, the open guide gets ticks and saves itself
  const d = await page.evaluate(() => { const t = __mstest, N = t.assignData.N; let d = 1; while (Math.floor((d * 100) / N) < 30) d++; t.assignData.order.slice(0, d).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); return d; });
  await flushSave(page);
  assert.match(await page.textContent(row(g.id) + ' .smeta'), new RegExp(`${d} of ${g.n} coloured`));
  assert.deepEqual(errors, []);
});

test('a guide whose sections were rebuilt under it is never saved', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await saveGuide(page);
  const [g] = await guides(page), before = await stored(page, g.id);
  await answerAsks(page);
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
  await saveGuide(page);
  const [g] = await guides(page);
  await openLibrary(page);
  await libItem(page, row(g.id), 'sdel'); await idle(page);
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
  assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
  assert.equal(await saveShown(page), false);
  assert.deepEqual(errors, []);
});

test('a guide deleted while open (no Undo) stays out of the Library and the slot until Put back, which puts it back as it is now', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await saveGuide(page);
  const [g] = await guides(page);
  await openLibrary(page);
  await libItem(page, row(g.id), 'sdel'); await idle(page, 6500); // until the 6 s Undo window has run out
  await page.click('#savedClose'); await page.click('#mSections'); await idle(page);
  assert.equal(await page.textContent('#sfSave'), 'Put back');
  assert.equal(await status(page), 'Removed from your Library');
  assert.equal(await page.evaluate(() => document.getElementById('sfSaveSt').classList.contains('warn')), true);
  await tickInCode(page, 0); await flushSave(page); await idle(page, AUTO);
  assert.equal((await guides(page)).length, 0, 'a change doesn’t bring it back');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-guide-auto')), null, 'nor into the autosave slot');
  assert.equal(await page.evaluate((id) => IDB.get('guide-' + id).then((p) => !!p), g.id), false, 'its stored copy stays deleted');
  await page.click('#sfSave'); await idle(page);
  const gs = await guides(page);
  assert.equal(gs.length, 1);
  assert.equal(gs[0].id, g.id, 'put back as the same entry');
  assert.equal((await stored(page, g.id)).prog, 1, 'with the change made meanwhile');
  assert.equal(await saveShown(page), false);
  assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
  assert.match(await page.textContent('#sfLive'), /Put back in your Library/);
  assert.deepEqual(errors, []);
});

test('when storage is full, a failed auto-save says so once and the guide stays open with its changes', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await saveGuide(page);
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
  assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
  assert.equal(await page.evaluate(() => __mstest.saveErr), false);
  assert.deepEqual(errors, []);
});

test('Save puts the guide in the Library and Home counts it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await saveGuide(page);
  await page.click('#mHome');
  assert.match(await page.textContent('#homeLibSub'), /^1 saved$/);
  assert.ok(await page.isVisible('#sfRecent'));
  await page.click('.sfSeeAll');
  assert.ok(await page.evaluate(() => savedOverlay.classList.contains('on')));
  assert.equal(await page.locator('#savedList .srow').count(), 1);
  assert.deepEqual(errors, []);
});

test('colouring the sample keeps it: after a reload it’s in the Library with its ticks', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfColor');
  const ls = await page.evaluate(() => __mstest.assignData.order.slice(0, 3));
  await scrollTop(page);
  for (const l of ls) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); }
  assert.match(await toolStatus(page), /^3 of \d+ coloured$/);
  await idle(page, AUTO);
  await page.reload(); await idle(page);
  const gs = await guides(page);
  assert.equal(gs.length, 1);
  assert.equal(gs[0].done, 3, 'progress kept');
  assert.deepEqual(errors, []);
});

// ---- From the second full review ----
test('a failed auto-save leaves the saved guide exactly as it was', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
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

test('a first save that fails (storage full) says so once, offers Save, keeps the guide for Resume, and saves once there is room', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.evaluate(() => {
    window.__toasts = []; const t = window.toast; window.toast = function (m, ms) { window.__toasts.push(String(m)); return t(m, ms); };
    window.__put = IDB.put; IDB.put = function (k, v) { return /^guide-\d/.test(k) ? Promise.reject(new DOMException('full', 'QuotaExceededError')) : window.__put.call(IDB, k, v); };
  });
  for (let i = 0; i < 3; i++) { await tickN(page, 1, i); await flushSave(page); }
  assert.equal(await page.evaluate(() => window.__toasts.filter((m) => /storage is full/.test(m)).length), 1, 'one message');
  assert.match(await page.evaluate(() => window.__toasts.find((m) => /storage is full/.test(m))), /Share › Guide file/);
  assert.equal(await status(page), 'Not saved — storage is full');
  assert.equal(await page.textContent('#sfSave'), 'Save');
  assert.equal((await guidesR4(page)).length, 0);
  assert.equal(await page.evaluate(() => IDB.get('guide-autosave').then((d) => (d && d.payload.prog || []).length)), 3, 'kept for Resume meanwhile');
  // room again: the next change (or Save) puts it in the Library
  await page.evaluate(() => { IDB.put = window.__put; });
  await page.click('#sfSave'); await idle(page);
  const gs = await guidesR4(page);
  assert.equal(gs.length, 1);
  assert.equal((await storedR4(page, gs[0].id)).prog, 3);
  assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
  assert.deepEqual(errors, []);
});

test('a first save that fails is waited for and tried again before anything else opens', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await tickN(page, 3);
  // the first Library write fails (slowly)
  await page.evaluate(() => { const o = IDB.put; let n = 0; IDB.put = function (k, v) { if (/^guide-\d/.test(k) && !n++) return new Promise((_, rej) => setTimeout(() => rej(new Error('full')), 400)); return o.call(IDB, k, v); }; });
  await page.evaluate(() => { __mstest.flushSave(); SF.loadSample(); }); await idle(page, 2500);
  const gs = await guidesR4(page);
  assert.equal(gs.length, 1, 'the guide went into the Library before the sample opened');
  assert.equal((await storedR4(page, gs[0].id)).prog, 3);
  assert.deepEqual(errors, []);
});
