// v299: fixes from the third fresh-eyes review — two of v298's own fixes put right (section edits from an earlier visit
// kept; Undo of a merge after a build gives the ticks back); a split-off coloured part keeps its marker and zone; the
// copy kept as the page goes works for edited guides; changes that couldn't be saved open instead of the older copy;
// Undo for Mark all coloured, Focus's Mark all done and a palette colour re-rolled; an old guide using Copic 0; and
// Scan's paste, typing and Clear list, Match's announcements, Random with nothing to draw.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, sampleGuide, saveGuide, idle, buildGo, scrollTop, sectionPoint } from './helpers.mjs';

before(setup);
after(teardown);

const hide = (page) => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; });
const slot = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ms-guide-auto') || 'null'));
const ticked = (page, ls) => page.evaluate((ls) => ls.map((l) => __mstest.colored[l]), ls);
const reopen = async (page, id) => {
  await page.evaluate(() => location.reload());
  await page.waitForLoadState('load'); await idle(page);
  await page.evaluate((id) => SF.openDesign(id), id);
  await page.waitForFunction((id) => window.__mstest && __mstest.assignData && __mstest.curId === id, id); await idle(page, 1500);
};

test('section edits kept for Resume from an earlier visit survive opening the guide and leaving Edit sections unchanged', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await page.click('#sfBack2'); await idle(page); await scrollTop(page);
  const l = await page.evaluate(() => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[2]; });
  const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y);
  await page.waitForFunction((l) => !__mstest.counted(l), l);
  await hide(page);
  await page.waitForFunction(() => { const m = JSON.parse(localStorage.getItem('ms-guide-auto') || 'null'); return m && m.edits === 1; });
  await page.reload(); await idle(page);
  // the same guide from the Library (not Resume), Edit sections, and back with nothing changed
  await page.evaluate((id) => { setMode('sections'); SF.openDesign(id); }, id);
  await page.waitForFunction(() => __mstest.assignData); await idle(page);
  await page.click('#sfBack2'); await idle(page);
  await page.click('#sfToPlan'); await idle(page, 1500);
  const m = await slot(page);
  assert.ok(m && m.edits === 1 && m.savedId === id, 'the earlier visit’s edits are still there: ' + JSON.stringify(m));
  assert.deepEqual(errors, []);
});

test('Undo of merges after building gives back the ticks the build took off', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const ls = await page.evaluate(() => {
    const t = __mstest, o = t.assignData.order.filter((l) => t.counted(l)), ls = [o[3], o[4], o[5], o[6]];
    t.colored[ls[0]] = 1; t.colored[ls[2]] = 1; t.colored[ls[3]] = 1; t.guideDirty = true; t.renderGuide();
    return ls;
  });
  await page.click('#sfBack2'); await idle(page);
  await page.evaluate(([a, b, c, d]) => { const t = __mstest; t.mergeCellsSnap(a, b); t.mergeCellsSnap(c, d); t.render(); }, ls);
  await buildGo(page); await idle(page);
  assert.deepEqual(await ticked(page, ls), [0, 0, 1, 0]);
  await page.click('#sfBack2'); await idle(page);
  await page.evaluate(() => { __mstest.doUndoSeg(); __mstest.doUndoSeg(); });
  await buildGo(page); await idle(page);
  assert.deepEqual(await ticked(page, ls), [1, 0, 1, 1], 'as they were before the merges');
  assert.deepEqual(errors, []);
});

