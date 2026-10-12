// v314 (D9): a photo of the finished page. Added from the Page finished panel, Home's latest piece or the guide's ⋯
// menu; found and straightened by itself when the finder is sure, else four corner handles with Keep as is; kept on
// this device beside the guide ('fin-<id>'), in the Library's backup, gone with the guide and back with Put back;
// Home shows it first with Your page | Plan; Reveal and the panel make a card of the plan beside it. Each test fails
// on v313, which had no photo of the finished page.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, openMenu, menuItem } from './helpers.mjs';

before(setup);
after(teardown);

// A made-up phone photo of a Letter page (the sample's picture on it), turned and tilted in front of a 25 mm lens, on
// a table (wood, or white: the finder can't find a white page on it), with uneven light, noise and JPEG; and where its
// corners really are. (As straighten.test.mjs makes them.)
const GEN = String.raw`
async function makePhoto(o) {
  const W = 1200, H = 1600;
  const art = new Image(); await new Promise((r) => { art.onload = r; art.src = '/src/assets/sample-jellyfish.png'; });
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
    else if (o.bg === 'white') { r = 238; gg = 236; b = 232; }
    else { const t = Math.sin(x * 0.02 + Math.sin(y * 0.005) * 3) * 0.5 + 0.5; r = 120 + 50 * t; gg = 80 + 35 * t; b = 50 + 20 * t; }
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
const FOUND = { tilt: 25, roll: 8, size: 0.6 },
  PALE = { tilt: 20, roll: 4, size: 0.6, bg: 'white' };

// the sample, every section coloured, in the Library and open in Colour along (its Page finished panel showing)
async function finished(page) {
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
  return page.evaluate(() => __mstest.curId);
}
async function choose(page, ph, sel) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(sel)]);
  await fc.setFiles({ name: 'my-page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
}
const stored = (page, id) => page.evaluate((id) => IDB.get('fin-' + id).then((r) => r || null), id);
// (in the page: waitForFunction doesn't wait for a promise)
const finIs = (page, id, there) =>
  page.evaluate(
    ([id, there]) =>
      new Promise((res, rej) => {
        const t0 = Date.now(),
          go = () =>
            IDB.get('fin-' + id).then((r) => {
              if (!!r === there) res();
              else if (Date.now() - t0 > 30000)
                rej(new Error(there ? 'the photo isn’t back' : 'the photo is still there'));
              else setTimeout(go, 100);
            });
        go();
      }),
    [id, there],
  );
const rec = (page) => page.evaluate(() => __mstest.fin.rec);
const waitRec = (page, ts0 = 0) =>
  page.waitForFunction((t) => __mstest.fin.rec && __mstest.fin.rec.ts > t, ts0, { timeout: 30000 });
const near = (a, b, tol) => Math.abs(a / b - 1) < tol;
const LETTER = 8.5 / 11;

test('a photo of the finished page, found and straightened: kept beside the guide and shown in the Page finished panel; ⋯ Change and Remove; Reset progress keeps it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const id = await finished(page);
  assert.match(
    await page.textContent('#sfFin'),
    /Add a photo of your page.*Keep your finished page beside its plan\. It stays on this device\./,
  );
  await choose(page, await photo(page, FOUND), '#sfFin [data-fin="add"]');
  await waitRec(page);
  const r = await rec(page);
  assert.equal(r.flat, 1, 'straightened');
  assert.ok(near(r.w / r.h, LETTER, 0.03), 'its true shape: ' + (r.w / r.h).toFixed(3));
  assert.ok(Math.max(r.w, r.h) <= 1600 && /^data:image\/jpeg;base64,/.test(r.u));
  assert.equal((await stored(page, id)).ts, r.ts, 'kept on this device, beside the guide');
  assert.equal(await page.evaluate(() => __mstest.fin.editing), null, 'no corners asked for');
  assert.match(await page.textContent('#msToast'), /Photo of your page added, straightened\./);
  assert.match(
    await page.textContent('#sfFin'),
    /Your page.*Added today · straightened.*Show beside the plan/,
  );
  // ⋯: Change and Remove (not Add)
  await openMenu(page);
  const items = await page.$$eval('#sfSheet .sfmitem', (b) => b.map((x) => x.textContent));
  assert.ok(
    items.includes('Change the photo of your page') && items.includes('Remove the photo of your page'),
    items.join(),
  );
  assert.ok(!items.includes('Add a photo of your page'));
  await page.keyboard.press('Escape');
  await idle(page);
  // Reset progress says it's kept
  await menuItem(page, 'Reset progress');
  assert.match(
    await page.textContent('#sfSheet'),
    /Your photo of the page is kept, and shows again once the page is finished\./,
  );
  await page.click('#sfSheet [data-rp="cancel"]');
  await idle(page);
  // Remove asks first
  await menuItem(page, 'Remove the photo of your page');
  await page.waitForSelector('#sfEdAsk');
  assert.match(await page.textContent('#sfEdAsk'), /Remove your photo\?.*The guide stays as it is\./);
  await page.click('#sfEdAsk [data-a="go"]');
  await page.waitForSelector('#sfFin [data-fin="add"]');
  assert.equal(await stored(page, id), null, 'gone from the device');
  assert.deepEqual(errors, []);
});

// the corner handles' places on the screen
const handle = (page, i) =>
  page.evaluate((i) => {
    const e = __mstest.fin.editing,
      c = document.getElementById('sfFinCv'),
      r = c.getBoundingClientRect(),
      s = r.width / c.width;
    return { x: r.left + (e.pad + e.q[i][0] * e.k) * s, y: r.top + (e.pad + e.q[i][1] * e.k) * s };
  }, i);
const spot = (page, p) =>
  page.evaluate((p) => {
    const e = __mstest.fin.editing,
      c = document.getElementById('sfFinCv'),
      r = c.getBoundingClientRect(),
      s = r.width / c.width;
    return { x: r.left + (e.pad + p[0] * e.k) * s, y: r.top + (e.pad + p[1] * e.k) * s };
  }, p);
async function drag(page, i, to) {
  const a = await handle(page, i),
    b = await spot(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

test('a page the finder can’t find (a white desk): four corner handles; corners that cross say so; Straighten, Keep as is, Cancel and Escape', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const id = await finished(page);
  const ph = await photo(page, PALE);
  await choose(page, ph, '#sfFin [data-fin="add"]');
  await page.waitForSelector('#sfFinEd #sfFinCv');
  assert.match(
    await page.textContent('#sfFinEd .dsub'),
    /Drag the four corners onto the corners of your page, or keep the photo as it is\./,
  );
  assert.equal(await page.isEnabled('#sfFinEd [data-a="go"]'), true);
  // crossed over: Straighten waits
  await drag(
    page,
    0,
    ph.C[2].map((v) => v + 40),
  );
  assert.equal(await page.isEnabled('#sfFinEd [data-a="go"]'), false);
  assert.equal(await page.isVisible('#sfFinX'), true);
  // onto the page's corners
  for (let i = 0; i < 4; i++) await drag(page, i, ph.C[i]);
  const q = (await page.evaluate(() => __mstest.fin.editing)).q;
  const off = Math.max(...q.map((p, i) => Math.hypot(p[0] - ph.C[i][0], p[1] - ph.C[i][1])));
  assert.ok(off < 6, 'on the corners: ' + off.toFixed(1));
  assert.equal(await page.isVisible('#sfFinX'), false);
  await page.click('#sfFinEd [data-a="go"]');
  await waitRec(page);
  let r = await rec(page);
  assert.equal(r.flat, 1);
  assert.ok(near(r.w / r.h, LETTER, 0.04), 'its true shape: ' + (r.w / r.h).toFixed(3));
  assert.equal(await page.locator('#sfFinEd').count(), 0);
  // Adjust corners: the same photo, its corners where they were left
  await page.click('#sfFin [data-fin="adjust"]');
  await page.waitForSelector('#sfFinEd');
  const q2 = (await page.evaluate(() => __mstest.fin.editing)).q;
  assert.ok(Math.hypot(q2[0][0] - ph.C[0][0], q2[0][1] - ph.C[0][1]) < 6);
  // Escape: nothing changes
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.locator('#sfFinEd').count(), 0);
  assert.equal((await rec(page)).ts, r.ts);
  // Change, then Keep as is: the photo as taken
  await choose(page, ph, '#sfFin [data-fin="change"]');
  await page.waitForSelector('#sfFinEd');
  await page.click('#sfFinEd [data-a="keep"]');
  await waitRec(page, r.ts);
  r = await rec(page);
  assert.equal(r.flat, 0);
  assert.equal(r.w / r.h, 1200 / 1600, 'as taken');
  assert.match(await page.textContent('#sfFin'), /Added today/);
  assert.doesNotMatch(await page.textContent('#sfFin'), /straightened/);
  // Change, then Cancel: as it was
  await choose(page, ph, '#sfFin [data-fin="change"]');
  await page.waitForSelector('#sfFinEd');
  await page.click('#sfFinEd [data-a="cancel"]');
  await idle(page);
  assert.equal((await stored(page, id)).ts, r.ts);
  // the keyboard: arrow keys move the corner, Space the next one
  await page.click('#sfFin [data-fin="adjust"]');
  await page.waitForSelector('#sfFinEd');
  const k0 = (await page.evaluate(() => __mstest.fin.editing)).q.map((p) => p.slice());
  await page.focus('#sfFinCv');
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowRight');
  const k1 = (await page.evaluate(() => __mstest.fin.editing)).q;
  assert.equal(k1[0][0], k0[0][0], 'the first corner stays');
  assert.ok(k1[1][0] > k0[1][0], 'the second moves right');
  await page.click('#sfFinEd [data-a="cancel"]');
  assert.deepEqual(errors, []);
});

const home = async (page) => {
  await page.click('#mHome');
  await idle(page);
};
const heroImg = (page) =>
  page.waitForFunction(() => !!document.querySelector('#homeHero .hhbox img'), null, { timeout: 20000 });
const pressed = (page) =>
  page.$$eval('#homeHero .hhseg [aria-pressed="true"]', (b) => b.map((x) => x.getAttribute('data-v')));

test('Home’s latest piece: Add a photo of your page (✕ puts it away for that guide); with one it shows first, the plan a tap away, remembered', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const id = await finished(page);
  await home(page);
  await heroImg(page);
  await page.waitForSelector('#homeHero .hhfin:not([hidden])');
  assert.equal(await page.isVisible('#homeHero .hhseg'), false, 'no switch without a photo');
  // ✕: put away, still after a reload
  await page.click('#homeHero .hhfinx');
  assert.equal(await page.isVisible('#homeHero .hhfin'), false);
  await page.reload();
  await idle(page);
  await home(page);
  await heroImg(page);
  // (the offer is shown or not with the picture)
  assert.equal(await page.isVisible('#homeHero .hhfin'), false, 'still put away');
  // brought back, and a photo added from Home itself
  await page.evaluate(() => localStorage.removeItem('ms-finx'));
  await page.reload();
  await idle(page);
  await home(page);
  await page.waitForSelector('#homeHero .hhfin:not([hidden])');
  await choose(page, await photo(page, FOUND), '#homeHero .hhfinadd');
  await page.waitForSelector('#homeHero .hhbox.ph img', { timeout: 30000 });
  assert.equal((await stored(page, id)).flat, 1);
  assert.match(await page.textContent('#homeHero .hhwhen'), /^Finished · .+ · your photo$/);
  assert.deepEqual(await pressed(page), ['page']);
  assert.equal(await page.isVisible('#homeHero .hhfin'), false);
  // the plan, remembered for the guide
  await page.click('#homeHero .hhseg [data-v="plan"]');
  assert.equal(await page.locator('#homeHero .hhbox.ph').count(), 0);
  assert.doesNotMatch(await page.textContent('#homeHero .hhwhen'), /your photo/);
  await page.reload();
  await idle(page);
  await home(page);
  await page.waitForSelector('#homeHero .hhseg:not([hidden])');
  assert.deepEqual(await pressed(page), ['plan']);
  assert.equal(await page.locator('#homeHero .hhbox.ph').count(), 0);
  // a tap on the picture still opens the guide
  await page.click('#homeHero .hhseg [data-v="page"]');
  await page.click('#homeHero .hhpic');
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  assert.deepEqual(errors, []);
});

test('the photo goes when the guide is deleted, and comes back with Put back; Save a copy doesn’t copy it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const id = await finished(page);
  await choose(page, await photo(page, FOUND), '#sfFin [data-fin="add"]');
  await waitRec(page);
  const ts = (await rec(page)).ts;
  // deleted in the Library while open, its Undo let go
  await page.evaluate((id) => {
    libDelete(id);
    libFinish();
  }, id);
  await finIs(page, id, false);
  // Put back
  await page.click('#sfHead .sfsave');
  await finIs(page, id, true);
  assert.equal((await stored(page, id)).ts, ts, 'the same photo');
  // Save a copy (on the plan): the copy has none
  await page.click('#sfDoneBtn');
  await idle(page);
  await menuItem(page, 'Save a copy');
  await page.waitForFunction((id) => __mstest.curId !== id && __mstest.inLibrary, id);
  const cid = await page.evaluate(() => __mstest.curId);
  assert.equal(await stored(page, cid), null);
  assert.ok(await stored(page, id), 'the first keeps its own');
  assert.deepEqual(errors, []);
});

test('the Library’s backup holds the photo (a guide file doesn’t); restoring puts it back, for the guide here and for one deleted', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const id = await finished(page);
  await choose(page, await photo(page, FOUND), '#sfFin [data-fin="add"]');
  await waitRec(page);
  const r = await rec(page);
  // the backup reminder counts the photo as a change
  assert.ok(await page.evaluate((id) => +state.saved.find((s) => s.id === id).fn > 0, id));
  await page.evaluate(() => openLibrary());
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
  const file = await dl.path();
  const bk = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
  const g = bk.guides.find((x) => x.id === id);
  assert.equal(g.fin.u, r.u, 'in the backup');
  assert.equal(await page.evaluate(() => guidesAtRisk()), 0, 'backed up');
  await page.keyboard.press('Escape');
  await idle(page);
  // a guide file: the guide only
  assert.doesNotMatch(
    await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj(true))),
    /data:image\/jpeg/,
  );
  // the photo gone here, then the backup restored: back for the same guide
  await page.evaluate((id) => IDB.del('fin-' + id), id);
  await page.setInputFiles('#guidesFile', file);
  await finIs(page, id, true);
  assert.equal((await stored(page, id)).u, r.u);
  await idle(page, 1500);
  // the guide deleted for good, photo and all; restored, both come back
  await page.evaluate((id) => {
    libDelete(id);
    libFinish();
  }, id);
  await finIs(page, id, false);
  await page.setInputFiles('#guidesFile', file);
  await page.waitForFunction((id) => state.saved.some((s) => s.id === id), id, { timeout: 30000 });
  await finIs(page, id, true);
  assert.equal((await stored(page, id)).u, r.u);
  assert.deepEqual(errors, []);
});

test('Reveal’s end: Plan and your page shows the plan beside the photo (side by side for a tall page), over Reveal, with Share', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await finished(page);
  await choose(page, await photo(page, FOUND), '#sfFin [data-fin="add"]');
  await waitRec(page);
  // the card: 1080 × 1350
  await page.waitForFunction(() => __mstest.fin.card() !== null);
  const c = await page.evaluate(() => {
    const k = __mstest.fin.card();
    return { w: k.width, h: k.height, at: k.finAt };
  });
  assert.deepEqual([c.w, c.h], [1080, 1350]);
  assert.equal(c.at.side, true, 'side by side');
  assert.ok(c.at.plan.x + c.at.plan.w < c.at.page.x, 'the plan on the left');
  assert.ok(Math.abs(c.at.plan.h - c.at.page.h) < 1, 'the same height');
  await page.click('#sfAlongRev');
  await page.waitForSelector('#revFin', { timeout: 30000 });
  assert.equal(await page.textContent('#revFin'), 'Plan and your page');
  await page.click('#revFin');
  await page.waitForSelector('#sfFinCard img');
  // over Reveal
  assert.equal(
    await page.evaluate(() => {
      const b = document.querySelector('#sfFinCard [data-a="share"]').getBoundingClientRect();
      return !!document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2).closest('#sfFinCard');
    }),
    true,
  );
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sfFinCard [data-a="share"]')]);
  assert.equal(dl.suggestedFilename(), 'finished-jellyfish-plan-and-page.jpg');
  // Escape closes the card, then Reveal
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.locator('#sfFinCard').count(), 0);
  assert.equal(await page.isVisible('#revFin'), true, 'Reveal still open');
  assert.deepEqual(errors, []);
});
