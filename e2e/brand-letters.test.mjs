// Brand letters: on screen they follow your collection and the view (one brand owned: letters only where a view mixes
// brands; both brands owned, or none yet: letters everywhere), while exports go by what they hold (one brand is named
// once, mixed brands keep the letters and the key).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { setup, teardown, openApp, welcome, sampleGuide, idle, scrollTop } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From v265 ----
// V265_SHOTS=<dir> also saves the screenshots looked at by hand (Markers Owned / All, Match, the PDF's first page)
const SHOTS = process.env.V265_SHOTS || '';
const snap = async (page, name) => { if (SHOTS) { await mkdir(SHOTS, { recursive: true }); await page.screenshot({ path: SHOTS + '/' + name + '.png' }); } };

const letters = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.offsetParent).map((e) => e.textContent));

// every text drawn on the PDF's pages (page number and text)
const pdfTexts = (page) => page.evaluate(() => { const P = CanvasRenderingContext2D.prototype, of = P.fillText, log = []; P.fillText = function (t) { log.push({ cv: this.canvas, t: String(t) }); return of.apply(this, arguments); }; let cvs; try { cvs = __mstest.buildPDFPages(); } finally { P.fillText = of; } window.__pdf0 = cvs[0].toDataURL('image/png'); return log.filter((e) => cvs.indexOf(e.cv) >= 0).map((e) => ({ p: cvs.indexOf(e.cv), t: e.t })); });
const canvasTexts = (page, fn) => page.evaluate((fn) => { const P = CanvasRenderingContext2D.prototype, of = P.fillText, log = []; P.fillText = function (t) { log.push(String(t)); return of.apply(this, arguments); }; try { __mstest[fn](); } finally { P.fillText = of; } return log; }, fn);
test('brand letters: hidden in an Ohuhu-only Owned view, shown in All and Unowned, and in Match results that mix brands (another brand clearly closer is named in full)', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mCollection'); await idle(page);
  await page.click('#ownView [data-v="owned"]'); await idle(page);
  assert.ok(await page.locator('#results .cell').count() > 50);
  assert.deepEqual(await letters(page, '#results .cell .bt'), [], 'one brand: no letters');
  assert.match(await page.getAttribute('#results .cell', 'aria-label'), /^Ohuhu /, 'the label still names the brand');
  await snap(page, 'c-markers-owned');
  await page.click('#ownView [data-v="all"]'); await idle(page);
  const all = await letters(page, '#results .cell .bt');
  assert.ok(all.includes('O') && all.includes('C'), 'All mixes brands: letters');
  await snap(page, 'c-markers-all');
  await page.click('#ownView [data-v="unowned"]'); await idle(page);
  assert.ok((await letters(page, '#results .cell .bt')).length > 0);
  // filtered to one brand, All has no letters either
  await page.click('#ownView [data-v="all"]'); await idle(page);
  await page.evaluate(() => { fgTap('brand', 'Ohuhu'); save(); fullRender(); }); await idle(page);
  assert.deepEqual(await letters(page, '#results .cell .bt'), []);
  await page.evaluate(() => { fgClear('brand'); save(); fullRender(); }); await idle(page);
  // Match: letters on every row when the rows mix brands, on none when they don't
  await page.click('#mkMatchBtn'); await page.click('.msrc [data-src="hex"]');
  let mixedSeen = false, singleSeen = false, otherSeen = false;
  for (const hex of ['#0bd6c8', '#e03c31', '#f2c14e', '#6b4f9e', '#9a9a9a', '#2e7d32', '#ff8fb1', '#3a7bd5']) {
    await page.fill('#matchHex', hex); await idle(page);
    // (v304: another brand's row under "Closer in Copic" names its brand in full and carries no letter; the letters
    // follow the other rows)
    const r = await page.evaluate(() => { const full = (x) => /^(Ohuhu|Copic) /.test(x.querySelector('.mnm b').textContent); if ([...document.querySelectorAll('#matchResult .mrow')].some((x) => full(x) && x.querySelector('.mtag'))) return { bad: 1 }; const rows = [...document.querySelectorAll('#matchResult .mrow')].filter((x) => !full(x)), best = document.querySelector('#matchResult .mbbrand'); const bs = new Set(rows.map((x) => x.getAttribute('data-copy').split(' ')[0])); if (best && /marker$/.test(best.textContent)) bs.add(best.textContent.split(' ')[0]); return { n: rows.length, tags: document.querySelectorAll('#matchResult .mtag').length, mixed: bs.size > 1, other: document.querySelectorAll('#matchResult .mrow').length - rows.length }; });
    assert.ok(!r.bad, hex + ': no letter on a row that names its brand');
    if (r.other) otherSeen = true;
    if (r.mixed) { mixedSeen = true; assert.equal(r.tags, r.n, hex + ': mixed → a letter on every row'); if (SHOTS && !singleSeen) await snap(page, 'c-match'); } else { singleSeen = true; assert.equal(r.tags, 0, hex + ': one brand → no letters'); }
  }
  // (v304: an Ohuhu collection's rows are Ohuhu, yours and to buy; a Copic one clearly closer is named in full)
  assert.ok(otherSeen || mixedSeen, 'some result names another brand');
  await page.click('#matchClose');
  // Palette and Random with only Ohuhu markers: no letters
  await page.click('#mPalette'); await page.click('#draw'); await idle(page);
  assert.deepEqual((await letters(page, '#bands .band .bt')).filter(Boolean), []);
  assert.match(await page.getAttribute('#bands .band .bhit', 'aria-label'), /^Ohuhu /);
  assert.deepEqual(errors, []);
});

