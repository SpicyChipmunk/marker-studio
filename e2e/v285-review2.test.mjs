// v285's second review (after release prep): changes made just before the page goes away are kept; Resume's section
// edits, discarded, never overwrite the Library guide; edits left by an earlier visit are kept as a copy; a guide
// deleted while open stays out of the slot; blocked storage asks before a guide goes; Continue's row is on screen;
// Reveal gives the keyboard back; the Library's backup line; the welcome on a landscape phone; singular wording.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, saveGuide, sectionPoint, scrollTop } from './helpers.mjs';

before(setup);
after(teardown);

const AUTO = 2300;
const tickN = (page, n, from = 0) => page.evaluate(([n, from]) => { const t = __mstest; t.assignData.order.slice(from, from + n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, [n, from]);
const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && { prog: (p.prog || []).length, n: Object.keys(p.assign || {}).length, shape: p.style && p.style.gradShape }), id);
const hide = (page) => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; });
async function excludeOne(page) {
  await page.click('#sfBack2'); await idle(page); await scrollTop(page);
  const l = await page.evaluate(() => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[2]; });
  const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y);
  await page.waitForFunction((l) => !__mstest.counted(l), l);
  return l;
}

test('ticks and a pattern change made just before a reload are kept, and the guide opens with them', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await tickN(page, 2); await page.evaluate(() => __mstest.flushSave()); await idle(page);
  // two more ticks and a pattern change, then the page goes at once
  await page.click('.sftabbtn[data-t="pattern"]');
  const shape = await page.getAttribute('#sfShape .sfedit:not(.on)', 'data-v');
  await page.click(`#sfShape [data-v="${shape}"]`);
  await tickN(page, 2, 2);
  await page.reload(); await idle(page);
  assert.equal(await page.evaluate((id) => state.saved.find((s) => s.id === id).done, id), 4, 'the Library row');
  const s = await stored(page, id);
  assert.equal(s.prog, 4, 'the stored guide');
  assert.equal(s.shape, shape, 'with the new pattern');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-guide-leave')), null, 'put into the guide, then gone');
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  assert.equal(await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)), 4);
  assert.deepEqual(errors, []);
});

test('changes kept as the page went away are dropped when another tab saved the guide meanwhile', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await tickN(page, 3);
  // (the page going away: its own save never lands, as when the browser drops it)
  await page.evaluate(() => { IDB.put = () => new Promise(() => {}); window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })); });
  assert.ok(await page.evaluate(() => localStorage.getItem('ms-guide-leave')), 'kept aside');
  // (another tab's save: a newer row)
  await page.evaluate((id) => { const e = state.saved.find((s) => s.id === id); e.ts = Date.now() + 5000; save(true); }, id);
  await page.reload(); await idle(page);
  assert.equal((await stored(page, id)).prog, 0, 'not put over the other tab’s save');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-guide-leave')), null);
  assert.deepEqual(errors, []);
});

test('Resume brings back section edits; Discard edits then keeps the Library guide as it was built', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId), n0 = await page.evaluate(() => __mstest.assignData.N);
  await tickN(page, 3); await idle(page, AUTO);
  await excludeOne(page);
  await hide(page); await idle(page);
  await page.reload();
  await page.waitForSelector('#sfResume', { state: 'visible' });
  await page.click('#sfResumeGo');
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id); await idle(page);
  // something else opens: Discard edits
  await page.evaluate(() => SF.loadSample());
  await page.waitForSelector('#sfEdAsk'); await page.click('#sfEdAsk [data-a="discard"]');
  await page.waitForFunction((id) => __mstest.curId !== id, id); await idle(page, AUTO);
  const s = await stored(page, id);
  assert.equal(s.n, n0, 'every section, as built');
  assert.equal(s.prog, 3, 'and its ticks');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-guide-auto')), null, 'the edits kept for Resume are gone');
  assert.deepEqual(errors, []);
});

test('section edits left by an earlier visit are kept as a copy when the guide is opened and changed another way', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await excludeOne(page);
  await hide(page); await idle(page);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-guide-auto')).edits), 1);
  // the app was closed; now the guide is opened from the Library (not Resume) and ticked
  await page.reload(); await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id); await idle(page);
  await tickN(page, 1); await page.evaluate(() => __mstest.flushSave()); await idle(page, AUTO);
  const names = await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => s.name));
  assert.equal(names.length, 2, 'the guide and its section edits: ' + names);
  assert.ok(names.some((n) => / \(section edits\)$/.test(n)));
  assert.deepEqual(errors, []);
});

test('a guide deleted while open with section edits doesn’t come back through Resume', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await excludeOne(page);
  await page.evaluate((id) => { libDelete(id); libFinish(); }, id); await idle(page);
  await hide(page); await idle(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-guide-auto')), null, 'nothing kept for Resume');
  assert.deepEqual(errors, []);
});

