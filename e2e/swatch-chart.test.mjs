// Markers › Print a swatch chart: the sheet (which markers, order, labels, paper) with its page count, and the PDF it
// makes with the guide's PDF writer — a box per marker beside a strip of its screen colour, numbered, grouped by brand,
// with a registration mark in each corner of every page.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup, teardown, openApp, welcome, idle, saveArtifact } from './helpers.mjs';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

before(setup);
after(teardown);

// every console error and uncaught error on the page
function watch(page, errors) { page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); return errors; }
async function openChart(page) {
  await page.click('#mCollection'); await idle(page);
  await page.click('#swatchBtn');
  await page.waitForSelector('#swOverlay.on');
}
const pick = async (page, k, v) => { await page.click(`#swOpts [data-k="${k}"][data-v="${v}"]`); await idle(page); };
const summary = async (page) => (await page.textContent('#swSum')).trim();
// the PDF's pages and page size, straight from the file
function pdfInfo(bytes) {
  const s = bytes.toString('latin1'), box = s.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
  return { head: s.slice(0, 5), pages: (s.match(/\/Type \/Page\b(?!s)/g) || []).length, count: +(s.match(/\/Type \/Pages [^>]*\/Count (\d+)/) || [])[1], w: box && +box[1], h: box && +box[2] };
}
async function download(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#swGo')]);
  return { name: dl.suggestedFilename(), bytes: await readFile(await dl.path()) };
}
// draw the chart's pages as the download would, and report the text on each and the colour at each corner mark
function probe(page) {
  return page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype, of = P.fillText, log = [];
    P.fillText = function (t) { log.push({ cv: this.canvas, t: String(t) }); return of.apply(this, arguments); };
    const pk = SF.pdfKit, pap = pk.paper(), g = swGeom(pap, swOpt.labels), pages = swLayout(swGroups(swList(swOpt.what), swOpt.order), g), k = pk.DPI / 25.4, out = [];
    try {
      pages.forEach((pg, i) => {
        const c = swDraw(pg, i, pages.length, g, { paper: pap, title: 'Swatch chart · test' }), x = c.getContext('2d');
        const at = (mx, my) => Array.from(x.getImageData(Math.round(mx * k), Math.round(my * k), 1, 1).data.slice(0, 3));
        const q = g.R / 2, marks = [[g.m + q, g.m + q], [g.pw - g.m - q, g.m + q], [g.m + q, g.ph - g.m - q], [g.pw - g.m - q, g.ph - g.m - q]].map((p) => at(p[0], p[1]));
        out.push({ w: c.width, h: c.height, texts: log.filter((e) => e.cv === c).map((e) => e.t), marks, corner: at(g.m + 0.4, g.ph - g.m - 0.4), cells: pg.items.filter((it) => !it.h).map((it) => ({ no: it.no, code: COLORS[it.i].code, brand: COLORS[it.i].brand, x: it.x, y: it.y })), heads: pg.items.filter((it) => it.h).map((it) => it.h + (it.cont ? ' (continued)' : '')) });
        c.width = 0;
      });
    } finally { P.fillText = of; }
    return { pages: out, g };
  });
}

