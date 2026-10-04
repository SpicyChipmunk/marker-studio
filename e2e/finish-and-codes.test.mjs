// v284: Colour along's Codes button works (codes off: every section in its colour, those done keeping their ✓); a
// finished page shows as it is, with what was coloured and when; Save image can leave the codes off; a guide part-way
// coloured opens in Colour along, its Home card saying how far; the codes on the picture never come out tinier than
// 6 screen pixels where their section nearly holds them, redrawn as you zoom; the first time the screen is kept on,
// a toast says so.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

// the canvas colour a little way from a section's label (inside it), and the marker's own
const colourAt = (page, l) => page.evaluate((l) => {
  const t = __mstest, c = document.getElementById('sfCanvas'), g = c.getContext('2d'), m = t.assignData.assign[l];
  let best = null;
  for (let y = 0; y < t.H && !best; y += 2) for (let x = 0; x < t.W; x += 2) if (t.labels[y * t.W + x] === l) {
    const p = t.labelPos(l); if (Math.hypot(x - p.x, y - p.y) < 16) continue;
    best = [x, y]; break;
  }
  const d = g.getImageData(best[0], best[1], 1, 1).data, h = m.hex;
  return { px: [d[0], d[1], d[2]], mk: [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) };
}, l);
const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

test('Colour along: done sections in their colour, the rest pale (v288, as your paper); Codes off shows every section in its colour', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await idle(page);
  const [l, l2] = await page.evaluate(() => { const t = __mstest, a = t.assignData, s = a.order.slice().sort((x, y) => t.comps[y].area - t.comps[x].area); t.colored[s[1]] = 1; t.renderGuide(); return [s[1], s[2]]; });
  let c = await colourAt(page, l), c2 = await colourAt(page, l2);
  assert.ok(near(c.px, c.mk, 40), 'done: its own colour ' + c.px + ' vs ' + c.mk);
  assert.ok(!near(c2.px, c2.mk, 30), 'not done: pale ' + c2.px + ' vs ' + c2.mk);
  await page.click('#sfCodes'); await idle(page);
  assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'false');
  c = await colourAt(page, l); c2 = await colourAt(page, l2);
  assert.ok(near(c.px, c.mk, 40), 'codes off: its own colour ' + c.px + ' vs ' + c.mk);
  assert.ok(near(c2.px, c2.mk, 40), 'codes off: not done in its own colour too ' + c2.px + ' vs ' + c2.mk);
  await page.click('#sfCodes'); await idle(page);
  c2 = await colourAt(page, l2);
  assert.ok(!near(c2.px, c2.mk, 30), 'codes on: not done pale again');
  assert.deepEqual(errors, []);
});

test('a finished page: the picture as it is, what was coloured and when (saved with the guide); Save image can leave the codes off', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await idle(page);
  // all but one ticked, then the last by a tap on its row's Mark all done
  await page.evaluate(() => { const t = __mstest, o = t.assignData.order; o.slice(1).forEach((l) => { t.colored[l] = 1; }); t.checkComplete(); t.renderGuide(); });
  await page.evaluate(() => { const t = __mstest; t.colored[t.assignData.order[0]] = 1; });
  await page.evaluate(() => __mstest.checkComplete());
  await page.evaluate(() => { __mstest.updateProgress(); __mstest.renderGuide(); });
  await idle(page);
  assert.match(await page.textContent('#sfDoneSum'), /^\d+ sections · \d+ markers · coloured today$/);
  const at = await page.evaluate(() => __mstest.progAt);
  assert.ok(at.s > 0 && at.e >= at.s);
  const l = await page.evaluate(() => __mstest.assignData.order[3]);
  const c = await colourAt(page, l);
  assert.ok(near(c.px, c.mk, 40), 'the finished picture in its colours');
  const d = await page.evaluate(() => __mstest.currentDesignObj().payload.dates);
  assert.deepEqual(d, { s: at.s, e: at.e });
  // Save image, without the codes
  await page.click('#sfDoneBtn'); await idle(page);
  await page.click('.sftabbtn[data-t="share"]'); await idle(page);
  // (v305: the codes go off by themselves once the page is finished; ticking and unticking is still your choice)
  assert.equal(await page.isChecked('#sfExCodes'), false);
  await page.check('#sfExCodes');
  assert.equal(await page.evaluate(() => __mstest.exCodes), true);
  await page.uncheck('#sfExCodes');
  assert.equal(await page.evaluate(() => __mstest.exCodes), false);
  const diff = await page.evaluate(() => {
    const a = __mstest.buildExportCanvas(false, false), b = __mstest.buildExportCanvas(false, true), H = __mstest.H, W = __mstest.W;
    const da = a.getContext('2d').getImageData(0, 0, W, H).data, db = b.getContext('2d').getImageData(0, 0, W, H).data;
    let n = 0; for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i]) n++;
    return n;
  });
  assert.ok(diff > 500, 'the codes left off: ' + diff);
  assert.deepEqual(errors, []);
});

