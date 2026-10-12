// v315: a photo of the finished page is of a COLOURED page. The page finder's paper view split the photo at the drawing's
// colours, so a coloured page on a light grey or light wood table was never found (the corners opened) where the same
// page uncoloured was. For a finished page the finder now splits again when the first split leaves nearly everything
// above it, keeping that split only where the brightness histogram has a clear valley (a white table's lighting has
// none). Building a guide from a photo is unchanged. And a photo taken with the phone turned, or upside down, is turned
// the right way up by comparing it with the plan; the panel's Turn turns it a quarter turn; the page takes the paper
// Print uses when it measures within 6% of it. Straightened by itself, its toast offers Adjust corners; on a patterned
// cloth the corners are shown to check; Turn keeps the day it was added and loses nothing. Tests 1–3, 5 and 6 fail on
// v314.1; 4 guards a photo already upright.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

// a made-up phone photo of a Letter page with `art` on it (a data: URL), turned and tilted in front of a 25 mm lens, on a
// plain table of brightness `L`, or a red and white check cloth of `check` px squares (shaded a little, with noise and
// JPEG); and where its corners really are
const GEN = String.raw`
async function makePhoto(o) {
  const W = 1200, H = 1600;
  const art = new Image(); await new Promise((r) => { art.onload = r; art.src = o.art; });
  const PW = 850, PH = 1100, pg = document.createElement('canvas'); pg.width = PW; pg.height = PH; const p = pg.getContext('2d');
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  p.fillStyle = '#f7f5ef'; p.fillRect(0, 0, PW, PH);
  const s = Math.min((PW - 160) / art.width, (PH - 200) / art.height); p.drawImage(art, (PW - art.width * s) / 2, (PH - art.height * s) / 2, art.width * s, art.height * s);
  const pd = p.getImageData(0, 0, PW, PH).data;
  const f = 25 / 43.27 * Math.hypot(W, H), tx = (o.tilt || 0) * Math.PI / 180, rz = (o.roll || 0) * Math.PI / 180, sz = o.size || 0.8;
  const hw = 0.5 * 8.5, hh = 0.5 * 11, Z = (11 / sz) * f / H;
  const proj = (X, Y) => { let x = X, y = Y * Math.cos(tx), z = Y * Math.sin(tx); const x1 = x * Math.cos(rz) - y * Math.sin(rz), y1 = x * Math.sin(rz) + y * Math.cos(rz); return [W / 2 + f * x1 / (z + Z), H / 2 + f * y1 / (z + Z)]; };
  const C = [proj(-hw, -hh), proj(hw, -hh), proj(hw, hh), proj(-hw, hh)], Hm = __mstest.pgHomog(C, [[0, 0], [PW, 0], [PW, PH], [0, PH]]);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const j = (y * W + x) * 4, den = Hm[6] * x + Hm[7] * y + 1, u = (Hm[0] * x + Hm[1] * y + Hm[2]) / den, v = (Hm[3] * x + Hm[4] * y + Hm[5]) / den; let r, gg, b;
    if (u >= 0 && v >= 0 && u < PW - 1 && v < PH - 1) { const k = ((v | 0) * PW + (u | 0)) * 4; r = pd[k]; gg = pd[k + 1]; b = pd[k + 2]; }
    else if (o.check) { const on = (Math.floor(x / o.check) + Math.floor(y / o.check)) % 2 === 0; r = on ? 200 : 240; gg = b = on ? 40 : 240; }
    else { r = gg = b = o.L; }
    const sh = 1 - 0.22 * (x / W * 0.6 + y / H * 0.4), nz = (rnd() - 0.5) * 12; d[j] = r * sh + nz; d[j + 1] = gg * sh + nz; d[j + 2] = b * sh + nz; d[j + 3] = 255; }
  g.putImageData(im, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
  return { b64, C };
}`;
const photo = (page, o) =>
  page.evaluate(
    ([src, o]) => {
      eval(src);
      return makePhoto(o);
    },
    [GEN, o],
  ); // eslint-disable-line no-eval
// the finder on a photo, as the finished-page path (coloured) and as guide building calls it
const find = (page, b64) =>
  page.evaluate(async (b64) => {
    const im = new Image();
    im.src = 'data:image/jpeg;base64,' + b64;
    await im.decode();
    const t = __mstest,
      q = (f) => ({ tier: f.tier, why: f.why || '', q: f.q ? f.q.map((p) => p.map(Math.round)) : null });
    return { fin: q(t.pgFind(im, { coloured: true })), guide: q(t.pgFind(im)) };
  }, b64);
const err = (q, C) => Math.max(...q.map((p, i) => Math.hypot(p[0] - C[i][0], p[1] - C[i][1]))) / 1600;

