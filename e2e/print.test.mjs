// Print for real markers: the Print sheet's options (Share › Print…) (labels, label darkness, what to print, paper) and what
// they do to the PDF pages. The pages are read straight from __mstest.buildPDFPages(), with fillText and drawImage
// watched so the tests can see which labels were drawn, where the text sits and how big the reference is. Also: the
// downloaded PDF in Letter and A4.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as pw from 'playwright';
import { setup, teardown, openApp, sampleGuide, idle, trackIdle, startServer, ENGINE, saveArtifact, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

// build the PDF pages and report: page sizes, every text drawn (page, text, position, width, alignment, colour,
// whether it was drawn in page coordinates or on the picture), the pictures drawn and page 1's dark pixels
function probe(page, keep) {
  return page.evaluate((keep) => {
    const P = CanvasRenderingContext2D.prototype, of = P.fillText, od = P.drawImage, log = [], imgs = [];
    P.fillText = function (t, x, y) { const tr = this.getTransform(); log.push({ cv: this.canvas, t: String(t), x, y, w: this.measureText(t).width, al: this.textAlign, fill: this.fillStyle, id: tr.a === 1 && tr.b === 0 && tr.c === 0 && tr.d === 1 && tr.e === 0 && tr.f === 0 }); return of.apply(this, arguments); };
    P.drawImage = function (img, x, y, w, h) { if (arguments.length === 5) imgs.push({ cv: this.canvas, x, y, w, h, sw: img.width, sh: img.height }); return od.apply(this, arguments); };
    let cvs; try { cvs = __mstest.buildPDFPages(); } finally { P.fillText = of; P.drawImage = od; }
    const t = __mstest, pg = (c) => cvs.indexOf(c);
    const texts = log.filter((e) => pg(e.cv) >= 0).map((e) => ({ p: pg(e.cv), t: e.t, x: e.x, y: e.y, w: e.w, al: e.al, fill: e.fill, id: e.id }));
    const art = imgs.filter((e) => pg(e.cv) >= 0 && e.sw === t.W && e.sh === t.H).map((e) => ({ p: pg(e.cv), x: e.x, y: e.y, w: e.w, h: e.h }));
    const d = cvs[0].getContext('2d').getImageData(0, 0, cvs[0].width, cvs[0].height).data;
    let dark = 0; for (let i = 0; i < d.length; i += 4) if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 90) dark++;
    if (keep) { window.__p0 = window.__p0 || {}; window.__p0[keep] = d; }
    const codes = [...new Set(Object.values(t.assignData.assign).map((m) => m.code))];
    const keyN = new Set(Object.values(t.assignData.assign).map((m) => m.mkey)).size;
    // (v284: close-ups of small sections may come between the colouring page and the key)
    const keyP = Math.max(0, texts.findIndex((e) => /^Colour key/.test(e.t)) >= 0 ? texts.find((e) => /^Colour key/.test(e.t)).p : 1);
    return { pages: cvs.map((c) => [c.width, c.height]), texts, art, dark, codes, keyN, keyP, closeN: t.pdfCloseN, left: t.pdfLeft, onArt: texts.filter((e) => e.p === 0 && !e.id).map((e) => e.t) };
  }, keep || null);
}
// darkest pixel that labels added to page 1, compared with the page without labels
// (below the page's header, whose line of what's where changes with close-ups: v284)
const labelInk = (page, a, b) => page.evaluate(([a, b]) => { const A = window.__p0[a], B = window.__p0[b], L = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; let min = 255, n = 0; for (let i = Math.floor(A.length * 0.12 / 4) * 4; i < A.length; i += 4) { const la = L(A, i); if (la < L(B, i) - 30) { n++; if (la < min) min = la; } } return { min, n }; }, [a, b]);
const pick = (page, sel) => page.click(sel);
// the key's number column (right-aligned; v305: drawn as the colouring page's numbers are, light grey or with Darker
// labels near-black)
const NUM_INK = /^#(a0a0a0|111111)$/;
const keyNums = (r) => r.texts.filter((e) => e.p > 0 && e.al === 'right' && NUM_INK.test(e.fill) && /^\d+$/.test(e.t)).map((e) => e.t);
// Share › Print… opens the Print sheet; Cancel closes it
async function sharePrint(page) { await page.click('.sftabbtn[data-t="share"]'); await page.click('#sfPrint'); await page.waitForSelector('#sfSheet.sfprsh'); await idle(page); }
async function closePrint(page) { await page.click('#sfSheet [data-pr="cancel"]'); await page.waitForSelector('#sfSheet', { state: 'detached' }); }
// every text drawn in page coordinates, and every picture, stays inside the page margins
function checkInside(r, what) {
  r.pages.forEach(([w, h], p) => {
    const foot = r.texts.find((e) => e.p === p && e.t === 'Made with Marker Studio');
    assert.ok(foot, `${what} p${p + 1}: footer`);
    const m = foot.x;
    for (const e of r.texts.filter((e) => e.p === p && e.id)) {
      const left = e.al === 'right' ? e.x - e.w : e.al === 'center' ? e.x - e.w / 2 : e.x;
      assert.ok(left >= m - 1 && left + e.w <= w - m + 1, `${what} p${p + 1}: "${e.t}" runs outside the margins (${Math.round(left)}..${Math.round(left + e.w)} of ${w}, margin ${m})`);
      assert.ok(e.y > 0 && e.y < h, `${what} p${p + 1}: "${e.t}" off the page`);
    }
    for (const a of r.art.filter((a) => a.p === p)) assert.ok(a.x >= m - 1 && a.x + a.w <= w - m + 1 && a.y >= m && a.y + a.h <= h - m, `${what} p${p + 1}: picture inside the margins`);
  });
}