test('a part split off a coloured section keeps its marker, its tick and its zone', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  // the biggest section, in a zone of its own, coloured
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await page.click('#sfZoneAdd'); await idle(page);
  const big = await page.evaluate(() => { const t = __mstest; let best = 0, ba = 0; for (const l of t.assignData.order) if (t.comps[l].area > ba) { ba = t.comps[l].area; best = l; } t.zoneMove([best], t.zoneCur); t.reassign([0, t.zoneCur]); return best; });
  await page.click('#sfZoneDone'); await idle(page);
  const [mk, z] = await page.evaluate((l) => { const t = __mstest; t.colored[l] = 1; t.guideDirty = true; t.renderGuide(); return [t.assignData.assign[l].mkey, t.zoneOf(l)]; }, big);
  assert.ok(z > 0);
  await page.click('#sfBack2'); await idle(page);
  const parts = await page.evaluate((l) => {
    const t = __mstest, c = t.comps[l], n0 = t.comps.length, y = Math.round(c.cy);
    t.snapshotSeg(); t.splitAt(l, [{ x: c.x0 - 3, y }, { x: c.x1 + 3, y }]); t.render();
    const out = [];
    for (let k = n0; k < t.comps.length; k++) if (t.comps[k] && !t.comps[k].merged && t.comps[k].area > 0) out.push(k);
    return out;
  }, big);
  assert.ok(parts.length >= 1, 'cut in two');
  await buildGo(page); await idle(page);
  const r = await page.evaluate((ls) => ls.map((l) => [__mstest.assignData.assign[l].mkey, __mstest.colored[l], __mstest.zoneOf(l)]), [big, ...parts]);
  for (const x of r) assert.deepEqual(x, [mk, 1, z]);
  assert.deepEqual(errors, []);
});

test('a guide with merged sections keeps its section numbers when opened, so ticks kept as the page went away aren’t lost', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfBack2'); await idle(page);
  await page.evaluate(() => { const t = __mstest, o = t.assignData.order.filter((l) => t.counted(l)); t.mergeCellsSnap(o[3], o[4]); t.render(); });
  await buildGo(page); await idle(page);
  await saveGuide(page); await idle(page, 2000);
  const id = await page.evaluate(() => __mstest.curId);
  await reopen(page, id);
  assert.equal(await page.evaluate(() => IDB.get('guide-' + __mstest.curId).then((p) => p.lmap === __mstest.lmapURL())), true, 'the picture as stored');
  // ticks, then the page is hidden and the database write never lands (a phone freezing the page)
  await page.evaluate(() => {
    const t = __mstest; t.assignData.order.slice(10, 13).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide();
    const op = IDB.put; IDB.put = function (k, v) { if (/^guide-/.test(k)) return new Promise(() => {}); return op(k, v); };
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await reopen(page, id);
  assert.equal(await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)), 3);
  assert.deepEqual(errors, []);
});

test('changes that couldn’t be saved (storage full) open from the Library instead of the older copy, and are then saved', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await saveGuide(page); await idle(page, 2000);
  const id = await page.evaluate(() => __mstest.curId);
  await page.evaluate(() => { const op = IDB.put; IDB.put = function (k, v) { if (/^guide-\d/.test(k)) return Promise.reject(new Error('QuotaExceededError')); return op(k, v); }; });
  await page.click('#sfColor'); await idle(page);
  const ls = await page.evaluate(() => { const t = __mstest, ls = t.assignData.order.slice(5, 15); ls.forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); return ls; });
  await page.waitForFunction(() => { const m = JSON.parse(localStorage.getItem('ms-guide-auto') || 'null'); return m && m.dirty; }, null, { timeout: 8000 });
  await page.evaluate(() => { const os = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'ms-guide-leave') throw new Error('QuotaExceededError'); return os.call(this, k, v); }; });
  await reopen(page, id);
  assert.equal(await page.evaluate((ls) => ls.filter((l) => __mstest.colored[l]).length, ls), 10, 'the newer copy opened');
  // a change: saved to the Library with the ticks, and the slot then goes
  await page.evaluate(() => { const t = __mstest; t.colored[t.assignData.order[30]] = 1; t.guideDirty = true; t.renderGuide(); });
  let saved = 0;
  for (let t = 0; t < 40 && saved < 11; t++) {
    await page.waitForTimeout(200); // polling the stored copy until the save lands
    saved = await page.evaluate((id) => IDB.get('guide-' + id).then((p) => p.prog.length), id);
  }
  assert.ok(saved >= 11, 'saved with the ticks: ' + saved);
  await page.waitForFunction(() => !localStorage.getItem('ms-guide-auto'), null, { timeout: 8000 });
  assert.deepEqual(errors, []);
});

