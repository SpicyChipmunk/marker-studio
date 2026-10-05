// v307 (along): Colour along through Reveal. A finished page stays in full colour after Focus mode, the code box
// survives another tab saving, shaded guides count their shading markers, a code in both brands outlines both
// markers, brand-aware names, the PDF key's order column, the find line naming zones, and the polish (the brand as
// a badge on screen and its name for screen readers, one "Page finished" announcement, "Saving…" only while
// writing, ticks fading out, the print tag, contrast).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup,
  teardown,
  openApp,
  sampleGuide,
  idle,
  saveGuide,
  until,
  sectionPoint,
  pause,
} from './helpers.mjs';

before(setup);
after(teardown);

// the sample at one marker per section from Ben's 451: Ohuhu and Copic Y26, R46 and RV09 are all in it
async function benGuide(page) {
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
}
const along = async (page) => {
  await page.click('#sfColor');
  await idle(page);
};
const live = (page) => page.textContent('#sfLive');
const rowKeys = (page) => page.$$eval('#sfAlist .sfarow', (rs) => rs.map((r) => r.dataset.k));
const openKey = (page) =>
  page.evaluate(() => document.querySelector('#sfAlist .sfarow.open')?.dataset.k || null);
// how many of the guide's sections show in their own marker's colour at their label point (the picture as drawn)
const inColour = (page) =>
  page.evaluate(() => {
    const t = __mstest,
      cv = document.getElementById('sfCanvas'),
      g = cv.getContext('2d'),
      A = t.assignData.assign;
    let n = 0,
      ok = 0;
    for (const l of t.assignData.order) {
      const p = t.labelPos(l),
        d = g.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data,
        h = A[l].hex,
        c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      n++;
      if (Math.max(Math.abs(d[0] - c[0]), Math.abs(d[1] - c[1]), Math.abs(d[2] - c[2])) <= 40) ok++;
    }
    return ok / n;
  });

// ---- Bug 1: a finished page after Focus mode ----
test('a page finished in Focus mode shows in full colour after ✕, with no row open', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await along(page);
  // a row open, then Focus mode from it; everything else already coloured
  const k = await page.evaluate(() => {
    const t = __mstest,
      ord = t.assignData.order,
      k = t.assignData.assign[ord[0]].mkey;
    ord.forEach((l) => {
      if (t.assignData.assign[l].mkey !== k) t.colored[l] = 1;
    });
    t.updateProgress();
    return k;
  });
  await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
  await idle(page);
  assert.equal(await openKey(page), k);
  await page.click('#sfFocus');
  await idle(page);
  for (let i = 0; i < 400 && (await page.isVisible('#sfFDone')); i++) {
    await page.click('#sfFDone');
    await idle(page);
  }
  assert.match(await page.textContent('#sfFocName'), /Page finished/);
  await page.click('#sfExitFoc');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.focus), false);
  const f = await inColour(page);
  assert.ok(f > 0.95, 'the picture in its colours: ' + f);
  assert.equal(await openKey(page), null, 'no row reopened');
  assert.equal(await page.evaluate(() => __mstest.hlKey), null);
  // a row opened on the finished page doesn't fade the rest either
  await page.evaluate((k) => {
    const r = document.querySelector(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    if (r && !r.closest('.sfarow').classList.contains('open')) r.click();
  }, k);
  await idle(page);
  assert.ok((await inColour(page)) > 0.95, 'still in full colour with a row open');
  assert.deepEqual(errors, []);
});