test('exports: one brand is named once in the headers (no letters); mixed brands keep the letters and the key', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  assert.deepEqual(await page.evaluate(() => [...new Set(Object.values(__mstest.assignData.assign).map((m) => m.brand))]), ['Ohuhu']);
  let t = await pdfTexts(page);
  assert.ok(t.some((e) => e.p === 0 && /\d+ Ohuhu markers/.test(e.t)), 'page 1 says the brand: ' + t.filter((e) => e.p === 0).map((e) => e.t).slice(0, 4));
  // (the key's page: after any close-ups of small sections, v284)
  const kp = (t) => t.find((e) => e.t === 'Colour key')?.p ?? 1;
  assert.ok(t.some((e) => e.p === kp(t) && /· \d+ Ohuhu markers ·/.test(e.t)), 'and the key page');
  assert.ok(!t.some((e) => /= Copic|= Ohuhu/.test(e.t)), 'no letter key');
  assert.ok(!t.some((e) => e.p >= kp(t) && /^[OC]$/.test(e.t)), 'no letter column');
  if (SHOTS) { await mkdir(SHOTS, { recursive: true }); const png = await page.evaluate(() => window.__pdf0); await writeFile(SHOTS + '/c-pdf-page1.png', Buffer.from(png.split(',')[1], 'base64')); }
  // the saved image and the share card
  let img = await canvasTexts(page, 'buildExportCanvas');
  assert.ok(img.includes('Ohuhu markers') && !img.some((s) => /= Copic/.test(s)) && !img.some((s) => /^O {2}/.test(s)));
  let card = await canvasTexts(page, 'buildShareCard');
  assert.ok(card.includes('Ohuhu markers') && !card.includes('O'));
  // the same picture with Copic markers too
  await page.evaluate(() => { COLORS.forEach((c, i) => { if (c.brand === 'Copic') state.owned.add(mkey(i)); }); save(); SF.setCollection(sfCollection()); __mstest.reassign(); });
  await idle(page);
  assert.equal(await page.evaluate(() => new Set(Object.values(__mstest.assignData.assign).map((m) => m.brand)).size), 2, 'the guide mixes brands now');
  t = await pdfTexts(page);
  assert.ok(t.some((e) => e.p === kp(t) && /C = Copic {2}O = Ohuhu/.test(e.t)), 'the key page has the letter key');
  assert.ok(t.some((e) => e.p >= kp(t) && e.t === 'C') && t.some((e) => e.p >= kp(t) && e.t === 'O'), 'and a letter on each row');
  assert.ok(!t.some((e) => /Ohuhu markers|Copic markers/.test(e.t)));
  img = await canvasTexts(page, 'buildExportCanvas');
  assert.ok(img.some((s) => /C = Copic/.test(s)) && img.some((s) => /^[OC] {2}/.test(s)));
  card = await canvasTexts(page, 'buildShareCard');
  assert.ok(card.some((s) => /C = Copic/.test(s)) && card.includes('O') && card.includes('C'));
  assert.deepEqual(errors, []);
});

