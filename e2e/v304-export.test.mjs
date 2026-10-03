// v304 (print and export): Save image places its codes as the PDF does (none over another, as small as 6 px, the rest
// left off with a line saying so) and lays its key out in 2-4 columns (6 of codes alone past 150 markers), and comes
// back from an error instead of staying on Preparing…; the test strip's pages are drawn one at a time on the paper the
// PDF was started on; a PDF can be made where the browser can't compress; a Print sheet opened again while a PDF is
// still being written says so; the colour card stays under iPad Safari's canvas limit; a second share while one is open
// is left alone; a download's file stays there for a minute; the PDF's zone outlines are filled on a stack that holds
// each pixel once.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, sampleGuide, letterGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const sharePrint = async (page) => { await page.click('.sftabbtn[data-t="share"]'); await page.click('#sfPrint'); await page.waitForSelector('#sfSheet.sfprsh'); await idle(page); };
// every text the saved image draws: where, how big, on which canvas (the picture's, or the image's)
const imageTexts = (page, noCodes) => page.evaluate((noCodes) => {
  const P = CanvasRenderingContext2D.prototype, of = P.fillText, log = [];
  P.fillText = function (t, x, y) { log.push({ t: String(t), x, y, fs: parseFloat(/(\d+(\.\d+)?)px/.exec(this.font)[1]) }); return of.apply(this, arguments); };
  let c;
  try { c = __mstest.buildExportCanvas(false, noCodes); } finally { P.fillText = of; }
  return { log, w: c.width, h: c.height, W: __mstest.W, H: __mstest.H, pl: __mstest.exPlaced && JSON.parse(JSON.stringify(__mstest.exPlaced)) };
}, noCodes);
// the open guide's sections given n different markers (both brands), as a big collection would
const manyMarkers = (page, n) => page.evaluate((n) => {
  const t = __mstest, a = t.assignData.assign, ids = Object.keys(a), base = a[ids[0]];
  ids.forEach((l, i) => { const c = COLORS[(i * 7) % COLORS.length]; if (i < n) a[l] = Object.assign({}, base, { mkey: c.brand + ':' + c.code, hex: c.hex, code: c.code, name: c.name, brand: c.brand }); });
}, n);

test('Save image: codes placed as on the PDF, none over another and none under 6 px; the rest left off, said under the brand; Codes off draws none', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const r = await imageTexts(page, false);
  assert.ok(r.pl, 'the placing is kept');
  const b = r.pl.boxes;
  let over = 0;
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (b[i][0] < b[j][2] && b[j][0] < b[i][2] && b[i][1] < b[j][3] && b[j][1] < b[i][3]) over++;
  assert.equal(over, 0, 'no two codes overlap (v303: 150 of the 166 did)');
  const codes = r.log.filter((e) => e.y < r.H);
  assert.equal(codes.length, b.length, 'one code per box placed');
  assert.ok(codes.every((e) => e.fs >= 6), 'none smaller than 6 px');
  assert.ok(r.pl.dropped.length > 0 && r.pl.dropped.length < 40, 'a few sections too small: ' + r.pl.dropped.length);
  assert.equal(codes.length + r.pl.dropped.length, await page.evaluate(() => Object.keys(__mstest.assignData.assign).length));
  const nt = r.log.filter((e) => /^Small sections unlabelled: see the guide or the PDF’s close-ups\.$/.test(e.t));
  assert.equal(nt.length, 1, 'the line under the brand');
  const brand = r.log.find((e) => /Ohuhu markers/.test(e.t));
  assert.ok(nt[0].y > brand.y, 'under the brand line');
  // Codes off: no codes and no line about them
  const off = await imageTexts(page, true);
  assert.equal(off.log.filter((e) => e.y < off.H).length, 0, 'no codes');
  assert.ok(!off.log.some((e) => /Small sections/.test(e.t)));
  assert.ok(off.h < r.h, 'the image a line shorter');
  assert.deepEqual(errors, []);
});

