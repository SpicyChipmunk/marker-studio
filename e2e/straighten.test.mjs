// Page straightening: a photographed page is found and flattened; unsure cases open the corner handles with a
// reason; scans, a page square to the camera and a white page on a white table are left alone. The corner editor,
// Undo and Adjust corners work, the lens's focal length is read from the photo, and the page's shape comes out right.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, scrollTop, notOnWebKit, WK, buildGo } from './helpers.mjs';

before(setup);
after(teardown);

// A made-up phone photo of a page: a Letter page (a drawing with margins, or one that fills the page), turned and
// tilted in front of a 25 mm-equivalent phone lens, on a table, with uneven light, noise and JPEG. Returns the
// photo and where its corners really are.
const GEN = String.raw`
async function makePhoto(o) {
  const W = o.W || 1200, H = o.H || 1600;
  const art = new Image(); await new Promise((r) => { art.onload = r; art.src = '/src/assets/sample-jellyfish.png'; });
  const PW = 850, PH = 1100, pg = document.createElement('canvas'); pg.width = PW; pg.height = PH; const p = pg.getContext('2d');
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  p.fillStyle = '#f7f5ef'; p.fillRect(0, 0, PW, PH);
  if (o.bleed) { p.save(); p.beginPath(); p.rect(20, 20, PW - 40, PH - 40); p.clip(); p.strokeStyle = '#161616'; for (let i = 0; i < 420; i++) { p.lineWidth = 2 + rnd() * 5; p.beginPath(); p.ellipse(rnd() * PW, rnd() * PH, 8 + rnd() * 60, 8 + rnd() * 60, rnd() * 3, 0, 6.283); p.stroke(); } p.lineWidth = 5; p.strokeRect(20, 20, PW - 40, PH - 40); p.restore(); }
  else { const s = Math.min((PW - 160) / art.width, (PH - 200) / art.height); p.drawImage(art, (PW - art.width * s) / 2, (PH - art.height * s) / 2, art.width * s, art.height * s); }
  if (o.scan) { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, W, H); const s = Math.min(W / PW, H / PH) * 0.94; if (o.border) { g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(W * 0.05, H * 0.05, W * 0.9, H * 0.9); } g.drawImage(pg, (W - PW * s) / 2, (H - PH * s) / 2, PW * s, PH * s); return done(c, null); }
  const pd = p.getImageData(0, 0, PW, PH).data;
  const f = 25 / 43.27 * Math.hypot(W, H), tx = (o.tilt || 0) * Math.PI / 180, rz = (o.roll || 0) * Math.PI / 180, ry = (o.yaw || 0) * Math.PI / 180, sz = o.size || 0.8;
  const hw = 0.5 * 8.5, hh = 0.5 * 11, Z = (11 / sz) * f / H;
  const proj = (X, Y) => { let x = X, y = Y, z = 0, y1 = y * Math.cos(tx), z1 = y * Math.sin(tx); y = y1; z = z1; let x1 = x * Math.cos(ry) + z * Math.sin(ry); z1 = -x * Math.sin(ry) + z * Math.cos(ry); x = x1; z = z1; x1 = x * Math.cos(rz) - y * Math.sin(rz); y1 = x * Math.sin(rz) + y * Math.cos(rz); x = x1; y = y1; z += Z; return [W / 2 + (o.dx || 0) * W + f * x / z, H / 2 + (o.dy || 0) * H + f * y / z]; };
  const C = [proj(-hw, -hh), proj(hw, -hh), proj(hw, hh), proj(-hw, hh)], Hm = __mstest.pgHomog(C, [[0, 0], [PW, 0], [PW, PH], [0, PH]]);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data, bg = o.bg || 'wood';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const j = (y * W + x) * 4, den = Hm[6] * x + Hm[7] * y + 1, u = (Hm[0] * x + Hm[1] * y + Hm[2]) / den, v = (Hm[3] * x + Hm[4] * y + Hm[5]) / den; let r, gg, b;
    if (u >= 0 && v >= 0 && u < PW - 1 && v < PH - 1) { const k = ((v | 0) * PW + (u | 0)) * 4; r = pd[k]; gg = pd[k + 1]; b = pd[k + 2]; }
    else if (bg === 'wood') { const t = Math.sin(x * 0.02 + Math.sin(y * 0.005) * 3) * 0.5 + 0.5; r = 120 + 50 * t; gg = 80 + 35 * t; b = 50 + 20 * t; }
    else if (bg === 'dark') { const t = rnd(); r = 50 + 30 * t; gg = 52 + 30 * t; b = 58 + 30 * t; }
    else { r = 238; gg = 236; b = 232; }
    const sh = 1 - 0.22 * (x / W * 0.6 + y / H * 0.4), nz = (rnd() - 0.5) * 12; d[j] = r * sh + nz; d[j + 1] = gg * sh + nz; d[j + 2] = b * sh + nz; d[j + 3] = 255; }
  g.putImageData(im, 0, 0); return done(c, C);
  async function done(c, C) { const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88)); const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); }); return { b64, C, W, H }; }
}`;
async function photo(page, o) { return page.evaluate(async ([src, o]) => { eval(src); return makePhoto(o); }, [GEN, o]); }
async function pick(page, ph, name = 'page.jpg') {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles({ name, mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
}
async function fresh() { const a = await openApp(); await a.page.check('#wcSets input[data-i="3"]'); await a.page.click('#wcAdd'); return a; }
const sections = (page) => page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
const info = (page) => page.evaluate(() => { const t = __mstest; return { W: t.W, H: t.H, line: document.querySelector('.sfpgline') ? document.querySelector('.sfpgline').textContent : '', q: t.pgQ, src: t.srcSize }; });

test('a page photographed at an angle is found and flattened to its true shape', notOnWebKit(WK.photo), async () => {
  for (const o of [{ tilt: 25, roll: 8, size: 0.6 }, { tilt: 20, yaw: 12, bleed: 1, bg: 'dark', size: 0.65 }]) {
    const { page, errors } = await fresh();
    const ph = await photo(page, o);
    // what the finder sees, straight from the photo
    const f = await page.evaluate(async (b64) => { const img = new Image(); await new Promise((r) => { img.onload = r; img.src = 'data:image/jpeg;base64,' + b64; }); const r = __mstest.pgFind(img); return { tier: r.tier, q: r.q, kind: r.kind }; }, ph.b64);
    assert.equal(f.tier, 'sure', JSON.stringify(o));
    const err = Math.max(...f.q.map((p, i) => Math.hypot(p[0] - ph.C[i][0], p[1] - ph.C[i][1])));
    assert.ok(err < ph.W * 0.012, `corners within ${err.toFixed(1)} px`);
    await pick(page, ph);
    // (the note is read in the same check that finds it: it changes once straightening is done)
    await page.waitForFunction(() => { const n = document.querySelector('.sfpgnote'); return !!n && /Straightening the page/.test(n.textContent); }, null, { timeout: 20000 });
    await sections(page); await idle(page);
    const r = await info(page);
    assert.match(r.line, /Page straightened/);
    // said once, in that line: no toast repeating it over its Adjust corners and Undo
    assert.equal(await page.evaluate(() => { const t = document.getElementById('msToast'); return !!(t && t.classList.contains('on') && /straighten/i.test(t.textContent)); }), false, 'no toast repeating the line');
    // Adjust corners is offered once (in that line, not again in Adjust photo), and its small links have 44px to tap
    await page.click('#sfAdjToggle'); await idle(page);
    assert.equal(await page.locator('#sfCtl button:text-is("Adjust corners")').count(), 1, 'one Adjust corners');
    const lh = await page.$$eval('.sfpgline .sflink', (b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
    assert.ok(lh.length === 2 && lh.every((h) => h >= 44), 'links 44px tall: ' + lh.join());
    await page.click('#sfAdjToggle');
    const ratio = r.W / r.H;
    assert.ok(Math.abs(ratio / (8.5 / 11) - 1) < 0.02, `Letter shape: ${ratio.toFixed(3)}`);
    assert.deepEqual(errors, []);
  }
});

test('scans, a page square to the camera and a white page on a white table are left alone', notOnWebKit(WK.photo), async () => {
  for (const o of [{ scan: 1 }, { scan: 1, border: 1 }, { tilt: 0, size: 0.97 }, { tilt: 20, bg: 'white', size: 0.6 }]) {
    const { page, errors } = await fresh();
    const ph = await photo(page, o);
    await pick(page, ph); await sections(page); await idle(page);
    const r = await info(page);
    assert.equal(r.line, '', 'no straightening: ' + JSON.stringify(o));
    assert.equal(r.q, null);
    assert.deepEqual(r.src, [ph.W, ph.H], 'the photo as taken');
    if (!(await page.isVisible('#sfPgOpen'))) await page.click('#sfAdjToggle');
    assert.ok(await page.isVisible('#sfPgOpen'), 'Straighten page is still offered in Adjust photo');
    assert.deepEqual(errors, []);
  }
});

test('a corner outside the photo opens the corner handles with a reason; Keep as is carries on unchanged', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await fresh();
  const ph = await photo(page, { tilt: 15, size: 0.9, dx: 0.2 });
  await pick(page, ph);
  await page.waitForSelector('#sfPgGo', { timeout: 20000 });
  assert.match(await page.textContent('.sfpgnote'), /outside the photo/);
  assert.equal(await page.textContent('#sfPgNo'), 'Keep as is');
  await page.click('#sfPgNo'); await sections(page);
  const r = await info(page);
  // (v284: a line offers Straighten again)
  assert.equal(r.line, 'Page kept as photographed · Straighten'); assert.deepEqual(r.src, [ph.W, ph.H]);
  assert.equal(r.q, null);
  assert.deepEqual(errors, []);
});

test('the corner editor: drag a corner, straighten, undo, adjust again', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await fresh();
  const ph = await photo(page, { tilt: 15, size: 0.9, dx: 0.2 });
  await pick(page, ph); await page.waitForSelector('#sfPgGo', { timeout: 20000 });
  await scrollTop(page);
  // drag the corner that's off the photo back inside it
  const pts = await page.evaluate(() => { const c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), e = __mstest.pgEd, s = r.width / c.width; return e.q.map((p) => [r.left + (e.pad + p[0] * e.k) * s, r.top + (e.pad + p[1] * e.k) * s]); });
  const box = await page.locator('#sfCanvas').boundingBox();
  const i = pts.findIndex((p) => p[0] > box.x + box.width * 0.9) >= 0 ? pts.findIndex((p) => p[0] > box.x + box.width * 0.9) : 1;
  await page.mouse.move(pts[i][0], pts[i][1]); await page.mouse.down();
  await page.mouse.move(pts[i][0] - 40, pts[i][1], { steps: 5 });
  assert.ok(await page.evaluate(() => __mstest.pgEd.drag >= 0), 'dragging a corner');
  await page.mouse.move(box.x + box.width * 0.85, pts[i][1], { steps: 5 }); await page.mouse.up();
  await page.click('#sfPgShape [data-v="letter"]');
  await page.click('#sfPgGo'); await sections(page); await idle(page);
  let r = await info(page);
  assert.match(r.line, /Page straightened/);
  assert.ok(Math.abs(r.W / r.H - 8.5 / 11) < 0.01, 'Letter, as chosen');
  await page.click('#sfPgUndo'); await sections(page); await idle(page);
  r = await info(page);
  assert.equal(r.line, ''); assert.deepEqual(r.src, [ph.W, ph.H], 'back to the photo as taken');
  // Adjust photo -> Straighten page opens the handles again; Cancel leaves things as they were
  await page.click('#sfAdjToggle'); await page.click('#sfPgOpen'); await page.waitForSelector('#sfPgGo');
  assert.equal(await page.textContent('#sfPgNo'), 'Cancel');
  await page.click('#sfPgNo'); await sections(page);
  assert.equal((await info(page)).line, '');
  assert.deepEqual(errors, []);
});

test('the lens is read from the photo, and with it the page’s shape is measured, not guessed', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const t = __mstest;
    // a minimal JPEG: SOI, APP1 Exif (little-endian TIFF, IFD0 -> Exif IFD with FocalLengthIn35mmFilm = 23), EOI
    const b = [0xFF, 0xD8, 0xFF, 0xE1, 0, 0, 0x45, 0x78, 0x69, 0x66, 0, 0], tiff = [0x49, 0x49, 0x2A, 0, 8, 0, 0, 0, 1, 0, 0x69, 0x87, 4, 0, 1, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0x05, 0xA4, 3, 0, 1, 0, 0, 0, 23, 0, 0, 0, 0, 0, 0, 0];
    const all = b.concat(tiff, [0xFF, 0xD9]), len = 2 + 6 + tiff.length; all[4] = len >> 8; all[5] = len & 255;
    const withLens = t.pgExifFocal(new Uint8Array(all).buffer), without = t.pgExifFocal(new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]).buffer);
    // corners of a Letter page seen by a 23 mm lens, tilted 30 degrees and turned: measured with the lens, and without
    const W = 3000, H = 4000, f = 23 / 43.27 * Math.hypot(W, H), tx = 0.52, rz = 0.3, Z = 16;
    const P = (X, Y) => { let y = Y * Math.cos(tx), z = Y * Math.sin(tx) + Z, x = X; const x1 = x * Math.cos(rz) - y * Math.sin(rz), y1 = x * Math.sin(rz) + y * Math.cos(rz); return [W / 2 + f * x1 / z, H / 2 + f * y1 / z]; };
    const q = [P(-4.25, -5.5), P(4.25, -5.5), P(4.25, 5.5), P(-4.25, 5.5)];
    return { withLens, without, measured: t.pgShapeOf(q, W, H, 23, null), guessed: t.pgShapeOf(q, W, H, 0, null) };
  });
  assert.equal(r.withLens, 23); assert.equal(r.without, 0);
  assert.ok(Math.abs(r.measured.aspect / (8.5 / 11) - 1) < 0.005, 'measured with the lens: ' + r.measured.aspect);
  assert.equal(r.measured.shape, 'auto', 'no snapping needed');
  assert.ok(Math.abs(r.guessed.measured / (8.5 / 11) - 1) < 0.08, 'without it, a guessed lens is close');
  assert.deepEqual(errors, []);
});