// ---- Bug 4: another tab saving the guide keeps the code box ----
const AUTO = 2300; // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
test('another tab saving the same guide: the code box keeps its text, cursor and line, the row stays open and the box keeps the keyboard; a search run stays', async () => {
  const {
    ctx,
    page: a,
    errors,
  } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await benGuide(a);
  await saveGuide(a);
  await idle(a, AUTO);
  const id = await a.evaluate(() => __mstest.curId);
  const b = await ctx.newPage();
  b.on('pageerror', (e) => errors.push(e.message));
  await b.goto(a.url());
  await idle(b);
  await b.evaluate((id) => loadGuide({ id }), id);
  await b.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  await idle(b);
  await along(a);
  const k = (await rowKeys(a))[2];
  await a.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
  await idle(a);
  await a.click('#sfFindIn');
  await a.keyboard.type('Y2');
  await a.keyboard.press('ArrowLeft');
  await idle(a);
  const line = await a.textContent('#sfFindL');
  assert.match(line, /^Codes starting Y2: /);
  // the other tab ticks a section and saves
  const n0 = await a.evaluate(() => __mstest.colored.reduce((x, y) => x + y, 0));
  await b.evaluate(() => {
    const t = __mstest,
      l = t.assignData.order.find((l) => !t.colored[l]);
    t.colored[l] = 1;
    t.guideDirty = true;
    t.renderGuide();
  });
  await idle(b, AUTO);
  await until(
    a,
    (n) => __mstest.colored.reduce((x, y) => x + y, 0) === n + 1,
    n0,
    'the tick reaching this tab',
  );
  await idle(a);
  const st = await a.evaluate(() => {
    const i = document.getElementById('sfFindIn');
    return { v: i.value, foc: document.activeElement === i, s: i.selectionStart, e: i.selectionEnd };
  });
  assert.deepEqual(st, { v: 'Y2', foc: true, s: 1, e: 1 }, 'text, keyboard and cursor kept');
  assert.equal(await a.textContent('#sfFindL'), line, 'the line above the box');
  assert.equal(await openKey(a), k, 'the open row');
  assert.equal(await a.isVisible('#sfFindX'), true);
  // typing goes on into the box
  await a.keyboard.press('End');
  await a.keyboard.type('6');
  await idle(a);
  assert.equal(await a.inputValue('#sfFindIn'), 'Y26');
  assert.equal(await a.textContent('#sfFindL'), 'Copic Y26 Mustard · Ohuhu Y26 Light Gold');

  // a search run (Return): its rows and line stay through the next save
  await a.fill('#sfFindIn', 'g410');
  await a.press('#sfFindIn', 'Enter');
  await idle(a);
  assert.deepEqual(await rowKeys(a), ['Ohuhu|G410']);
  const line2 = await a.textContent('#sfFindL');
  await b.evaluate(() => {
    const t = __mstest,
      l = t.assignData.order.find((l) => !t.colored[l]);
    t.colored[l] = 1;
    t.guideDirty = true;
    t.renderGuide();
  });
  await idle(b, AUTO);
  await until(
    a,
    (n) => __mstest.colored.reduce((x, y) => x + y, 0) === n + 2,
    n0,
    'the second tick reaching this tab',
  );
  await idle(a);
  assert.deepEqual(await rowKeys(a), ['Ohuhu|G410'], 'still only its rows');
  assert.equal(await openKey(a), 'Ohuhu|G410');
  assert.equal(await a.inputValue('#sfFindIn'), 'g410');
  assert.equal(await a.textContent('#sfFindL'), line2);
  assert.deepEqual(errors, []);
});

// ---- Bug 5: shaded guides count their shading markers ----
// every line the PDF writes (fillText), page by page
const pdfText = (page) =>
  page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      ot = P.fillText,
      log = [];
    P.fillText = function (t) {
      log.push({ cv: this.canvas, t: String(t) });
      return ot.apply(this, arguments);
    };
    let cvs;
    try {
      cvs = __mstest.buildPDFPages();
    } finally {
      P.fillText = ot;
    }
    return log.filter((e) => cvs.indexOf(e.cv) >= 0).map((e) => e.t);
  });