test('Save image key: 2 columns on a narrow picture, 3, 4 when 3 would be taller than 60% of the picture, and past 150 markers 6 of codes alone', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const lay = (n) => page.evaluate((n) => JSON.parse(JSON.stringify(__mstest.exportKeyLayout(n))), n);
  // the sample is 568 px wide: 3 columns would cut most names (v303)
  assert.equal((await lay(16)).cols, 2);
  assert.equal((await lay(120)).cols, 2, 'no 4 columns under 812 px');
  const nar = await lay(151);
  assert.ok(nar.codes && nar.cols === 5, 'codes alone, as many as fit on a narrow picture: ' + nar.cols);
  // drawn: past 150 markers the key has codes, the brand letters, and no names
  const nS = await page.evaluate(() => Object.keys(__mstest.assignData.assign).length);
  assert.ok(nS > 160, 'enough sections: ' + nS);
  await manyMarkers(page, 160);
  const r = await imageTexts(page, true);
  const key = r.log.filter((e) => /^[CO] {2}\S+$/.test(e.t));
  assert.ok(key.length > 150, 'every entry a brand letter and a code: ' + key.length);
  assert.ok(!r.log.some((e) => /^[CO] {2}\S+ {3}/.test(e.t)), 'no names');
  assert.ok(r.w * r.h <= 15e6);
  // a Letter page enlarged to 1600 tall: 1236 wide
  const { page: p2 } = await openApp();
  await welcome(p2, 'look'); await idle(p2);
  await letterGuide(p2);
  const WH = await p2.evaluate(() => [__mstest.W, __mstest.H]);
  assert.ok(WH[0] >= 812);
  const lay2 = (n) => p2.evaluate((n) => JSON.parse(JSON.stringify(__mstest.exportKeyLayout(n))), n);
  assert.equal((await lay2(16)).cols, 3);
  const rh = Math.max(28, WH[0] / 40);
  let n4 = 1;
  while (Math.ceil(n4 / 3) * rh <= WH[1] * 0.6) n4++;
  assert.equal((await lay2(n4 - 1)).cols, 3, 'still 3 when the key fits');
  assert.equal((await lay2(n4)).cols, 4, '4 when 3 would be taller than 60% of the picture');
  assert.deepEqual([(await lay2(151)).cols, (await lay2(151)).codes], [6, true]);
  assert.deepEqual(errors, []);
});

test('Save image: an image the browser can’t make puts the button back (v303: stuck on Preparing… until a reload)', async () => {
  // (as iPad Safari does past its canvas limit: no drawing context for the image)
  const { page, errors } = await openApp({ init: () => { const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { return window.__lim && this.width * this.height > window.__lim ? null : gc.call(this, t, o); }; } });
  await sampleGuide(page); await idle(page);
  let n = 0;
  page.on('download', () => n++);
  await page.click('.sftabbtn[data-t="share"]'); await idle(page);
  await page.evaluate(() => { window.__lim = __mstest.W * __mstest.H; });
  await page.click('#sfExport');
  await page.waitForFunction(() => !document.getElementById('sfExport').disabled, null, { timeout: 5000 });
  assert.match(await page.textContent('#sfExport'), /Save image/);
  assert.equal(n, 0);
  await page.evaluate(() => { window.__lim = 0; });
  await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#sfExport')]);
  assert.deepEqual(errors, []);
});

test('Test strip PDF: pages drawn one at a time, on the paper it was started on even if Paper is changed meanwhile', async () => {
  // (each page's compressing slowed, so Paper is tapped while the PDF is being written)
  const { page, errors } = await openApp({ init: () => { const ab = Response.prototype.arrayBuffer; Response.prototype.arrayBuffer = function () { return new Promise((r) => setTimeout(r, Number(window.__slow || 0))).then(() => ab.call(this)); }; } });
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await sharePrint(page);
  await page.click('[data-paper="a5"]'); await idle(page);
  await page.click('[data-pwhat="strip"]'); await idle(page);
  const lazy = await page.evaluate(() => { const p = __mstest.buildPDFPages(false, true); return p.map((x) => typeof x); });
  assert.ok(lazy.length >= 2 && lazy.every((t) => t === 'function'), 'functions, one per page: ' + lazy);
  await page.evaluate(() => { window.__slow = 400; });
  const dlP = page.waitForEvent('download', { timeout: 30000 });
  await page.click('#sfPDF');
  await page.waitForTimeout(200); // (while the first page is being compressed)
  await page.click('[data-paper="letter"]');
  const dl = await dlP;
  const txt = Buffer.from(await (await import('node:fs/promises')).readFile(await dl.path())).toString('latin1');
  const boxes = [...txt.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => m[1] + 'x' + m[2]),
    imgs = [...txt.matchAll(/\/Width (\d+) \/Height (\d+)/g)].map((m) => m[1] + 'x' + m[2]);
  assert.ok(boxes.length >= 2 && new Set(boxes).size === 1 && boxes[0] === '419.53x595.28', 'A5 pages: ' + boxes);
  assert.ok(new Set(imgs).size === 1, 'every page drawn at one size: ' + imgs);
  assert.deepEqual(errors, []);
});

