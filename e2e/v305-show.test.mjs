// v305 (showing it off): Reveal ends with the piece on its paper, its title and markers, and Share sends that layout as
// a 1080 × 1350 card made while it played; the first Build of a new picture blooms; Save image's codes go automatic
// (and without them the picture is framed as the card is); the saved image's key goes by colour family and the PDF
// key's NO. looks like the page's numbers; Colour along's list can go lightest first, in rainbow order or by brand;
// ticks go from the art after a second with the codes on; no tick badges in the Owned view; Palette opens on a
// preview; the PDF's close-ups lighter.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  setup,
  teardown,
  openApp,
  welcome,
  sampleGuide,
  idle,
  until,
  sectionPoint,
  scrollTop,
  buildGo,
  pause,
  frames,
  ROOT,
} from './helpers.mjs';

before(setup);
after(teardown);

// Reveal takes about 4.6 s by the clock, much longer in WebKit on a slow machine (reveal.test.mjs)
const REV = 30000;
const finishAll = (page) =>
  page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.forEach((l) => {
      t.colored[l] = 1;
    });
    t.checkComplete();
    t.updateProgress();
    t.renderGuide();
  });
async function reveal(page) {
  await page.click('#sfReveal');
  await page.waitForSelector('.sfshow', { timeout: REV });
}
const showCount = (page) => page.evaluate(() => document.querySelectorAll('.sfshow').length);
// a PNG's size from its header
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];

test('Reveal ends with the piece on its paper; Replay, Escape and the ✕ take it away', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await finishAll(page);
  await idle(page);
  await page.click('#sfDoneBtn');
  await idle(page);
  await page.click('.sftabbtn[data-t="share"]');
  await idle(page);
  await reveal(page);
  assert.match(
    await page.getAttribute('.sfshow', 'aria-label'),
    /^Sample jellyfish\. \d+ sections · 16 Ohuhu markers · finished \d{1,2} \w{3,4} \d{4}$/,
  );
  await page.waitForSelector('.sfshow .sfsh-cap[data-drawn]');
  await page.waitForSelector('#revReplay', { timeout: REV });
  // the art sits inside the screen above the bar, the caption under it
  const r = await page.evaluate(() => {
    const q = (s) => document.querySelector(s).getBoundingClientRect();
    return { p: q('.sfsh-paper'), c: q('.sfsh-cap'), bar: q('#sfRevealBar') };
  });
  assert.ok(
    r.p.top >= 0 && r.p.bottom <= r.c.top && r.c.bottom <= r.bar.top + 1,
    'paper, then caption, above the bar',
  );
  await page.click('#revReplay');
  assert.equal(await showCount(page), 0, 'Replay takes it away');
  await page.waitForSelector('.sfshow', { timeout: REV });
  await page.waitForSelector('#revReplay', { timeout: REV });
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await showCount(page), 0, 'Escape takes it away');
  await reveal(page);
  await page.click('#sfRevX');
  await idle(page);
  assert.equal(await showCount(page), 0, 'the ✕ takes it away');
  assert.deepEqual(errors, []);
});

test('Share sends the card made while Reveal played (1080 × 1350), at once', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('.sftabbtn[data-t="share"]');
  await idle(page);
  await reveal(page);
  await until(page, () => !!__mstest.showBlob, null, 'the card made while it plays', REV);
  const wh = await page.evaluate(async () => {
    const b = await createImageBitmap(__mstest.showBlob);
    return [b.width, b.height];
  });
  assert.deepEqual(wh, [1080, 1350]);
  await page.waitForSelector('#revShare', { timeout: REV });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#revShare')]);
  assert.equal(dl.suggestedFilename(), 'marker-studio-card.png');
  assert.deepEqual(pngSize(await readFile(await dl.path())), [1080, 1350]);
  // not finished: nothing about finishing
  assert.doesNotMatch(await page.getAttribute('.sfshow', 'aria-label'), /finished/);
  assert.deepEqual(errors, []);
});

// every text the card draws, with its font and where it reaches
const cardTexts = (page) =>
  page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      of = P.fillText,
      log = [];
    P.fillText = function (t, x, y) {
      const w = this.measureText(t).width,
        al = this.textAlign;
      log.push({
        t: String(t),
        font: this.font,
        l: al === 'center' ? x - w / 2 : al === 'right' ? x - w : x,
        r: al === 'center' ? x + w / 2 : al === 'right' ? x : x + w,
      });
      return of.apply(this, arguments);
    };
    let c;
    try {
      c = __mstest.buildShowCard();
    } finally {
      P.fillText = of;
    }
    return {
      log,
      w: c.width,
      h: c.height,
      codes: [...new Set(Object.values(__mstest.assignData.assign).map((m) => m.code))],
    };
  });
