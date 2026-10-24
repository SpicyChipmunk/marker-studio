// Getting a picture in: photos, scans, PDFs, straightening, sections found, specks, frames, hatching.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ROOT,
  answerAsks,
  haveSet,
  idle,
  openApp,
  openBackupDialog,
  sampleGuide,
  saveGuide,
  sectionPoint,
  setup,
  teardown,
  welcome,
} from './helpers.mjs';
import { tmpdir } from 'node:os';
import { GEN_STRAIGHTEN } from './photo-gens.mjs';

before(setup);
after(teardown);

// ---- from v308-intake.test.mjs ----
// v308 (getting a picture in), in the browser: a tilted photo of grey paper keeps its sections; Straighten starts from
// the photo's own rectangle when the finder only saw the drawing; a page under a warm lamp is found; a straightened
// photo is found at Sensitivity 5 (v318.32: was 7); Auto crop says "Nothing to trim" with no Undo step; Merge refuses the background;
// Ignore faint grey marks; the warning for a coloured-in page; a failed file said once, and a PDF told what to do;
// the bloom's "too slow" lasts one launch; and a guide saved by v307.1 opens unchanged. Pages and photos are drawn
// here in code. (The measures themselves: test/v308-intake)
{
  async function fresh(opts = {}) {
    const a = await openApp({ width: 820, height: 1180, ...opts });
    await haveSet(a.page);
    await a.page.check('#wcSets input[data-i="3"]');
    await a.page.click('#wcAdd');
    return a;
  }
  async function pick(page, b64, name = 'page.jpg', mimeType = 'image/jpeg') {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({ name, mimeType, buffer: Buffer.from(b64, 'base64') });
  }
  const sections = async (page) => {
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
    await idle(page);
  };
  const count = (page) => page.evaluate(() => __mstest.countedList().length);
  const warn = (page) =>
    page.evaluate(() => (__mstest.segWarn && !__mstest.segWarn.ok ? __mstest.segWarn.code : ''));
  // Pictures drawn in the page: o.kind 'grey' (a page photographed square on, the paper grey and grainy, filling the
  // photo), 'angled' (a Letter page on a wooden table, turned and tilted towards the camera), 'faint' (line art with
  // pale grey rings like a watermark's letters), 'coloured' (line art coloured in, roughly). o.tint scales the channels
  // (a warm lamp). Returns the picture as base64 (JPEG, or PNG for line art).
  const GEN = String.raw`
async function makePic(o) {
  const art = new Image(); await new Promise((r) => { art.onload = r; art.src = '/src/assets/sample-jellyfish.png'; });
  let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const W = 1200, H = 1600, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  if (o.kind === 'grey' || o.kind === 'angled' || o.kind === 'coloured') {
    // the page: the drawing on paper
    const PW = 850, PH = 1100, pg = document.createElement('canvas'); pg.width = PW; pg.height = PH; const p = pg.getContext('2d');
    p.fillStyle = '#fff'; p.fillRect(0, 0, PW, PH);
    const s = Math.min((PW - 120) / art.width, (PH - 160) / art.height);
    p.drawImage(art, (PW - art.width * s) / 2, (PH - art.height * s) / 2, art.width * s, art.height * s);
    if (o.kind === 'coloured') {
      // scribbled colour over most of it, in short strokes that break into specks (v318.35: dark blue and violet
      // markers, as dark as the lines: a mid marker's strokes are paper to the ink now, and such a page gets no warning)
      p.globalCompositeOperation = 'multiply';
      for (let i = 0; i < 20000; i++) { p.strokeStyle = 'hsl(' + (235 + ((i * 37) % 30)) + ',100%,35%)'; p.lineWidth = 2 + rnd() * 3; const x = rnd() * PW, y = rnd() * PH; p.beginPath(); p.moveTo(x, y); p.lineTo(x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 16); p.stroke(); }
      p.globalCompositeOperation = 'source-over';
      g.drawImage(pg, (W - PW) / 2, (H - PH) / 2); g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      return done(c, 'image/png');
    }
    const pd = p.getImageData(0, 0, PW, PH).data, im = g.createImageData(W, H), d = im.data;
    let Hm = null;
    if (o.kind === 'angled') {
      const f = 25 / 43.27 * Math.hypot(W, H), tx = 22 * Math.PI / 180, rz = 6 * Math.PI / 180, hw = 4.25, hh = 5.5, Z = (11 / 0.62) * f / H;
      const proj = (X, Y) => { let y = Y * Math.cos(tx), z = Y * Math.sin(tx), x = X; const x1 = x * Math.cos(rz) - y * Math.sin(rz), y1 = x * Math.sin(rz) + y * Math.cos(rz); z += Z; return [W / 2 + f * x1 / z, H / 2 + f * y1 / z]; };
      Hm = __mstest.pgHomog([proj(-hw, -hh), proj(hw, -hh), proj(hw, hh), proj(-hw, hh)], [[0, 0], [PW, 0], [PW, PH], [0, PH]]);
    }
    const t = o.tint || [1, 1, 1];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 4; let r, gg, b;
      let u, v;
      if (Hm) { const den = Hm[6] * x + Hm[7] * y + 1; u = (Hm[0] * x + Hm[1] * y + Hm[2]) / den; v = (Hm[3] * x + Hm[4] * y + Hm[5]) / den; }
      else { u = PW * 0.03 + x * PW * 0.94 / W; v = PH * 0.03 + y * PH * 0.94 / H; }
      if (u >= 0 && v >= 0 && u < PW - 1 && v < PH - 1) {
        const k = ((v | 0) * PW + (u | 0)) * 4, ink = pd[k] / 255;
        // grey paper (the grey a phone gives white paper indoors), the ink on it
        r = 196 * ink + 30 * (1 - ink); gg = 190 * ink + 30 * (1 - ink); b = 178 * ink + 32 * (1 - ink);
      } else if (Hm) { const q = Math.sin(x * 0.02 + Math.sin(y * 0.005) * 3) * 0.5 + 0.5; r = 120 + 50 * q; gg = 80 + 35 * q; b = 50 + 20 * q; }
      else { r = 70; gg = 66; b = 60; }
      const sh = 1 - 0.12 * (x / W * 0.6 + y / H * 0.4), nz = (rnd() - 0.5) * 14;
      d[j] = (r * sh + nz) * t[0]; d[j + 1] = (gg * sh + nz) * t[1]; d[j + 2] = (b * sh + nz) * t[2]; d[j + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return done(c, 'image/jpeg');
  }
  // 'faint': line art (rings and a cross) with pale grey rings round it
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#000'; g.lineWidth = 5;
  for (const r of [300, 180]) { g.beginPath(); g.arc(600, 760, r, 0, 6.283); g.stroke(); }
  g.beginPath(); g.moveTo(300, 760); g.lineTo(900, 760); g.moveTo(600, 460); g.lineTo(600, 1060); g.stroke();
  g.strokeStyle = 'rgb(212,212,212)'; g.lineWidth = 10;
  for (const [x, y] of [[180, 200], [1020, 200], [180, 1400], [1020, 1400], [600, 220]]) { g.beginPath(); g.arc(x, y, 70, 0, 6.283); g.stroke(); }
  return done(c, 'image/png');
  async function done(c, type) { const blob = await new Promise((r) => c.toBlob(r, type, 0.9)); return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); }); }
}`;
  const pic = (page, o) =>
    page.evaluate(
      async ([src, o]) => {
        eval(src);
        return makePic(o);
      },
      [GEN, o],
    );
  test('a photo of grey paper, tilted: its sections stay as they were, with no fragments along the edges', async () => {
    const { page, errors } = await fresh();
    await pick(page, await pic(page, { kind: 'grey' }));
    await sections(page);
    const n0 = await count(page);
    assert.equal(await warn(page), '', 'no warning straight');
    for (const a of [1, -1, 3]) {
      await page.evaluate((a) => __mstest.geoSet({ tilt: a }), a);
      await idle(page);
      const n = await count(page);
      assert.equal(await warn(page), '', 'no warning at ' + a + '°');
      assert.ok(Math.abs(n - n0) <= Math.max(6, n0 * 0.1), `tilted ${a}°: ${n} sections, ${n0} straight`);
    }
    // the turned-in corners are the paper's own grey, not white
    const corner = await page.evaluate(() => __mstest.gray[2 * __mstest.W + 2]);
    assert.ok(corner < 230, 'corner grey ' + corner);
    assert.deepEqual(errors, []);
  });
  test('Straighten on a photo where only the drawing was seen starts from the photo’s own rectangle, 3% in', async () => {
    const { page, errors } = await fresh();
    const b64 = await pic(page, { kind: 'grey' });
    const f = await page.evaluate(async (b64) => {
      const img = new Image();
      await new Promise((r) => {
        img.onload = r;
        img.src = 'data:image/jpeg;base64,' + b64;
      });
      const r = __mstest.pgFind(img);
      return { tier: r.tier, why: r.why, kind: r.kind };
    }, b64);
    assert.equal(f.tier, 'none');
    assert.ok(f.why === 'fills' || (f.why === 'plain' && f.kind === 'drawing'), JSON.stringify(f));
    await pick(page, b64);
    await sections(page);
    await page.click('#sfAdjToggle');
    await page.click('#sfPgOpen');
    await page.waitForSelector('#sfPgGo');
    const q = await page.evaluate(() => __mstest.pgEd.q);
    const exp = [
      [36, 48],
      [1164, 48],
      [1164, 1552],
      [36, 1552],
    ];
    for (let i = 0; i < 4; i++)
      assert.ok(
        Math.hypot(q[i][0] - exp[i][0], q[i][1] - exp[i][1]) < 2,
        `corner ${i}: ${q[i].map(Math.round)}`,
      );
    assert.match(await page.textContent('.sfpgnote'), /Drag the four corners/);
    assert.deepEqual(errors, []);
  });
  test('a page photographed under a warm lamp is found and straightened, at Sensitivity 5 (v318.32: was 7); a scan stays at 5', async () => {
    const { page, errors } = await fresh();
    const b64 = await pic(page, { kind: 'angled', tint: [0.95, 0.82, 0.6] });
    const f = await page.evaluate(async (b64) => {
      const img = new Image();
      await new Promise((r) => {
        img.onload = r;
        img.src = 'data:image/jpeg;base64,' + b64;
      });
      return __mstest.pgFind(img).tier;
    }, b64);
    assert.equal(f, 'sure', 'found');
    await pick(page, b64);
    await page.waitForFunction(() => !!__mstest.pgQ && !!document.getElementById('sfBuild'), null, {
      timeout: 40000,
    });
    await sections(page);
    await page.click('#sfAdjToggle');
    assert.equal(await page.textContent('#sfSensVal'), '5', 'a straightened photo: Sensitivity 5 (v318.32)');
    // back to the photo as taken: 5 again
    await page.click('#sfPgUndo');
    await sections(page);
    if (!(await page.isVisible('#sfSensVal'))) await page.click('#sfAdjToggle');
    assert.equal(await page.textContent('#sfSensVal'), '5');
    // set by hand, it stays where it was put when the photo is straightened again
    await page.evaluate(() => {
      const s = document.getElementById('sfSens');
      s.value = 3;
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await idle(page);
    await page.click('#sfPgOpen');
    await page.waitForSelector('#sfPgGo');
    await page.click('#sfPgGo');
    await sections(page);
    if (!(await page.isVisible('#sfSensVal'))) await page.click('#sfAdjToggle');
    assert.equal(await page.textContent('#sfSensVal'), '3', 'yours kept');
    assert.deepEqual(errors, []);
    // a scan (line art on white) keeps 5
    const b = await fresh();
    await pick(b.page, await pic(b.page, { kind: 'faint' }), 'page.png', 'image/png');
    await sections(b.page);
    await b.page.click('#sfAdjToggle');
    assert.equal(await b.page.textContent('#sfSensVal'), '5');
    assert.deepEqual(b.errors, []);
  });
  test('Auto crop on a page with nothing round it: "Nothing to trim", and no Undo step', async () => {
    const { page, errors } = await fresh();
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    await pick(page, buf.toString('base64'), 'letter-page.png', 'image/png');
    await sections(page);
    const n0 = await count(page),
      u0 = await page.evaluate(() => __mstest.undoCount),
      wh = await page.evaluate(() => [__mstest.W, __mstest.H]);
    await page.click('#sfAdjToggle');
    await page.click('#sfAutoCrop');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.undoCount), u0, 'no Undo step');
    assert.match(await page.textContent('#msToast'), /Nothing to trim/);
    assert.deepEqual(await page.evaluate(() => [__mstest.W, __mstest.H]), wh, 'the picture as it was');
    assert.equal(await count(page), n0);
    assert.deepEqual(errors, []);
  });
  test('Merge refuses the background, with a word on Leave out, and keeps the section picked', async () => {
    const { page, errors } = await fresh();
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    await pick(page, buf.toString('base64'), 'letter-page.png', 'image/png');
    await sections(page);
    const n0 = await count(page);
    const [l, bg] = await page.evaluate(() => {
      const t = __mstest,
        cl = t.countedList();
      let bg = 0;
      for (let i = 1; i < t.comps.length; i++)
        if (t.comps[i] && !t.comps[i].merged && t.comps[i].bg && !t.counted(i)) {
          bg = i;
          break;
        }
      return [cl[Math.floor(cl.length / 2)], bg];
    });
    assert.ok(bg > 0, 'there is background');
    await page.click('#sfEmMerge');
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.mergeSel), l, 'picked');
    // the paper at the picture's corner
    const c = await page.evaluate(() => {
      const r = document.getElementById('sfCanvas').getBoundingClientRect();
      return { x: r.left + 4, y: r.top + 4 };
    });
    assert.equal(
      await page.evaluate((c) => {
        const cv = document.getElementById('sfCanvas'),
          r = cv.getBoundingClientRect();
        const x = Math.floor(((c.x - r.left) / r.width) * cv.width),
          y = Math.floor(((c.y - r.top) / r.height) * cv.height);
        const k = __mstest.labels[y * __mstest.W + x];
        return __mstest.comps[k].bg && !__mstest.counted(k);
      }, c),
      true,
      'the corner is background',
    );
    await page.mouse.click(c.x, c.y);
    await idle(page);
    assert.match(
      await page.textContent('#msToast'),
      /That’s the background, not a section\. To make a section white, use Leave out\./,
    );
    assert.equal(await page.evaluate(() => __mstest.mergeSel), l, 'still picked');
    assert.equal(await count(page), n0, 'nothing merged');
    assert.equal(await page.evaluate((l) => __mstest.comps[l].merged || __mstest.comps[l].bg, l), false);
    assert.deepEqual(errors, []);
  });
  test('Ignore faint grey marks: offered for pale marks round dark outlines; ticked, they go; Undo brings them back', async () => {
    const { page, errors } = await fresh();
    await pick(page, await pic(page, { kind: 'faint' }), 'page.png', 'image/png');
    await sections(page);
    const n0 = await count(page);
    assert.ok(await page.isVisible('#sfFaint'), 'offered');
    assert.match(await page.textContent('#sfFaintLine'), /can be part of the drawing/);
    await page.check('#sfFaint');
    await idle(page);
    const n1 = await count(page);
    assert.equal(n1, n0 - 5, `the five pale rings' insides: ${n0} -> ${n1}`);
    assert.equal(await page.isChecked('#sfFaint'), true);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await count(page), n0, 'Undo');
    assert.equal(await page.isChecked('#sfFaint'), false);
    assert.deepEqual(errors, []);
    // not offered on clean line art
    const b = await fresh();
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    await pick(b.page, buf.toString('base64'), 'letter-page.png', 'image/png');
    await sections(b.page);
    assert.equal(await b.page.$('#sfFaint'), null);
    assert.deepEqual(b.errors, []);
  });
  test('a page coloured in already gets a warning (v318.35: softened, a partly coloured page works)', async () => {
    const { page, errors } = await fresh();
    await pick(page, await pic(page, { kind: 'coloured' }), 'page.png', 'image/png');
    await sections(page);
    assert.equal(await warn(page), 'coloured');
    assert.match(await page.textContent('.sfc-segwarn'), /coloured in already/);
    assert.match(await page.textContent('.sfc-segwarn'), /A partly coloured page works/);
    assert.deepEqual(errors, []);
  });
  test('a file that won’t open is said once; a PDF that won’t open is told to screenshot the page (v313: PDFs open); the start card offers Open the PDF', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await page.click('#wcLook');
    await idle(page);
    await page.click('#mSections');
    await page.waitForSelector('#sfStart', { state: 'visible' });
    assert.match(await page.textContent('#sfStart'), /Colouring page in a PDF\? Open the PDF/);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPick')]);
    await fc.setFiles({ name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a picture') });
    await page.waitForSelector('.mserr');
    await idle(page);
    const said = await page.evaluate(
      () => document.body.innerText.split('couldn’t be opened as a picture').length - 1,
    );
    assert.equal(said, 1, 'said once');
    assert.doesNotMatch(await page.textContent('#sfMeta'), /couldn’t be opened/);
    const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPick')]);
    await fc2.setFiles({
      name: 'colouring.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });
    await page.waitForFunction(() =>
      /Couldn’t open that PDF/.test(
        document.querySelector('.mserr') && document.querySelector('.mserr').textContent,
      ),
    );
    assert.match(
      await page.textContent('.mserr'),
      /Take a screenshot of the colouring page, then choose the screenshot\./,
    );
    assert.deepEqual(errors, []);
  });
  test('the bloom: too slow once, it stays off for this launch only; an old lasting "too slow" is let go', async () => {
    const pickLetter = async (page) => {
      const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
      await pick(page, buf.toString('base64'), 'letter-page.png', 'image/png');
      await sections(page);
      await page.click('#sfBuild');
      await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
        timeout: 60000,
      });
      await idle(page);
    };
    // a slow start: off for the rest of this launch (a reload is the same launch)
    const { page, errors } = await fresh({
      init: () => {
        window.__MS_BLOOM = true;
        window.__MS_BLOOM_PREP_MAX = 1e-9;
      },
    });
    await pickLetter(page);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('ms-bloom-slow')), '1', 'this launch');
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-bloom-slow')), null, 'not for good');
    assert.deepEqual(errors, []);
    // the next launch (a new session), with a lasting flag an earlier version left: it blooms again
    const b = await fresh({
      init: () => {
        window.__MS_BLOOM = true;
        if (!sessionStorage.getItem('__lsset')) {
          localStorage.setItem('ms-bloom-slow', '1');
          sessionStorage.setItem('__lsset', '1');
        }
      },
    });
    await pickLetter(b.page);
    assert.equal(await b.page.evaluate(() => __mstest.bloomCount), 1, 'bloomed');
    assert.equal(
      await b.page.evaluate(() => localStorage.getItem('ms-bloom-slow')),
      null,
      'the old flag is gone',
    );
    assert.deepEqual(b.errors, []);
  });
  // a guide saved by v307.1 from a page drawn in code (a double frame with corner circles, pale grey rings and line art):
  // sections as v307.1 found them, which v308 would find differently (the frame's paper left white, the pale rings
  // offered to be ignored). Opened, it is exactly as saved.
  test('a guide saved by v307.1 opens exactly as it was saved', async () => {
    const fx = JSON.parse(await readFile(join(ROOT, 'e2e', 'fixtures', 'v307-intake-guide.json'), 'utf8'));
    const { page, errors } = await fresh();
    await page.click('#wcLook').catch(() => {});
    await idle(page);
    await page.evaluate(
      (d) =>
        SF.importFile(new File([JSON.stringify(d.file)], 'old.msguide.json', { type: 'application/json' })),
      fx,
    );
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 20000,
    });
    await idle(page);
    const now = await page.evaluate(() => ({
      sig: __mstest.labelsSig(),
      n: Object.keys(__mstest.assignData.assign).length,
      frame: __mstest.frameLeft(),
      faint: __mstest.faintOffer,
      assign: Object.fromEntries(Object.entries(__mstest.assignData.assign).map(([k, v]) => [k, v.mkey])),
    }));
    assert.equal(now.sig, fx.sig, 'the same sections');
    assert.equal(now.n, fx.n, 'as many coloured: ' + now.n);
    assert.deepEqual(now.assign, fx.assign, 'the same markers');
    assert.equal(now.frame, 0, 'no frame line: v307.1 found none');
    assert.equal(now.faint, 0, 'nothing offered on a guide opened again');
    assert.deepEqual(errors, []);
  });
}

