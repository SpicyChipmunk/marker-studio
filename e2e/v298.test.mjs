// v298: fixes from the second fresh-eyes review of v297 — ticks follow merged and split sections; Focus mode says
// where it is up to; zones keep touching sections apart across their borders; a guide file with odd keys opens; the
// sets list follows Clear collection; and Scan's box: the same text again is still cleared, Enter then the same cap
// again is read, letters composed by an Android keyboard wait for Enter, and a card isn't repeated while held.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, sampleGuide, idle, buildGo, scrollTop, sectionPoint } from './helpers.mjs';

before(setup);
after(teardown);

const ticked = (page, ls) => page.evaluate((ls) => ls.map((l) => __mstest.colored[l]), ls);

test('building again after merging: a merged section stays ticked only when every part was; a split one keeps its tick in each part', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  // a and b: only a ticked; c and d: both ticked
  const [a, b, c, d] = await page.evaluate(() => {
    const t = __mstest, o = t.assignData.order.filter((l) => t.counted(l));
    const ls = [o[3], o[4], o[5], o[6]];
    t.colored[ls[0]] = 1; t.colored[ls[2]] = 1; t.colored[ls[3]] = 1; t.guideDirty = true; t.renderGuide();
    return ls;
  });
  await page.click('#sfBack2'); await idle(page);
  await page.evaluate(([a, b, c, d]) => { const t = __mstest; t.mergeCellsSnap(a, b); t.mergeCellsSnap(c, d); t.render(); t.renderControls(); }, [a, b, c, d]);
  assert.match(await page.textContent('#sfKeepLine'), /Merged sections stay ticked only when every part was/);
  await buildGo(page); await idle(page);
  assert.deepEqual(await ticked(page, [a, b, c, d]), [0, 0, 1, 0], 'a half-coloured merge is to colour; a whole one is done; the merged-away ones count for nothing');
  // a big coloured section cut in two: both parts coloured
  const big = await page.evaluate(() => {
    const t = __mstest; let best = 0, ba = 0;
    for (const l of t.assignData.order) if (t.counted(l) && t.comps[l].area > ba) { ba = t.comps[l].area; best = l; }
    t.colored[best] = 1; t.guideDirty = true; t.renderGuide();
    return best;
  });
  await page.click('#sfBack2'); await idle(page);
  const made = await page.evaluate((l) => {
    const t = __mstest, c = t.comps[l], n0 = t.comps.length, y = Math.round(c.cy);
    t.snapshotSeg();
    const m = t.splitAt(l, [{ x: c.x0 - 3, y }, { x: c.x1 + 3, y }]);
    t.render();
    const out = [];
    for (let k = n0; k < t.comps.length; k++) if (t.comps[k] && !t.comps[k].merged && t.comps[k].area > 0) out.push(k);
    return { m, out };
  }, big);
  assert.ok(made.m >= 1 && made.out.length >= 1, 'cut in two');
  await buildGo(page); await idle(page);
  const parts = await ticked(page, [big, ...made.out]);
  assert.ok(parts.every((x) => x === 1), 'each part coloured: ' + parts.join(','));
  assert.deepEqual(errors, []);
});

test('Focus mode says each section as it comes, and that the page is finished', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await page.click('#sfFocus'); await idle(page);
  const live = () => page.evaluate(() => new Promise((r) => setTimeout(() => r(document.getElementById('sfLive').textContent), 120)));
  const name = await page.textContent('#sfFocName');
  let s = await live();
  assert.ok(s.startsWith(name + '. Section 1 of '), s);
  await page.click('#sfFDone'); await idle(page);
  s = await live();
  assert.match(s, /\. Section \d+ of \d+/);
  assert.ok(s.startsWith(await page.textContent('#sfFocName')));
  assert.deepEqual(errors, []);
});