test('labels: Codes, Numbers or None on the colouring page, light grey unless Darker labels is ticked', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await sharePrint(page);
  assert.equal(await page.getAttribute('[data-plabels="codes"]', 'aria-pressed'), 'true', 'codes by default');
  assert.equal(await page.isChecked('#sfPdfDark'), false, 'light labels by default');

  const codes = await probe(page, 'codes');
  // (v284: every section is labelled on the page, or has a dot there and is labelled in a close-up; none overlap)
  const nSec = Object.keys(await page.evaluate(() => __mstest.assignData.assign)).length, onP1 = codes.onArt.filter((t) => !/^[A-Z]{1,2}$/.test(t));
  assert.equal(onP1.length + codes.closeN + codes.left, nSec, 'a label or a close-up for every section (or counted as left with a dot)');
  assert.ok(onP1.length >= nSec * 0.6, 'most labelled on the page: ' + onP1.length);
  const cs = [...new Set(onP1.filter((t) => !/^\d+$/.test(t)))];
  assert.ok(cs.every((t) => codes.codes.includes(t)) && cs.length >= codes.codes.length - 2, 'codes on the colouring page');
  assert.ok(codes.texts.filter((e) => e.p === 0 && !e.id && !/^[A-Z]{1,2}$/.test(e.t)).every((e) => e.fill === '#a0a0a0'), 'light grey labels');
  // (a key number stands in where a code won't fit: then the key has its numbers column)
  const fellBack = onP1.some((t) => /^\d+$/.test(t));
  assert.equal(codes.texts.some((e) => e.p === codes.keyP && e.t === 'NO.'), fellBack, 'a numbers column in the key only when numbers stand in');

  await pick(page, '[data-plabels="numbers"]');
  const nums = await probe(page, 'numbers');
  const want = Array.from({ length: nums.keyN }, (_, i) => String(i + 1));
  const ns = [...new Set(nums.onArt.filter((t) => /^\d+$/.test(t)))];
  assert.ok(ns.every((t) => want.includes(t)) && ns.length >= want.length - 2, 'numbers on the page, one per marker');
  // (v305: the key's numbers look as the page's do: light grey, as its labels are by default)
  const keyNums = nums.texts.filter((e) => e.p === nums.keyP && e.al === 'right' && e.fill === '#a0a0a0' && /^\d+$/.test(e.t)).map((e) => e.t);
  assert.deepEqual(keyNums, want, 'the key lists 1…N in order');
  assert.ok(nums.texts.some((e) => e.p === nums.keyP && e.t === 'NO.'), 'number column heading');
  assert.ok(nums.texts.some((e) => e.p === 0 && /numbers: see the colour key/.test(e.t)), 'the page says where the numbers are');

  await pick(page, '[data-plabels="none"]');
  assert.equal(await page.isDisabled('#sfPdfDark'), true, 'darkness has nothing to do with no labels');
  const none = await probe(page, 'none');
  assert.equal(none.onArt.length, 0, 'no labels drawn');
  assert.deepEqual(none.pages, codes.pages.slice(0, codes.pages.length - (codes.keyP - 1)), 'same pages otherwise (no close-ups)');

  await pick(page, '[data-plabels="codes"]'); await page.check('#sfPdfDark');
  const dark = await probe(page, 'dark');
  assert.ok(dark.texts.filter((e) => e.p === 0 && !e.id && !/^[A-Z]{1,2}$/.test(e.t)).every((e) => e.fill === '#111111'), 'darker labels are near-black (the close-ups’ letters aside)');
  assert.ok(dark.dark > none.dark + 2000, `darker labels add dark ink (${dark.dark} vs ${none.dark})`);
  assert.ok(codes.dark <= none.dark + 200, `light labels add no dark ink (${codes.dark} vs ${none.dark})`);
  const lightInk = await labelInk(page, 'codes', 'none'), darkInk = await labelInk(page, 'dark', 'none');
  assert.ok(lightInk.n > 1000 && lightInk.min >= 140, `light labels print grey: ${JSON.stringify(lightInk)}`);
  assert.ok(darkInk.min < 60, `darker labels print black: ${JSON.stringify(darkInk)}`);
  assert.deepEqual(errors, []);
});

