// The test strip (v282): Share › Print › Pages › Test strip. A page of boxes to try the guide's markers on your own
// paper: a row per line of the key (7a, 7b where zones shade a marker differently), each marker's ×1/×2 box once, and
// with shading a long box in thirds for its highlight, base and shadow; with blend companions, lighter, colour, darker.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

async function sharePrint(page) { await page.click('.sftabbtn[data-t="share"]'); await page.click('#sfPrint'); await page.waitForSelector('#sfSheet.sfprsh'); await idle(page); }
async function closePrint(page) { await page.click('#sfSheet [data-pr="cancel"]'); await page.waitForSelector('#sfSheet', { state: 'detached' }); }
// every text the strip's pages draw, by page
const strip = (page) => page.evaluate(() => {
  const P = CanvasRenderingContext2D.prototype, of = P.fillText, log = [];
  P.fillText = function (t, x, y) { log.push({ cv: this.canvas, t: String(t), x: this.textAlign === 'right' ? x - this.measureText(t).width : x, y, w: this.measureText(t).width }); return of.apply(this, arguments); };
  let cvs;
  try { cvs = __mstest.buildPDFPages(false); } finally { P.fillText = of; }
  const pg = (c) => cvs.indexOf(c);
  return { n: cvs.length, dims: cvs.map((c) => [c.width, c.height]), texts: log.filter((e) => pg(e.cv) >= 0).map((e) => ({ p: pg(e.cv), t: e.t, x: e.x, y: e.y, w: e.w })) };
});
const selectVal = (page, id, v) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);

test('Test strip: a Pages choice of its own; Labels have nothing to label; a row per marker with its ×1/×2 box; not remembered next time', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await sharePrint(page);
  await page.click('[data-pwhat="strip"]'); await idle(page);
  assert.equal(await page.getAttribute('[data-pwhat="strip"]', 'aria-pressed'), 'true');
  assert.equal(await page.isDisabled('[data-plabels="numbers"]'), true);
  assert.equal(await page.isDisabled('#sfPdfDark'), true);
  assert.match(await page.textContent('#sfPrSum'), /Test strip/);
  const r = await strip(page);
  const keyN = await page.evaluate(() => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size);
  assert.equal(r.n, 1, 'the sample’s markers fit on one Letter page');
  assert.equal(await page.evaluate(() => __mstest.buildPDFPages(true)), r.n);
  assert.ok(r.texts.some((e) => /^Test strip · /.test(e.t)));
  assert.ok(r.texts.some((e) => /^Paper: _+ +Date: _+$/.test(e.t)));
  assert.equal(r.texts.filter((e) => e.t === '×1').length, keyN, 'a ×1/×2 box per marker');
  // numbered as the key is
  for (let i = 1; i <= keyN; i++) assert.ok(r.texts.some((e) => e.t === String(i)), 'row ' + i);
  // everything inside the page, the margins kept
  const [w, h] = r.dims[0];
  for (const e of r.texts) assert.ok(e.x >= w * 0.04 && e.x + e.w <= w * 0.965 && e.y > 0 && e.y <= h * 0.985, `${e.t} inside the page`);
  // (the how-to is wrapped, at most three lines on Letter)
  const ti = r.texts.find((e) => /^Test strip/.test(e.t)), pl = r.texts.find((e) => /^Paper:/.test(e.t)),
    how = r.texts.filter((e) => e.p === 0 && e.y > ti.y && e.y < pl.y);
  assert.ok(how.length >= 1 && how.length <= 3, 'how-to lines: ' + how.length);
  // the strip is chosen once in a while: the choice from before stays stored
  await page.click('[data-pwhat="ref"]'); await idle(page);
  await page.click('[data-pwhat="strip"]'); await idle(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-pdf-what')), 'ref');
  await closePrint(page);
  // (while the app is open it stays chosen)
  await sharePrint(page);
  assert.equal(await page.getAttribute('[data-pwhat="strip"]', 'aria-pressed'), 'true');
  // the download: a PDF whose name says what it is
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
  assert.match(dl.suggestedFilename(), /-test-strip\.pdf$/);
  assert.deepEqual(errors, []);
});