test('a coloured page on a grey table is found and straightened by itself; on a white table the corners still open; guide building finds as before', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  // the sample coloured as planned
  const art = await page.evaluate(() => __mstest.buildExportCanvas(false, true).toDataURL('image/png'));
  // a grey table at 70% of the paper's brightness: found now, not before (guide building still as before)
  const grey = await photo(page, { art, L: 170, tilt: 15, roll: 5, size: 0.7 });
  let r = await find(page, grey.b64);
  assert.equal(r.fin.tier, 'sure', JSON.stringify(r.fin));
  assert.ok(err(r.fin.q, grey.C) < 0.01, 'its corners: ' + err(r.fin.q, grey.C).toFixed(4));
  assert.notEqual(r.guide.tier, 'sure', 'guide building as v314.1 found it: ' + r.guide.tier);
  // a white table: no page offered with wrong corners
  const white = await photo(page, { art, L: 236, tilt: 15, roll: 5, size: 0.7 });
  r = await find(page, white.b64);
  assert.equal(r.fin.tier, 'none', 'white table: ' + JSON.stringify(r.fin));
  // a wood-dark table: found either way, the same corners
  const dark = await photo(page, { art, L: 90, tilt: 15, roll: 5, size: 0.7 });
  r = await find(page, dark.b64);
  assert.equal(r.fin.tier, 'sure');
  assert.deepEqual(r.fin.q, r.guide.q, 'the second split never runs where the first works');
  assert.deepEqual(errors, []);
});

test('the Page finished panel: a coloured page on a grey table, chosen as its photo, is straightened with no corners to drag; the note says how', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.styleVars.smpTry = 0;
    t.curName = 'Finished jellyfish';
    t.assignData.order.forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.saveNow();
  });
  await page.waitForFunction(() => __mstest.inLibrary);
  await page.click('#sfColor');
  await idle(page);
  await page.waitForSelector('#sfFin [data-fin="add"]');
  assert.match(
    await page.textContent('#sfFin .sffinnote'),
    /On a plain table darker than the paper, it straightens by itself\./,
  );
  const art = await page.evaluate(() => __mstest.buildExportCanvas(false, true).toDataURL('image/png'));
  const ph = await photo(page, { art, L: 170, tilt: 15, roll: 5, size: 0.7 });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFin [data-fin="add"]')]);
  await fc.setFiles({ name: 'my-page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.fin.rec, null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => __mstest.fin.rec.flat), 1, 'straightened');
  assert.equal(await page.locator('#sfFinEd').count(), 0, 'no corners asked for');
  // (Q9) its toast offers Adjust corners: the corners as found, to check
  await page.waitForSelector('#msToast #toastAct');
  assert.equal(await page.textContent('#toastAct'), 'Adjust corners');
  await page.click('#toastAct');
  await page.waitForFunction(() => !!__mstest.fin.editing);
  assert.ok(await page.evaluate(() => !!__mstest.fin.editing.q), 'the corners found');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.locator('#sfFinEd').count(), 0);
  assert.deepEqual(errors, []);
});

// (Q4) the sample, every section coloured, in the Library and open in Colour along; its plan without a key, as a
// coloured page is
async function finishedArt(page) {
  await sampleGuide(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.styleVars.smpTry = 0;
    t.curName = 'Finished jellyfish';
    t.assignData.order.forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.saveNow();
  });
  await page.waitForFunction(() => __mstest.inLibrary);
  const art = await page.evaluate(() => document.getElementById('sfCanvas').toDataURL('image/png'));
  await page.click('#sfColor');
  await idle(page);
  await page.waitForSelector('#sfFin [data-fin="add"]');
  return art;
}
// which way up the stored photo is: compared with the plan as the app compares them, the turn that matches best
const upright = (page) =>
  page.evaluate(async () => {
    const r = __mstest.fin.rec,
      im = new Image();
    im.src = r.u;
    await im.decode();
    const c = document.createElement('canvas');
    c.width = im.width;
    c.height = im.height;
    c.getContext('2d').drawImage(im, 0, 0);
    return { w: r.w, h: r.h, o: await __mstest.fin.orient(__mstest.curId, c) };
  });