test('v284: labels on the colouring page never overlap; a section with no room has a dot there and a label in a close-up; the key has a box to tick and the colouring order', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const r = await probe(page);
  const pl = await page.evaluate(() => { const p = __mstest.pdfP1; return { boxes: Object.values(p.lays).map((x) => x.box), lays: Object.keys(p.lays).length, dropped: p.dropped.length }; });
  const n = Object.keys(await page.evaluate(() => __mstest.assignData.assign)).length;
  assert.equal(pl.lays + pl.dropped, n, 'every section placed or left for a close-up');
  for (let i = 0; i < pl.boxes.length; i++) for (let j = i + 1; j < pl.boxes.length; j++) {
    const a = pl.boxes[i], b = pl.boxes[j];
    assert.ok(!(a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]), 'labels ' + i + ' and ' + j + ' overlap');
  }
  assert.equal(r.closeN + r.left, pl.dropped, 'each one left out is in a close-up, or counted');
  // the close-ups' letters on page 1 (the boxes placed after the labels and the dots) are clear of every label, and
  // each close-up labels its own sections inside its crop
  const cl = await page.evaluate(() => { const p = __mstest.pdfP1; return { all: p.boxes, n: __mstest.pdfCloseL, cu: __mstest.pdfCU }; });
  const letters = cl.all.slice(pl.lays + pl.dropped);
  assert.equal(letters.length, cl.n, 'a letter for each close-up');
  for (const b of letters) for (const a of pl.boxes) assert.ok(!(a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]), 'a letter on a label');
  for (const c of cl.cu) for (const b of c.boxes) assert.ok(b[0] >= c.crop[0] && b[1] >= c.crop[1] && b[2] <= c.crop[2] && b[3] <= c.crop[3], 'a label cut by its close-up’s edge');
  assert.ok(r.left <= pl.dropped * 0.1, 'nearly all of them labelled in their close-up: ' + r.left + ' of ' + pl.dropped);
  if (pl.dropped) {
    assert.ok(r.texts.some((e) => e.p === 1 && e.t === 'Close-ups'), 'the close-ups follow the colouring page');
    assert.ok(r.texts.some((e) => e.p === 0 && /close-ups? on pages? 2/.test(e.t)), 'the colouring page says where they are');
  }
  // the key: ORDER, with each marker's place lightest first, as 1st, 2nd … (so it can't be taken for a number)
  assert.ok(r.texts.some((e) => e.p === r.keyP && e.t === 'ORDER'));
  const ords = r.texts.filter((e) => e.p >= r.keyP && e.al === 'right' && e.fill === '#8a8a8a' && /^\d+(st|nd|rd|th)$/.test(e.t)).map((e) => e.t);
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  assert.deepEqual(ords.slice().sort((a, b) => parseInt(a) - parseInt(b)), Array.from({ length: r.keyN }, (_, i) => ord(i + 1)));
  assert.deepEqual(errors, []);
});