test('Mark all coloured in Colour along, and Focus mode’s Mark all done, can be undone', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await idle(page); await scrollTop(page);
  const k0 = await page.evaluate(() => { const t = __mstest, n = {}; t.assignData.order.forEach((l) => { const k = t.assignData.assign[l].mkey; n[k] = (n[k] || 0) + 1; }); return Object.keys(n).sort((a, b) => n[b] - n[a])[0]; });
  await page.locator(`#sfAlist .sfarow[data-k="${k0}"] .sfah`).click(); await idle(page);
  const k = await page.evaluate(() => __mstest.hlKey);
  const secs = await page.evaluate((k) => __mstest.assignData.order.filter((l) => __mstest.assignData.assign[l].mkey === k), k);
  assert.ok(secs.length >= 2);
  await page.evaluate((l) => { __mstest.colored[l] = 1; __mstest.renderGuide(); }, secs[0]);
  await page.click('#sfMarkAll'); await idle(page);
  assert.ok((await ticked(page, secs)).every((x) => x === 1));
  assert.match(await page.textContent('#msToast'), /Marked all .+ coloured/);
  await page.click('#toastAct'); await idle(page);
  assert.deepEqual(await ticked(page, secs), secs.map((_, i) => (i === 0 ? 1 : 0)), 'back to the one that was done');
  // Focus mode: Colours › Mark all … done, then Undo
  await page.click('#sfFocus'); await idle(page);
  const fk = await page.evaluate(() => __mstest.assignData.assign[__mstest.focusOrd[__mstest.focusPos]].mkey);
  const fs = await page.evaluate((k) => __mstest.assignData.order.filter((l) => __mstest.assignData.assign[l].mkey === k), fk);
  const f0 = await ticked(page, fs);
  await page.click('#sfFocCols'); await idle(page);
  await page.click('#sfFocAll'); await idle(page);
  assert.ok((await ticked(page, fs)).every((x) => x === 1));
  assert.match(await page.textContent('#msToast'), /Marked all .+ done/);
  await page.click('#toastAct'); await idle(page);
  assert.deepEqual(await ticked(page, fs), f0, 'as they were');
  assert.deepEqual(errors, []);
});

test('re-rolling one palette colour can be undone', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look'); await idle(page);
  await page.click('#mPalette'); await page.click('#draw'); await idle(page, 1300);
  const p0 = await page.evaluate(() => state.palettes[state.palettes.length - 1].slice());
  await page.evaluate(() => doReRollBand(1));
  await page.waitForFunction((n) => state.palettes[state.palettes.length - 1].join() !== n, p0.join(), { timeout: 5000 });
  const p1 = await page.evaluate(() => state.palettes[state.palettes.length - 1].slice());
  assert.equal(p1.filter((x, i) => x !== p0[i]).length, 1, 'one colour changed');
  await page.click('#undo'); await idle(page);
  assert.deepEqual(await page.evaluate(() => state.palettes[state.palettes.length - 1].slice()), p0, 'Undo brings it back');
  assert.deepEqual(errors, []);
});

test('an older guide that used Copic 0 (owned) opens with it, not as a marker "no longer in your collection"', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.evaluate(() => { COLORS.forEach((c, i) => { state.owned.add(mkey(i)); }); save(); SF.setCollection(sfCollection()); });
  await page.evaluate(() => {
    const t = __mstest, d = t.currentDesignObj(), p = Object.assign({}, d.payload, { name: 'Blend', W: d.W, H: d.H }), k = Object.keys(p.assign);
    p.assign = Object.assign({}, p.assign); p.assign[k[0]] = 'Copic|0'; p.prog = [];
    t.openDesignObj(p, null);
  });
  await page.waitForFunction(() => __mstest.curName === 'Blend'); await idle(page);
  assert.doesNotMatch(await page.evaluate(() => [...document.querySelectorAll('#sfMeta, #msToast')].map((e) => e.textContent).join(' ')), /no longer in your collection/);
  assert.ok(await page.evaluate(() => Object.values(__mstest.assignData.assign).some((m) => m.mkey === 'Copic|0')));
  assert.deepEqual(errors, []);
});