test('PDF where the browser can’t compress (Safari before 16.4): the pages stored as they are', async () => {
  const { page, errors } = await openApp({ init: () => { delete window.CompressionStream; } });
  await sampleGuide(page); await idle(page);
  await sharePrint(page);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#sfPDF')]);
  const buf = await (await import('node:fs/promises')).readFile(await dl.path()), txt = buf.toString('latin1');
  assert.match(txt.slice(0, 8), /^%PDF-1\.4/);
  assert.ok(!/FlateDecode/.test(txt));
  const m = /\/Width (\d+) \/Height (\d+) \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Length (\d+)/.exec(txt);
  assert.ok(m && +m[3] === m[1] * m[2] * 3, 'a page’s pixels as they are');
  assert.match(txt.slice(-6), /%%EOF$/);
  assert.deepEqual(errors, []);
});

test('Print sheet closed and opened again while its PDF is written: the button says Preparing… until it is done, and one PDF comes', async () => {
  const { page, errors } = await openApp({ init: () => { const ab = Response.prototype.arrayBuffer; Response.prototype.arrayBuffer = function () { return new Promise((r) => setTimeout(r, Number(window.__slow || 0))).then(() => ab.call(this)); }; } });
  await sampleGuide(page); await idle(page);
  let n = 0;
  page.on('download', () => n++);
  await sharePrint(page);
  const label = await page.textContent('#sfPDF');
  await page.evaluate(() => { window.__slow = 600; });
  await page.click('#sfPDF');
  await page.waitForTimeout(100);
  await page.click('#sfSheet [data-pr="cancel"]'); await page.waitForSelector('#sfSheet', { state: 'detached' });
  await page.click('#sfPrint'); await page.waitForSelector('#sfSheet.sfprsh');
  assert.equal(await page.textContent('#sfPDF'), 'Preparing…');
  assert.equal(await page.isDisabled('#sfPDF'), true);
  await page.waitForFunction(() => !document.getElementById('sfPDF').disabled, null, { timeout: 30000 });
  assert.equal(await page.textContent('#sfPDF'), label, 'back as it was');
  await page.waitForTimeout(300);
  assert.equal(n, 1);
  assert.deepEqual(errors, []);
});

test('the colour card stays under 16 million pixels with every marker on it', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look'); await idle(page);
  const r = await page.evaluate(async () => {
    const url = await makeCard(COLORS.map((_, i) => i), 'random'), im = new Image();
    im.src = url;
    await im.decode();
    return [im.naturalWidth, im.naturalHeight];
  });
  assert.ok(r[0] * r[1] <= 16e6 && r[0] > 600, 'v303: 1200 × 22612; now ' + r.join(' × '));
  assert.deepEqual(errors, []);
});

test('a second share while the share sheet is open is left alone, not downloaded; a download’s file stays for a minute', async () => {
  const { page, errors } = await openApp({ userAgent: IPHONE });
  let n = 0;
  page.on('download', () => n++);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => Promise.reject(new DOMException('already sharing', 'InvalidStateError')) });
  });
  const r = await page.evaluate(() => handOver(new Blob(['x'], { type: 'text/plain' }), 'x.txt', { title: 'X' }));
  assert.equal(r, 'cancel');
  await page.waitForTimeout(300);
  assert.equal(n, 0);
  const waits = await page.evaluate(() => {
    const st = window.setTimeout, d = [];
    window.setTimeout = function (f, ms) { d.push(ms); return st.apply(this, arguments); };
    try { downloadBlob(new Blob(['x']), 'y.txt'); } finally { window.setTimeout = st; }
    return d;
  });
  assert.ok(waits.includes(60000) && !waits.includes(4000), 'revoked after ' + waits);
  assert.deepEqual(errors, []);
});