test('the card: 1080 × 1350, a long title kept inside it on two lines at most, codes only up to 16 markers', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  let c = await cardTexts(page);
  assert.deepEqual([c.w, c.h], [1080, 1350]);
  const shown = c.log.filter((e) => c.codes.includes(e.t));
  assert.equal(shown.length, c.codes.length, '16 markers: each code under the ribbon');
  await page.evaluate(() => {
    __mstest.curName =
      'The great big spiral mandala with the jellyfish and the octopus and all their friends under the sea';
  });
  c = await cardTexts(page);
  const title = c.log.filter((e) => /Fraunces/.test(e.font) && !/Made with/.test(e.t));
  assert.ok(title.length >= 1 && title.length <= 2, 'one or two lines: ' + title.length);
  for (const e of title)
    assert.ok(e.l >= 0 && e.r <= 1080, `"${e.t}" inside the card (${Math.round(e.l)}…${Math.round(e.r)})`);
  if (title.length === 2) assert.match(title[1].t, /…$/);
  // past 16 markers: the ribbon alone
  await page.evaluate(() => {
    const t = __mstest,
      a = t.assignData.assign,
      ids = Object.keys(a),
      base = a[ids[0]];
    const cs = COLORS.filter((c) => c.brand === 'Ohuhu');
    ids.forEach((l, i) => {
      if (i < 40) {
        const c = cs[(i * 5) % cs.length];
        a[l] = Object.assign({}, base, {
          mkey: c.brand + '|' + c.code,
          hex: c.hex,
          code: c.code,
          name: c.name,
          brand: c.brand,
          lab: null,
        });
      }
    });
  });
  c = await cardTexts(page);
  assert.ok(c.codes.length > 16);
  assert.equal(c.log.filter((e) => c.codes.includes(e.t)).length, 0, 'no codes row past 16 markers');
  assert.equal(await page.evaluate(() => __mstest.showModel().bands.length), 24, 'the ribbon in 24 bands');
  // a wide screen: the codes as chips in two rows (16 markers again)
  await page.evaluate(() => __mstest.reassign());
  const rows = await page.evaluate(() => {
    const g = document.createElement('canvas').getContext('2d'),
      M = __mstest.showModel();
    return M.codes ? __mstest.showLayout(g, M, 1180, 744, { top: 64 }).codes.rows : -1;
  });
  assert.equal(rows, 2);
  assert.deepEqual(errors, []);
});

test('with reduced motion Reveal ends on the finished view, nothing moving', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await sampleGuide(page);
  await idle(page);
  await page.click('.sftabbtn[data-t="share"]');
  await idle(page);
  await reveal(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector('.sfshow');
    return { still: el.classList.contains('still'), n: el.getAnimations({ subtree: true }).length };
  });
  assert.deepEqual(r, { still: true, n: 0 });
  await page.waitForSelector('.sfshow .sfsh-cap[data-drawn]');
  assert.deepEqual(errors, []);
});

// ---- W2: the first Build's bloom ----
async function pickLetter(page) {
  const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
}
const bloomOn = () => {
  window.__MS_BLOOM = true;
};
const count = (page) => page.evaluate(() => __mstest.bloomCount);

test('the first Build of a new picture blooms, once; a tap during it ends it and still picks the section', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, init: bloomOn });
  await welcome(page, 'look');
  await idle(page);
  await pickLetter(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.bloomOn, null, { timeout: 60000 });
  assert.equal(await count(page), 1);
  // the picture's own pixels are the guide's all along, with its codes, under the bloom
  assert.ok(await page.evaluate(() => !!document.querySelector('.sfpic .sfbloom')));
  const l = await page.evaluate(
    () =>
      __mstest.assignData.order.slice().sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)[1],
  );
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y);
  await page.waitForSelector('.sftip');
  assert.equal(await page.evaluate(() => __mstest.bloomOn), false, 'the tap ended it');
  await idle(page);
  // (its quick fade-out can still be running when idle returns on a slow runner: wait for it, v307)
  await page.waitForFunction(() => !document.querySelector('.sfbloom'), null, { timeout: 5000 }).catch(() => {});
  assert.equal(await page.evaluate(() => document.querySelectorAll('.sfbloom').length), 0, 'and it has gone');
  // Build again (after an edit to the sections) and a guide opened again: none
  await page.keyboard.press('Escape');
  await idle(page);
  await page.click('#sfBack2');
  await idle(page);
  await page.evaluate(() => {
    const t = __mstest,
      o = t.assignData.order;
    t.mergeCellsSnap(o[0], o[1]);
    t.render();
  });
  await buildGo(page);
  await idle(page);
  await page.waitForFunction(() => __mstest.sfmode === 'guide');
  assert.equal(await count(page), 1, 'not on Build again');
  await page.evaluate(() => {
    const t = __mstest;
    t.openDesignObj(Object.assign({}, t.currentDesignObj().payload, { name: 'Again' }), null);
  });
  await page.waitForFunction(() => __mstest.curName === 'Again');
  await idle(page);
  assert.equal(await count(page), 1, 'not on opening a guide');
  assert.deepEqual(errors, []);
});