test('Test strip with shading and a zone that shades differently: rows 1a/1b with the zone’s name, the tones in thirds, glazes “over B”, paper highlights, and more pages on A5', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await selectVal(page, 'sfShStyle', 'grey'); await idle(page);
  // a zone over the top third: paper highlights, cooler shadows
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await page.click('#sfZoneAdd'); await idle(page);
  await page.fill('#sfZoneName', 'Top'); await page.press('#sfZoneName', 'Enter');
  await page.evaluate(() => { const t = __mstest, cl = Object.keys(t.assignData.assign).map(Number).filter((l) => t.comps[l].cy < t.H * 0.35); t.zoneMove(cl, t.zoneCur); t.reassign([0, t.zoneCur]); });
  await page.click('#sfZoneDone'); await idle(page);
  await page.click('.sftabbtn[data-t="shading"]'); await idle(page);
  assert.equal(await page.isChecked('#sfZoneShade'), true, 'the zone is shaded, as Main was when it was made');
  await selectVal(page, 'sfHiStyle', 'paper'); await idle(page);
  await selectVal(page, 'sfShStyle', 'cool'); await idle(page);
  await sharePrint(page);
  await page.click('[data-paper="letter"]'); await idle(page);
  await page.click('[data-pwhat="strip"]'); await idle(page);
  assert.match(await page.textContent('#sfPrShNote'), /each colour’s row has a box for its tones/);
  const r = await strip(page);
  const T = r.texts.map((e) => e.t);
  assert.ok(T.includes('1a') && T.includes('1b'), 'a marker shaded differently in two zones has two rows');
  assert.ok(T.includes('in Main') && T.includes('in Top'));
  assert.ok(T.some((t) => /^B [A-Z]+\d+$/.test(t)), 'the base named in its third');
  assert.ok(T.some((t) => t === 'H: paper'), 'a paper highlight');
  assert.ok(T.includes('over B') && T.some((t) => /^S [A-Z]+\d+$/.test(t)), 'a glaze, laid over the base (on a line of its own)');
  assert.ok(T.some((t) => /^H [A-Z]+\d+$/.test(t) || t === 'H: none'), 'Main’s highlights');
  assert.ok(r.texts.some((e) => /nothing where it says paper or none/.test(e.t)), 'the how-to says what “paper” means');
  // each marker's ×1/×2 box once, however many rows it has
  const keyN = await page.evaluate(() => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size);
  assert.equal(T.filter((t) => t === '×1').length, keyN);
  assert.ok(r.n >= 2);
  // A5: a column a page, more pages, the same rows
  await page.click('[data-paper="a5"]'); await idle(page);
  const a5 = await strip(page);
  assert.ok(a5.n > r.n, `A5 ${a5.n} pages, Letter ${r.n}`);
  assert.equal(await page.evaluate(() => __mstest.buildPDFPages(true)), a5.n);
  const rowsA5 = a5.texts.filter((e) => /^\d+[ab]?$/.test(e.t)).map((e) => e.t).sort(), rowsL = r.texts.filter((e) => /^\d+[ab]?$/.test(e.t)).map((e) => e.t).sort();
  assert.deepEqual(rowsA5, rowsL, 'the same rows');
  // a marker's rows (4a, 4b) stay together, in one column of one page
  const where = {};
  for (const e of a5.texts.filter((e) => /^\d+[ab]$/.test(e.t))) (where[parseInt(e.t)] = where[parseInt(e.t)] || new Set()).add(e.p + ':' + Math.round(e.x));
  for (const n in where) assert.equal(where[n].size, 1, 'row ' + n + '’s lines together');
  assert.ok(a5.texts.some((e) => e.t === 'Page ' + a5.n + ' of ' + a5.n));
  // a zone left flat: its rows say so, when no other zone shades the marker
  await closePrint(page);
  await page.click('.sftabbtn[data-t="shading"]'); await idle(page);
  await page.click('#sfZoneShade'); await idle(page);
  await sharePrint(page);
  const fl = await strip(page);
  assert.ok(!fl.texts.some((e) => e.t === 'in Top'), 'a flat zone has no tones of its own');
  assert.deepEqual(errors, []);
});

test('Test strip with blend companions (no shading): lighter, the colour and darker in the long box, only markers you own', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await sharePrint(page);
  await page.click('[data-pwhat="strip"]'); await idle(page);
  const flat = await strip(page);
  await page.check('#sfPdfBlend'); await idle(page);
  const r = await strip(page);
  assert.ok(r.n >= flat.n);
  const own = await page.evaluate(() => { const t = __mstest, ks = new Set(t.coll.map((m) => m.mkey)); return [...ks].map((k) => k.split('|')[1]); });
  const named = r.texts.map((e) => e.t).filter((t) => /^[A-Z]+\d+$/.test(t));
  assert.ok(named.length > 0);
  for (const c of named) assert.ok(own.includes(c), c + ' is owned');
  assert.ok(r.texts.some((e) => /the lighter marker on the left/.test(e.t)));
  await page.uncheck('#sfPdfBlend');
  assert.deepEqual(errors, []);
});
