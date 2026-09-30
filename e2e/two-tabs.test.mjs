// Two tabs sharing storage: palettes, deleted guides, the same Library guide, and the Resume slot.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From the fourth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });

test('two tabs: a palette saved in one is kept when the other changes screen, and a delete there reaches this one', async () => {
  const a = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  const b = { page: await a.ctx.newPage(), errors: [] };
  b.page.on('pageerror', (e) => b.errors.push(e.message));
  await b.page.goto(a.page.url()); await idle(b.page);
  // A saves a palette
  await a.page.click('#mPalette'); await a.page.click('#draw'); await idle(a.page);
  await a.page.click('#saveBtn'); await a.page.waitForFunction(() => state.saved.length > 0);
  const id = await a.page.evaluate(() => state.saved[0].id);
  // B hears about it, and changing screen there keeps it
  await b.page.waitForFunction((id) => state.saved.some((s) => s.id === id), id, { timeout: 3000 });
  await b.page.click('#mCollection'); await idle(b.page);
  assert.ok(await b.page.evaluate(([KEY, id]) => JSON.parse(localStorage.getItem(KEY)).saved.some((s) => s.id === id), [KEY, id]), 'still in the stored Library');
  // the safety net: a write B never heard about (no storage event) survives B's next save
  await b.page.evaluate((KEY) => { const v = JSON.parse(localStorage.getItem(KEY)); v.saved.push({ id: 42, type: 'palette', name: 'Quiet', keys: ['Ohuhu|R014'], ts: 42 }); localStorage.setItem(KEY, JSON.stringify(v)); }, KEY);
  await b.page.click('#mPalette'); await idle(b.page);
  assert.ok(await b.page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)).saved.some((s) => s.id === 42), KEY), 'merged by id, not written over');
  // a delete in A reaches B's open Library
  await b.page.click('#savedBtn'); await idle(b.page);
  await a.page.click('#savedBtn'); await a.page.click(`#savedList .srow[data-id="${id}"] .sdel`); await idle(a.page);
  await b.page.waitForFunction((id) => !document.querySelector(`#savedList .srow[data-id="${id}"]`), id, { timeout: 3000 });
  await b.page.keyboard.press('Escape'); await b.page.click('#mCollection'); await idle(b.page);
  assert.equal(await b.page.evaluate(([KEY, id]) => JSON.parse(localStorage.getItem(KEY)).saved.some((s) => s.id === id), [KEY, id]), false, 'not written back');
  assert.equal(await b.page.evaluate((id) => state.saved.some((s) => s.id === id), id), false, 'B did not bring it back');
  assert.deepEqual([...a.errors, ...b.errors], []);
});

test('two tabs: a guide deleted in one tab stops the other saving into it', async () => {
  const a = await openApp();
  await sampleGuide(a.page); await a.page.click('#sfSave'); await idle(a.page);
  const id = await a.page.evaluate(() => __mstest.curId);
  const b = await a.ctx.newPage(); const errs = []; b.on('pageerror', (e) => errs.push(e.message));
  await b.goto(a.page.url()); await idle(b);
  await b.evaluate(() => { savedOverlay.classList.add('on'); renderSaved(); });
  await b.click(`#savedList .srow[data-id="${id}"] .sdel`); await idle(b);
  await a.page.waitForFunction(() => /Not saved/.test(document.getElementById('sfSaveSt').textContent), null, { timeout: 3000 });
  assert.equal(await a.page.evaluate((id) => state.saved.some((s) => s.id === id), id), false);
  // a third tab starting during the Undo time leaves the guide's picture alone, so Undo still brings it all back
  const c = await a.ctx.newPage(); await c.goto(a.page.url()); await idle(c, 2000); // until its start-up tidy (1.5 s in) has run
  await b.click('#toastAct'); await idle(b);
  assert.ok(await b.evaluate((id) => IDB.get('guide-' + id).then((p) => !!p), id), 'the stored guide is still there');
  await a.page.waitForFunction(() => /Saved in your Library/.test(document.getElementById('sfSaveSt').textContent), null, { timeout: 3000 });
  assert.deepEqual([...a.errors, ...errs], []);
});

