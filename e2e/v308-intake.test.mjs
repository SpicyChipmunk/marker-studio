// v308 (getting a picture in), in the browser: a tilted photo of grey paper keeps its sections; Straighten starts from
// the photo's own rectangle when the finder only saw the drawing; a page under a warm lamp is found; a straightened
// photo is found at Sensitivity 7; Auto crop says "Nothing to trim" with no Undo step; Merge refuses the background;
// Ignore faint grey marks; the warning for a coloured-in page; a failed file said once, and a PDF told what to do;
// the bloom's "too slow" lasts one launch; and a guide saved by v307.1 opens unchanged. Pages and photos are drawn
// here in code. (The measures themselves: test/v308-intake)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, idle, sectionPoint, ROOT } from './helpers.mjs';

before(setup);
after(teardown);

async function fresh(opts = {}) {
  const a = await openApp({ width: 820, height: 1180, ...opts });
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
      // scribbled colour over most of it, in short strokes that break into specks
      p.globalCompositeOperation = 'multiply';
      for (let i = 0; i < 20000; i++) { p.strokeStyle = 'hsl(' + ((i * 37) % 360) + ',80%,60%)'; p.lineWidth = 2 + rnd() * 3; const x = rnd() * PW, y = rnd() * PH; p.beginPath(); p.moveTo(x, y); p.lineTo(x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 16); p.stroke(); }
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

test('a page photographed under a warm lamp is found and straightened, at Sensitivity 7; a scan stays at 5', async () => {
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
  assert.equal(await page.textContent('#sfSensVal'), '7', 'a straightened photo: Sensitivity 7');
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

test('a page coloured in already gets a warning', async () => {
  const { page, errors } = await fresh();
  await pick(page, await pic(page, { kind: 'coloured' }), 'page.png', 'image/png');
  await sections(page);
  assert.equal(await warn(page), 'coloured');
  assert.match(await page.textContent('.sfc-segwarn'), /coloured in already/);
  assert.deepEqual(errors, []);
});

test('a file that won’t open is said once; a PDF is told to screenshot the page; the start card says so too', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await page.click('#wcLook');
  await idle(page);
  await page.click('#mSections');
  await page.waitForSelector('#sfStart', { state: 'visible' });
  assert.match(await page.textContent('#sfStart'), /Colouring page in a PDF\? Take a screenshot of it/);
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
  await fc2.setFiles({ name: 'colouring.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await page.waitForFunction(() =>
    /That’s a PDF/.test(document.querySelector('.mserr') && document.querySelector('.mserr').textContent),
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