test('zones: touching sections either side of a zone’s border don’t share a marker when the pattern keeps them apart', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await page.click('#sfFam [data-v="random"]'); await idle(page);
  await page.click('#sfBal [data-v="mixed"]'); await idle(page);
  await page.evaluate(() => { __mstest.styleVars.noAdj = true; });
  await page.click('#sfZoneAdd'); await idle(page);
  await page.evaluate(() => { const t = __mstest, cl = Object.keys(t.assignData.assign).map(Number).filter((l) => t.comps[l].cy > t.H * 0.5); t.zoneMove(cl, t.zoneCur); t.reassign([0, t.zoneCur]); });
  await page.click('#sfZoneDone'); await idle(page);
  await page.evaluate(() => { __mstest.styleVars.noAdj = true; });
  const clash = await page.evaluate(() => {
    const t = __mstest, ids = [0].concat(t.zones.map((z) => z.id));
    let n = 0, pairs = 0;
    for (let r = 0; r < 8; r++) {
      t.reassign(ids);
      const A = t.assignData.assign, adj = t.adj;
      for (const l in A)
        if (adj[l])
          adj[l].forEach((q) => {
            if (+q > +l && A[q] && t.zoneOf(+l) !== t.zoneOf(+q)) { pairs++; if (A[q].mkey === A[l].mkey) n++; }
          });
    }
    return { n, pairs };
  });
  assert.ok(clash.pairs > 20, 'pairs across the border: ' + clash.pairs);
  assert.equal(clash.n, 0, `${clash.n} of ${clash.pairs} touching pairs across the border share a marker`);
  assert.deepEqual(errors, []);
});

test('a guide file whose keys include "constructor" or "toString" opens, the rest of it as it was', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.evaluate(() => {
    const t = __mstest, d = t.currentDesignObj(), p = Object.assign({}, d.payload, { name: 'Odd', W: d.W, H: d.H });
    p.assign = Object.assign({ constructor: 'Ohuhu|R14', toString: 'Ohuhu|R14' }, p.assign);
    p.locks = { constructor: 'Ohuhu|R14' };
    p.prog = (p.prog || []).concat(['constructor', 'hasOwnProperty']);
    t.openDesignObj(p, null);
  });
  await page.waitForFunction(() => __mstest.curName === 'Odd'); await idle(page);
  const r = await page.evaluate(() => { const t = __mstest; return { N: t.assignData.N, ok: t.assignData.order.every((l) => Number.isInteger(l) && t.assignData.assign[l] && t.assignData.assign[l].mkey) }; });
  assert.ok(r.N > 20 && r.ok, JSON.stringify(r));
  assert.doesNotMatch(await page.evaluate(() => [...document.querySelectorAll('#msToast, .mserr, #sfMeta')].map((e) => e.textContent).join(' ')), /Couldn’t open that guide/);
  assert.deepEqual(errors, []);
});

test('Markers › Add a set: the sets you have are unmarked by Clear collection, and marked again by its Undo', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mCollection'); await idle(page);
  await page.click('#presetHdr'); await idle(page);
  const have = () => page.$$eval('#presetList .presetrow.have', (r) => r.length);
  const n0 = await have();
  assert.ok(n0 >= 1);
  await page.click('#presetReset'); await page.click('#presetReset'); await idle(page);
  assert.equal(await have(), 0);
  await page.click('#toastAct'); await idle(page);
  assert.equal(await have(), n0);
  assert.deepEqual(errors, []);
});

test('Undo after Change colour on a coloured section puts its marker back', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const l = await page.evaluate(() => { const t = __mstest; let best = 0, ba = 0; for (const l of t.assignData.order) if (t.comps[l].area > ba) { ba = t.comps[l].area; best = l; } t.colored[best] = 1; t.guideDirty = true; t.renderGuide(); return best; });
  const mk = () => page.evaluate((l) => [__mstest.assignData.assign[l].mkey, __mstest.locks[l] ?? null], l);
  const [orig] = await mk();
  await scrollTop(page);
  const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page);
  await page.click('.sftip [data-a="change"]'); await page.waitForSelector('#sfSheet', { state: 'visible' });
  const k1 = await page.evaluate((not) => [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')].find((b) => b.dataset.k !== not).dataset.k, orig);
  await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k1}"]`); await page.click('#sfPopConfirm'); await idle(page);
  assert.deepEqual(await mk(), [k1, k1]);
  await page.click('#sfPlanUndo'); await idle(page);
  assert.deepEqual(await mk(), [orig, null], 'its marker back, unpinned');
  assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1, 'still ticked');
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
const list = (page) => page.$$eval('#scList .scrow', (rs) => rs.map((r) => (r.querySelector('.sccode') || r.querySelector('b')).textContent));
const stat = (page) => page.textContent('#scStat');