test('no bloom with reduced motion, nor in the tests unless asked for, nor for the sample', async () => {
  let { page, errors } = await openApp({ init: bloomOn });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await welcome(page, 'look');
  await idle(page);
  await pickLetter(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 60000,
  });
  await idle(page);
  assert.equal(await count(page), 0, 'reduced motion');
  assert.deepEqual(errors, []);
  ({ page, errors } = await openApp());
  await welcome(page, 'look');
  await idle(page);
  await pickLetter(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 60000,
  });
  await idle(page);
  assert.equal(await count(page), 0, 'the tests');
  ({ page, errors } = await openApp({ init: bloomOn }));
  await sampleGuide(page);
  await idle(page);
  assert.equal(await count(page), 0, 'the sample');
  assert.deepEqual(errors, []);
});

test('a device too slow for the bloom: it ends at once, the guide shows as usual, and it stays off there', async () => {
  // (setting up "took too long": any time at all counts as too long here)
  let { page, errors } = await openApp({
    init: () => {
      window.__MS_BLOOM = true;
      window.__MS_BLOOM_PREP_MAX = 1e-9;
    },
  });
  await welcome(page, 'look');
  await idle(page);
  await pickLetter(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 60000,
  });
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.bloomOn), false);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.sfbloom').length), 0, 'no overlay left');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-bloom-slow')), '1', 'remembered');
  assert.deepEqual(errors, []);
  // slow first frames do the same
  ({ page, errors } = await openApp({
    init: () => {
      window.__MS_BLOOM = true;
      window.__MS_BLOOM_FRAME_MAX = 1e-9;
    },
  }));
  await welcome(page, 'look');
  await idle(page);
  await pickLetter(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 60000,
  });
  await page.waitForFunction(() => !__mstest.bloomOn && __mstest.bloomCount === 1, null, { timeout: 10000 });
  assert.ok(
    (await page.evaluate(() => __mstest.bloomLast.frames.length)) <= 6,
    'ended after its first frames',
  );
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-bloom-slow')), '1');
  assert.deepEqual(errors, []);
  // and once remembered, a new picture doesn't bloom
  ({ page, errors } = await openApp({
    init: () => {
      window.__MS_BLOOM = true;
      localStorage.setItem('ms-bloom-slow', '1');
    },
  }));
  await welcome(page, 'look');
  await idle(page);
  await pickLetter(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 60000,
  });
  await idle(page);
  assert.equal(await count(page), 0, 'remembered as too slow');
  assert.deepEqual(errors, []);
});

// ---- W4: Save image's codes ----
test('Save image: codes on until the page is finished, then the picture framed as the card is; a choice of yours stays', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('.sftabbtn[data-t="share"]');
  await idle(page);
  assert.equal(await page.isChecked('#sfExCodes'), true, 'codes while there is colouring to do');
  // the box follows the ticks while it's on screen
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.forEach((l) => {
      t.colored[l] = 1;
    });
    t.updateProgress();
  });
  assert.equal(await page.isChecked('#sfExCodes'), false, 'every section ticked: off');
  await page.evaluate(() => {
    const t = __mstest;
    t.colored[t.assignData.order[0]] = 0;
    t.updateProgress();
  });
  assert.equal(await page.isChecked('#sfExCodes'), true);
  // finished by colouring along
  await page.click('#sfColor');
  await idle(page);
  await finishAll(page);
  await idle(page);
  await page.click('#sfDoneBtn');
  await idle(page);
  await page.click('.sftabbtn[data-t="share"]');
  await idle(page);
  assert.equal(await page.isChecked('#sfExCodes'), false, 'finished: off');
  assert.equal(await page.evaluate(() => __mstest.exCodes), null, 'still automatic');
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.click('#sfExport'),
  ]);
  assert.equal(dl.suggestedFilename(), 'marker-studio-picture.png');
  assert.deepEqual(
    pngSize(await readFile(await dl.path())),
    [2160, 2700],
    'framed as the card, at twice its size',
  );
  // your tick stays through finishing
  await page.check('#sfExCodes');
  assert.equal(await page.evaluate(() => __mstest.exCodes), true);
  await page.evaluate(() => {
    const t = __mstest;
    t.colored[t.assignData.order[0]] = 0;
    t.updateProgress();
    t.colored[t.assignData.order[0]] = 1;
    t.updateProgress();
  });
  assert.equal(await page.isChecked('#sfExCodes'), true, 'your choice stands');
  const [dl2] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.click('#sfExport'),
  ]);
  assert.equal(dl2.suggestedFilename(), 'colour-guide.png', 'the guide with its codes and key');
  assert.deepEqual(errors, []);
});