test('the palette card says the brand once when there is one', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  const t = await page.evaluate(async () => { const P = CanvasRenderingContext2D.prototype, of = P.fillText, log = []; P.fillText = function (s) { log.push(String(s)); return of.apply(this, arguments); }; try { const oh = [], mixed = []; COLORS.forEach((c, i) => { if (c.brand === 'Ohuhu' && oh.length < 12) oh.push(i); }); const cp = COLORS.map((c, i) => i).filter((i) => COLORS[i].brand === 'Copic').slice(0, 6); mixed.push(...oh.slice(0, 6), ...cp); await makeCard(oh, 'drawn'); log.push('---'); await makeCard(mixed, 'drawn'); } finally { P.fillText = of; } return log; });
  const [one, mix] = [t.slice(0, t.indexOf('---')), t.slice(t.indexOf('---') + 1)];
  assert.ok(one.includes('12 colours · Ohuhu markers'));
  assert.ok(!one.some((s) => /^O /.test(s)), 'no letters');
  assert.ok(mix.some((s) => /^12 colours · C = Copic/.test(s)) && mix.some((s) => /^C /.test(s)) && mix.some((s) => /^O /.test(s)));
  assert.deepEqual(errors, []);
});

// ---- From v267 ----
// V267_SHOTS=<dir> also saves the screenshots looked at by hand
const SHOTS_V267 = process.env.V267_SHOTS || '';
const snapV267 = async (page, name) => { if (SHOTS_V267) { await mkdir(SHOTS_V267, { recursive: true }); await page.screenshot({ path: SHOTS_V267 + '/' + name + '.png' }); } };
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v266', ...extra });
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: [], saved: [], ...extra });
const guideBrands = (page) => page.evaluate(() => [...new Set(Object.values(__mstest.assignData.assign).map((m) => m.brand))]);
// some Copic markers into an Ohuhu collection (the guide already made keeps its Ohuhu markers)
const ownCopic = (page, n = 12) => page.evaluate((n) => {
  let k = 0;
  COLORS.forEach((c, i) => { if (c.brand === 'Copic' && k < n) { state.owned.add(mkey(i)); k++; } });
  save(); if (window.SF) SF.setCollection(sfCollection());
}, n);
// every text drawn on the guide's picture in a full redraw (a code label's brand letter is drawn on its own)
const pictureTexts = (page) => page.evaluate(() => {
  const P = CanvasRenderingContext2D.prototype, of = P.fillText, cv = document.getElementById('sfCanvas'), log = [];
  P.fillText = function (t) { if (this.canvas === cv) log.push(String(t)); return of.apply(this, arguments); };
  try { __mstest.forceFullRender(); __mstest.renderGuide(); } finally { P.fillText = of; }
  return log;
});
const pdfTextsOnly = (page) => page.evaluate(() => { const P = CanvasRenderingContext2D.prototype, of = P.fillText, log = []; P.fillText = function (t) { log.push({ cv: this.canvas, t: String(t) }); return of.apply(this, arguments); }; let cvs; try { cvs = __mstest.buildPDFPages(); } finally { P.fillText = of; } return log.filter((e) => cvs.indexOf(e.cv) >= 0).map((e) => ({ p: cvs.indexOf(e.cv), t: e.t })); });
// Match a colour: the rows, how many carry a letter, and whether they mix brands
async function matchRows(page, hex) {
  await page.fill('#matchHex', hex); await idle(page);
  // (v304: another brand's row under "Closer in Copic" names its brand in full, with no letter: left out here)
  return page.evaluate(() => { const rows = [...document.querySelectorAll('#matchResult .mrow')].filter((x) => !/^(Ohuhu|Copic) /.test(x.querySelector('.mnm b').textContent)); return { n: rows.length, tags: document.querySelectorAll('#matchResult .mtag').length, mixed: new Set(rows.map((x) => x.getAttribute('data-copy').split(' ')[0])).size > 1 }; });
}
const HEXES = ['#0bd6c8', '#e03c31', '#f2c14e', '#6b4f9e', '#9a9a9a', '#2e7d32'];
async function markersView(page, v) { await page.click('#mCollection'); await idle(page); await page.click(`#ownView [data-v="${v}"]`); await idle(page); }
async function drawPalette(page) { await page.click('#mPalette'); await page.click('#draw'); await idle(page); }