test('Scan: the same text coming back is still cleared; after Enter the same code is read again; Android’s composed letters wait for Enter', async () => {
  // (v299: the composed-letters rule is Android's only)
  const { page, errors } = await scanOpened({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' });
  // read, then (before it clears) the camera swaps the text and puts the same back: still cleared
  await scanText(page, 'E19 Dried Sage');
  await page.waitForFunction(() => document.querySelector('#scList .scrow'));
  await scanText(page, 'E1');
  await scanText(page, 'E19 Dried Sage');
  await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 4000 });
  assert.deepEqual(await list(page), ['E19']);
  // typed with Enter, then Scan Text brings the same code (another cap): read, not left in the box
  await page.click('#scClear'); await page.click('#scClear');
  await page.fill('#scBox', 'B015'); await page.press('#scBox', 'Enter'); await idle(page);
  assert.deepEqual(await list(page), ['B015']);
  await page.click('#scClear'); await page.click('#scClear');
  await scanText(page, 'B015');
  await page.waitForFunction(() => document.querySelector('#scList .scrow'), null, { timeout: 4000 });
  assert.deepEqual(await list(page), ['B015']);
  // Gboard: each letter a composition of the whole word so far; a pause after "R1" reads nothing
  await page.click('#scClear'); await page.click('#scClear');
  await page.evaluate(() => { const b = document.getElementById('scBox'); b.value = ''; b.dispatchEvent(new Event('scanreset')); });
  for (const v of ['R', 'R1']) {
    await page.evaluate((v) => { const b = document.getElementById('scBox'); b.value = v; b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: v, isComposing: true })); }, v);
  }
  await page.waitForTimeout(1000); // longer than the box waits for text to hold still: nothing may be read
  assert.deepEqual(await list(page), [], 'nothing read half-typed');
  assert.equal(await page.inputValue('#scBox'), 'R1');
  assert.deepEqual(errors, []);
});

test('Scan: another brand’s code says the marker and that it’s another brand, once while it’s held in view', async () => {
  const { page, errors } = await scanOpened();
  await page.click('#scBrand button[data-b="Ohuhu"]');
  await page.evaluate(() => { window.__beeps = 0; const o = scanBeep; window.scanBeep = scanBeep = function (k) { window.__beeps++; return o(k); }; });
  await scanText(page, 'C-3'); await idle(page, 1200);
  assert.match(await stat(page), /^.?Copic C-3 /);
  assert.match(await stat(page), /Another brand than the one chosen \(Ohuhu\)/);
  const b1 = await page.evaluate(() => window.__beeps);
  await scanText(page, 'C-3 '); await idle(page, 1200);
  await scanText(page, 'C-3'); await idle(page, 1200);
  assert.equal(await page.evaluate(() => window.__beeps), b1, 'not again while held');
  assert.deepEqual(errors, []);
});

test('Scan: a pasted list with a line of only a name and a line of another brand’s code asks about each in the list', async () => {
  const { page, errors } = await scanOpened();
  await page.click('#scBrand button[data-b="Ohuhu"]');
  await page.evaluate((t) => { const d = new DataTransfer(); d.setData('text/plain', t); document.getElementById('scBox').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d })); }, 'B015\nHoneydew Melon\nC-3');
  await idle(page);
  const asks = await page.$$eval('#scList .scask b', (b) => b.map((x) => x.textContent));
  assert.equal(asks.length, 2, asks.join(' | '));
  assert.ok(asks.some((t) => /Only its name was read/.test(t)));
  assert.ok(asks.some((t) => /Another brand than the one chosen \(Ohuhu\)/.test(t)));
  assert.match(await stat(page), /1 added to the list/);
  assert.deepEqual(errors, []);
});