// ---- U8 ----
test('the saved image’s key goes by colour family, lightest first in each, as the PDF’s', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  const r = await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      of = P.fillText,
      log = [],
      t = __mstest;
    P.fillText = function (s, x, y) {
      log.push({ s: String(s), y });
      return of.apply(this, arguments);
    };
    try {
      t.buildExportCanvas(false, true);
    } finally {
      P.fillText = of;
    }
    const seen = {},
      mk = [];
    t.assignData.order.forEach((l) => {
      const m = t.assignData.assign[l];
      if (!seen[m.mkey]) {
        seen[m.mkey] = 1;
        mk.push(m);
      }
    });
    const want = mk
      .slice()
      .sort(t.famCmp)
      .map((m) => m.code);
    // (each key line: its code, then its name)
    const got = log
      .filter((e) => e.y > t.H)
      .map((e) => e.s.split(/\s+/).find((w) => want.includes(w)))
      .filter(Boolean);
    return { want, got };
  });
  assert.deepEqual(r.got, r.want);
  assert.deepEqual(errors, []);
});

test('the PDF key: NO. drawn as the page’s numbers are, ORDER a grey “5th”', async () => {
  const { page, errors } = await openApp({ storage: { 'ms-pdf-labels': 'numbers' } });
  await sampleGuide(page);
  await idle(page);
  const r = await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      of = P.fillText,
      os = P.strokeText,
      log = [];
    P.fillText = function (t, x, y) {
      log.push({
        cv: this.canvas,
        k: 'f',
        t: String(t),
        fill: this.fillStyle,
        font: this.font,
        al: this.textAlign,
      });
      return of.apply(this, arguments);
    };
    P.strokeText = function (t, x, y) {
      log.push({ cv: this.canvas, k: 's', t: String(t), stroke: this.strokeStyle, al: this.textAlign });
      return os.apply(this, arguments);
    };
    let cvs;
    try {
      cvs = __mstest.buildPDFPages();
    } finally {
      P.fillText = of;
      P.strokeText = os;
    }
    const pg = (c) => cvs.indexOf(c),
      keyP = pg(log.find((e) => e.t === 'Colour key').cv);
    const onArt = log.filter((e) => pg(e.cv) === 0 && e.k === 'f' && /^\d+$/.test(e.t) && e.al === 'center');
    const keyNo = log.filter(
      (e) => pg(e.cv) >= keyP && e.k === 'f' && /^\d+$/.test(e.t) && e.al === 'right' && e.fill !== '#777777',
    );
    const keyNoS = log.filter(
      (e) => pg(e.cv) >= keyP && e.k === 's' && /^\d+$/.test(e.t) && e.al === 'right',
    );
    const ord = log.filter((e) => pg(e.cv) >= keyP && /^\d+(st|nd|rd|th)$/.test(e.t));
    const w = (f) => f.split(' ')[0];
    return {
      art: onArt.length ? { fill: onArt[0].fill, w: w(onArt[0].font) } : null,
      key: keyNo.map((e) => ({ fill: e.fill, w: w(e.font) })),
      stroked: keyNoS.length,
      strokes: [...new Set(keyNoS.map((e) => e.stroke))],
      ord: [...new Set(ord.map((e) => e.fill))],
      n: ord.length,
    };
  });
  assert.ok(r.art, 'numbers on the colouring page');
  assert.ok(r.key.length >= 10, 'a NO. for each row');
  for (const k of r.key) assert.deepEqual(k, r.art, 'NO. looks as the page’s numbers do');
  assert.equal(r.stroked, r.key.length, 'with their white edge');
  assert.deepEqual(r.strokes, ['#ffffff']);
  assert.deepEqual(r.ord, ['#8a8a8a'], 'ORDER grey');
  assert.equal(r.n, r.key.length);
  assert.deepEqual(errors, []);
});

