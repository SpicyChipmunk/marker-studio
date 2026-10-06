// v308 (output): the PDF key's reference sized to the room left, its table going on to a "continued" page, and Key +
// reference on one page; one number column in colouring order when Numbers are printed; the shading's sun clear of the
// labels; small sections left with only a dot given a number after all; Save image's least code size, with dots below
// it. Colouring: Focus mode's + and − about the section it's on, its keyboard ring, the Page finished panel in view
// after finishing there, Escape leaving Colour along as Back does, Reveal from Colour along going back there, the
// screen-on note in the tool row. Dialogs: Tab stays in Help and Scan. The Print sheet's choices not taken look
// pressable.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, sampleGuide, letterGuide, idle, shot } from './helpers.mjs';

before(setup);
after(teardown);

// the open guide given n different markers, as a big collection would (as v304-export does)
const manyMarkers = (page, n) =>
  page.evaluate((n) => {
    const t = __mstest,
      a = t.assignData.assign,
      ids = Object.keys(a),
      base = a[ids[0]];
    ids.forEach((l, i) => {
      const c = COLORS[(i * 7) % COLORS.length];
      if (i < n)
        a[l] = Object.assign({}, base, {
          mkey: c.brand + ':' + c.code,
          hex: c.hex,
          code: c.code,
          name: c.name,
          brand: c.brand,
        });
    });
  }, n);
// the PDF's pages: their sizes, the texts drawn on each (page coordinates or on a picture) and the pictures drawn
const probe = (page) =>
  page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      of = P.fillText,
      od = P.drawImage,
      log = [],
      imgs = [];
    P.fillText = function (t, x, y) {
      const tr = this.getTransform();
      log.push({
        cv: this.canvas,
        t: String(t),
        x,
        y,
        al: this.textAlign,
        fill: this.fillStyle,
        id: tr.a === 1 && tr.e === 0 && tr.f === 0,
      });
      return of.apply(this, arguments);
    };
    P.drawImage = function (img, x, y, w, h) {
      if (arguments.length === 5) imgs.push({ cv: this.canvas, x, y, w, h, sw: img.width, sh: img.height });
      return od.apply(this, arguments);
    };
    let cvs;
    try {
      cvs = __mstest.buildPDFPages();
    } finally {
      P.fillText = of;
      P.drawImage = od;
    }
    const t = __mstest,
      pg = (c) => cvs.indexOf(c);
    return {
      pages: cvs.map((c) => [c.width, c.height]),
      texts: log
        .filter((e) => pg(e.cv) >= 0)
        .map((e) => ({ p: pg(e.cv), t: e.t, x: e.x, y: e.y, al: e.al, fill: e.fill, id: e.id })),
      art: imgs
        .filter((e) => pg(e.cv) >= 0 && e.sw === t.W && e.sh === t.H)
        .map((e) => ({ p: pg(e.cv), x: e.x, y: e.y, w: e.w, h: e.h })),
    };
  });
const opt = (page, o) =>
  page.evaluate((o) => {
    for (const k in o) __mstest.pdfOpt(k, o[k]);
  }, o);
const shading = async (page) => {
  await page.click('.sftabbtn[data-t="shading"]');
  await page.click('#sfShade [data-v="full"]');
  await idle(page);
};
const over = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

test('the key’s reference with shading is never a stamp: a third of the page or more, the table going on to a continued page', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await shading(page);
  await manyMarkers(page, 40);
  await opt(page, { pwhat: 'page', plabels: 'codes', paper: 'letter', blend: true });
  const r = await probe(page);
  const keyP = r.texts.find((e) => e.t === 'Colour key').p,
    ref = r.art.find((a) => a.p === keyP),
    H = r.pages[keyP][1];
  assert.ok(ref, 'the reference is drawn on the key’s page');
  assert.ok(ref.h >= H * 0.3, `the reference is ${Math.round((ref.h / H) * 100)}% of the page’s height`);
  assert.ok(
    r.texts.some((e) => e.t === 'Colour key (continued)' && e.p > keyP),
    'the key goes on to the next page',
  );
  assert.deepEqual(errors, []);
});

test('Key + reference fits on one page where it can (a smaller picture rather than rows on a second sheet)', async () => {
  // (a Letter page: v307 put 16 markers' key on two pages, as on Ben's page)
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await letterGuide(page);
  await opt(page, { pwhat: 'ref', plabels: 'codes', paper: 'letter', blend: false });
  const r = await probe(page);
  assert.equal(r.pages.length, 1, 'one page');
  assert.ok(r.art[0].h >= r.pages[0][1] * 0.3, 'the reference still a good size');
  assert.deepEqual(errors, []);
});