test('the sheet opens from Markers and previews pages and markers for the collection and for a brand', async () => {
  const { page, errors } = await openApp();
  watch(page, errors);
  await welcome(page, 'look');
  await openChart(page);
  assert.equal(await page.isVisible('#swOverlay .dcard'), true);
  assert.equal(await page.getAttribute('#swOpts [data-k="what"][data-v="owned"]', 'aria-pressed'), 'true', 'My collection by default');
  assert.equal(await page.getAttribute('#swOpts [data-k="order"][data-v="fam"]', 'aria-pressed'), 'true', 'colour family order by default');
  assert.equal(await page.getAttribute('#swOpts [data-k="labels"][data-v="name"]', 'aria-pressed'), 'true', 'code + name by default');
  const paper = await page.evaluate(() => localStorage.getItem('ms-paper') || SF.pdfKit.paper());
  assert.equal(await page.getAttribute(`#swOpts [data-k="paper"][data-v="${paper}"]`, 'aria-pressed'), 'true', 'the app’s paper choice');
  const owned = await page.evaluate(() => state.owned.size);
  // (v309.1: Honolulu 120 comes with its Colorless Blender, which has its box like any marker)
  assert.equal(owned, 121);
  // Letter and A4 take 5 columns × 8 rows of boxes with names, 9 rows with codes only
  await pick(page, 'paper', 'letter');
  assert.equal(await summary(page), '4 pages · 121 markers');
  await pick(page, 'what', 'Copic');
  assert.equal(await summary(page), '9 pages · 358 markers');
  await pick(page, 'what', 'Ohuhu');
  assert.equal(await summary(page), '10 pages · 364 markers');
  await pick(page, 'labels', 'code');
  assert.equal(await summary(page), '9 pages · 364 markers', 'codes only fit more rows');
  await pick(page, 'paper', 'a5');
  const a5 = await page.evaluate(() => { const g = swGeom('a5', 'code'); return { cols: g.cols, box: g.box }; });
  assert.ok(a5.cols >= 3 && a5.box >= 16, 'pocket paper still has nib-sized boxes');
  assert.match(await summary(page), /^\d+ pages · 364 markers$/);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-paper')), 'a5', 'paper is the app’s shared print option');
  // the sheet's own choices are remembered, apart from which markers (always your collection when it opens)
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.isVisible('#swOverlay'), false, 'Escape closes it');
  await page.click('#swatchBtn'); await page.waitForSelector('#swOverlay.on');
  assert.equal(await page.getAttribute('#swOpts [data-k="what"][data-v="owned"]', 'aria-pressed'), 'true');
  assert.equal(await page.getAttribute('#swOpts [data-k="labels"][data-v="code"]', 'aria-pressed'), 'true');
  assert.equal(await page.getAttribute('#swOpts [data-k="paper"][data-v="a5"]', 'aria-pressed'), 'true');
  await page.click('#swClose');
  assert.deepEqual(errors, []);
});

test('with no markers to print, Download is off and the sheet says why', async () => {
  const { page, errors } = await openApp();
  watch(page, errors);
  await page.click('#wcSkip'); await page.click('#wcLook'); await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 0);
  await openChart(page);
  assert.equal(await page.isDisabled('#swGo'), true);
  assert.match(await summary(page), /collection is empty/);
  assert.equal(await page.getAttribute('#swGo', 'aria-describedby'), 'swSum');
  await pick(page, 'what', 'wish');
  assert.equal(await page.isDisabled('#swGo'), true);
  assert.match(await summary(page), /To buy list is empty/);
  await pick(page, 'what', 'Ohuhu');
  assert.equal(await page.isDisabled('#swGo'), false, 'a whole brand can still be printed');
  assert.match(await summary(page), /· 364 markers$/);
  assert.deepEqual(errors, []);
});

test('the download is a PDF with the pages the sheet promised, on the chosen paper', async () => {
  const { page, errors } = await openApp();
  watch(page, errors);
  await welcome(page, 'look');
  await openChart(page);
  await pick(page, 'paper', 'letter');
  let d = await download(page);
  let info = pdfInfo(d.bytes);
  assert.equal(info.head, '%PDF-');
  assert.equal(info.pages, 4); assert.equal(info.count, 4); // (with the blender, v309.1)
  assert.deepEqual([info.w, info.h], [612, 792], 'Letter');
  assert.match(d.name, /^swatch-chart-my-collection-\d{4}-\d{2}-\d{2}\.pdf$/);
  await saveArtifact('swatch-chart-letter.pdf', d.bytes);
  await page.waitForFunction(() => /downloaded/.test(document.getElementById('msToast')?.textContent || ''));
  // a large set on A4, quickly
  await pick(page, 'what', 'Copic'); await pick(page, 'paper', 'a4');
  const want = +(await summary(page)).match(/^(\d+) pages/)[1];
  const t0 = Date.now();
  d = await download(page);
  const ms = Date.now() - t0;
  info = pdfInfo(d.bytes);
  assert.equal(info.head, '%PDF-');
  assert.equal(info.pages, want, 'as many pages as the sheet said');
  assert.deepEqual([info.w, info.h], [595.28, 841.89], 'A4');
  assert.ok(ms < 20000, `358 markers took ${ms} ms`);
  assert.equal(await page.isDisabled('#swGo'), false, 'ready for another');
  assert.equal((await page.textContent('#swGo')).trim(), 'Download PDF');
  await saveArtifact('swatch-chart-a4-copic.pdf', d.bytes);
  assert.deepEqual(errors, []);
});