test('a shaded guide says "16 markers + 29 for shading" on Page finished, Focus mode’s finish, Reveal’s card, Home’s latest piece and the PDF; with shading off as before', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await benGuide(page);
  await saveGuide(page);
  // shading off: as before
  const n = await page.evaluate(
    () => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
  );
  assert.ok(
    (await pdfText(page)).some((t) => new RegExp(` · ${n} markers · `).test(t)),
    'the PDF as before',
  );
  // shading on: how many markers the highlights and shadows take besides
  const x = await page.evaluate(() => {
    const t = __mstest;
    t.shadeMode = 'full';
    t.guideDirty = true;
    t.renderGuide();
    const A = t.assignData.assign,
      base = new Set(Object.values(A).map((m) => m.mkey)),
      ex = new Set();
    for (const l in A) {
      const s = t.shadeSec(+l);
      if (s) [s.light, s.dark].forEach((m) => m && !base.has(m.mkey) && ex.add(m.mkey));
    }
    return ex.size;
  });
  assert.ok(x > 0, 'shading takes other markers');
  const want = `${n} markers + ${x} for shading`;
  const pdf = await pdfText(page);
  assert.ok(
    pdf.some((t) => t.includes(want)),
    'the PDF key’s header: ' + pdf.filter((t) => / markers/.test(t)).join(' | '),
  );
  // finished in the list
  await along(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.checkComplete();
    t.updateProgress();
  });
  await idle(page);
  assert.match(
    await page.textContent('#sfDoneSum'),
    new RegExp(`^\\d+ sections · ${want.replace('+', '\\+')}`),
  );
  // Reveal's card
  const meta = await page.evaluate(() => __mstest.showModel().meta);
  assert.ok(meta.includes(want), meta);
  // Home's latest piece, once saved
  await idle(page, AUTO);
  await page.click('#mCollection');
  await idle(page);
  await page.click('#mHome');
  await idle(page);
  assert.match(await page.textContent('#homeHero .hhmeta'), new RegExp(`· ${want.replace('+', '\\+')}$`));
  assert.deepEqual(errors, []);
});

// ---- Bug 7: a code in both brands outlines both markers ----
// the outline over the picture: which sections, and which of the given colours its pixels have
const outline = (page, hexes) =>
  page.evaluate((hexes) => {
    const o = document.querySelector('canvas.sfoutline');
    if (!o || o.style.display === 'none' || !o.dataset.secs) return null;
    const d = o.getContext('2d').getImageData(0, 0, o.width, o.height).data,
      rgb = hexes.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))),
      n = hexes.map(() => 0);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 250) continue;
      rgb.forEach((c, k) => {
        if (Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]) < 12) n[k]++;
      });
    }
    return {
      secs: o.dataset.secs
        .split(' ')
        .map(Number)
        .sort((a, b) => a - b),
      px: n,
    };
  }, hexes);
test('a code in both brands: Return shows both markers’ sections on the picture, each outlined in its own colour, until a row is tapped', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await benGuide(page);
  await along(page);
  const g = await page.evaluate(() => {
    const t = __mstest,
      A = t.assignData.assign,
      by = {};
    for (const l of t.assignData.order) {
      const m = A[l];
      if (m.code !== 'Y26') continue;
      (by[m.mkey] = by[m.mkey] || { hex: m.hex, s: [] }).s.push(l);
    }
    return by;
  });
  assert.deepEqual(Object.keys(g).sort(), ['Copic|Y26', 'Ohuhu|Y26']);
  const hexes = [g['Copic|Y26'].hex, g['Ohuhu|Y26'].hex];
  await page.fill('#sfFindIn', 'Y26');
  await page.press('#sfFindIn', 'Enter');
  await idle(page);
  assert.equal(await page.textContent('#sfFindL'), 'Two Y26s: which is in your hand?');
  assert.equal(await openKey(page), null, 'neither row opened');
  const o = await outline(page, hexes);
  assert.ok(o, 'outlined on the picture');
  assert.deepEqual(
    o.secs,
    [...g['Copic|Y26'].s, ...g['Ohuhu|Y26'].s].sort((a, b) => a - b),
  );
  assert.ok(o.px[0] > 0 && o.px[1] > 0, 'each in its own colour: ' + o.px);
  // their sections in full colour, the rest pale, as an open row shows
  const shown = await page.evaluate(() => {
    const t = __mstest,
      L = t.labels,
      d = document.getElementById('sfCanvas').getContext('2d').getImageData(0, 0, t.W, t.H).data,
      A = t.assignData.assign,
      r = { y26: 0, y26n: 0, rest: 0, restn: 0 },
      n = {},
      near = {};
    // how much of each section is near its marker's colour (its code drawn on it aside)
    for (let p = 0; p < L.length; p += 2) {
      const l = L[p],
        m = l > 0 && A[l];
      if (!m) continue;
      const c = [1, 3, 5].map((i) => parseInt(m.hex.slice(i, i + 2), 16));
      n[l] = (n[l] || 0) + 1;
      if (Math.max(...[0, 1, 2].map((i) => Math.abs(d[p * 4 + i] - c[i]))) <= 40)
        near[l] = (near[l] || 0) + 1;
    }
    for (const l of t.assignData.order) {
      if (!n[l]) continue;
      const own = (near[l] || 0) / n[l] > 0.5;
      if (A[l].code === 'Y26') {
        r.y26n++;
        if (own) r.y26++;
      } else {
        r.restn++;
        if (own) r.rest++;
      }
    }
    return r;
  });
  assert.equal(shown.y26, shown.y26n, 'both markers’ sections in their colours: ' + JSON.stringify(shown));
  assert.ok(shown.rest < shown.restn * 0.2, 'the rest pale: ' + JSON.stringify(shown));
  // a row tapped: that one marker, outlined as an open row is
  await page.click('#sfAlist .sfarow[data-k="Ohuhu|Y26"] .sfah');
  await idle(page);
  const o2 = await outline(page, hexes);
  assert.deepEqual(
    o2.secs,
    g['Ohuhu|Y26'].s.slice().sort((a, b) => a - b),
  );
  assert.deepEqual(o2.px, [0, 0], 'white and dark, as an open row’s');
  // closed again: both stay out (the search said which)
  await page.click('#sfAlist .sfarow[data-k="Ohuhu|Y26"] .sfah');
  await idle(page);
  assert.equal(await outline(page, hexes), null);
  assert.deepEqual(errors, []);
});