test('Numbers: one NO. column in colouring order (lightest first), the key in that order, so "14" on the page is the 14th row', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await opt(page, { pwhat: 'page', plabels: 'numbers', paper: 'letter', blend: false });
  const r = await probe(page);
  const keyP = r.texts.find((e) => e.t === 'Colour key').p,
    onKey = r.texts.filter((e) => e.p >= keyP && e.id);
  assert.ok(
    onKey.some((e) => e.t === 'NO.'),
    'NO. heads the column',
  );
  assert.ok(!onKey.some((e) => e.t === 'ORDER' || /^\d+(st|nd|rd|th)$/.test(e.t)), 'no second, ORDER column');
  // the numbers top to bottom are 1, 2, 3 …, and the codes beside them go lightest first
  const nums = onKey.filter(
    (e) => e.al === 'right' && /^\d+$/.test(e.t) && /^#(a0a0a0|111111)$/.test(e.fill),
  );
  const n = await page.evaluate(
    () => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
  );
  assert.deepEqual(
    nums.map((e) => +e.t),
    Array.from({ length: n }, (_, i) => i + 1),
    'the rows in number order',
  );
  // (lightness as Colour along's order has it: 0.299 R + 0.587 G + 0.114 B)
  const lum = await page.evaluate(() => {
    const o = {};
    Object.values(__mstest.assignData.assign).forEach((m) => {
      const h = m.hex.replace('#', ''),
        c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      o[m.code] = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    });
    return o;
  });
  const codes = nums.map((e) =>
    onKey.find((c) => c.p === e.p && Math.abs(c.y - e.y) < 1 && c.al === 'left' && lum[c.t] != null),
  );
  assert.ok(codes.every(Boolean), 'a code on each numbered row');
  for (let i = 1; i < codes.length; i++)
    assert.ok(
      lum[codes[i].t] <= lum[codes[i - 1].t] + 0.02,
      `lightest first: ${codes[i - 1].t} then ${codes[i].t}`,
    );
  // the page's numbers are those
  const onPage = new Set(r.texts.filter((e) => e.p === 0 && !e.id && /^\d+$/.test(e.t)).map((e) => +e.t));
  assert.ok([...onPage].every((v) => v >= 1 && v <= n));
  assert.deepEqual(errors, []);
});

test('the shading’s sun on the colouring page sits clear of every label, and the labels keep their codes', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await shading(page);
  // the light from the middle of the picture, where the labels are
  await page.evaluate(() => {
    __mstest.shadeSun = Object.assign({}, __mstest.shadeSun, { x: 0.5, y: 0.45 });
  });
  await opt(page, { pwhat: 'page', plabels: 'codes', paper: 'letter', blend: false });
  await probe(page);
  const r = await page.evaluate(() => ({ sun: __mstest.pdfSun, boxes: __mstest.pdfP1.boxes }));
  assert.ok(r.sun && r.sun.box, 'a sun drawn');
  for (const b of r.boxes) assert.ok(!over(b, r.sun.box), 'a label under the sun');
  assert.deepEqual(errors, []);
});

test('Half Letter with Codes: a small section no close-up labels gets a number (in its close-up, or on page 1), not only a dot', async () => {
  // (the sample with Ben's 451 markers: on Half Letter, v307 left one section with only a dot, labelled nowhere)
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.evaluate(() => {
    state.owned = new Set(defaultOwned());
    save();
    SF.setCollection(sfCollection());
    __mstest.styleVars.limitN = 999;
    // (every marker of his: the Gradient's Include row, v308, leaves greys, browns and fluorescents out of a new
    // guide, and those 130 put a 3-digit number in a 32-pixel section where none fits)
    __mstest.styleVars.gradIncl = null;
    SF.reassign();
  });
  await idle(page);
  for (const paper of ['half', 'a5', 'letter']) {
    await opt(page, { pwhat: 'page', plabels: 'codes', paper, blend: false });
    await probe(page);
    const r = await page.evaluate(() => {
      const p = __mstest.pdfP1;
      return {
        dropped: p.dropped.length,
        sq: Object.keys(p.sq || {}).length,
        closeN: __mstest.pdfCloseN,
        left: __mstest.pdfLeft,
        labels: p.boxes.slice(0, Object.keys(p.lays).length),
        sqBoxes: Object.values(p.sq || {}).map((L) => L.box),
      };
    });
    assert.equal(r.closeN + r.sq + r.left, r.dropped, paper + ': every small section counted once');
    assert.equal(r.left, 0, `${paper}: none left with only a dot (of ${r.dropped})`);
    for (const a of r.sqBoxes)
      for (const b of r.labels) assert.ok(!over(a, b), paper + ': a number over a label');
  }
  assert.deepEqual(errors, []);
});