test('letters, one brand owned: none on lists of that brand (Owned, Palette, the guide), still where a view mixes (All, Match)', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await markersView(page, 'owned');
  assert.ok(await page.locator('#results .cell').count() > 50);
  assert.deepEqual(await letters(page, '#results .cell .bt'), [], 'Owned: no letters');
  await markersView(page, 'all');
  const all = await letters(page, '#results .cell .bt');
  assert.ok(all.includes('O') && all.includes('C'), 'All mixes brands: letters');
  await page.click('#mkMatchBtn'); await page.click('.msrc [data-src="hex"]');
  let single = 0;
  for (const hex of HEXES) { const r = await matchRows(page, hex); if (!r.mixed) { single++; assert.equal(r.tags, 0, hex + ': one brand → no letters'); } else assert.equal(r.tags, r.n, hex); }
  assert.ok(single > 0, 'some result is one brand');
  await page.click('#matchClose');
  await drawPalette(page);
  assert.deepEqual((await letters(page, '#bands .band .bt')).filter(Boolean), []);
  assert.equal(await page.$$eval('#readout .rbt', (x) => x.length), 0, 'no letters in the code line');
  // the sample guide, all Ohuhu: no letters on the picture or in Colour along
  await page.evaluate(() => SF.loadSample());
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData)); await idle(page);
  assert.deepEqual(await guideBrands(page), ['Ohuhu']);
  const pic = await pictureTexts(page);
  assert.ok(pic.length > 20 && !pic.includes('O'), 'no letters on the picture');
  await page.click('#sfColor'); await idle(page);
  assert.equal(await page.locator('#sfAlist .btag').count(), 0);
  assert.deepEqual(errors, []);
});

test('letters, both brands owned: on every list (Owned, Palette, Match, the guide picture and rows), with full names for screen readers; exports of a one-brand guide unchanged', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await ownCopic(page);
  assert.deepEqual(await guideBrands(page), ['Ohuhu'], 'the guide itself is still all Ohuhu');
  // the guide: letters on the picture's labels, in Colour along's rows and the shading tones
  const pic = await pictureTexts(page);
  assert.ok(pic.filter((t) => t === 'O').length > 5, 'the picture labels carry their letter');
  assert.ok(!pic.includes('C'));
  await scrollTop(page);
  await snapV267(page, 'a-guide-letters');
  await page.click('#sfColor'); await idle(page);
  const rows = await letters(page, '#sfAlist .btag');
  assert.ok(rows.length > 3 && rows.every((t) => t === 'O'), 'a letter on every row');
  assert.match(await page.textContent('#sfAlist .sfarow .sfah .nm'), /^O Ohuhu \S+/, 'the letter is hidden from screen readers, which hear "Ohuhu"');
  assert.equal(await page.getAttribute('#sfAlist .btag', 'aria-hidden'), 'true');
  await page.click('#sfDoneBtn'); await idle(page);
  // exports go by the guide's own markers: one brand, named once, no letters
  const t = await pdfTextsOnly(page);
  assert.ok(t.some((e) => e.p === 0 && /\d+ Ohuhu markers/.test(e.t)), 'page 1 says the brand');
  assert.ok(!t.some((e) => /= Copic|= Ohuhu/.test(e.t)), 'no letter key');
  // (the close-ups' letters aside: C and O are the 3rd and 15th, on page 1 and over their close-up)
  const nCl = await page.evaluate(() => __mstest.pdfCloseL), close = (x) => x.charCodeAt(0) - 64 <= nCl;
  for (const x of ['O', 'C']) assert.ok(t.filter((e) => e.t === x).length <= (close(x) ? 2 : 0), 'no letters, on the picture or the key: ' + x);
  const img = await canvasTexts(page, 'buildExportCanvas');
  assert.ok(img.includes('Ohuhu markers') && !img.includes('O') && !img.some((s) => /^O {2}/.test(s)));
  const card = await canvasTexts(page, 'buildShareCard');
  assert.ok(card.includes('Ohuhu markers') && !card.includes('O'));
  // the shell's lists
  await markersView(page, 'owned');
  const own = await letters(page, '#results .cell .bt');
  assert.ok(own.length > 50 && own.filter((x) => x === 'O').length > 50 && own.includes('C'), 'Owned: a letter on every cell');
  assert.equal(own.length, await page.locator('#results .cell').count());
  assert.match(await page.getAttribute('#results .cell', 'aria-label'), /^(Ohuhu|Copic) /, 'labels name the brand');
  await page.evaluate(() => scrollTo(0, 0));
  await snapV267(page, 'a-markers-owned');
  // filtered to Ohuhu only, still letters: the collection mixes
  await page.evaluate(() => { fgTap('brand', 'Ohuhu'); save(); fullRender(); }); await idle(page);
  const oh = await letters(page, '#results .cell .bt');
  assert.ok(oh.length > 50 && oh.every((x) => x === 'O'));
  await drawPalette(page);
  assert.ok((await letters(page, '#bands .band .bt')).filter(Boolean).length > 0, 'Palette bands');
  assert.ok(await page.$$eval('#readout .rbt', (x) => x.length) > 0, 'and the code line');
  assert.match(await page.textContent('#readout .hex'), /Ohuhu /, 'which a screen reader hears as the brand');
  await page.evaluate(() => { fgClear('brand'); save(); fullRender(); }); await idle(page);
  await page.click('#mCollection'); await idle(page);
  await page.click('#mkMatchBtn'); await page.click('.msrc [data-src="hex"]');
  for (const hex of HEXES) { const r = await matchRows(page, hex); assert.equal(r.tags, r.n, hex + ': a letter on every row'); }
  assert.deepEqual(errors, []);
});