test('shading marks still work with numbers: H/S circles and tone lines, key keeps its tones', async () => {
  const { page, errors } = await openApp({ storage: { 'ms-pdf-labels': 'numbers' } });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  const r = await probe(page);
  const zones = r.onArt.filter((t) => t === 'H' || t === 'S'), nums = r.onArt.filter((t) => /^\d+$/.test(t));
  assert.ok(zones.length > 3, `H/S circles drawn (${zones.length})`);
  assert.ok(nums.length > 50, 'numbers drawn');
  assert.ok(r.texts.some((e) => e.p === r.keyP && e.t === 'H  HIGHLIGHT') && r.texts.some((e) => e.p === r.keyP && e.t === 'S  SHADOW'), 'key has tone columns');
  checkInside(r, 'letter shading numbers');
  assert.deepEqual(errors, []);
});

test('Key + reference: no colouring page, a coloured reference at least as big, labels switched off', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await sharePrint(page);
  const full = await probe(page);
  await pick(page, '[data-pwhat="ref"]');
  assert.equal(await page.isDisabled('[data-plabels="numbers"]'), true, 'labels have nothing to label');
  assert.equal(await page.isDisabled('#sfPdfDark'), true);
  const ref = await probe(page);
  assert.equal(ref.pages.length, full.pages.length - full.keyP, 'no colouring page (nor close-ups)');
  assert.equal(full.art.length, 2, 'colouring page + reference'); assert.equal(ref.art.length, 1, 'just the reference');
  const a = full.art[1], b = ref.art[0];
  // (v284: a tall picture's reference fills a column beside the key in Page + key too, so it can be as big)
  assert.ok(b.w * b.h >= a.w * a.h * 0.99, `as big a reference (${Math.round(b.w)}×${Math.round(b.h)} vs ${Math.round(a.w)}×${Math.round(a.h)})`);
  assert.equal(ref.onArt.length, 0, 'nothing drawn over the reference');
  assert.ok(ref.texts.some((e) => e.p === 0 && e.t === 'MARKER'), 'the key is on the first page');
  checkInside(ref, 'reference');
  assert.deepEqual(errors, []);
});

test('A5 and Half Letter: right page shape, smaller pages, nothing runs off the edge', async () => {
  const { page, errors } = await openApp({ storage: { 'ms-pdf-labels': 'numbers', 'ms-pdf-blend': '1' } });
  await sampleGuide(page);
  await sharePrint(page);
  const letter = await probe(page);
  checkInside(letter, 'letter blends');
  for (const [p, W, H] of [['a5', 419.53, 595.28], ['half', 396, 612], ['a4', 595.28, 841.89]]) {
    await pick(page, `[data-paper="${p}"]`);
    const r = await probe(page);
    for (const [w, h] of r.pages) assert.ok(Math.abs(w / h - W / H) < 0.002 && Math.abs(w - Math.round(W / 72 * 200)) <= 1, `${p}: page is ${w}×${h}`);
    checkInside(r, p + ' blends');
    assert.equal(keyNums(r).length, keyNums(letter).length, `${p}: every key row is there`);
    if (p !== 'a4') assert.ok(r.pages.length >= letter.pages.length, `${p}: the key may need more pages (${r.pages.length})`);
  }
  // shading on the smallest page, with the key's widest cells
  await closePrint(page); await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await sharePrint(page); await pick(page, '[data-paper="half"]');
  checkInside(await probe(page), 'half shading');
  await pick(page, '[data-pwhat="ref"]');
  checkInside(await probe(page), 'half shading reference');
  assert.deepEqual(errors, []);
});