test('Photo colour pattern: a coloured version photographed at an angle is straightened, turned and lined up by itself', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await page.check('#wcSets input[data-i="6"]'); await page.click('#wcAdd');
  const scan = await photo(page, { scan: 1, bleed: 1 });
  await pick(page, scan); await sections(page);
  await buildGo(page); await page.waitForFunction(() => __mstest.assignData, null, { timeout: 60000 }); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  for (const [o, turn] of [[{ bleed: 1, tilt: 22, roll: 6, size: 0.6 }, 0], [{ bleed: 1, tilt: 18, roll: 94, size: 0.6, W: 1600, H: 1200 }, 1]]) {
    const ph = await photo(page, o);
    const had = await page.evaluate(() => !!__mstest.photoRef);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), had ? page.evaluate(() => __mstest.pickPhotoRef()) : page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'coloured.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
    await page.waitForFunction(() => __mstest.photoRef && !__mstest.photoChecking, null, { timeout: 30000 }); await idle(page);
    const r = await page.evaluate(() => ({ flat: __mstest.photoRef.flat, xf: __mstest.photoXf, toast: document.getElementById('msToast').textContent }));
    assert.equal(r.flat, true, 'the photo’s page was straightened');
    assert.match(r.toast, /Straightened the page in the photo and lined it up/);
    const q = Math.round(r.xf.r / (Math.PI / 2)), want = turn;
    assert.ok(q % 2 === want % 2, `turned a quarter turn when the page was photographed sideways (r=${r.xf.r.toFixed(2)})`);
  }
  assert.deepEqual(errors, []);
});

test('Adjust corners, then Cancel, leaves the straightened page and its section edits exactly as they were', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await fresh();
  const ph = await photo(page, { tilt: 25, roll: 8, size: 0.6 });
  await pick(page, ph); await sections(page); await idle(page);
  const before = await page.evaluate(() => ({ W: __mstest.W, H: __mstest.H, src: __mstest.srcSize, sig: __mstest.labelsSig() }));
  await page.click('#sfPgAdj'); await page.waitForSelector('#sfPgGo');
  await page.click('#sfPgNo'); await sections(page); await idle(page);
  const r = await page.evaluate(() => ({ W: __mstest.W, H: __mstest.H, src: __mstest.srcSize, sig: __mstest.labelsSig(), line: document.querySelector('.sfpgline') ? document.querySelector('.sfpgline').textContent : '' }));
  assert.deepEqual({ W: r.W, H: r.H, src: r.src, sig: r.sig }, before);
  assert.match(r.line, /Page straightened/);
  assert.deepEqual(errors, []);
});