test('Save image: no code under the least size; a small section gets a dot instead', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  const r = await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      of = P.fillText,
      oa = P.arc,
      log = [];
    let arcs = 0;
    P.fillText = function (t) {
      log.push({ t: String(t), fs: parseFloat(/(\d+(\.\d+)?)px/.exec(this.font)[1]) });
      return of.apply(this, arguments);
    };
    P.arc = function () {
      arcs++;
      return oa.apply(this, arguments);
    };
    let c;
    try {
      c = __mstest.buildExportCanvas(false, false);
    } finally {
      P.fillText = of;
      P.arc = oa;
    }
    const pl = __mstest.exPlaced,
      codes = new Set(Object.values(__mstest.assignData.assign).map((m) => m.code));
    return {
      min: __mstest.exportMinPx(c.width / __mstest.W),
      xs: c.width / __mstest.W,
      codes: log.filter((e) => codes.has(e.t)).map((e) => e.fs),
      dropped: pl.dropped.length,
      arcs,
    };
  });
  assert.ok(r.codes.length > 50);
  assert.ok(
    r.codes.every((fs) => fs * r.xs >= r.min - 0.01),
    'none under ' + r.min + ' px',
  );
  assert.ok(
    r.dropped > 0 && r.arcs >= r.dropped * 0.8,
    `a dot for the small sections (${r.arcs} for ${r.dropped})`,
  );
  assert.deepEqual(errors, []);
});

// the middle of a section's box on the screen (what Focus mode frames), after the next frames
const boxMid = (page, l) =>
  page.evaluate(
    (l) =>
      new Promise((res) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const c = document.getElementById('sfCanvas'),
              r = c.getBoundingClientRect(),
              b = __mstest.secBox(l);
            res({
              x: r.left + ((b[0] + b[2] + 1) / 2 / c.width) * r.width,
              y: r.top + ((b[1] + b[3] + 1) / 2 / c.height) * r.height,
            });
          }),
        ),
      ),
    l,
  );
test('Focus mode: + zooms about the section it’s on, not the middle of the view', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await page.click('#sfFocus');
  await idle(page);
  await page.click('#sfZin');
  await idle(page);
  // the section moved off the middle by a drag
  await page.mouse.move(410, 600);
  await page.mouse.down();
  await page.mouse.move(470, 650, { steps: 4 });
  await page.mouse.up();
  await idle(page);
  const l = await page.evaluate(() => __mstest.focusCur());
  const p0 = await boxMid(page, l);
  await page.click('#sfZin');
  await idle(page);
  const p1 = await boxMid(page, l);
  assert.ok(
    Math.hypot(p1.x - p0.x, p1.y - p0.y) < 4,
    `the section stays put: (${p0.x}, ${p0.y}) → (${p1.x}, ${p1.y})`,
  );
  await page.click('#sfZout');
  await idle(page);
  const p2 = await boxMid(page, l);
  assert.ok(Math.hypot(p2.x - p0.x, p2.y - p0.y) < 4, 'and zooming out too');
  assert.deepEqual(errors, []);
});

test('Focus mode: a control reached by Tab shows a focus ring', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await page.click('#sfFocus');
  await idle(page);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  const r = await page.evaluate(() => {
    const a = document.activeElement,
      cs = getComputedStyle(a);
    return {
      tag: a.tagName,
      kbd: a.classList.contains('sfkbd'),
      outline: cs.outlineStyle,
      w: parseFloat(cs.outlineWidth),
    };
  });
  assert.equal(r.tag, 'BUTTON');
  assert.ok(r.kbd && r.outline !== 'none' && r.w >= 2, 'a ring: ' + JSON.stringify(r));
  assert.deepEqual(errors, []);
});