// a context in a given locale, with a fresh profile and the test seam on
async function localeApp(server, browser, locale) {
  const ctx = await browser.newContext({ locale, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await trackIdle(ctx);
  await ctx.addInitScript(() => { window.__MS_TEST = true; });
  await ctx.route((u) => !u.href.startsWith(server.url), (r) => r.abort());
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.url);
  return { ctx, page, errors };
}
test('paper defaults to the local size: A4 in Britain, Letter in the US and Mexico', async () => {
  const server = await startServer(), browser = await pw[ENGINE].launch();
  try {
    for (const [loc, want] of [['en-GB', 'a4'], ['en-US', 'letter'], ['es-MX', 'letter'], ['de-DE', 'a4']]) {
      const { ctx, page, errors } = await localeApp(server, browser, loc);
      await sampleGuide(page);
      await sharePrint(page);
      assert.equal(await page.getAttribute('.sfpaper button.on', 'data-paper'), want, loc);
      const [w, h] = (await probe(page)).pages[0];
      assert.ok(Math.abs(w / h - (want === 'a4' ? 595.28 / 841.89 : 612 / 792)) < 0.002, `${loc}: ${w}×${h}`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); await server.close(); }
});

test('choices are remembered after a reload, and the download is a real PDF', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await sharePrint(page);
  await pick(page, '[data-plabels="numbers"]'); await page.check('#sfPdfDark'); await pick(page, '[data-paper="a5"]'); await pick(page, '[data-pwhat="ref"]');
  await closePrint(page); await saveGuide(page); await idle(page);
  await page.reload();
  await page.waitForFunction(() => !!window.__mstest);
  assert.deepEqual(await page.evaluate(() => ['ms-pdf-labels', 'ms-pdf-dark', 'ms-paper', 'ms-pdf-what'].map((k) => localStorage.getItem(k))), ['numbers', '1', 'a5', 'ref']);
  await page.click('#mHome'); await page.click('#sfRecent [data-gid]');
  await page.waitForFunction(() => !!__mstest.assignData); await idle(page);
  await sharePrint(page);
  for (const sel of ['[data-plabels="numbers"]', '[data-paper="a5"]', '[data-pwhat="ref"]']) assert.equal(await page.getAttribute(sel, 'aria-pressed'), 'true', sel);
  assert.equal(await page.isChecked('#sfPdfDark'), true);
  const n = (await probe(page)).pages.length;
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
  const bytes = await readFile(await dl.path()); await saveArtifact('print-a5-ref.pdf', bytes);
  const s = bytes.toString('latin1'), box = s.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
  assert.equal(s.slice(0, 5), '%PDF-');
  assert.deepEqual([+box[1], +box[2]], [419.53, 595.28], 'A5 media box');
  assert.equal((s.match(/\/Type\s*\/Page[^s]/g) || []).length, n, 'one PDF page per built page');
  assert.match(s.slice(-6), /%%EOF/);
  // back to the colouring page: one more page
  await pick(page, '[data-pwhat="page"]');
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
  const s2 = (await readFile(await dl2.path())).toString('latin1');
  assert.ok((s2.match(/\/Type\s*\/Page[^s]/g) || []).length > n, 'the colouring page is back');
  assert.deepEqual(errors, []);
});

async function pdf(page, name) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sfPDF')]);
  const path = await dl.path(); const bytes = await readFile(path);
  await saveArtifact(name + '.pdf', bytes);
  const s = bytes.toString('latin1');
  const box = s.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
  return { head: s.slice(0, 5), pages: (s.match(/\/Type\s*\/Page[^s]/g) || []).length, w: box && +box[1], h: box && +box[2] };
}
test('Print makes a Letter PDF by default and an A4 PDF when chosen', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="share"]'); await page.click('#sfPrint');
  const letter = await pdf(page, 'guide-letter');
  assert.equal(letter.head, '%PDF-');
  assert.deepEqual([letter.w, letter.h], [612, 792]);
  assert.ok(letter.pages >= 2, `${letter.pages} pages (colouring page + key)`);
  await page.click('[data-paper="a4"]');
  const a4 = await pdf(page, 'guide-a4');
  assert.deepEqual([Math.round(a4.w), Math.round(a4.h)], [595, 842]);
  assert.deepEqual(errors, []);
});