test('letters with an empty collection: the whole range counts, so letters everywhere', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  assert.equal(await page.evaluate(() => state.owned.size), 0);
  await markersView(page, 'all');
  assert.ok((await letters(page, '#results .cell .bt')).length > 50);
  await page.evaluate(() => { fgTap('brand', 'Copic'); save(); fullRender(); }); await idle(page);
  const cp = await letters(page, '#results .cell .bt');
  assert.ok(cp.length > 20 && cp.every((x) => x === 'C'), 'a one-brand view still has them');
  await drawPalette(page);
  assert.ok((await letters(page, '#bands .band .bt')).filter(Boolean).every((x) => x === 'C'));
  assert.ok((await letters(page, '#bands .band .bt')).filter(Boolean).length > 0);
  await page.evaluate(() => { fgClear('brand'); save(); fullRender(); }); await idle(page);
  await page.click('#mCollection'); await idle(page);
  await page.click('#mkMatchBtn'); await page.click('.msrc [data-src="hex"]');
  for (const hex of HEXES.slice(0, 3)) { const r = await matchRows(page, hex); assert.equal(r.tags, r.n, hex); }
  await page.click('#matchClose');
  await page.evaluate(() => SF.loadSample());
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData)); await idle(page);
  const pic = await pictureTexts(page);
  assert.ok(pic.some((t) => t === 'O' || t === 'C'), 'the picture labels carry letters');
  assert.deepEqual(errors, []);
});

// ---- Brand tags on the picture (decision #7) ----
// every tag drawn: its box's fill colour and the letter in it, in order (a tag's box is the path drawn with arcTo
// just before its letter). what: 'screen' (the guide's picture), 'pdf' or 'image' (the saved image)
const tagsOf = (page, what) => page.evaluate((what) => {
  const P = CanvasRenderingContext2D.prototype, of = P.fill, oa = P.arcTo, ot = P.fillText, log = [], cv = document.getElementById('sfCanvas');
  P.arcTo = function () { this.__tag = 1; return oa.apply(this, arguments); };
  P.fill = function () { if (this.__tag) { this.__tag = 0; this.__box = this.fillStyle; } return of.apply(this, arguments); };
  P.fillText = function (t) { if (this.__box) log.push({ box: this.__box, t: String(t), cv: this.canvas }); this.__box = null; return ot.apply(this, arguments); };
  let cvs;
  try { if (what === 'screen') { cvs = [cv]; __mstest.forceFullRender(); __mstest.renderGuide(); } else if (what === 'pdf') cvs = __mstest.buildPDFPages(); else cvs = [__mstest.buildExportCanvas()]; } finally { P.fill = of; P.arcTo = oa; P.fillText = ot; }
  return log.filter((e) => cvs.indexOf(e.cv) >= 0).map((e) => ({ box: e.box, t: e.t }));
}, what);
const ownAllCopic = (page) => page.evaluate(() => { COLORS.forEach((c, i) => { if (c.brand === 'Copic') state.owned.add(mkey(i)); }); save(); SF.setCollection(sfCollection()); __mstest.reassign(); });