// ---- Bug 8 and the brand as a badge: brand-aware names wherever a code is named ----
// what a screen reader hears of an element: its text without what's hidden from it (aria-hidden)
const heard = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = el.cloneNode(true);
    c.querySelectorAll('[aria-hidden="true"]').forEach((x) => x.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  }, sel);
// what the eye sees: its text without the screen-reader-only parts, and its badges
const seen = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = el.cloneNode(true);
    c.querySelectorAll('.sfsr').forEach((x) => x.remove());
    return {
      t: c.textContent.replace(/\s+/g, ' ').trim(),
      badges: [...el.querySelectorAll('.btag')].map((b) => b.textContent),
    };
  }, sel);
test('two brands in the collection: Mark all, its toast, Undo, the list’s and Focus mode’s screen-reader lines and the Colours sheet name the brand; the brand shows as a badge (Focus mode’s name line, Start colour), never a bare letter', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await benGuide(page);
  // Pattern › Start colour: a badge on screen, "Ohuhu R46" (or Copic) for a screen reader
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  const sc = await seen(page, '#sfGStartC'),
    m0 = await page.evaluate(() => __mstest.gradStartInfo().cols[0]);
  assert.deepEqual(sc.badges, [m0.brand[0]], 'the brand as a badge');
  assert.equal(await heard(page, '#sfGStartC'), `${m0.brand} ${m0.code} ${m0.name}`);
  // the list: opening a row, Mark all, its toast and Undo
  await along(page);
  await page.click('#sfAlist .sfarow[data-k="Ohuhu|Y26"] .sfah');
  await idle(page);
  assert.match(await live(page), /^Ohuhu Y26 Light Gold, 0 of \d+ coloured$/);
  await page.click('#sfMarkAll');
  await idle(page);
  assert.match(await live(page), /^(The Ohuhu Y26 section|All \d+ Ohuhu Y26 sections) coloured$/);
  assert.equal(await heard(page, '#msToast'), 'Marked all Ohuhu Y26 coloured Undo');
  assert.deepEqual((await seen(page, '#msToast')).badges, ['O']);
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await live(page), 'Ticks as they were for Ohuhu Y26');
  // Focus mode from that row: the name line's badge, "Ohuhu Y26 · Light Gold" heard, the Colours sheet's Mark all
  await page.click('#sfFocus');
  await idle(page);
  const fn = await seen(page, '#sfFocName');
  assert.deepEqual(fn, { t: 'O Y26 · Light Gold', badges: ['O'] });
  assert.match(await live(page), /^Ohuhu Y26 · Light Gold\. Section 1 of \d+/);
  await page.click('#sfFocCols');
  await idle(page);
  assert.equal(await heard(page, '#sfFocAll'), 'Mark all Ohuhu Y26 done');
  assert.deepEqual((await seen(page, '#sfFocAll')).badges, ['O']);
  assert.ok(
    (await page.$$eval('#sfFocMk .focmk .fmc', (b) => b.map((x) => x.textContent))).includes('Ohuhu Y26'),
    'the sheet’s chips name the brand for a screen reader',
  );
  await page.click('#sfFocAll');
  await idle(page);
  assert.equal(await heard(page, '#msToast'), 'Marked all Ohuhu Y26 done Undo');
  assert.deepEqual(errors, []);
});