test('Colour along’s list: Lightest first, Rainbow or By brand (kept); Focus mode and Home’s Continue keep lightest first', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  const rows = () => page.$$eval('#sfAlist .sfarow', (r) => r.map((x) => x.dataset.k));
  const light = await rows();
  assert.deepEqual(light, await page.evaluate(() => __mstest.alongList().map((e) => e.key)));
  assert.equal(await page.getAttribute('#sfAlSort [data-v="light"]', 'aria-pressed'), 'true');
  const ord0 = await page.evaluate(() => {
    __mstest.buildFocusOrder();
    return __mstest.focusOrd.slice();
  });
  await page.click('#sfAlSort [data-v="rainbow"]');
  await idle(page);
  const rb = await rows();
  assert.deepEqual(rb, await page.evaluate(() => __mstest.alongList('rainbow').map((e) => e.key)));
  assert.notDeepEqual(rb, light);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-along-sort')), 'rainbow');
  assert.deepEqual(
    await page.evaluate(() => {
      __mstest.buildFocusOrder();
      return __mstest.focusOrd.slice();
    }),
    ord0,
    'focus mode as before',
  );
  await page.evaluate(() => __mstest.alongResume());
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.hlKey), light[0], 'Continue: the lightest');
  await page.click('#sfAlSort [data-v="brand"]');
  await idle(page);
  assert.deepEqual(await rows(), await page.evaluate(() => __mstest.alongList('brand').map((e) => e.key)));
  // kept: Colour along again
  await page.click('#sfDoneBtn');
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  assert.equal(await page.getAttribute('#sfAlSort [data-v="brand"]', 'aria-pressed'), 'true');
  assert.deepEqual(errors, []);
});

// ---- W8 ----
// pixels near a section's label in the ✓'s green (#3f7d4e)
const green = (page, l) =>
  page.evaluate((l) => {
    const t = __mstest,
      c = document.getElementById('sfCanvas'),
      q = t.labelPos(l),
      r = 24,
      d = c.getContext('2d').getImageData(Math.max(0, q.x - r), Math.max(0, q.y - r), 2 * r, 2 * r).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4)
      if (Math.abs(d[i] - 63) < 14 && Math.abs(d[i + 1] - 125) < 14 && Math.abs(d[i + 2] - 78) < 14) n++;
    return n;
  }, l);
test('Colour along: with the codes on a ✓ shows for about a second, then goes; with them off it stays', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  const big = await page.evaluate(() =>
    __mstest.assignData.order
      .slice()
      .sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)
      .slice(0, 3),
  );
  await scrollTop(page);
  let p = await sectionPoint(page, big[0]);
  // (v307.1: the ✓'s colour as it's drawn, however strongly, not read off the canvas: v307's ✓ fades out, and a slow
  // machine could read it part way through the fade, no longer the green looked for)
  await page.evaluate((l) => {
    const P = CanvasRenderingContext2D.prototype,
      of = P.fillText,
      q = __mstest.labelPos(l);
    window.__tk = [];
    window.__tkOff = () => { P.fillText = of; };
    P.fillText = function (t, x, y) {
      if (t === '✓' && Math.abs(x - q.x) < 0.5 && Math.abs(y - q.y) < 0.5) window.__tk.push([this.fillStyle, this.globalAlpha]);
      return of.apply(this, arguments);
    };
  }, big[0]);
  await page.mouse.click(p.x, p.y);
  await until(page, (l) => __mstest.colored[l] === 1, big[0], 'ticked');
  assert.equal(await page.evaluate((l) => __mstest.tkFresh(l), big[0]), true, 'its ✓ showing');
  const tk = await page.evaluate(() => { window.__tkOff(); return window.__tk; });
  assert.ok(tk.length && tk.every((x) => x[0] === '#3f7d4e'), 'drawn in green: ' + JSON.stringify(tk));
  await until(page, (l) => !__mstest.tkFresh(l), big[0], 'the ✓ gone after about a second', 4000);
  await frames(page);
  assert.equal(await green(page, big[0]), 0, 'no ✓ left on the art');
  // the codes off: every ✓ stays (the only mark of a done section there)
  await page.click('#sfCodes');
  await idle(page);
  await scrollTop(page);
  p = await sectionPoint(page, big[1]);
  await page.mouse.click(p.x, p.y);
  await until(page, (l) => __mstest.colored[l] === 1, big[1], 'ticked');
  await pause(page, 1300, 'longer than a ✓ shows with the codes on');
  const ticks = await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      of = P.fillText;
    let n = 0;
    P.fillText = function (t) {
      if (t === '✓') n++;
      return of.apply(this, arguments);
    };
    try {
      __mstest.forceFullRender();
      __mstest.renderGuide();
    } finally {
      P.fillText = of;
    }
    return n;
  });
  assert.equal(ticks, 2, 'both ✓ drawn');
  assert.deepEqual(errors, []);
});