test('each page: a numbered box and screen colour for every marker, brand headings, header, footer and corner marks', async () => {
  const { page, errors } = await openApp();
  watch(page, errors);
  await welcome(page, 'look');
  // a To buy list with both brands, in code order
  const keys = await page.evaluate(() => { const o = COLORS.filter((c, i) => c.brand === 'Ohuhu' && !isOwned(i)).slice(0, 44), c = COLORS.filter((c) => c.brand === 'Copic').slice(0, 3); const ks = [...o, ...c].map((m) => m.brand + '|' + m.code); ks.forEach((k) => addWish(k, 'test', true)); save(); return ks; });
  await openChart(page);
  await pick(page, 'what', 'wish'); await pick(page, 'order', 'code'); await pick(page, 'paper', 'letter');
  assert.equal(await summary(page), '2 pages · 47 markers');
  const r = await probe(page);
  assert.equal(r.pages.length, 2);
  const cells = r.pages.flatMap((p) => p.cells);
  assert.deepEqual(cells.map((c) => c.no), keys.map((_, i) => i + 1), 'boxes numbered 1…N through the chart');
  assert.deepEqual(cells.map((c) => c.brand + '|' + c.code).sort(), [...keys].sort(), 'every marker once');
  const oh = cells.filter((c) => c.brand === 'Ohuhu').map((c) => c.code);
  assert.deepEqual(oh, [...oh].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), 'code order');
  assert.ok(cells.findIndex((c) => c.brand === 'Copic') > cells.findLastIndex((c) => c.brand === 'Ohuhu'), 'grouped by brand');
  assert.deepEqual(r.pages.map((p) => p.heads), [['Ohuhu'], ['Ohuhu (continued)', 'Copic']]);
  r.pages.forEach((p, i) => {
    for (const c of p.cells) { assert.ok(p.texts.includes(c.code), `p${i + 1}: ${c.code}`); assert.ok(p.texts.includes(String(c.no)), `p${i + 1}: box ${c.no}`); }
    assert.ok(p.texts.includes('Page ' + (i + 1) + ' of 2'), 'page x of y');
    assert.ok(p.texts.includes('Swatch chart · test'), 'header');
    assert.ok(p.texts.includes('Made with Marker Studio'));
    // three solid marks and a hollow one at the bottom right, on white paper
    assert.deepEqual(p.marks.slice(0, 3), [[0, 0, 0], [0, 0, 0], [0, 0, 0]], `p${i + 1}: solid corner marks`);
    assert.deepEqual(p.marks[3], [255, 255, 255], `p${i + 1}: hollow bottom-right mark`);
    assert.deepEqual(p.corner, [0, 0, 0]);
    // a regular grid: the columns line up and every box fits between the marks
    const xs = [...new Set(p.cells.map((c) => c.x.toFixed(2)))];
    assert.ok(xs.length <= r.g.cols);
    for (const c of p.cells) assert.ok(c.x >= r.g.m && c.x + r.g.cw <= r.g.pw - r.g.m + 0.01 && c.y >= r.g.top && c.y + r.g.box <= r.g.bot, `box ${c.no} inside the page`);
  });
  assert.ok(r.g.box >= 16 && r.g.box <= 20, 'boxes a nib can fill');
  // names go with Code + name, not with Code only
  const name = await page.evaluate((k) => COLORS.find((c) => c.brand + '|' + c.code === k).name, keys[0]);
  assert.ok(r.pages[0].texts.includes(name));
  await pick(page, 'labels', 'code');
  assert.ok(!(await probe(page)).pages[0].texts.includes(name));
  assert.deepEqual(errors, []);
});

test('on a phone the chart goes to the share sheet, with a Share button when the tap has expired', async () => {
  const init = () => {
    window.__shared = [];
    let n = 0;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: (d) => { window.__shared.push(d.files[0].name + ' ' + d.files[0].type); return ++n === 1 ? Promise.reject(new DOMException('no gesture', 'NotAllowedError')) : Promise.resolve(); } });
  };
  const { page, errors } = await openApp({ init, userAgent: IPHONE });
  watch(page, errors);
  await welcome(page, 'look');
  await openChart(page);
  await page.click('#swGo');
  await page.waitForSelector('#msToast.on #toastAct');
  assert.match(await page.textContent('#msToast'), /Your swatch chart is ready/);
  await page.click('#toastAct'); await idle(page);
  const shared = await page.evaluate(() => window.__shared);
  assert.equal(shared.length, 2);
  assert.match(shared[1], /^swatch-chart-my-collection-.*\.pdf application\/pdf$/);
  assert.deepEqual(errors, []);
});