// ---- from v308-merge-r3.test.mjs ----
// v308 debug (reviewer 3): getting a picture in and what comes out of a guide, after the branches were merged.
{
  const opt = (page, o) =>
    page.evaluate((o) => {
      for (const k in o) __mstest.pdfOpt(k, o[k]);
    }, o);
  // the texts drawn on the PDF's pages, in the order drawn
  const pdfTexts = (page) =>
    page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        log = [];
      P.fillText = function (t, x, y) {
        const tr = this.getTransform();
        log.push({
          cv: this.canvas,
          t: String(t),
          y,
          al: this.textAlign,
          fill: this.fillStyle,
          id: tr.a === 1 && tr.e === 0,
        });
        return of.apply(this, arguments);
      };
      let cvs;
      try {
        cvs = __mstest.buildPDFPages();
      } finally {
        P.fillText = of;
      }
      return log
        .filter((e) => cvs.indexOf(e.cv) >= 0)
        .map((e) => ({ p: cvs.indexOf(e.cv), t: e.t, y: e.y, al: e.al, fill: e.fill, id: e.id }));
    });
  test('Codes with numbers for the small sections: the key is in number order, so "14" on the page is the 14th row', async () => {
    // (Ben's 451 markers, every one the page can take, Half Letter: small sections get the marker's number. v308 made
    // the numbers the colouring order but left the key by colour family, so they came 8, 12, 13, 4, 6, 1 …)
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      state.owned = new Set(defaultOwned());
      save();
      SF.setCollection(sfCollection());
      __mstest.styleVars.limitN = 999;
      SF.reassign();
    });
    await idle(page);
    await opt(page, { pwhat: 'page', plabels: 'codes', paper: 'half', blend: false });
    const t = await pdfTexts(page);
    const keyP = t.find((e) => e.t === 'Colour key').p,
      onKey = t.filter((e) => e.p >= keyP && e.id);
    const onPage = t.filter((e) => e.p < keyP && !e.id && /^\d+$/.test(e.t)).map((e) => +e.t);
    assert.ok(onPage.length, 'numbers on the colouring page or its close-ups');
    assert.ok(
      onKey.some((e) => e.t === 'NO.'),
      'NO. heads the column',
    );
    const nums = onKey
      .filter((e) => e.al === 'right' && /^\d+$/.test(e.t) && /^#(a0a0a0|111111)$/.test(e.fill))
      .map((e) => +e.t);
    const n = await page.evaluate(
      () => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
    );
    assert.deepEqual(
      nums,
      Array.from({ length: n }, (_, i) => i + 1),
      'the key’s rows in number order',
    );
    assert.ok(
      onPage.every((v) => v >= 1 && v <= n),
      'each number on the page is a row of the key',
    );
    assert.deepEqual(errors, []);
  });
  test('the screen-on note is seen at every size: in the tool row where it fits, else as a toast (side by side, a phone)', async () => {
    const init = () => {
      Object.defineProperty(navigator, 'wakeLock', {
        value: { request: () => Promise.resolve({ addEventListener() {}, release() {} }) },
        configurable: true,
      });
    };
    for (const [w, h, where] of [
      [1180, 820, 'toast'],
      [390, 844, 'toast'],
      [820, 1180, 'row'],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h, init });
      await sampleGuide(page);
      await idle(page);
      await page.click('#sfColor');
      await page.waitForFunction(
        () =>
          /screen stays on/.test(document.getElementById('msToast')?.textContent || '') ||
          /screen stays on/.test(document.getElementById('sfStat').textContent),
      );
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const r = await page.evaluate(() => {
        const t = document.getElementById('msToast'),
          s = document.querySelector('#sfStat .sfsp2');
        return {
          toast: !!t && t.classList.contains('on') && /screen stays on/.test(t.textContent),
          row: !!s && s.getBoundingClientRect().width > 0 && /screen stays on/.test(s.textContent),
        };
      });
      assert.equal(r.toast, where === 'toast', `${w}×${h}: a toast`);
      assert.equal(r.row, where === 'row', `${w}×${h}: in the tool row`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v308-specks.test.mjs ----
// v308 debug: specks of grain in the paper round a drawing are left out of what's printed and saved (outDebris), as
// on Ben's own page, where most of them (23-78 px) had been printed; the drawing's small details round it stay: a dot
// made with its pen, a small ring, a word, hatching and a dotted line. The page is drawn here in code.
{
  // a 1200 x 1600 page: the drawing (8 px lines: a box in four sections, two dots for eyes in one), and round it on the
  // paper the details (which stay) and the specks (which go), each with the box it lies in
  const GEN = String.raw`
async function makePage() {
  const W = 1200, H = 1600, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.strokeStyle = g.fillStyle = '#000'; g.lineCap = 'round';
  g.lineWidth = 8;
  g.strokeRect(320, 320, 560, 800);
  g.beginPath(); g.moveTo(600, 320); g.lineTo(600, 1120); g.moveTo(320, 720); g.lineTo(880, 720); g.stroke();
  for (const x of [430, 490]) { g.beginPath(); g.arc(x, 500, 6, 0, 6.283); g.fill(); }
  const keep = {}, go = {};
  // a dot made with the drawing's pen
  g.beginPath(); g.arc(180, 400, 5, 0, 6.283); g.fill(); keep.dot = [172, 392, 188, 408];
  // a small ring, drawn thin
  g.lineWidth = 2; g.beginPath(); g.arc(180, 600, 4.5, 0, 6.283); g.stroke(); keep.ring = [170, 590, 190, 610];
  // hatching: short thin strokes close together
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(980 + i * 7, 400); g.lineTo(1000 + i * 7, 430); g.stroke(); }
  keep.hatching = [975, 395, 1035, 435];
  // a dotted line
  for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(150 + i * 11, 1300, 2.5, 0, 6.283); g.fill(); }
  keep.dots = [145, 1295, 235, 1305];
  // a word
  g.font = '15px sans-serif'; g.textBaseline = 'top'; g.fillText('Ben 26', 960, 1300); keep.word = [955, 1295, 1020, 1318];
  // the specks: short scratches as thin as grain, and small clumps
  g.lineWidth = 2;
  for (const [x, y, dx, dy] of [[180, 800, 10, 6], [1000, 800, -5, 11], [700, 1350, 12, 2], [180, 1000, 4, -12], [1000, 600, 8, 8]]) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.lineTo(x + dx + 4, y + dy - 3); g.stroke();
    go['scratch ' + x + ',' + y] = [x - 12, y - 18, x + 22, y + 18];
  }
  g.fillRect(500, 1400, 4, 4); go['clump 500,1400'] = [494, 1394, 510, 1410];
  g.fillRect(1020, 1050, 3, 3); g.fillRect(1023, 1053, 3, 3); go['clump 1020,1050'] = [1014, 1044, 1032, 1062];
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
  return { b64, keep, go };
}`;
  test('specks of grain on the paper are left out of what’s printed and saved; the drawing’s small details stay', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    const pg = await page.evaluate(async (src) => {
      eval(src);
      return makePage();
    }, GEN);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(pg.b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
    await idle(page);
    // (Min section size up a little, to 48 px: the paper inside the ring and the letters isn't a section, so it's their
    // own shape that keeps them, not a section they touch)
    await page.$eval('#sfMin', (el) => {
      el.value = 60;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await idle(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 40000,
    });
    await idle(page);
    const r = await page.evaluate(
      ({ keep, go }) => {
        const t = __mstest,
          W = t.W,
          k = W / 1200,
          L = t.labels,
          m = t.outDebris(),
          // Save image as saved (without its codes): the picture at its top left, xs to a picture pixel
          ex = t.buildExportCanvas(false, true),
          xs = ex.width / W,
          px = ex.getContext('2d').getImageData(0, 0, ex.width, ex.height).data;
        // for each box: its ink, how much of that is left out, how much is dark on the saved image, and whether the
        // paper round it is coloured
        const look = (b) => {
          let ink = 0,
            out = 0,
            dark = 0,
            col = 0;
          for (let y = Math.round(b[1] * k); y <= Math.round(b[3] * k); y++)
            for (let x = Math.round(b[0] * k); x <= Math.round(b[2] * k); x++) {
              const p = y * W + x;
              if (L[p] > 0 && t.assignData.assign[L[p]]) col++;
              if (L[p] !== -1) continue;
              ink++;
              if (m && m[p]) out++;
              const j = (Math.min(ex.height - 1, Math.round(y * xs)) * ex.width + Math.round(x * xs)) * 4;
              if (px[j] + px[j + 1] + px[j + 2] < 3 * 128) dark++;
            }
          return { ink, out, dark, col };
        };
        const res = { keep: {}, go: {} };
        for (const n in keep) res.keep[n] = look(keep[n]);
        for (const n in go) res.go[n] = look(go[n]);
        res.eyes = look([420, 490, 500, 510]);
        res.lines = look([590, 330, 610, 710]);
        res.sections = t.assignData.order.length;
        return res;
      },
      { keep: pg.keep, go: pg.go },
    );
    assert.ok(r.sections >= 4, 'the drawing’s sections: ' + r.sections);
    const wrong = [];
    for (const [n, v] of Object.entries(r.go))
      if (v.col || !v.ink || v.out !== v.ink || v.dark) wrong.push(n + ' (to go) ' + JSON.stringify(v));
    // (and inside the drawing: a line and the eyes)
    for (const [n, v] of Object.entries(Object.assign({ eyes: r.eyes, lines: r.lines }, r.keep)))
      if ((v.col && n in r.keep) || !v.ink || v.out || v.dark < v.ink * 0.9)
        wrong.push(n + ' (to stay) ' + JSON.stringify(v));
    assert.deepEqual(wrong, []);
    assert.deepEqual(errors, []);
  });
}

// ---- from v310-quick.test.mjs ----
// v310: the quick section check. A new picture's first Build asks only "Looks right?" (Build guide, and the tools
// behind Fix sections) when nothing is wrong with the sections; once Fix sections is tapped the full step stays.
// At the first start of v310, anyone with a guide in their Library keeps the full step.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const shown = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return !!e && e.getClientRects().length > 0;
    }, sel);
  async function pickPage(page, buf, name = 'letter-page.png', type = 'image/png') {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name, mimeType: type, buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
  }
  const letter = () => readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  test('a new user: "Looks right?" with Build guide and Edit sections (Fix sections before the v318 review); a tap changes nothing; Edit sections stays', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
    await welcome(page, 'look');
    await idle(page);
    await pickPage(page, await letter());
    assert.ok(await shown(page, '#sfQuick'));
    assert.match(await page.textContent('#sfQuick'), /^Looks right\?We found \d+ sections to colour/);
    assert.equal(await page.textContent('#sfQuickN'), await page.textContent('#sfCount'));
    for (const s of ['#sfEdit', '#sfMin', '#sfBg', '#sfAdjToggle'])
      assert.equal(await shown(page, s), false, s);
    // (v318 review: the full step's heading is Edit sections too, as the button now is: hidden here)
    assert.equal(await page.isVisible('#sfSecHead'), false, "the full step's heading is hidden");
    assert.ok(await shown(page, '#sfFix'));
    // (v318 review: one name for the section tools, as the Plan's ← Edit sections and Help call them)
    assert.equal((await page.textContent('#sfFix')).trim(), 'Edit sections');
    assert.ok(await shown(page, '#sfBuild'));
    // a tap on a section: nothing left out, a word on where the tools are
    const before = await page.evaluate(() => __mstest.secState.join());
    const at = await page.evaluate(() => {
      const t = __mstest,
        cv = document.getElementById('sfCanvas'),
        r = cv.getBoundingClientRect();
      for (let y = (t.H / 3) | 0; y < t.H; y += 7)
        for (let x = (t.W / 3) | 0; x < t.W; x += 7) {
          const l = t.labels[y * t.W + x];
          if (l > 0 && t.comps[l] && !t.comps[l].bg && t.comps[l].area > 400)
            return { x: r.left + ((x + 0.5) * r.width) / t.W, y: r.top + ((y + 0.5) * r.height) / t.H };
        }
      return null;
    });
    assert.ok(at, 'a section to tap');
    await page.mouse.click(at.x, at.y);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.secState.join()), before);
    assert.match(await page.textContent('#msToast'), /tap Edit sections/);
    // Fix sections: the tools, the keyboard on the first, kept from now on
    await page.click('#sfFix');
    assert.ok(await shown(page, '#sfEdit'));
    assert.equal(await shown(page, '#sfQuick'), false);
    assert.equal(await shown(page, '#sfFix'), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfEmToggle');
    assert.equal(
      (await page.textContent('#sfSecHead')).trim(),
      'Edit sections',
      'the step is called what its button was',
    );
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-sec-tools')), '1');
    await pickPage(page, await letter(), 'again.png');
    assert.ok(await shown(page, '#sfEdit'), 'the next picture: the full step');
    assert.equal(await shown(page, '#sfQuick'), false);
    assert.deepEqual(errors, []);
  });
  test('Build guide from the quick check; the Plan’s ← Edit sections opens the full tools', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
    await welcome(page, 'look');
    await idle(page);
    await pickPage(page, await letter());
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    assert.ok(await shown(page, '#sfEdit'));
    assert.equal(
      (await page.textContent('#sfSecHead')).trim(),
      'Edit sections',
      '← Edit sections lands on Edit sections',
    );
    assert.equal(await shown(page, '#sfQuick'), false);
    // (came to fix something: not remembered as Fix sections was)
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-sec-tools')), '0');
    assert.deepEqual(errors, []);
  });
  test('a warning about the sections: the full step, with the warning, for a new user too', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
    await welcome(page, 'look');
    await idle(page);
    // the letter page, 40 px on its short side: too small
    const b64 = await page.evaluate(
      async (b) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b;
        await img.decode();
        const k = 40 / Math.min(img.naturalWidth, img.naturalHeight),
          c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
      },
      (await letter()).toString('base64'),
    );
    await pickPage(page, Buffer.from(b64, 'base64'), 'tiny.png');
    assert.ok(await shown(page, '.sfc-segwarn'));
    assert.ok(await shown(page, '#sfEdit'));
    assert.equal(await shown(page, '#sfQuick'), false);
    assert.deepEqual(errors, []);
  });
  test('a photo straightened: the line with Undo and Adjust corners stays on the quick check', async () => {
    // (the photo maker of e2e/straighten: a page photographed at an angle on a table; v320: in photo-gens.mjs)
    const GEN = GEN_STRAIGHTEN;
    const { page, errors } = await openApp({ storage: { 'ms-sec-tools': '0' } });
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    const ph = await page.evaluate(
      async ([g, o]) => {
        eval(g);
        return makePhoto(o);
      },
      [GEN, { tilt: 25, roll: 8, size: 0.6 }],
    );
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({ name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
    await idle(page);
    assert.ok(await page.evaluate(() => !!__mstest.pgQ), 'straightened');
    assert.ok(await shown(page, '#sfQuick'));
    assert.ok(await shown(page, '.sfpgline'));
    assert.ok(await shown(page, '#sfPgAdj'));
    assert.deepEqual(errors, []);
  });
  test('the first start of v310: a Library with a guide keeps the full step; an empty one gets the quick check', async () => {
    const st = (saved) =>
      JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: [], saved });
    const g = { id: 5, type: 'guide', name: 'Owl', keys: ['Ohuhu|R014'], ts: Date.now() };
    for (const [saved, want] of [
      [[g], '1'],
      [[], '0'],
    ]) {
      const { page, errors, ctx } = await openApp({
        width: 820,
        height: 1180,
        storage: { 'ms-sec-tools': null, 'ms-onboarded': '1', 'ms-setup-tip': '1', [KEY]: st(saved) },
      });
      await idle(page);
      assert.equal(await page.evaluate(() => localStorage.getItem('ms-sec-tools')), want);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v310-rv.test.mjs ----
// v310 review: fixes found in the review of the quick section check and the Mood pictures (32-mood-pics)
{
  const MOODS = ['neutral', 'vivid', 'muted', 'pastel', 'deep', 'earthy'];
  async function pickLetter(page) {
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
  }
  const shown = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return !!e && e.getClientRects().length > 0;
    }, sel);
  test('the first Build’s bloom: no Mood picture is made while it shows (its frames kept clear), all of them after', async () => {
    const { page, errors } = await openApp({
      width: 1180,
      height: 820,
      storage: { 'ms-test-moodpics': '1' },
      init: () => {
        window.__MS_BLOOM = true;
      },
    });
    await welcome(page, 'look');
    await idle(page);
    await pickLetter(page);
    // (every 20 ms while the bloom shows: whether a picture was made meanwhile)
    await page.evaluate(() => {
      window.__mpDuring = [];
      let last = null;
      setInterval(() => {
        const t = window.__mstest;
        if (t && t.bloomOn) {
          const s = t.mp.key + '#' + Object.keys(t.mp.pics).join(',');
          if (last !== null && s !== last) __mpDuring.push(Object.keys(t.mp.pics).join(','));
          last = s;
        } else last = null;
      }, 20);
    });
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.bloomOn, null, { timeout: 60000 });
    // (a new guide opens on the Colours tab, Mood's pictures first in it)
    assert.ok(await page.isVisible('#sfMood.sfmoodpics'));
    // (over by itself; or, where frames come slowly (WebKit here), after 2 s, by a key, as a person's tap ends it)
    await page
      .waitForFunction(() => !__mstest.bloomOn, null, { timeout: 2000 })
      .catch(() => page.keyboard.press('Shift'));
    await page.waitForFunction(() => !__mstest.bloomOn, null, { timeout: 5000 });
    assert.deepEqual(await page.evaluate(() => __mpDuring), [], 'made while the bloom showed');
    // and once it's over, every picture
    await page.evaluate(() => document.getElementById('sfMood').scrollIntoView({ block: 'center' }));
    await page.waitForFunction(
      (M) => {
        const t = __mstest;
        return t.mp.key === t.mpKey() && M.every((k) => k === t.emphasis || k in t.mp.pics);
      },
      MOODS,
      { timeout: 30000 },
    );
    assert.deepEqual(errors, []);
  });
  test('the quick check: once a warning has brought the full step, it stays for that picture when the warning goes', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
    await welcome(page, 'look');
    await idle(page);
    await pickLetter(page);
    assert.ok(await shown(page, '#sfQuick'));
    // a warning about the sections (as segQuality gives one): the full step, the tools in hand
    await page.evaluate(() => {
      __mstest.segWarn = { ok: false, msg: 'Lots of tiny sections', tip: 'Raise Min section size.' };
      __mstest.renderControls();
    });
    await idle(page);
    assert.ok(await shown(page, '.sfc-segwarn'));
    assert.ok(await shown(page, '#sfEdit'));
    // Min section size let go: the warning checked again, and gone
    await page.evaluate(() => {
      const s = document.getElementById('sfMin');
      s.value = String(+s.value + 1);
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await idle(page);
    assert.equal(await shown(page, '.sfc-segwarn'), false);
    assert.ok(await shown(page, '#sfEdit'));
    // Adjust photo opened (the step drawn again): still the full step, not "Looks right?" with the tools put away
    await page.click('#sfAdjToggle');
    await idle(page);
    assert.ok(await shown(page, '#sfEdit'), 'the tools still there');
    assert.equal(await shown(page, '#sfQuick'), false);
    assert.equal(await page.getAttribute('#sfAdjToggle', 'aria-expanded'), 'true');
    assert.deepEqual(errors, []);
  });
}

// ---- from v3101-d4.test.mjs ----
// v310.1 (reviewer 4: the first run and the app as a whole): a returning tester's backup restored on a new device keeps
// the full section step (a backup made before v310); the quick check is said to a screen reader; Ctrl+Z from a Mood picture keeps the keyboard there.
{
  test('the quick check is said to a screen reader once the sections are found', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
    await welcome(page, 'look');
    await idle(page);
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfQuick', { state: 'visible', timeout: 60000 });
    await idle(page);
    const n = await page.textContent('#sfQuickN');
    assert.match(n, /^\d+ sections$/);
    assert.equal(
      await page.textContent('#sfLive'),
      'Looks right? We found ' + n + ' to colour. Build guide, or Edit sections.',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v3102.test.mjs ----
// v310.2: Ben's decisions from the v310.1 pass. An open guide follows a marker marked dry or unticked in Markers as
// opening it again would (sections still to colour show the closest you own; coloured ones keep theirs; the guide
// keeps the marker; back when it's yours again; not an Undo step); a locked Palette colour that can't be used is
// unlocked on Generate, with a word; Undo on "Page straightened" leaves "Page kept as photographed · Straighten";
// Home's guide card counts the colours guides use, saying how many marked dry are left out.
{
  test('Undo on "Page straightened": "Page kept as photographed · Straighten", on the quick check and the full step', async () => {
    const GEN = GEN_STRAIGHTEN;
    for (const tools of ['0', '1']) {
      const { page, errors, ctx } = await openApp({ storage: { 'ms-sec-tools': tools } });
      await haveSet(page);
      await page.check('#wcSets input[data-i="3"]');
      await page.click('#wcAdd');
      const ph = await page.evaluate(
        async ([g, o]) => {
          eval(g);
          return makePhoto(o);
        },
        [GEN, { tilt: 25, roll: 8, size: 0.6 }],
      );
      const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
      await fc.setFiles({ name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
      await page.waitForSelector('#sfPgUndo', { timeout: 40000 });
      await idle(page);
      await page.click('#sfPgUndo');
      await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
      await idle(page);
      assert.match(
        await page.textContent('.sfpgline'),
        /Page kept as photographed · Straighten/,
        'tools ' + tools,
      );
      assert.equal(await page.isVisible('#sfPgAdj'), true);
      // (the photo as taken may bring a warning, and with it the full step)
      const warn = await page.evaluate(() => !!(__mstest.segWarn && !__mstest.segWarn.ok));
      assert.equal(!!(await page.$('#sfQuick')), tools === '0' && !warn);
      // Straighten opens the corners again
      await page.click('#sfPgAdj');
      await page.waitForSelector('#sfPgGo');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v313-pdf.test.mjs ----
// v313 (D10): a colouring page that came as a PDF opens with PDF.js (vendor/pdfjs). One page goes straight on, as a
// scan does (no straightening); several pages ask which, with a small picture of each; a blank page, or a file that
// isn't a PDF, says to screenshot the page instead. The PDFs are written here, a few lines of drawing each. Each test
// fails on v312, which only said to take a screenshot.
{
  // a PDF of Letter pages, each drawn by its content stream (PDF drawing operators)
  function mkPdf(pages) {
    const objs = [];
    const add = (s) => objs.push(s) && objs.length;
    const cat = add('<< /Type /Catalog /Pages 2 0 R >>');
    add('');
    const kids = [];
    for (const c of pages) {
      const st = add(`<< /Length ${Buffer.byteLength(c)} >>\nstream\n${c}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${st} 0 R >>`));
    }
    objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
    let out = '%PDF-1.4\n';
    const at = [];
    objs.forEach((o, i) => {
      at.push(Buffer.byteLength(out));
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const x = Buffer.byteLength(out);
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const a of at) out += String(a).padStart(10, '0') + ' 00000 n \n';
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  }
  // a grid of boxes (cols × rows), outlined 3pt thick
  const grid = (cols, rows) => {
    let s = '3 w\n';
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++)
        s += `${60 + i * (492 / cols)} ${90 + j * (612 / rows)} ${492 / cols - 8} ${612 / rows - 8} re S\n`;
    return s;
  };
  async function guideScreen(page) {
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mSections');
    await idle(page);
  }
  async function openPdf(page, buf, name = 'page.pdf') {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPdf')]);
    await fc.setFiles({ name, mimeType: 'application/pdf', buffer: buf });
  }
  const sections = (page) => page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  const errCard = (page) =>
    page
      .waitForFunction(() => /Take a screenshot/.test(document.getElementById('sfRoot').textContent), null, {
        timeout: 60000,
      })
      .then(() => page.evaluate(() => document.getElementById('sfRoot').textContent));
  test('a one-page PDF: Open the PDF draws it at the working size and goes on to its sections, as a scan does', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await guideScreen(page);
    assert.match(await page.textContent('#sfStart .sfstpdf'), /Colouring page in a PDF\? Open the PDF/);
    assert.equal(await page.getAttribute('#sfFile', 'accept'), 'image/*', 'the photo picker as it was');
    await openPdf(page, mkPdf([grid(4, 5)]));
    await sections(page);
    const r = await page.evaluate(() => ({
      src: __mstest.srcSize,
      q: __mstest.pgQ,
      n: __mstest.countedList().length,
    }));
    assert.deepEqual(r.src, [Math.round((2400 * 612) / 792), 2400], 'its long side 2400');
    assert.equal(r.q, null, 'not straightened');
    assert.ok(r.n >= 20 && r.n <= 24, r.n + ' sections (20 boxes)');
    assert.deepEqual(errors, []);
  });
  test('a PDF of several pages asks which, with a small picture of each; Cancel leaves things as they were', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await guideScreen(page);
    const pdf = mkPdf(['BT /F1 24 Tf 200 700 Td ET', grid(3, 3), grid(5, 6)]);
    await openPdf(page, pdf);
    await page.waitForSelector('#sfEdAsk .sfpdfpg');
    assert.match(
      await page.textContent('#sfEdAsk .dsub'),
      /This PDF has 3 pages\. Choose the colouring page\./,
    );
    assert.equal(await page.locator('#sfEdAsk .sfpdfpg').count(), 3);
    await page.waitForFunction(
      () => document.querySelectorAll('#sfEdAsk .sfpdfth canvas').length === 3,
      null,
      {
        timeout: 30000,
      },
    );
    await page.click('#sfEdAsk [data-a="cancel"]');
    await idle(page);
    assert.equal(await page.isVisible('#sfStart'), true, 'still the start card');
    // again, and the third page
    await openPdf(page, pdf);
    await page.waitForSelector('#sfEdAsk .sfpdfpg');
    await page.click('#sfEdAsk .sfpdfpg[data-a="3"]');
    await sections(page);
    const n = await page.evaluate(() => __mstest.countedList().length);
    assert.ok(n >= 30 && n <= 34, n + ' sections (30 boxes: page 3)');
    assert.deepEqual(errors, []);
  });
  test('a blank page, or a file that isn’t a PDF: it says to take a screenshot instead', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await guideScreen(page);
    await openPdf(page, mkPdf(['']));
    assert.match(
      await errCard(page),
      /That PDF page came out blank here\. Take a screenshot of the colouring page/,
    );
    await openPdf(page, Buffer.from('not a PDF at all'), 'broken.pdf');
    await page.waitForFunction(
      () => /Couldn’t open that PDF/.test(document.getElementById('sfRoot').textContent),
      null,
      {
        timeout: 60000,
      },
    );
    // (an error with Copy details is expected here, not a page error)
    assert.deepEqual(errors, []);
  });
  test('Home’s start card offers a PDF too', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await page.click('#mHome');
    await idle(page);
    const b = page.locator('#homeCont [data-start="pdf"]');
    assert.ok(await b.isVisible());
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), b.click()]);
    await fc.setFiles({ name: 'p.pdf', mimeType: 'application/pdf', buffer: mkPdf([grid(2, 2)]) });
    await sections(page);
    assert.equal(await page.evaluate(() => state.mode), 'sections');
    assert.deepEqual(errors, []);
  });
}

// ---- from v313-photo.test.mjs ----
// v313 (photos): D6, a page photographed under a lamp. The page finder no longer takes the bright half of a lit page for
// the page (the drawing runs across that outline, and the light changes gently there, not in a step), and a drawing's
// outline wins a tie with the paper's only when it fits the drawing. When the finder isn't sure, Keep as is comes first
// and Straighten shows what it's about to do before it does it. The two pictures are made up (a drawn mandala, lit
// unevenly), in e2e/fixtures. Each test fails on v312.
{
  const find = (page, name) =>
    page.evaluate(async (name) => {
      const img = new Image();
      img.src = '/e2e/fixtures/' + name;
      await img.decode();
      const r = __mstest.pgFind(img);
      return { tier: r.tier, why: r.why, kind: r.kind, q: r.q };
    }, name);
  async function fresh() {
    const a = await openApp();
    await haveSet(a.page);
    await a.page.check('#wcSets input[data-i="3"]');
    await a.page.click('#wcAdd');
    return a;
  }
  async function pick(page, name) {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({
      name,
      mimeType: 'image/png',
      buffer: await readFile(join(ROOT, 'e2e', 'fixtures', name)),
    });
  }
  const sections = (page) => page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
  test('a page lit unevenly by a lamp: its bright half isn’t taken for the page, so nothing is offered to straighten', async () => {
    const { page, errors } = await fresh();
    const f = await find(page, 'lit-mandala.png');
    assert.deepEqual([f.tier, f.why], ['none', 'lit'], JSON.stringify(f));
    let opened = false;
    await pick(page, 'lit-mandala.png');
    await Promise.race([
      page.waitForSelector('#sfPgGo', { timeout: 40000 }).then(() => (opened = true)),
      sections(page),
    ]);
    assert.equal(opened, false, 'no corner handles');
    await sections(page);
    assert.equal(await page.evaluate(() => __mstest.pgQ), null);
    assert.deepEqual(errors, []);
  });
  test('a page on a table under a lamp: the paper’s outline, not a diamond round the drawing; Straighten first (v318.32: the corners cover most of the photo); it shows what it’s about to do, then does it', async () => {
    const { page, errors } = await fresh();
    const f = await find(page, 'lit-mandala-table.png');
    assert.equal(f.tier, 'unsure');
    assert.equal(f.kind, 'paper');
    const want = [
      [73, 95],
      [624, 73],
      [648, 629],
      [95, 646],
    ];
    const err = Math.max(...f.q.map((p, i) => Math.hypot(p[0] - want[i][0], p[1] - want[i][1])));
    assert.ok(err < 20, 'the page’s corners, within ' + err.toFixed(1) + ' px');
    await pick(page, 'lit-mandala-table.png');
    await page.waitForSelector('#sfPgGo', { timeout: 40000 });
    // (v313: Keep as is first, the main button, Straighten beside it. v318.32: Straighten is the main button when the
    // corners are a convex quad inside the photo covering most of it, as here; Keep as is beside it. U1-3)
    const btns = await page.evaluate(() =>
      [...document.querySelectorAll('.sfpgbtns button')].map(
        (b) => b.id + ':' + b.className + ':' + b.textContent,
      ),
    );
    assert.deepEqual(btns, ['sfPgGo:btn-primary:Straighten', 'sfPgNo:btn-soft:Keep as is']);
    await page.click('#sfPgGo');
    await page.waitForFunction(
      () => {
        const n = document.querySelector('.sfpgnote');
        return !!n && /Straightening the page/.test(n.textContent) && !document.getElementById('sfPgGo');
      },
      null,
      { timeout: 20000 },
    );
    await sections(page);
    await idle(page);
    assert.match(await page.textContent('.sfpgline'), /Page straightened/);
    assert.ok(await page.evaluate(() => !!__mstest.pgQ));
    assert.deepEqual(errors, []);
  });
}