test('Markers › Owned has no tick badges (every marker there is yours); All keeps them', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await idle(page);
  await page.click('#ownView [data-v="owned"]');
  await idle(page);
  assert.ok((await page.locator('#results .cell.own').count()) > 50);
  assert.equal(await page.locator('#results .owncheck').count(), 0);
  await page.click('#ownView [data-v="all"]');
  await idle(page);
  assert.ok((await page.locator('#results .cell.own .owncheck').count()) > 50);
  assert.deepEqual(errors, []);
});

test('Palette’s first visit: a preview, not one of your palettes until you use it; not for From photo', async () => {
  let { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mPalette');
  await idle(page);
  assert.ok((await page.locator('#bands .band').count()) >= 2, 'a palette to look at');
  assert.equal(await page.isVisible('#phint'), false);
  assert.equal(await page.evaluate(() => state.palettes.length), 0, 'not in your palettes');
  assert.equal(await page.isDisabled('#undo'), true, 'nothing to remove');
  assert.equal(await page.isDisabled('#saveBtn'), false, 'it can be saved as it is');
  // locking a colour makes it yours
  await page.click('#bands .band .blk');
  await idle(page);
  assert.equal(await page.evaluate(() => state.palettes.length), 1);
  await page.click('#draw');
  await idle(page, 1300);
  assert.equal(await page.evaluate(() => state.palettes.length), 2);
  assert.deepEqual(errors, []);
  // no markers yet: still a preview, and the note says every marker is used
  ({ page, errors } = await openApp());
  await page.click('#wcSkip');
  await page.click('#wcLook').catch(() => {});
  await idle(page);
  await page.click('#mPalette');
  await idle(page);
  assert.ok(await page.isVisible('#emptyOwned'));
  assert.ok((await page.locator('#bands .band').count()) >= 2);
  // From photo: the card waits for a photo
  await page.evaluate(() => setHarmony('photo'));
  await idle(page);
  assert.ok(await page.isVisible('#phint'));
  assert.equal(await page.evaluate(() => state.palettes.length), 0);
  assert.deepEqual(errors, []);
});

test('the PDF’s close-ups: lines in mid grey, their codes near-black', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  const r = await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      of = P.fillText,
      log = [];
    P.fillText = function (t) {
      log.push({ cv: this.canvas, t: String(t), fill: this.fillStyle, al: this.textAlign });
      return of.apply(this, arguments);
    };
    let cvs;
    try {
      cvs = __mstest.buildPDFPages();
    } finally {
      P.fillText = of;
    }
    const cp = cvs.findIndex((c) => log.some((e) => e.cv === c && e.t === 'Close-ups'));
    if (cp < 0) return null;
    const codes = new Set(Object.values(__mstest.assignData.assign).map((m) => m.code));
    const fills = [...new Set(log.filter((e) => e.cv === cvs[cp] && codes.has(e.t)).map((e) => e.fill))];
    // the first close-up's inside: its pixels by how dark
    const c = cvs[cp],
      d = c
        .getContext('2d')
        .getImageData(
          Math.round(c.width * 0.08),
          Math.round(c.height * 0.14),
          Math.round(c.width * 0.3),
          Math.round(c.height * 0.15),
        ).data;
    let dark = 0,
      mid = 0;
    for (let i = 0; i < d.length; i += 4) {
      const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (L < 80) dark++;
      else if (L > 110 && L < 185) mid++;
    }
    return { fills, dark, mid };
  });
  assert.ok(r, 'the sample has close-ups');
  assert.deepEqual(r.fills, ['#1a1a1a'], 'close-up codes near-black');
  assert.ok(r.mid > 1000 && r.mid > r.dark * 4, `lines in mid grey (${r.mid} mid, ${r.dark} dark)`);
  assert.deepEqual(errors, []);
});