test('a photo taken with the phone turned, or upside down, is kept the right way up; Turn turns it a quarter turn', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const art = await finishedArt(page);
  let ts = 0;
  for (const roll of [88, 180, 268]) {
    const ph = await photo(page, { art, L: 90, tilt: 0, roll, size: 0.7 });
    const sel = ts ? '#sfFin [data-fin="change"]' : '#sfFin [data-fin="add"]';
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(sel)]);
    await fc.setFiles({ name: 'my-page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
    await page.waitForFunction((t) => __mstest.fin.rec && __mstest.fin.rec.ts > t, ts, { timeout: 30000 });
    ts = await page.evaluate(() => __mstest.fin.rec.ts);
    const u = await upright(page);
    assert.ok(u.h > u.w, `roll ${roll}: upright, not on its side (${u.w}×${u.h})`);
    assert.equal(u.o.turns, 0, `roll ${roll}: needs no more turning (scores ${u.o.sc})`);
    assert.match(await page.textContent('#msToast'), /turned upright/);
  }
  // Turn: a quarter turn clockwise, then back with three more
  await page.click('#sfFin [data-fin="turn"]');
  await page.waitForFunction((t) => __mstest.fin.rec.ts > t, ts);
  const t1 = await page.evaluate(() => __mstest.fin.rec);
  assert.ok(t1.w > t1.h, 'on its side after a quarter turn');
  assert.match(await page.textContent('#msToast'), /Photo turned\./);
  assert.equal(
    await page.evaluate(
      (id) => state.saved.find((s) => s.id === id).fa,
      await page.evaluate(() => __mstest.curId),
    ),
    Math.round((t1.w / t1.h) * 10000) / 10000,
    'Home’s shape follows',
  );
  assert.deepEqual(errors, []);
});

test('a page photographed upright stays as it is; the page’s shape is the paper Print uses when it’s within 6%', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const art = await finishedArt(page);
  const ph = await photo(page, { art, L: 90, tilt: 20, roll: 4, size: 0.7 });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFin [data-fin="add"]')]);
  await fc.setFiles({ name: 'my-page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.fin.rec, null, { timeout: 30000 });
  assert.doesNotMatch(await page.textContent('#msToast'), /turned/);
  const r = await page.evaluate(() => __mstest.fin.rec);
  // Letter (the paper here), as Print has it
  assert.ok(Math.abs(r.w / r.h - 8.5 / 11) < 0.004, 'Letter: ' + (r.w / r.h).toFixed(4));
  assert.deepEqual(errors, []);
});

test('(Q9) a finished page on a check cloth: found, but the corners shown to check, not trusted; on a plain table, trusted', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  const art = await page.evaluate(() => __mstest.buildExportCanvas(false, true).toDataURL('image/png'));
  const cloth = await find(page, (await photo(page, { art, check: 12, tilt: 15, roll: 0, size: 0.75 })).b64);
  assert.equal(cloth.fin.tier, 'unsure');
  assert.equal(cloth.fin.why, 'cloth');
  const plain = await find(page, (await photo(page, { art, L: 120, tilt: 15, roll: 0, size: 0.75 })).b64);
  assert.equal(plain.fin.tier, 'sure', 'a plain table as before');
  assert.deepEqual(errors, []);
});

test('(Q9) Turn keeps the day the photo was added, loses nothing turned right round, and Adjust corners keeps the turn', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const art = await finishedArt(page);
  const id = await page.evaluate(() => __mstest.curId);
  const ph = await photo(page, { art, L: 120, tilt: 10, roll: 3, size: 0.7 });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFin [data-fin="add"]')]);
  await fc.setFiles({ name: 'my-page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.fin.rec && __mstest.fin.rec.flat === 1, null, {
    timeout: 30000,
  });
  const r0 = await page.evaluate(() => __mstest.fin.rec);
  // added five days ago
  const old = Date.now() - 5 * 864e5;
  await page.evaluate(
    ([id, r, old]) =>
      IDB.put('fin-' + id, Object.assign({}, r, { ts: old, added: old })).then(() => __mstest.fin.refresh()),
    [id, r0, old],
  );
  await page.waitForFunction((old) => __mstest.fin.rec.ts === old, old);
  const turned = (n) => page.waitForFunction((n) => __mstest.fin.rec.ts > n, n, { timeout: 30000 });
  let t = old;
  for (let i = 0; i < 4; i++) {
    await page.click('#sfFin [data-fin="turn"]');
    await turned(t);
    t = await page.evaluate(() => __mstest.fin.rec.ts);
    assert.equal(await page.evaluate(() => __mstest.fin.rec.added), old, 'still added five days ago');
    assert.doesNotMatch(await page.textContent('#sfFin .sffinwhen'), /today/);
  }
  assert.equal(await page.evaluate(() => __mstest.fin.rec.u), r0.u, 'turned right round: the same photo');
  // one turn, then Adjust corners › Straighten: still turned
  await page.click('#sfFin [data-fin="turn"]');
  await turned(t);
  t = await page.evaluate(() => __mstest.fin.rec.ts);
  const w1 = await page.evaluate(() => __mstest.fin.rec.w);
  await page.click('#sfFin [data-fin="adjust"]');
  await page.waitForSelector('#sfFinEd [data-a="go"]');
  await page.click('#sfFinEd [data-a="go"]');
  await turned(t);
  assert.equal(await page.evaluate(() => __mstest.fin.rec.w), w1, 'the turn kept');
  assert.equal(await page.evaluate(() => __mstest.fin.rec.added), old);
  assert.deepEqual(errors, []);
});
