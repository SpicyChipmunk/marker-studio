// v296: fixes from the fresh-eyes review of v296 — ← Plan › Discard opening the photo picker, zoomed-in redraws a part
// at a time on the codes' own canvas, ticks after Codes off, the palette's Undo and locks, the scheme line.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, scrollTop, sectionPoint } from './helpers.mjs';

before(setup);
after(teardown);

const tickN = (page, n, from = 0) => page.evaluate(([n, from]) => { const t = __mstest; t.assignData.order.slice(from, from + n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, [n, from]);
// the picture and the codes' canvas as they are, against a from-scratch redraw of the same state
const vsFull = (page) => page.evaluate(() => {
  const grab = () => ['sfCanvas', 'sfLabHi'].map((id) => { const c = document.getElementById(id); return c && c.width && c.style.display !== 'none' ? c.getContext('2d').getImageData(0, 0, c.width, c.height).data.slice() : null; });
  __mstest.renderGuide();
  const a = grab();
  __mstest.forceFullRender(); __mstest.renderGuide();
  const b = grab();
  return a.map((x, k) => { if (!x || !b[k] || x.length !== b[k].length) return x || b[k] ? 'size' : 0; let n = 0; for (let i = 0; i < x.length; i++) if (x[i] !== b[k][i]) n++; return n; });
});

test('← Plan › Discard edits goes back to the Plan and opens no photo picker (only Home’s New guide does that)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfBack2'); await idle(page); await scrollTop(page);
  const l = await page.evaluate(() => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[2]; });
  const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y);
  await page.waitForFunction((l) => !__mstest.counted(l), l);
  let chooser = false;
  page.on('filechooser', () => { chooser = true; });
  await page.evaluate(() => scrollTo(0, 99999)); await idle(page);
  await page.click('#sfToPlan');
  await page.waitForSelector('#sfEdAsk'); await page.click('#sfEdAsk [data-a="discard"]');
  await page.waitForFunction(() => __mstest.sfmode === 'guide'); await idle(page, 1500);
  assert.equal(chooser, false, 'no photo picker');
  assert.equal(await page.evaluate((l) => __mstest.counted(l), l), true, 'the edit discarded');
  assert.deepEqual(errors, []);
});

test('zoomed in, ticks are drawn a part at a time, the codes on their own canvas, exactly as a full draw', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await idle(page);
  await page.click('#sfZin'); await page.click('#sfZin'); await idle(page);
  await page.waitForFunction(() => { const h = document.getElementById('sfLabHi'); return h && h.style.display !== 'none' && h.width > 0; });
  // a part at a time: no whole-picture put while ticking
  await page.evaluate(() => { window.__whole = 0; const P = CanvasRenderingContext2D.prototype, o = P.putImageData; P.putImageData = function (im) { if (this.canvas.id === 'sfCanvas' && arguments.length < 7) window.__whole++; return o.apply(this, arguments); }; });
  await tickN(page, 3);
  assert.equal(await page.evaluate(() => window.__whole), 0, 'drawn a part at a time');
  assert.deepEqual(await vsFull(page), [0, 0], 'the picture and the codes as a full draw');
  await tickN(page, 4, 3);
  assert.deepEqual(await vsFull(page), [0, 0], 'again');
  assert.deepEqual(errors, []);
});

test('Codes off in Colour along: the ticks are drawn the Codes-off way everywhere, as a full draw', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await idle(page);
  // most of the page coloured: only a little left to draw a part at a time
  const n = await page.evaluate(() => __mstest.assignData.order.length);
  await tickN(page, n - 3);
  await page.click('#sfCodes'); await idle(page);
  assert.deepEqual(await vsFull(page), [0, 0]);
  await page.click('#sfCodes'); await idle(page);
  assert.deepEqual(await vsFull(page), [0, 0]);
  assert.deepEqual(errors, []);
});

test('zoomed in, leaving the guide hands the codes’ canvas back; coming back draws them again', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfZin'); await page.click('#sfZin'); await idle(page);
  const on = () => page.evaluate(() => { const h = document.getElementById('sfLabHi'); return !!h && h.style.display !== 'none' && h.width > 0; });
  await page.waitForFunction(() => { const h = document.getElementById('sfLabHi'); return h && h.style.display !== 'none' && h.width > 0; });
  await page.click('#mHome'); await idle(page);
  assert.equal(await on(), false, 'handed back');
  await page.click('#mSections'); await idle(page);
  await page.waitForFunction(() => { const h = document.getElementById('sfLabHi'); return h && h.style.display !== 'none' && h.width > 0; }, null, { timeout: 5000 });
  assert.deepEqual(await vsFull(page), [0, 0], 'and drawn as a full draw would');
  assert.deepEqual(errors, []);
});