test('finishing in the list says what Focus mode says: "Page finished. 166 sections · 16 markers … Reveal & share is in the bar at the bottom."', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await along(page);
  const k = await page.evaluate(() => {
    const t = __mstest,
      k = t.assignData.assign[t.assignData.order[0]].mkey;
    t.assignData.order.forEach((l) => {
      if (t.assignData.assign[l].mkey !== k) t.colored[l] = 1;
    });
    t.updateProgress();
    return k;
  });
  await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
  await idle(page);
  await page.click('#sfMarkAll');
  await idle(page);
  assert.match(
    await live(page),
    /^Page finished\. 166 sections · \d+ markers · coloured today\. Reveal & share is in the bar at the bottom\.$/,
  );
  assert.deepEqual(errors, []);
});

// ---- Bug 10 and the print tag: the PDF key ----
test('the PDF key: three-digit order numbers ("162nd") clear the tick box; a code in both brands has a darker amber tag with a white letter in print (the screen’s amber stays)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await benGuide(page);
  const r = await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      osr = P.strokeRect,
      ot = P.fillText,
      of = P.fill,
      oa = P.arcTo,
      log = [];
    P.strokeRect = function (x, y, w, h) {
      log.push({ k: 'box', cv: this.canvas, x, w, h });
      return osr.apply(this, arguments);
    };
    P.arcTo = function () {
      this.__tag = 1;
      return oa.apply(this, arguments);
    };
    P.fill = function () {
      if (this.__tag) {
        this.__tag = 0;
        this.__box = String(this.fillStyle);
      }
      return of.apply(this, arguments);
    };
    P.fillText = function (t, x) {
      const s = String(t);
      if (/^\d+(st|nd|rd|th)$/.test(s) && this.textAlign === 'right')
        log.push({ k: 'ord', cv: this.canvas, t: s, l: x - this.measureText(s).width });
      if (this.__box)
        log.push({ k: 'tag', cv: this.canvas, box: this.__box, ink: String(this.fillStyle), t: s });
      this.__box = null;
      return ot.apply(this, arguments);
    };
    let cvs;
    try {
      cvs = __mstest.buildPDFPages();
    } finally {
      P.strokeRect = osr;
      P.fillText = ot;
      P.fill = of;
      P.arcTo = oa;
    }
    const out = { gaps: [], tags: [] };
    let box = null;
    for (const e of log) {
      if (cvs.indexOf(e.cv) < 0) continue;
      if (e.k === 'box' && Math.abs(e.w - e.h) < 0.01 && e.w < 40) box = e;
      else if (e.k === 'ord' && box && box.cv === e.cv) {
        out.gaps.push({ t: e.t, gap: e.l - (box.x + box.w) });
        box = null;
      } else if (e.k === 'tag') out.tags.push({ box: e.box, ink: e.ink });
    }
    return out;
  });
  const three = r.gaps.filter((g) => g.t.length >= 5);
  assert.ok(three.length > 50, 'three-digit order numbers: ' + three.length);
  const worst = Math.min(...r.gaps.map((g) => g.gap));
  assert.ok(worst >= 4, 'every order number clear of its box (device px): ' + worst);
  // print's amber: on page 1, the close-ups and the key
  const am = r.tags.filter((t) => t.box === '#b45f06');
  assert.ok(am.length > 3, 'print amber tags: ' + am.length);
  assert.ok(
    am.every((t) => t.ink === '#ffffff'),
    'white letters',
  );
  assert.ok(!r.tags.some((t) => t.box === '#ffb454'), 'not the screen’s amber');
  // the screen keeps its amber
  const scr = await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      of = P.fill,
      seen = new Set();
    P.fill = function () {
      seen.add(String(this.fillStyle));
      return of.apply(this, arguments);
    };
    try {
      __mstest.forceFullRender();
      __mstest.renderGuide();
    } finally {
      P.fill = of;
    }
    return [...seen];
  });
  assert.ok(scr.includes('#ffb454') && !scr.includes('#b45f06'), 'the screen’s labels as they were');
  assert.deepEqual(errors, []);
});