test('finishing in Focus mode and closing it: the Page finished panel sits just under the pinned picture’s tool row', async () => {
  for (const [w, h] of [
    [820, 1180],
    [1180, 820],
  ]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    // scrolled down the list first, as after colouring a while
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.click('#sfFocus');
    await idle(page);
    // all but the section Focus mode is on, then ✓ Done
    await page.evaluate(() => {
      const t = __mstest,
        cur = t.focusCur();
      t.assignData.order.forEach((l) => {
        if (l !== cur) t.colored[l] = 1;
      });
    });
    await page.click('#sfFDone');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.focusFin), true);
    await page.click('#sfExitFoc');
    await idle(page);
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => {
      const d = document.getElementById('sfDone').getBoundingClientRect(),
        z = document.getElementById('sfZoomCtl').getBoundingClientRect();
      return { top: d.top, h: d.height, tools: z.bottom, ih: innerHeight };
    });
    assert.ok(r.h > 0, 'the panel shows');
    // (side by side the picture is beside the list: the panel only has to be on the screen)
    if (w < h)
      assert.ok(
        r.top >= r.tools - 2 && r.top <= r.tools + 30,
        `${w}×${h}: its top just under the tool row (${r.top}, tools ${r.tools})`,
      );
    else assert.ok(r.top >= 0 && r.top < r.ih - 100, `${w}×${h}: on the screen (${r.top})`);
    await shot(page, `v308-finished-after-focus-${w}x${h}`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Escape leaves Colour along for the Plan, as Back does; not from the code box', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await page.focus('#sfFindIn');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'color', 'from the box: stays');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide', 'back to the Plan');
  assert.deepEqual(errors, []);
});

test('Reveal opened from Colour along goes back to Colour along when closed', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.forEach((l) => (t.colored[l] = 1));
    t.updateProgress();
  });
  await idle(page);
  await page.click('#sfAlongRev');
  await page.waitForSelector('#sfRoot.sfrev');
  await page.click('#sfRevX');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
  assert.ok(await page.isVisible('#sfDone'), 'the Page finished panel');
  // and with Escape
  await page.click('#sfAlongRev');
  await page.waitForSelector('#sfRoot.sfrev');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
  assert.deepEqual(errors, []);
});

test('the screen-on note is in the tool row, not a toast over the rows', async () => {
  const init = () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: () => Promise.resolve({ addEventListener() {}, release() {} }) },
      configurable: true,
    });
  };
  const { page, errors } = await openApp({ width: 820, height: 1180, init });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await page.waitForFunction(() => /screen stays on/.test(document.getElementById('sfStat').textContent));
  assert.equal(
    await page.evaluate(() => document.getElementById('msToast')?.classList.contains('on') || false),
    false,
  );
  await page.waitForFunction(
    () => !/screen stays on/.test(document.getElementById('sfStat').textContent),
    null,
    { timeout: 8000 },
  );
  assert.deepEqual(errors, []);
});

test('Tab stays in Help and in Scan: a <summary> is a stop, an icon’s <use href> isn’t, and it wraps both ways', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  for (const id of ['helpOverlay', 'scanOverlay']) {
    await page.evaluate((id) => openDialog(document.getElementById(id)), id);
    await page.waitForSelector('#' + id + '.on');
    await page.waitForTimeout(80);
    for (const key of ['Tab', 'Shift+Tab'])
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press(key);
        const ok = await page.evaluate((id) => {
          const a = document.activeElement;
          return !!a && document.getElementById(id).contains(a) && !(a instanceof SVGElement);
        }, id);
        assert.ok(ok, `${id}: ${key} ${i + 1} left the dialog`);
      }
    if (id === 'helpOverlay') {
      let sum = false;
      for (let i = 0; i < 30 && !sum; i++) {
        await page.keyboard.press('Tab');
        sum = await page.evaluate(() => document.activeElement.tagName === 'SUMMARY');
      }
      assert.ok(sum, 'Help’s sections are reached');
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction((id) => !document.getElementById(id).classList.contains('on'), id);
  }
  assert.deepEqual(errors, []);
});

test('the Print sheet: a choice not taken is in the ink colour, not faded as if it couldn’t be chosen', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet.sfprsh');
  await idle(page);
  const r = await page.evaluate(() => {
    const on = document.querySelector('#sfSheet [data-plabels].on'),
      off = document.querySelector('#sfSheet [data-plabels]:not(.on):not(:disabled)'),
      cs = (e) => getComputedStyle(e);
    return { on: cs(on).color, off: cs(off).color, opacity: cs(off).opacity, bg: cs(off).backgroundColor };
  });
  assert.equal(r.off, r.on, 'the same ink as the chosen one');
  assert.equal(r.opacity, '1');
  assert.notEqual(r.bg, 'rgba(0, 0, 0, 0)', 'a card of its own');
  await shot(page, 'v308-print-sheet-820x1180');
  assert.deepEqual(errors, []);
});