// EX-04: the PDF's zone outlines filled from the picture's edge on a stack that holds each pixel once (v303 pushed every
// neighbour on a plain list: 12.8 million entries on a 2400 × 2400 picture). A 2400 px guide with two zones that shade
// differently: the outlines are the same pixels as the flood worked out here, and the build makes no huge list.
test('PDF zone outlines on a 2400 px guide: the same outline as a plain flood, without a list of millions', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look'); await idle(page);
  // line art drawn here: a 12 × 12 grid with a ring in each cell, 2400 px square
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'), N = 2400, s = N / 12;
    c.width = c.height = N;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, N, N);
    g.strokeStyle = '#000'; g.lineWidth = 7;
    for (let i = 0; i <= 12; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, N); g.moveTo(0, i * s); g.lineTo(N, i * s); g.stroke(); }
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { g.beginPath(); g.arc(x * s + s / 2, y * s + s / 2, s * 0.3, 0, 6.283); g.stroke(); }
    return c.toDataURL('image/png');
  });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'grid-2400.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64') });
  const first = await Promise.race([
    page.waitForSelector('#sfBuild', { state: 'visible', timeout: 120000 }).then(() => 'build'),
    page.waitForSelector('#sfPgGo', { state: 'visible', timeout: 120000 }).then(() => 'corners'),
  ]);
  if (first === 'corners') { await page.click('#sfPgGo'); await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 120000 }); }
  await idle(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, { timeout: 120000 }); await idle(page);
  assert.ok(Math.max(...(await page.evaluate(() => [__mstest.W, __mstest.H]))) >= 2300, 'a big picture');
  // shading, and two zones (top and bottom thirds) shaded differently from Main
  const selectVal = (id, v) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await selectVal('sfShStyle', 'grey'); await idle(page);
  for (const [name, lo, hi] of [['Top', 0, 0.34], ['Bottom', 0.66, 1]]) {
    await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
    // (＋ Zone on its own line until there is one; then a chip after the zones')
    if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
    else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
    await idle(page);
    await page.fill('#sfZoneName', name); await page.press('#sfZoneName', 'Enter');
    await page.evaluate(([lo, hi]) => { const t = __mstest, cl = Object.keys(t.assignData.assign).map(Number).filter((l) => t.comps[l].cy >= t.H * lo && t.comps[l].cy < t.H * hi); t.zoneMove(cl, t.zoneCur); t.reassign([0, t.zoneCur]); }, [lo, hi]);
    await page.click('#sfZoneDone'); await idle(page);
    await page.click('.sftabbtn[data-t="shading"]'); await idle(page);
    await selectVal('sfShStyle', 'cool'); await idle(page);
  }
  const r = await page.evaluate(() => {
    const T = __mstest, W = T.W, H = T.H, n = W * H, P = CanvasRenderingContext2D.prototype, put = P.putImageData, push = Array.prototype.push;
    let pushes = 0;
    const cands = [];
    // (the outlines' own layer: picture-sized, see-through but for the outlines)
    P.putImageData = function (im) { if (im.width === W && im.height === H) { let see = false; for (let q = 0; q < n && !see; q += 997) see = im.data[q * 4 + 3] === 0; if (see) cands.push(new Uint8ClampedArray(im.data)); } return put.apply(this, arguments); };
    Array.prototype.push = function () { pushes += arguments.length; return push.apply(this, arguments); };
    const t0 = performance.now();
    try { T.buildPDFPages(false).forEach((c) => { c.width = 0; }); } finally { P.putImageData = put; Array.prototype.push = push; }
    const ms = performance.now() - t0;
    // (the layer in the zones' colours: the first two of the PDF's, #d4145a and #1f6fd1; other see-through layers are
    // the shading's marks)
    const ZC = ['212,20,90', '31,111,209'],
      ov = cands.find((d) => { let k = 0; for (let q = 0; q < n; q++) if (d[q * 4 + 3]) { if (!ZC.includes(d[q * 4] + ',' + d[q * 4 + 1] + ',' + d[q * 4 + 2])) return false; k++; } return k > 0; });
    if (!ov) return { ms, pushes, ov: false, layers: cands.length };
    // the reference: each zone closed over its lines, filled from the edge (a plain flood, queue), its rim t px thick
    const dil = (M, r) => {
      const T2 = new Uint8Array(n), O = new Uint8Array(n);
      for (let y = 0; y < H; y++) { let c = 0; const ro = y * W; for (let x = -r; x < W; x++) { if (x + r < W) c += M[ro + x + r]; if (x - r - 1 >= 0) c -= M[ro + x - r - 1]; if (x >= 0) T2[ro + x] = c > 0 ? 1 : 0; } }
      for (let x = 0; x < W; x++) { let c = 0; for (let y = -r; y < H; y++) { if (y + r < H) c += T2[(y + r) * W + x]; if (y - r - 1 >= 0) c -= T2[(y - r - 1) * W + x]; if (y >= 0) O[y * W + x] = c > 0 ? 1 : 0; } }
      return O;
    };
    const r1 = Math.max(2, Math.round(Math.max(W, H) / 160)), ids = [...new Set(Object.keys(T.assignData.assign).map((l) => T.zoneOf(+l)))].filter((id) => +id);
    const outside = [];
    ids.forEach((id) => {
      const M = new Uint8Array(n);
      for (let q = 0; q < n; q++) { const l = T.labels[q]; if (l > 0 && T.zoneOf(l) === id) M[q] = 1; }
      const D = dil(M, r1), inv = new Uint8Array(n);
      for (let q = 0; q < n; q++) inv[q] = D[q] ? 0 : 1;
      const E = dil(inv, r1), out = new Uint8Array(n), qu = new Int32Array(n);
      for (let q = 0; q < n; q++) E[q] = E[q] ? 0 : 1;
      let a = 0, b = 0;
      const go = (q) => { if (!out[q] && !E[q]) { out[q] = 1; qu[b++] = q; } };
      for (let x = 0; x < W; x++) { go(x); go((H - 1) * W + x); }
      for (let y = 0; y < H; y++) { go(y * W); go(y * W + W - 1); }
      while (a < b) { const q = qu[a++], x = q % W; if (x > 0) go(q - 1); if (x < W - 1) go(q + 1); if (q >= W) go(q - W); if (q < n - W) go(q + W); }
      outside.push(out);
    });
    // the rim's thickness depends on the page's scale: the one that gives the drawn outline
    let best = null;
    const tried = [];
    for (let t = 1; t <= 12 && !best; t++) {
      let diff = 0, drawn = 0;
      const rims = outside.map((out) => dil(out, t));
      for (let q = 0; q < n; q++) {
        let on = 0;
        for (let z = 0; z < outside.length; z++) if (!outside[z][q] && rims[z][q]) on = 1;
        const d = ov[q * 4 + 3] > 0 ? 1 : 0;
        drawn += d;
        if (on !== d) diff++;
      }
      if (!diff) best = { t, drawn };
      tried.push([t, diff, drawn]);
    }
    const cols = new Set();
    for (let q = 0; q < n; q++) if (ov[q * 4 + 3]) cols.add(ov[q * 4] + ',' + ov[q * 4 + 1] + ',' + ov[q * 4 + 2]);
    return { ms, pushes, ov: true, zones: ids.length, best, tried, cols: cols.size, W, H };
  });
  assert.ok(r.ov, 'the zone outlines were drawn');
  assert.equal(r.zones, 2);
  assert.ok(r.best, 'the outline is exactly the reference flood’s, for one rim thickness: ' + JSON.stringify(r));
  assert.ok(r.best.drawn > 2000, 'outline pixels: ' + (r.best && r.best.drawn));
  assert.equal(r.cols, 2, 'a colour per zone');
  assert.ok(r.pushes < 1e6, 'no list of millions while it is built (v303: one entry for every neighbour): ' + r.pushes);
  assert.ok(r.ms < 60000, 'built in ' + Math.round(r.ms) + ' ms');
  assert.deepEqual(errors, []);
});