test('with storage blocked, opening something else asks before the guide goes', async () => {
  const { page, errors } = await openApp({ init: () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } }); } });
  await sampleGuide(page);
  await tickN(page, 2); await idle(page);
  await page.evaluate(() => SF.loadSample());
  await page.waitForSelector('#sfEdAsk');
  assert.match(await page.textContent('#sfEdAsk'), /isn’t letting Marker Studio save/);
  await page.click('#sfEdAsk [data-a="stay"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)), 2, 'Cancel: still open');
  await page.evaluate(() => SF.loadSample());
  await page.waitForSelector('#sfEdAsk'); await page.click('#sfEdAsk [data-a="go"]');
  await page.waitForFunction(() => __mstest.assignData && __mstest.colored.reduce((a, b) => a + b, 0) === 0); await idle(page);
  assert.equal(await page.locator('#sfEdAsk').count(), 0);
  assert.deepEqual(errors, []);
});

test('Continue opens Colour along with the marker’s row on screen', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await sampleGuide(page); await saveGuide(page);
  // part-way through a marker far down the list (the darkest with more than one section)
  await page.evaluate(() => { const t = __mstest, by = {}; t.assignData.order.forEach((l) => { const m = t.assignData.assign[l]; (by[m.mkey] = by[m.mkey] || { hex: m.hex, ls: [] }).ls.push(l); }); const lum = (h) => 0.299 * parseInt(h.slice(1, 3), 16) + 0.587 * parseInt(h.slice(3, 5), 16) + 0.114 * parseInt(h.slice(5, 7), 16); const e = Object.values(by).filter((e) => e.ls.length > 1).sort((a, b) => lum(a.hex) - lum(b.hex))[0]; t.colored[e.ls[0]] = 1; t.guideDirty = true; t.renderGuide(); });
  await page.evaluate(() => __mstest.flushSave()); await idle(page);
  await page.click('#mHome'); await idle(page);
  await page.click('#homeCont .hccard');
  await page.waitForFunction(() => __mstest.sfmode === 'color'); await idle(page); await idle(page);
  const r = await page.evaluate(() => { const row = document.querySelector('.sfarow.open').getBoundingClientRect(), bar = document.querySelector('#sfWork>.sfbar').getBoundingClientRect(); return { top: row.top, bottom: row.bottom, barTop: bar.top, pin: parseFloat(document.documentElement.style.getPropertyValue('--pinH')) || 0 }; });
  assert.ok(r.top >= r.pin - 2 && r.top < r.barTop - 20, `the open row is on screen (${JSON.stringify(r)})`);
  assert.deepEqual(errors, []);
});

test('Reveal: the keyboard goes into its bar and back to Reveal & share; one Escape closes it, even with a tip left open', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await scrollTop(page);
  const l = await page.evaluate(() => __mstest.assignData.order[0]);
  const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page);
  await page.click('.sftabbtn[data-t="share"]'); await idle(page);
  assert.equal(await page.evaluate(() => { const t = document.getElementById('sfTip'); return !!t && t.offsetParent !== null; }), false, 'the tip goes with the tab');
  await page.focus('#sfReveal'); await page.keyboard.press('Enter');
  await page.waitForSelector('#revShare', { timeout: 15000 });
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'revShare');
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev')), false, 'closed with one Escape');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'sfReveal');
  assert.deepEqual(errors, []);
});

test('the Library doesn’t say guides are backed up when none has been', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  await page.evaluate(() => { const g = state.saved.find((s) => s.type === 'guide'); g.fresh = 1; renderLibStat(); });
  assert.equal(await page.textContent('#libStat'), 'Not backed up yet');
  assert.deepEqual(errors, []);
});

test('the welcome on a landscape phone: the marker sets are in the one scrolling area', async () => {
  const { page, errors, ctx } = await openApp({ width: 667, height: 375 });
  await page.waitForSelector('#welcome.on');
  const g = await page.evaluate(() => { const s = document.getElementById('wcSets'); return { inner: s.scrollHeight - s.clientHeight }; });
  assert.ok(g.inner <= 1, 'the list doesn’t scroll inside another (' + g.inner + ')');
  await page.check('#wcSets input[data-i="3"]');
  assert.ok(await page.isEnabled('#wcAdd'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('one marker: Home says "1 marker"', async () => {
  const { page, errors } = await openApp();
  await page.click('#wcSkip').catch(() => {}); await page.click('#wcLook').catch(() => {});
  await page.evaluate(() => { state.owned = new Set([0]); save(); }); await page.click('#mPalette'); await page.click('#mHome'); await idle(page);
  assert.equal(await page.textContent('.homecard[data-go="collection"] .hcsub'), '1 marker');
  assert.deepEqual(errors, []);
});