// ---- Bug 11: the find line names the zones ----
test('find by code with zones and shading: a highlight’s and a shadow’s zones are noted, and named in the line when they differ', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  // a zone of the bottom part
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
  else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
  await idle(page);
  await page.fill('#sfZoneName', 'Tail');
  await page.press('#sfZoneName', 'Enter');
  await page.evaluate(() => {
    const t = __mstest,
      cl = Object.keys(t.assignData.assign)
        .map(Number)
        .filter((l) => t.comps[l].cy > t.H * 0.6);
    t.zoneMove(cl, t.zoneCur);
    t.reassign([0, t.zoneCur]);
  });
  await page.click('#sfZoneDone');
  await idle(page);
  const r = await page.evaluate(() => {
    const t = __mstest;
    t.shadeMode = 'full';
    t.renderGuide();
    const A = t.assignData.assign,
      want = {};
    // each highlight and shadow marker: the zones it's that in, from the guide itself
    for (const l in A) {
      const s = t.shadeSec(+l);
      if (!s) continue;
      [
        ['light', 'highlight'],
        ['dark', 'shadow'],
      ].forEach(([p, k]) => {
        const x = s[p];
        if (!x) return;
        const w = (want[x.code] = want[x.code] || {});
        (w[x.mkey] = w[x.mkey] || { highlight: {}, shadow: {} })[k][t.zoneOf(+l)] = 1;
      });
    }
    const out = { n: 0, bad: [], named: [] };
    for (const c in want) {
      const f = t.codeFind(c);
      for (const p of f.part) {
        out.n++;
        const w = want[c][p.m.mkey];
        if (JSON.stringify(w) !== JSON.stringify(p.zn)) out.bad.push([c, w, p.zn]);
        const ks = (o) => Object.keys(o).sort().join();
        if (ks(p.zn.highlight) && ks(p.zn.shadow) && ks(p.zn.highlight) !== ks(p.zn.shadow))
          out.named.push(t.findLine(f));
      }
    }
    return out;
  });
  assert.ok(r.n > 5, 'highlights and shadows found: ' + r.n);
  assert.deepEqual(r.bad, [], 'their zones noted');
  for (const line of r.named) assert.match(line, / in (Main|Tail)/, line);
  assert.deepEqual(errors, []);
});

// ---- Polish: "Saving…" only while writing; ticks fade out ----
test('"Saving…" shows only while the guide is being written, not in the moment before every tick is saved', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await saveGuide(page);
  await idle(page, AUTO);
  await along(page);
  // every text the line shows, and when the guide is written
  await page.evaluate(() => {
    const el = document.getElementById('sfSaveSt'),
      t0 = performance.now();
    window.__st = [];
    window.__w = [];
    new MutationObserver(() =>
      window.__st.push([Math.round(performance.now() - t0), el.textContent]),
    ).observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    const put = IDB.put;
    IDB.put = function (k) {
      if (/^guide-\d/.test(k)) window.__w.push(Math.round(performance.now() - t0));
      return put.apply(this, arguments);
    };
  });
  const l = await page.evaluate(() => __mstest.assignData.order[3]);
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y);
  await pause(page, 900, 'the moment before the save, which said "Saving…"');
  assert.match(await page.textContent('#sfSaveSt'), /Saved in your Library|Saves itself from now on/);
  assert.ok(await page.evaluate(() => __mstest.colored[__mstest.assignData.order[3]] === 1), 'ticked');
  await idle(page, AUTO);
  const { st, w } = await page.evaluate(() => ({ st: window.__st, w: window.__w }));
  assert.equal(w.length, 1, 'written once: ' + JSON.stringify(w));
  const saving = st.filter((x) => x[1] === 'Saving…');
  assert.ok(saving.length >= 1, 'said while writing: ' + JSON.stringify(st));
  assert.ok(
    saving.every((x) => x[0] >= w[0] - 5),
    'only once the write began: ' + JSON.stringify({ st, w }),
  );
  assert.match(await page.textContent('#sfSaveSt'), /^(Saved in your Library|Saves itself from now on) ✓$/);
  assert.deepEqual(errors, []);
});