test('brand tags: a small box after every code when the collection mixes brands (Ohuhu filled, Copic pale and outlined), on screen, the PDF and the saved image; none for one brand', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  // one brand owned, one brand in the guide: no tags anywhere
  assert.deepEqual(await tagsOf(page, 'screen'), []);
  assert.deepEqual(await tagsOf(page, 'pdf'), []);
  assert.deepEqual(await tagsOf(page, 'image'), []);
  // both brands owned and used
  await ownAllCopic(page); await idle(page);
  const n = await page.evaluate(() => Object.keys(__mstest.assignData.assign).length);
  const scr = await tagsOf(page, 'screen');
  assert.ok(scr.length > 20 && scr.length <= n, 'a tag on the labels: ' + scr.length + ' of ' + n);
  assert.ok(scr.some((e) => e.t === 'O') && scr.some((e) => e.t === 'C'), 'both brands');
  for (const e of scr) assert.equal(e.box, e.t === 'C' ? '#c4c1c9' : '#26252b', 'Copic pale, Ohuhu dark: ' + JSON.stringify(e));
  // the print's light labels draw them as light as the codes; the saved image as on screen
  const pdf = await tagsOf(page, 'pdf');
  assert.ok(pdf.length > 20 && pdf.every((e) => e.box === (e.t === 'C' ? '#ffffff' : '#a0a0a0')), JSON.stringify(pdf.slice(0, 3)));
  const img = await tagsOf(page, 'image');
  assert.ok(img.length > 20 && img.every((e) => e.box === (e.t === 'C' ? '#c4c1c9' : '#26252b')), JSON.stringify(img.slice(0, 3)));
  // pixels: a big label's tag, drawn on a canvas of its own (inside its padding: the fill; on its left edge: the outline)
  const px = await page.evaluate(() => {
    const t = __mstest, l = +Object.keys(t.assignData.assign).sort((a, b) => t.comps[b].area - t.comps[a].area)[0], out = {};
    for (const brand of ['Ohuhu', 'Copic']) {
      const m = COLORS.find((c) => c.brand === brand), c = document.createElement('canvas'); c.width = t.W; c.height = t.H;
      const g = c.getContext('2d'); g.fillStyle = '#7fbf7f'; g.fillRect(0, 0, c.width, c.height);
      const o = { bt: true, base: 40, min: 40, max: 40, w: 600, swk: 0.27, stroke: '#fff', fill: '#000' }, L = t.codeLayout(g, l, m, o);
      t.drawCode(g, l, m, o);
      const tx = L.x0 + L.cw + L.fs * 0.2, at = (x) => [...g.getImageData(Math.round(x), Math.round(L.y), 1, 1).data.slice(0, 3)];
      out[brand] = { fill: at(tx + L.fs * 0.1), edge: at(tx + 0.5), gw: L.gw, fs: L.fs };
    }
    return out;
  });
  const near = (a, hex) => a.every((v, k) => Math.abs(v - parseInt(hex.slice(1 + 2 * k, 3 + 2 * k), 16)) < 12);
  assert.ok(near(px.Ohuhu.fill, '#26252b'), 'Ohuhu tag filled dark: ' + px.Ohuhu.fill);
  assert.ok(near(px.Copic.fill, '#c4c1c9'), 'Copic tag pale inside: ' + px.Copic.fill);
  assert.ok(near(px.Copic.edge, '#26252b'), 'with a dark outline: ' + px.Copic.edge);
  assert.ok(px.Ohuhu.gw > px.Ohuhu.fs * 0.5 && px.Ohuhu.gw < px.Ohuhu.fs * 0.9, 'about a letter plus padding wide: ' + JSON.stringify(px.Ohuhu));
  assert.deepEqual(errors, []);
});

test('brand tags: the tag counts in a label’s width, so labels still fit their sections (and the tap box covers it)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await ownAllCopic(page); await idle(page);
  const r = await page.evaluate(() => {
    const t = __mstest, g = document.createElement('canvas').getContext('2d'), a = t.assignData.assign, o = { base: 9, min: 5, w: 600, swk: 0.27, stroke: '#fff', fill: '#000' };
    return Object.keys(a).map((k) => {
      const l = +k, p = t.labelPos(l), L = t.codeLayout(g, l, a[k], o), N = t.codeLayout(g, l, a[k], { ...o, bt: false });
      return { l, fs: L.fs, fsN: N.fs, w: L.box[2] - L.box[0] - 2 * L.lw - 4, want: L.cw + L.fs * 0.2 + L.gw, aw: p.aw, tg: L.tg, gw: L.gw };
    });
  });
  assert.ok(r.every((x) => x.tg && x.gw > 0), 'every label has its tag');
  assert.ok(r.every((x) => Math.abs(x.w - x.want) < 0.01), 'the box spans code, gap and tag');
  // above the smallest size a label fits its section's width, tag included; the tag only ever makes a label smaller
  assert.deepEqual(r.filter((x) => x.fs > 5 && x.w > x.aw * 0.94 + 0.5), [], 'labels fit');
  assert.ok(r.every((x) => x.fs <= x.fsN));
  assert.ok(r.some((x) => x.fs < x.fsN), 'some labels made room for the tag');
  assert.deepEqual(errors, []);
});