test('Random with nothing in play says so, not "All drawn"', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look'); await idle(page);
  await page.evaluate(() => { setMode('random'); });
  // (an Ohuhu set owned, Copic chosen)
  await page.evaluate(() => { state.brands = new Set(['Copic']); save(); fullRender(); });
  await idle(page);
  assert.equal(await page.textContent('#draw'), 'No markers to draw');
  assert.equal(await page.isDisabled('#draw'), true);
  assert.deepEqual(errors, []);
});

test('Match: the result isn’t a live region; the best match is said once the colour holds still', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look'); await idle(page);
  await page.evaluate(() => msMatchHex('#cc3344')); await idle(page);
  assert.equal(await page.getAttribute('#matchResult', 'aria-live'), null);
  await page.waitForFunction(() => document.getElementById('matchSay').textContent.length > 0, null, { timeout: 3000 });
  assert.match(await page.textContent('#matchSay'), / match: /);
  assert.deepEqual(errors, []);
});

async function scanOpened(opts) {
  const a = await openApp(opts);
  await welcome(a.page, 'look'); await idle(a.page);
  await a.page.click('#mCollection'); await idle(a.page);
  await a.page.click('#scanOpen'); await idle(a.page);
  return a;
}
const scanText = (page, text) => page.evaluate((t) => { const b = document.getElementById('scBox'); b.value = t; b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' })); }, text);
const paste = (page, text) => page.evaluate((t) => { const d = new DataTransfer(); d.setData('text/plain', t); document.getElementById('scBox').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d })); }, text);
const list = (page) => page.$$eval('#scList .scrow', (rs) => rs.map((r) => (r.querySelector('.sccode') || r.querySelector('b')).textContent));

test('Scan: Copic B04 typed after Ohuhu B04 is asked about; a paste reads what Scan Text left waiting; a letter typed after a read starts afresh; Clear list takes two taps', async () => {
  const { page, errors } = await scanOpened();
  const ohB04 = await page.evaluate(() => COLORS.find((c) => c.brand === 'Ohuhu' && c.code === 'B04').name);
  await page.fill('#scBox', 'B04 ' + ohB04); await page.press('#scBox', 'Enter'); await idle(page);
  await page.fill('#scBox', 'B04'); await page.press('#scBox', 'Enter'); await idle(page);
  assert.equal(await page.locator('#scList .scask').count(), 1, 'asked: Copic’s B04 too?');
  // Scan Text text waiting to hold still, then a paste: both read
  await scanText(page, 'E19 Dried Sage');
  await paste(page, 'B015');
  await idle(page);
  const l = await list(page);
  assert.ok(l.includes('E19') && l.includes('B015'), l.join(','));
  assert.equal(await page.inputValue('#scBox'), '');
  // read, then a letter typed straight away: the box holds the letter, not the old text with it
  await scanText(page, 'R014');
  await page.waitForFunction(() => document.querySelectorAll('#scList .scrow').length >= 5, null, { timeout: 3000 });
  await page.evaluate(() => { const b = document.getElementById('scBox'); b.value = b.value + 'E'; b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'E' })); });
  assert.equal(await page.inputValue('#scBox'), 'E');
  // Clear list: the first tap only asks
  const n = (await list(page)).length;
  await page.click('#scClear');
  assert.equal((await list(page)).length, n);
  assert.equal(await page.textContent('#scClear'), 'Tap again to clear');
  await page.click('#scClear');
  assert.equal((await list(page)).length, 0);
  assert.deepEqual(errors, []);
});