// how strongly each ✓ is drawn on section l, in order, from now until it has gone
const tickFade = (page, l) =>
  page.evaluate(
    (l) =>
      new Promise((res) => {
        const P = CanvasRenderingContext2D.prototype,
          ot = P.fillText,
          q = __mstest.labelPos(l),
          seen = [];
        P.fillText = function (t, x, y) {
          if (t === '✓' && Math.abs(x - q.x) < 0.5 && Math.abs(y - q.y) < 0.5) seen.push(this.globalAlpha);
          return ot.apply(this, arguments);
        };
        const t0 = performance.now(),
          wait = () => {
            if (performance.now() - t0 > 1600) {
              P.fillText = ot;
              res(seen);
            } else setTimeout(wait, 50);
          };
        wait();
      }),
    l,
  );
test('a section ticked in Colour along: its ✓ shows for a second, then fades out over about 200 ms in three steps; at once with Reduce motion', async () => {
  for (const rm of [false, true]) {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    if (rm) await page.emulateMedia({ reducedMotion: 'reduce' });
    await sampleGuide(page);
    await along(page);
    const l = await page.evaluate(() => __mstest.assignData.order[5]);
    const p = await sectionPoint(page, l);
    const fade = tickFade(page, l);
    await page.mouse.click(p.x, p.y);
    const a = await fade;
    const steps = [...new Set(a.map((x) => Math.round(x * 100) / 100))];
    if (rm) assert.deepEqual(steps, [1], 'Reduce motion: shown, then gone: ' + a);
    else assert.deepEqual(steps, [1, 0.75, 0.5, 0.25], 'fading: ' + a);
    assert.deepEqual(errors, []);
  }
});

// ---- Polish: contrast ----
// the contrast of an element's text against what's behind it: its colour, faded by its own and its parents' opacity,
// over the backgrounds under it (each laid over the page's)
const contrast = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rgba = (s) => {
        const m = s.match(/[\d.]+/g).map(Number);
        return { c: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 };
      },
      over = (top, a, under) => top.map((v, i) => v * a + under[i] * (1 - a)),
      lum = (c) =>
        c
          .map((v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          })
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const chain = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
    let bg = rgba(getComputedStyle(document.body).backgroundColor).c;
    // backgrounds from the outside in, each with its element's opacity and its parents'
    const op = (n) => {
      let o = 1;
      for (let x = n; x && x.nodeType === 1; x = x.parentElement) o *= +getComputedStyle(x).opacity;
      return o;
    };
    for (let i = chain.length - 1; i >= 1; i--) {
      const b = rgba(getComputedStyle(chain[i]).backgroundColor);
      if (b.a > 0) bg = over(b.c, b.a * op(chain[i]), bg);
    }
    const own = rgba(getComputedStyle(el).backgroundColor);
    if (own.a > 0) bg = over(own.c, own.a * op(el), bg);
    const f = rgba(getComputedStyle(el).color),
      fg = over(f.c, f.a * op(el), bg),
      L1 = lum(fg),
      L2 = lum(bg);
    return Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100;
  }, sel);
test('contrast: a finished row’s brand badge and Focus mode’s ← while there’s nothing to go back to are 4.5:1 or more', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await benGuide(page);
  await along(page);
  const k = (await rowKeys(page))[0];
  await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
  await idle(page);
  await page.click('#sfMarkAll');
  await idle(page);
  const sel = `#sfAlist .sfarow.full[data-k="${k}"] .btag`;
  assert.ok(await page.$(sel), 'a finished row with a badge');
  const c1 = await contrast(page, sel);
  assert.ok(c1 >= 4.5, 'the badge: ' + c1);
  // (closed, not the open row's tint)
  await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
  await idle(page);
  const c2 = await contrast(page, sel);
  assert.ok(c2 >= 4.5, 'the badge, row closed: ' + c2);
  await page.click('#sfFocus');
  await idle(page);
  // (at its first section, with nothing to go back to)
  await page.evaluate(() => __mstest.goFocus(0, false, true));
  await idle(page);
  assert.equal(await page.getAttribute('#sfFBack', 'disabled'), '');
  const c3 = await contrast(page, '#sfFBack');
  assert.ok(c3 >= 4.5, 'Focus mode’s ←: ' + c3);
  assert.deepEqual(errors, []);
});