// ---- From the fifth review (data safety) ----
const AUTO = 2300; // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
const guides = (page) => page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, thumb: s.thumb })));
const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && { prog: (p.prog || []).length, progL: p.prog || [], assign: p.assign, tones: p.tones || {}, ref: p.ref || null, photo: (p.style && p.style.photo) || null, out: p.out || null, secStates: p.secStates || {}, lmap: p.lmap }), id);
const tickN = (page, n, from = 0) => page.evaluate(([n, from]) => { const t = __mstest; t.assignData.order.slice(from, from + n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, [n, from]);
const openSaved = async (page, id) => { await page.evaluate((id) => loadGuide({ id }), id); await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 }); await idle(page); };
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t ? t.textContent : ''; });

test('two tabs with the same Library guide: neither loses the other’s ticks (shown there, merged when both changed)', async () => {
  const { ctx, page: a, errors } = await openApp();
  await sampleGuide(a); await a.click('#sfSave'); await idle(a);
  const id = await savedId(a);
  const b = await ctx.newPage(); b.on('pageerror', (e) => errors.push(e.message));
  await b.goto(a.url()); await idle(b);
  await openSaved(b, id);
  await tickN(a, 5); await idle(a, AUTO);
  await b.waitForFunction(() => __mstest.colored.reduce((x, y) => x + y, 0) === 5, null, { timeout: 5000 });
  await tickN(b, 3, 10); await idle(b, AUTO);
  assert.equal((await stored(a, id)).prog, 8);
  await a.waitForFunction(() => __mstest.colored.reduce((x, y) => x + y, 0) === 8, null, { timeout: 5000 });
  await tickN(a, 1, 20); await idle(a, AUTO);
  assert.equal((await stored(a, id)).prog, 9, 'A’s tick joins B’s');
  // both change at once: B has a change still to save when A saves
  await b.waitForFunction(() => __mstest.colored.reduce((x, y) => x + y, 0) === 9, null, { timeout: 5000 });
  await tickN(b, 2, 30);
  await tickN(a, 1, 40); await a.evaluate(() => __mstest.flushSave());
  await idle(b, AUTO + 500);
  assert.equal((await stored(a, id)).prog, 12, 'merged: the union of both tabs’ ticks');
  assert.match(await toastText(b), /also changed in another tab/);
  await a.waitForFunction(() => __mstest.colored.reduce((x, y) => x + y, 0) === 12, null, { timeout: 5000 });
  assert.deepEqual(errors, []);
});

test('two tabs with new guides share the Resume slot: neither guide is lost, none is kept twice', async () => {
  const { ctx, page: a, errors } = await openApp();
  await sampleGuide(a); await tickN(a, 3); await idle(a, AUTO);
  const b = await ctx.newPage(); b.on('pageerror', (e) => errors.push(e.message));
  await b.goto(a.url()); await idle(b);
  await b.evaluate(() => { setMode('sections'); SF.loadSample(); }); await b.waitForFunction(() => __mstest.assignData);
  await tickN(b, 2, 10); await idle(b, AUTO);
  // A's guide went into the Library to make room; A goes on saving into that entry
  await tickN(a, 1, 20); await idle(a, AUTO);
  const gs = await guides(a);
  assert.equal(gs.length, 1, 'A’s guide is in the Library once');
  assert.equal(await a.evaluate(() => __mstest.curId), gs[0].id, 'and A saves into it');
  assert.equal((await stored(a, gs[0].id)).prog, 4);
  assert.equal(await a.evaluate(() => IDB.get('guide-autosave').then((d) => (d.payload.prog || []).length)), 2, 'the slot keeps B’s guide');
  await tickN(b, 1, 30); await idle(b, AUTO);
  assert.equal((await guides(b)).length, 1, 'still one in the Library');
  assert.equal(await b.evaluate(() => IDB.get('guide-autosave').then((d) => (d.payload.prog || []).length)), 3);
  assert.deepEqual(errors, []);
});