test('a guide coloured before the dates were kept gets none (not today’s): finished, it says only what was coloured', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.evaluate(() => { const t = __mstest, d = t.currentDesignObj(), p = Object.assign({}, d.payload, { name: 'Old', W: d.W, H: d.H, prog: Object.keys(d.payload.assign).map(Number) }); delete p.dates; t.openDesignObj(p, null); });
  await page.waitForFunction(() => __mstest.curName === 'Old' && __mstest.assignData); await idle(page);
  if (await page.evaluate(() => __mstest.sfmode) !== 'color') { await page.click('#sfColor'); await idle(page); }
  await page.evaluate(() => { __mstest.checkComplete(); __mstest.updateProgress(); });
  assert.equal(await page.evaluate(() => __mstest.progAt.s), 0, 'no start date made up');
  assert.match(await page.textContent('#sfDoneSum'), /^\d+ sections · \d+ markers$/);
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.dates), undefined);
  assert.deepEqual(errors, []);
});

test('a guide part-way coloured opens in Colour along, its Home card saying how far (one not started opens in the plan, as the other tests find)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await saveGuide(page);
  await page.click('#sfColor'); await idle(page);
  await page.evaluate(() => { const t = __mstest; t.assignData.order.slice(0, 20).forEach((l) => { t.colored[l] = 1; }); t.checkComplete(); t.renderGuide(); });
  await page.click('#sfDoneBtn'); await idle(page);
  await page.evaluate(() => { __mstest.guideDirty = true; return SF.flushSave(); });
  await page.waitForFunction(() => { const s = state.saved.find((x) => x.type === 'guide'); return s && s.done === 20; });
  await page.reload(); await idle(page);
  await page.click('#mHome'); await idle(page);
  // (v285: it's Home's Continue card)
  assert.match(await page.textContent('#homeCont .hcmeta'), /^20 of \d+ coloured/);
  await page.click('#homeCont .hccard');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'color'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
  assert.deepEqual(errors, []);
});

test('codes on the picture: tinier than 6 screen pixels only where their section is far too small, redrawn in steps as you zoom', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const m0 = await page.evaluate(() => __mstest.labMin), s0 = await page.evaluate(() => document.getElementById('sfCanvas').offsetWidth / __mstest.W);
  assert.ok(Math.abs(m0 * s0 - 6) < 0.5, '6 screen pixels at 1×: ' + m0 * s0);
  await page.click('#sfZin'); await page.click('#sfZin'); await idle(page);
  await page.waitForFunction((m0) => __mstest.labMin < m0, m0);
  const z = await page.evaluate(() => __mstest.zoom), m1 = await page.evaluate(() => __mstest.labMin);
  assert.ok(m1 * s0 * z >= 4.2 && m1 * s0 * z <= 8.5, 'about 6 screen pixels zoomed in: ' + m1 * s0 * z);
  assert.deepEqual(errors, []);
});

test('the first time Colour along keeps the screen on, a toast says so (once)', async () => {
  const init = () => { Object.defineProperty(navigator, 'wakeLock', { value: { request: () => Promise.resolve({ addEventListener() {}, release() {} }) }, configurable: true }); };
  const { page, errors } = await openApp({ init });
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await idle(page);
  await page.waitForFunction(() => /Your screen stays on while you colour along\./.test(document.getElementById('msToast')?.textContent || ''));
  await page.click('#sfDoneBtn'); await idle(page);
  await page.evaluate(() => document.getElementById('msToast').classList.remove('on'));
  await page.click('#sfColor'); await idle(page);
  await page.waitForTimeout(300);
  assert.ok(!/screen stays on/.test(await page.evaluate(() => { const t = document.getElementById('msToast'); return t.classList.contains('on') ? t.textContent : ''; })), 'not again');
  assert.deepEqual(errors, []);
});
