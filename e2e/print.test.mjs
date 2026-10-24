// Print and the PDF, the test strip.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as pw from 'playwright';
import {
  ENGINE,
  idle,
  letterGuide,
  openApp,
  sampleGuide,
  saveArtifact,
  saveGuide,
  setup,
  shot,
  startServer,
  teardown,
  trackIdle,
  welcome,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- from print.test.mjs ----
// Print for real markers: the Print sheet's options (Share › Print…) (labels, label darkness, what to print, paper) and what
// they do to the PDF pages. The pages are read straight from __mstest.buildPDFPages(), with fillText and drawImage
// watched so the tests can see which labels were drawn, where the text sits and how big the reference is. Also: the
// downloaded PDF in Letter and A4.
{
  // build the PDF pages and report: page sizes, every text drawn (page, text, position, width, alignment, colour,
  // whether it was drawn in page coordinates or on the picture), the pictures drawn and page 1's dark pixels
  function probe(page, keep) {
    return page.evaluate((keep) => {
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
          w: this.measureText(t).width,
          al: this.textAlign,
          fill: this.fillStyle,
          id: tr.a === 1 && tr.b === 0 && tr.c === 0 && tr.d === 1 && tr.e === 0 && tr.f === 0,
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
      const texts = log
        .filter((e) => pg(e.cv) >= 0)
        .map((e) => ({ p: pg(e.cv), t: e.t, x: e.x, y: e.y, w: e.w, al: e.al, fill: e.fill, id: e.id }));
      const art = imgs
        .filter((e) => pg(e.cv) >= 0 && e.sw === t.W && e.sh === t.H)
        .map((e) => ({ p: pg(e.cv), x: e.x, y: e.y, w: e.w, h: e.h }));
      const d = cvs[0].getContext('2d').getImageData(0, 0, cvs[0].width, cvs[0].height).data;
      let dark = 0;
      for (let i = 0; i < d.length; i += 4)
        if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 90) dark++;
      if (keep) {
        window.__p0 = window.__p0 || {};
        window.__p0[keep] = d;
      }
      const codes = [...new Set(Object.values(t.assignData.assign).map((m) => m.code))];
      const keyN = new Set(Object.values(t.assignData.assign).map((m) => m.mkey)).size;
      // (v284: close-ups of small sections may come between the colouring page and the key)
      const keyP = Math.max(
        0,
        texts.findIndex((e) => /^Colour key/.test(e.t)) >= 0
          ? texts.find((e) => /^Colour key/.test(e.t)).p
          : 1,
      );
      return {
        pages: cvs.map((c) => [c.width, c.height]),
        texts,
        art,
        dark,
        codes,
        keyN,
        keyP,
        closeN: t.pdfCloseN,
        left: t.pdfLeft,
        onArt: texts.filter((e) => e.p === 0 && !e.id).map((e) => e.t),
      };
    }, keep || null);
  }
  // darkest pixel that labels added to page 1, compared with the page without labels
  // (below the page's header, whose line of what's where changes with close-ups: v284)
  const labelInk = (page, a, b) =>
    page.evaluate(
      ([a, b]) => {
        const A = window.__p0[a],
          B = window.__p0[b],
          L = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        let min = 255,
          n = 0;
        for (let i = Math.floor((A.length * 0.12) / 4) * 4; i < A.length; i += 4) {
          const la = L(A, i);
          if (la < L(B, i) - 30) {
            n++;
            if (la < min) min = la;
          }
        }
        return { min, n };
      },
      [a, b],
    );
  const pick = (page, sel) => page.click(sel);
  // the key's number column (right-aligned; v305: drawn as the colouring page's numbers are, light grey or with Darker
  // labels near-black)
  const NUM_INK = /^#(a0a0a0|111111)$/;
  const keyNums = (r) =>
    r.texts
      .filter((e) => e.p > 0 && e.al === 'right' && NUM_INK.test(e.fill) && /^\d+$/.test(e.t))
      .map((e) => e.t);
  // Share › Print… opens the Print sheet; Cancel closes it
  async function sharePrint(page) {
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await idle(page);
  }
  async function closePrint(page) {
    await page.click('#sfSheet [data-pr="cancel"]');
    await page.waitForSelector('#sfSheet', { state: 'detached' });
  }
  // every text drawn in page coordinates, and every picture, stays inside the page margins
  function checkInside(r, what) {
    r.pages.forEach(([w, h], p) => {
      // (v320: the footer "Marker Studio" in the serif, the name and "page n of N" on the right)
      const foot = r.texts.find((e) => e.p === p && e.t === 'Marker Studio');
      assert.ok(foot, `${what} p${p + 1}: footer`);
      const m = foot.x;
      for (const e of r.texts.filter((e) => e.p === p && e.id)) {
        const left = e.al === 'right' ? e.x - e.w : e.al === 'center' ? e.x - e.w / 2 : e.x;
        assert.ok(
          left >= m - 1 && left + e.w <= w - m + 1,
          `${what} p${p + 1}: "${e.t}" runs outside the margins (${Math.round(left)}..${Math.round(left + e.w)} of ${w}, margin ${m})`,
        );
        assert.ok(e.y > 0 && e.y < h, `${what} p${p + 1}: "${e.t}" off the page`);
      }
      for (const a of r.art.filter((a) => a.p === p))
        assert.ok(
          a.x >= m - 1 && a.x + a.w <= w - m + 1 && a.y >= m && a.y + a.h <= h - m,
          `${what} p${p + 1}: picture inside the margins`,
        );
    });
  }
  // a context in a given locale, with a fresh profile and the test seam on
  async function localeApp(server, browser, locale) {
    const ctx = await browser.newContext({
      locale,
      viewport: { width: 390, height: 844 },
      serviceWorkers: 'block',
    });
    await trackIdle(ctx);
    await ctx.addInitScript(() => {
      window.__MS_TEST = true;
    });
    await ctx.route(
      (u) => !u.href.startsWith(server.url),
      (r) => r.abort(),
    );
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    return { ctx, page, errors };
  }
  async function pdf(page, name) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sfPDF')]);
    const path = await dl.path();
    const bytes = await readFile(path);
    await saveArtifact(name + '.pdf', bytes);
    const s = bytes.toString('latin1');
    const box = s.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
    return {
      head: s.slice(0, 5),
      pages: (s.match(/\/Type\s*\/Page[^s]/g) || []).length,
      w: box && +box[1],
      h: box && +box[2],
    };
  }
  test('labels: Codes, Numbers or None on the colouring page, light grey unless Darker labels is ticked', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await sharePrint(page);
    assert.equal(
      await page.getAttribute('[data-plabels="codes"]', 'aria-pressed'),
      'true',
      'codes by default',
    );
    assert.equal(await page.isChecked('#sfPdfDark'), false, 'light labels by default');

    // (v318.1: a line under What to print says what it prints)
    const what = () => page.textContent('#sfPrWhat');
    // (v318.27: then, on a line of its own, what the close-ups hold)
    assert.match(
      await what(),
      /^Your picture with light codes to colour on, then the colour key\.(\d+ small sections? |$)/,
    );
    const codes = await probe(page, 'codes');
    // (v284: every section is labelled on the page, or has a dot there and is labelled in a close-up; none overlap)
    const nSec = Object.keys(await page.evaluate(() => __mstest.assignData.assign)).length,
      onP1 = codes.onArt.filter((t) => !/^[A-Z]{1,2}$/.test(t));
    assert.equal(
      onP1.length + codes.closeN + codes.left,
      nSec,
      'a label or a close-up for every section (or counted as left with a dot)',
    );
    assert.ok(onP1.length >= nSec * 0.6, 'most labelled on the page: ' + onP1.length);
    const cs = [...new Set(onP1.filter((t) => !/^\d+$/.test(t)))];
    assert.ok(
      cs.every((t) => codes.codes.includes(t)) && cs.length >= codes.codes.length - 2,
      'codes on the colouring page',
    );
    // (v318.1: those under 6 pt a darker grey, #8a8a8a, so the smallest can be read; most stay #a0a0a0)
    const p1Fills = codes.texts
      .filter((e) => e.p === 0 && !e.id && !/^[A-Z]{1,2}$/.test(e.t))
      .map((e) => e.fill);
    assert.ok(
      p1Fills.every((f) => f === '#a0a0a0' || f === '#8a8a8a'),
      'light grey labels',
    );
    assert.ok(p1Fills.filter((f) => f === '#a0a0a0').length > p1Fills.length / 2, 'most the lightest grey');
    // (a key number stands in where a code won't fit: then the key has its numbers column)
    const fellBack = onP1.some((t) => /^\d+$/.test(t));
    assert.equal(
      codes.texts.some((e) => e.p === codes.keyP && e.t === 'NO.'),
      fellBack,
      'a numbers column in the key only when numbers stand in',
    );

    await pick(page, '[data-plabels="numbers"]');
    assert.match(await what(), /with light numbers to colour on/);
    const nums = await probe(page, 'numbers');
    const want = Array.from({ length: nums.keyN }, (_, i) => String(i + 1));
    const ns = [...new Set(nums.onArt.filter((t) => /^\d+$/.test(t)))];
    assert.ok(
      ns.every((t) => want.includes(t)) && ns.length >= want.length - 2,
      'numbers on the page, one per marker',
    );
    // (v305: the key's numbers look as the page's do: light grey, as its labels are by default)
    const keyNums = nums.texts
      .filter((e) => e.p === nums.keyP && e.al === 'right' && e.fill === '#a0a0a0' && /^\d+$/.test(e.t))
      .map((e) => e.t);
    assert.deepEqual(keyNums, want, 'the key lists 1…N in order');
    assert.ok(
      nums.texts.some((e) => e.p === nums.keyP && e.t === 'NO.'),
      'number column heading',
    );
    assert.ok(
      nums.texts.some((e) => e.p === 0 && /numbers: see the colour key/.test(e.t)),
      'the page says where the numbers are',
    );

    await pick(page, '[data-plabels="none"]');
    assert.equal(await page.isDisabled('#sfPdfDark'), true, 'darkness has nothing to do with no labels');
    assert.match(await what(), /to colour on, unlabelled/);
    const none = await probe(page, 'none');
    assert.equal(none.onArt.length, 0, 'no labels drawn');
    assert.deepEqual(
      none.pages,
      codes.pages.slice(0, codes.pages.length - (codes.keyP - 1)),
      'same pages otherwise (no close-ups)',
    );

    await pick(page, '[data-plabels="codes"]');
    await page.check('#sfPdfDark');
    assert.match(await what(), /with dark codes to colour on/);
    const dark = await probe(page, 'dark');
    assert.ok(
      dark.texts
        .filter((e) => e.p === 0 && !e.id && !/^[A-Z]{1,2}$/.test(e.t))
        .every((e) => e.fill === '#111111'),
      'darker labels are near-black (the close-ups’ letters aside)',
    );
    assert.ok(dark.dark > none.dark + 2000, `darker labels add dark ink (${dark.dark} vs ${none.dark})`);
    assert.ok(codes.dark <= none.dark + 200, `light labels add no dark ink (${codes.dark} vs ${none.dark})`);
    const lightInk = await labelInk(page, 'codes', 'none'),
      darkInk = await labelInk(page, 'dark', 'none');
    // (v318.1: labels under 6 pt are #8a8a8a, 138)
    assert.ok(
      lightInk.n > 1000 && lightInk.min >= 136,
      `light labels print grey: ${JSON.stringify(lightInk)}`,
    );
    assert.ok(darkInk.min < 60, `darker labels print black: ${JSON.stringify(darkInk)}`);
    assert.deepEqual(errors, []);
  });
  test('v284: labels on the colouring page never overlap; a section with no room has a dot there and a label in a close-up; the key has a box to tick and the colouring order', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const r = await probe(page);
    const pl = await page.evaluate(() => {
      const p = __mstest.pdfP1;
      return {
        boxes: Object.values(p.lays).map((x) => x.box),
        lays: Object.keys(p.lays).length,
        dropped: p.dropped.length,
      };
    });
    const n = Object.keys(await page.evaluate(() => __mstest.assignData.assign)).length;
    assert.equal(pl.lays + pl.dropped, n, 'every section placed or left for a close-up');
    for (let i = 0; i < pl.boxes.length; i++)
      for (let j = i + 1; j < pl.boxes.length; j++) {
        const a = pl.boxes[i],
          b = pl.boxes[j];
        assert.ok(
          !(a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]),
          'labels ' + i + ' and ' + j + ' overlap',
        );
      }
    assert.equal(r.closeN + r.left, pl.dropped, 'each one left out is in a close-up, or counted');
    // the close-ups' letters on page 1 (the boxes placed after the labels and the dots) are clear of every label, and
    // each close-up labels its own sections inside its crop
    const cl = await page.evaluate(() => {
      const p = __mstest.pdfP1;
      return { all: p.boxes, n: __mstest.pdfCloseL, cu: __mstest.pdfCU };
    });
    const letters = cl.all.slice(pl.lays + pl.dropped);
    assert.equal(letters.length, cl.n, 'a letter for each close-up');
    for (const b of letters)
      for (const a of pl.boxes)
        assert.ok(!(a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]), 'a letter on a label');
    for (const c of cl.cu)
      for (const b of c.boxes)
        assert.ok(
          b[0] >= c.crop[0] && b[1] >= c.crop[1] && b[2] <= c.crop[2] && b[3] <= c.crop[3],
          'a label cut by its close-up’s edge',
        );
    assert.ok(
      r.left <= pl.dropped * 0.1,
      'nearly all of them labelled in their close-up: ' + r.left + ' of ' + pl.dropped,
    );
    if (pl.dropped) {
      assert.ok(
        r.texts.some((e) => e.p === 1 && e.t === 'Close-ups'),
        'the close-ups follow the colouring page',
      );
      assert.ok(
        r.texts.some((e) => e.p === 0 && /close-ups? on pages? 2/.test(e.t)),
        'the colouring page says where they are',
      );
    }
    // the key: ORDER, with each marker's place lightest first, as 1st, 2nd … (so it can't be taken for a number)
    // (v308: one column. Where numbers stand in on the page they are that order, so the column is NO., 1…N)
    const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
    if (r.texts.some((e) => e.p === r.keyP && e.t === 'NO.')) {
      assert.ok(!r.texts.some((e) => e.p === r.keyP && e.t === 'ORDER'), 'one column, not two');
      assert.deepEqual(
        keyNums(r)
          .map(Number)
          .sort((a, b) => a - b),
        Array.from({ length: r.keyN }, (_, i) => i + 1),
      );
    } else {
      assert.ok(r.texts.some((e) => e.p === r.keyP && e.t === 'ORDER'));
      const ords = r.texts
        .filter(
          (e) => e.p >= r.keyP && e.al === 'right' && e.fill === '#8a8a8a' && /^\d+(st|nd|rd|th)$/.test(e.t),
        )
        .map((e) => e.t);
      assert.deepEqual(
        ords.slice().sort((a, b) => parseInt(a) - parseInt(b)),
        Array.from({ length: r.keyN }, (_, i) => ord(i + 1)),
      );
    }
    assert.deepEqual(errors, []);
  });
  test('shading marks still work with numbers: H/S circles and tone lines, key keeps its tones', async () => {
    const { page, errors } = await openApp({ storage: { 'ms-pdf-labels': 'numbers' } });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    const r = await probe(page);
    const zones = r.onArt.filter((t) => t === 'H' || t === 'S'),
      nums = r.onArt.filter((t) => /^\d+$/.test(t));
    assert.ok(zones.length > 3, `H/S circles drawn (${zones.length})`);
    assert.ok(nums.length > 50, 'numbers drawn');
    assert.ok(
      r.texts.some((e) => e.p === r.keyP && e.t === 'H  HIGHLIGHT') &&
        r.texts.some((e) => e.p === r.keyP && e.t === 'S  SHADOW'),
      'key has tone columns',
    );
    checkInside(r, 'letter shading numbers');
    assert.deepEqual(errors, []);
  });
  // (v318.1) Key + reference is to read beside your own drawing: with labels, page 1 is the picture in colour with
  // near-black codes (its close-ups after it, as Page + key's), then the key; with no labels, one page of reference and key
  test('Key + reference: the picture in colour with near-black codes, then the key; with no labels, a coloured reference beside the key', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await sharePrint(page);
    const full = await probe(page, 'page');
    await page.check('#sfPdfDark');
    const fullDark = await probe(page);
    await page.uncheck('#sfPdfDark');
    await pick(page, '[data-pwhat="ref"]');
    assert.equal(await page.isDisabled('[data-plabels="numbers"]'), false, 'labels for the picture');
    assert.equal(await page.isDisabled('#sfPdfDark'), true, 'always dark: nothing to colour over');
    assert.match(await page.textContent('#sfPrWhat'), /in colour with dark codes/);
    const lab = await probe(page, 'ref');
    assert.equal(lab.pages.length, full.pages.length, 'picture, close-ups and key, as Page + key');
    assert.equal(lab.keyP, full.keyP, 'the same close-ups');
    const onPic = (r) => r.texts.filter((e) => e.p === 0 && !e.id && !/^[A-Z]{1,2}$/.test(e.t)),
      labs = onPic(lab);
    assert.deepEqual(
      labs.map((e) => e.t).sort(),
      onPic(fullDark)
        .map((e) => e.t)
        .sort(),
      'labelled as Page + key with Darker labels',
    );
    assert.ok(
      labs.every((e) => e.fill === '#111111'),
      'near-black labels',
    );
    // (page 1 in colour: many more strongly coloured pixels than the colouring page's)
    const sat = await page.evaluate(() =>
      Object.fromEntries(
        ['page', 'ref'].map((k) => {
          const d = window.__p0[k];
          let n = 0;
          for (let i = 0; i < d.length; i += 4)
            if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 60) n++;
          return [k, n];
        }),
      ),
    );
    assert.ok(sat.ref > sat.page * 5 && sat.ref > 100000, 'the picture in colour: ' + JSON.stringify(sat));
    checkInside(lab, 'reference with codes');

    await pick(page, '[data-plabels="none"]');
    assert.match(await page.textContent('#sfPrWhat'), /beside the colour key/);
    const ref = await probe(page);
    assert.equal(ref.pages.length, full.pages.length - full.keyP, 'no picture page (nor close-ups)');
    assert.equal(full.art.length, 2, 'colouring page + reference');
    assert.equal(ref.art.length, 1, 'just the reference');
    const a = full.art[1],
      b = ref.art[0];
    // (v284: a tall picture's reference fills a column beside the key in Page + key too, so it can be as big)
    assert.ok(
      b.w * b.h >= a.w * a.h * 0.99,
      `as big a reference (${Math.round(b.w)}×${Math.round(b.h)} vs ${Math.round(a.w)}×${Math.round(a.h)})`,
    );
    assert.equal(ref.onArt.length, 0, 'nothing drawn over the reference');
    assert.ok(
      ref.texts.some((e) => e.p === 0 && e.t === 'MARKER'),
      'the key is on the first page',
    );
    checkInside(ref, 'reference');
    assert.deepEqual(errors, []);
  });
  test('A5 and Half Letter: right page shape, smaller pages, nothing runs off the edge', async () => {
    const { page, errors } = await openApp({ storage: { 'ms-pdf-labels': 'numbers', 'ms-pdf-blend': '1' } });
    await sampleGuide(page);
    await sharePrint(page);
    const letter = await probe(page);
    checkInside(letter, 'letter blends');
    for (const [p, W, H] of [
      ['a5', 419.53, 595.28],
      ['half', 396, 612],
      ['a4', 595.28, 841.89],
    ]) {
      await pick(page, `[data-paper="${p}"]`);
      const r = await probe(page);
      for (const [w, h] of r.pages)
        assert.ok(
          Math.abs(w / h - W / H) < 0.002 && Math.abs(w - Math.round((W / 72) * 200)) <= 1,
          `${p}: page is ${w}×${h}`,
        );
      checkInside(r, p + ' blends');
      assert.equal(keyNums(r).length, keyNums(letter).length, `${p}: every key row is there`);
      if (p !== 'a4')
        assert.ok(
          r.pages.length >= letter.pages.length,
          `${p}: the key may need more pages (${r.pages.length})`,
        );
    }
    // shading on the smallest page, with the key's widest cells
    await closePrint(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await sharePrint(page);
    await pick(page, '[data-paper="half"]');
    checkInside(await probe(page), 'half shading');
    await pick(page, '[data-pwhat="ref"]');
    checkInside(await probe(page), 'half shading reference');
    assert.deepEqual(errors, []);
  });
  test('paper defaults to the local size: A4 in Britain, Letter in the US and Mexico', async () => {
    const server = await startServer(),
      browser = await pw[ENGINE].launch();
    try {
      for (const [loc, want] of [
        ['en-GB', 'a4'],
        ['en-US', 'letter'],
        ['es-MX', 'letter'],
        ['de-DE', 'a4'],
      ]) {
        const { ctx, page, errors } = await localeApp(server, browser, loc);
        await sampleGuide(page);
        await sharePrint(page);
        assert.equal(await page.getAttribute('.sfpaper button.on', 'data-paper'), want, loc);
        const [w, h] = (await probe(page)).pages[0];
        assert.ok(
          Math.abs(w / h - (want === 'a4' ? 595.28 / 841.89 : 612 / 792)) < 0.002,
          `${loc}: ${w}×${h}`,
        );
        assert.deepEqual(errors, []);
        await ctx.close();
      }
    } finally {
      await browser.close();
      await server.close();
    }
  });
  test('choices are remembered after a reload, and the download is a real PDF', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await sharePrint(page);
    await pick(page, '[data-plabels="numbers"]');
    await page.check('#sfPdfDark');
    await pick(page, '[data-paper="a5"]');
    await pick(page, '[data-pwhat="ref"]');
    await closePrint(page);
    await saveGuide(page);
    await idle(page);
    await page.reload();
    await page.waitForFunction(() => !!window.__mstest);
    assert.deepEqual(
      await page.evaluate(() =>
        ['ms-pdf-labels', 'ms-pdf-dark', 'ms-paper', 'ms-pdf-what'].map((k) => localStorage.getItem(k)),
      ),
      ['numbers', '1', 'a5', 'ref'],
    );
    await page.click('#mHome');
    await page.click('#sfRecent [data-gid]');
    await page.waitForFunction(() => !!__mstest.assignData);
    await idle(page);
    await sharePrint(page);
    for (const sel of ['[data-plabels="numbers"]', '[data-paper="a5"]', '[data-pwhat="ref"]'])
      assert.equal(await page.getAttribute(sel, 'aria-pressed'), 'true', sel);
    assert.equal(await page.isChecked('#sfPdfDark'), true);
    const n = (await probe(page)).pages.length;
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
    const bytes = await readFile(await dl.path());
    await saveArtifact('print-a5-ref.pdf', bytes);
    const s = bytes.toString('latin1'),
      box = s.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
    assert.equal(s.slice(0, 5), '%PDF-');
    assert.deepEqual([+box[1], +box[2]], [419.53, 595.28], 'A5 media box');
    assert.equal((s.match(/\/Type\s*\/Page[^s]/g) || []).length, n, 'one PDF page per built page');
    assert.match(s.slice(-6), /%%EOF/);
    // (v318.1) no labels: the reference beside the key, fewer pages
    await pick(page, '[data-plabels="none"]');
    const [dl2] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#sfPDF'),
    ]);
    const s2 = (await readFile(await dl2.path())).toString('latin1');
    assert.ok((s2.match(/\/Type\s*\/Page[^s]/g) || []).length < n, 'no picture page');
    assert.deepEqual(errors, []);
  });
  test('Print makes a Letter PDF by default and an A4 PDF when chosen', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    const letter = await pdf(page, 'guide-letter');
    assert.equal(letter.head, '%PDF-');
    assert.deepEqual([letter.w, letter.h], [612, 792]);
    assert.ok(letter.pages >= 2, `${letter.pages} pages (colouring page + key)`);
    await page.click('[data-paper="a4"]');
    const a4 = await pdf(page, 'guide-a4');
    assert.deepEqual([Math.round(a4.w), Math.round(a4.h)], [595, 842]);
    assert.deepEqual(errors, []);
  });
}

// ---- from test-strip.test.mjs ----
// The test strip (v282): Share › Print › Pages › Test strip. A page of boxes to try the guide's markers on your own
// paper: a row per line of the key (7a, 7b where zones shade a marker differently), each marker's ×1/×2 box once, and
// with shading a long box in thirds for its highlight, base and shadow; with blend companions, lighter, colour, darker.
{
  async function sharePrint(page) {
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await idle(page);
  }
  async function closePrint(page) {
    await page.click('#sfSheet [data-pr="cancel"]');
    await page.waitForSelector('#sfSheet', { state: 'detached' });
  }
  // every text the strip's pages draw, by page
  const strip = (page) =>
    page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        log = [];
      P.fillText = function (t, x, y) {
        log.push({
          cv: this.canvas,
          t: String(t),
          x: this.textAlign === 'right' ? x - this.measureText(t).width : x,
          y,
          w: this.measureText(t).width,
        });
        return of.apply(this, arguments);
      };
      let cvs;
      try {
        cvs = __mstest.buildPDFPages(false);
      } finally {
        P.fillText = of;
      }
      const pg = (c) => cvs.indexOf(c);
      return {
        n: cvs.length,
        dims: cvs.map((c) => [c.width, c.height]),
        texts: log.filter((e) => pg(e.cv) >= 0).map((e) => ({ p: pg(e.cv), t: e.t, x: e.x, y: e.y, w: e.w })),
      };
    });
  const selectVal = (page, id, v) =>
    page.evaluate(
      ([id, v]) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      [id, v],
    );
  test('Test strip: a Pages choice of its own; Labels have nothing to label; a row per marker with its ×1/×2 box; not remembered next time', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await sharePrint(page);
    await page.click('[data-pwhat="strip"]');
    await idle(page);
    assert.equal(await page.getAttribute('[data-pwhat="strip"]', 'aria-pressed'), 'true');
    assert.equal(await page.isDisabled('[data-plabels="numbers"]'), true);
    assert.equal(await page.isDisabled('#sfPdfDark'), true);
    assert.match(await page.textContent('#sfPrSum'), /Test strip/);
    const r = await strip(page);
    const keyN = await page.evaluate(
      () => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
    );
    assert.equal(r.n, 1, 'the sample’s markers fit on one Letter page');
    assert.equal(await page.evaluate(() => __mstest.buildPDFPages(true)), r.n);
    assert.ok(r.texts.some((e) => /^Test strip · /.test(e.t)));
    assert.ok(r.texts.some((e) => /^Paper: _+ +Date: _+$/.test(e.t)));
    assert.equal(r.texts.filter((e) => e.t === '×1').length, keyN, 'a ×1/×2 box per marker');
    // numbered as the key is
    for (let i = 1; i <= keyN; i++)
      assert.ok(
        r.texts.some((e) => e.t === String(i)),
        'row ' + i,
      );
    // everything inside the page, the margins kept
    const [w, h] = r.dims[0];
    for (const e of r.texts)
      assert.ok(
        e.x >= w * 0.04 && e.x + e.w <= w * 0.965 && e.y > 0 && e.y <= h * 0.985,
        `${e.t} inside the page`,
      );
    // (the how-to is wrapped, at most three lines on Letter)
    const ti = r.texts.find((e) => /^Test strip/.test(e.t)),
      pl = r.texts.find((e) => /^Paper:/.test(e.t)),
      how = r.texts.filter((e) => e.p === 0 && e.y > ti.y && e.y < pl.y);
    assert.ok(how.length >= 1 && how.length <= 3, 'how-to lines: ' + how.length);
    // the strip is chosen once in a while: the choice from before stays stored
    await page.click('[data-pwhat="ref"]');
    await idle(page);
    await page.click('[data-pwhat="strip"]');
    await idle(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-pdf-what')), 'ref');
    await closePrint(page);
    // (while the app is open it stays chosen)
    await sharePrint(page);
    assert.equal(await page.getAttribute('[data-pwhat="strip"]', 'aria-pressed'), 'true');
    // the download: a PDF whose name says what it is
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
    assert.match(dl.suggestedFilename(), /-test-strip\.pdf$/);
    assert.deepEqual(errors, []);
  });
  test('Test strip with shading and a zone that shades differently: rows 1a/1b with the zone’s name, the tones in thirds, glazes “over B”, paper highlights, and more pages on A5', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await selectVal(page, 'sfShStyle', 'grey');
    await idle(page);
    // a zone over the top third: paper highlights, cooler shadows
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfZoneAdd');
    await idle(page);
    await page.fill('#sfZoneName', 'Top');
    await page.press('#sfZoneName', 'Enter');
    await page.evaluate(() => {
      const t = __mstest,
        cl = Object.keys(t.assignData.assign)
          .map(Number)
          .filter((l) => t.comps[l].cy < t.H * 0.35);
      t.zoneMove(cl, t.zoneCur);
      t.reassign([0, t.zoneCur]);
    });
    await page.click('#sfZoneDone');
    await idle(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await idle(page);
    assert.equal(
      await page.isChecked('#sfZoneShade'),
      true,
      'the zone is shaded, as Main was when it was made',
    );
    await selectVal(page, 'sfHiStyle', 'paper');
    await idle(page);
    await selectVal(page, 'sfShStyle', 'cool');
    await idle(page);
    await sharePrint(page);
    await page.click('[data-paper="letter"]');
    await idle(page);
    await page.click('[data-pwhat="strip"]');
    await idle(page);
    assert.match(await page.textContent('#sfPrShNote'), /each colour’s row has a box for its tones/);
    const r = await strip(page);
    const T = r.texts.map((e) => e.t);
    assert.ok(T.includes('1a') && T.includes('1b'), 'a marker shaded differently in two zones has two rows');
    assert.ok(T.includes('in Main') && T.includes('in Top'));
    assert.ok(
      T.some((t) => /^B [A-Z]+\d+$/.test(t)),
      'the base named in its third',
    );
    assert.ok(
      T.some((t) => t === 'H: paper'),
      'a paper highlight',
    );
    assert.ok(
      T.includes('over B') && T.some((t) => /^S [A-Z]+\d+$/.test(t)),
      'a glaze, laid over the base (on a line of its own)',
    );
    assert.ok(
      T.some((t) => /^H [A-Z]+\d+$/.test(t) || t === 'H: none'),
      'Main’s highlights',
    );
    assert.ok(
      r.texts.some((e) => /nothing where it says paper or none/.test(e.t)),
      'the how-to says what “paper” means',
    );
    // each marker's ×1/×2 box once, however many rows it has
    const keyN = await page.evaluate(
      () => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
    );
    assert.equal(T.filter((t) => t === '×1').length, keyN);
    assert.ok(r.n >= 2);
    // A5: a column a page, more pages, the same rows
    await page.click('[data-paper="a5"]');
    await idle(page);
    const a5 = await strip(page);
    assert.ok(a5.n > r.n, `A5 ${a5.n} pages, Letter ${r.n}`);
    assert.equal(await page.evaluate(() => __mstest.buildPDFPages(true)), a5.n);
    const rowsA5 = a5.texts
        .filter((e) => /^\d+[ab]?$/.test(e.t))
        .map((e) => e.t)
        .sort(),
      rowsL = r.texts
        .filter((e) => /^\d+[ab]?$/.test(e.t))
        .map((e) => e.t)
        .sort();
    assert.deepEqual(rowsA5, rowsL, 'the same rows');
    // a marker's rows (4a, 4b) stay together, in one column of one page
    const where = {};
    for (const e of a5.texts.filter((e) => /^\d+[ab]$/.test(e.t)))
      (where[parseInt(e.t)] = where[parseInt(e.t)] || new Set()).add(e.p + ':' + Math.round(e.x));
    for (const n in where) assert.equal(where[n].size, 1, 'row ' + n + '’s lines together');
    assert.ok(a5.texts.some((e) => e.t === 'Page ' + a5.n + ' of ' + a5.n));
    // a zone left flat: its rows say so, when no other zone shades the marker
    await closePrint(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await idle(page);
    await page.click('#sfZoneShade');
    await idle(page);
    await sharePrint(page);
    const fl = await strip(page);
    assert.ok(!fl.texts.some((e) => e.t === 'in Top'), 'a flat zone has no tones of its own');
    assert.deepEqual(errors, []);
  });
  test('Test strip with blend companions (no shading): lighter, the colour and darker in the long box, only markers you own', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await sharePrint(page);
    await page.click('[data-pwhat="strip"]');
    await idle(page);
    const flat = await strip(page);
    await page.check('#sfPdfBlend');
    await idle(page);
    const r = await strip(page);
    assert.ok(r.n >= flat.n);
    const own = await page.evaluate(() => {
      const t = __mstest,
        ks = new Set(t.coll.map((m) => m.mkey));
      return [...ks].map((k) => k.split('|')[1]);
    });
    const named = r.texts.map((e) => e.t).filter((t) => /^[A-Z]+\d+$/.test(t));
    assert.ok(named.length > 0);
    for (const c of named) assert.ok(own.includes(c), c + ' is owned');
    assert.ok(r.texts.some((e) => /the lighter marker on the left/.test(e.t)));
    await page.uncheck('#sfPdfBlend');
    assert.deepEqual(errors, []);
  });
}

// ---- from v304-export.test.mjs ----
// v304 (print and export): Save image places its codes as the PDF does (none over another, as small as 6 px, the rest
// left off with a line saying so) and lays its key out in 2-4 columns (6 of codes alone past 150 markers), and comes
// back from an error instead of staying on Preparing…; the test strip's pages are drawn one at a time on the paper the
// PDF was started on; a PDF can be made where the browser can't compress; a Print sheet opened again while a PDF is
// still being written says so; the colour card stays under iPad Safari's canvas limit; a second share while one is open
// is left alone; a download's file stays there for a minute; the PDF's zone outlines are filled on a stack that holds
// each pixel once.
{
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const sharePrint = async (page) => {
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await idle(page);
  };
  // every text the saved image draws: where, how big, on which canvas (the picture's, or the image's)
  const imageTexts = (page, noCodes) =>
    page.evaluate((noCodes) => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        log = [];
      P.fillText = function (t, x, y) {
        log.push({ t: String(t), x, y, fs: parseFloat(/(\d+(\.\d+)?)px/.exec(this.font)[1]) });
        return of.apply(this, arguments);
      };
      let c;
      try {
        c = __mstest.buildExportCanvas(false, noCodes);
      } finally {
        P.fillText = of;
      }
      return {
        log,
        w: c.width,
        h: c.height,
        W: __mstest.W,
        H: __mstest.H,
        pl: __mstest.exPlaced && JSON.parse(JSON.stringify(__mstest.exPlaced)),
      };
    }, noCodes);
  // the open guide's sections given n different markers (both brands), as a big collection would
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
  test('Save image: codes placed as on the PDF, none over another and none under 10 px (v308); the rest a dot, said under the brand; Codes off draws none', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const r = await imageTexts(page, false);
    assert.ok(r.pl, 'the placing is kept');
    const b = r.pl.boxes;
    let over = 0;
    for (let i = 0; i < b.length; i++)
      for (let j = i + 1; j < b.length; j++)
        if (b[i][0] < b[j][2] && b[j][0] < b[i][2] && b[i][1] < b[j][3] && b[j][1] < b[i][3]) over++;
    assert.equal(over, 0, 'no two codes overlap (v303: 150 of the 166 did)');
    const codes = r.log.filter((e) => e.y < r.H);
    assert.equal(codes.length, b.length, 'one code per box placed');
    // (v308: none under 10 px on the image as saved, the sample saved full size; codes of 6-8 px couldn't be read)
    assert.ok(
      codes.every((e) => e.fs >= 10),
      'none smaller than 10 px',
    );
    assert.ok(
      r.pl.dropped.length > 0 && r.pl.dropped.length < 70,
      'a few sections too small: ' + r.pl.dropped.length,
    );
    assert.equal(
      codes.length + r.pl.dropped.length,
      await page.evaluate(() => Object.keys(__mstest.assignData.assign).length),
    );
    const nt = r.log.filter((e) =>
      /^A dot marks each small section: see the guide or the PDF’s close-ups\.$/.test(e.t),
    );
    assert.equal(nt.length, 1, 'the line under the brand');
    const brand = r.log.find((e) => /Ohuhu markers/.test(e.t));
    assert.ok(nt[0].y > brand.y, 'under the brand line');
    // Codes off: no codes and no line about them
    const off = await imageTexts(page, true);
    assert.equal(off.log.filter((e) => e.y < off.H).length, 0, 'no codes');
    assert.ok(!off.log.some((e) => /small section/.test(e.t)));
    assert.ok(off.h < r.h, 'the image a line shorter');
    assert.deepEqual(errors, []);
  });
  test('Save image key: 2 columns on a narrow picture, 3, 4 when 3 would be taller than 60% of the picture, and past 150 markers 6 of codes alone', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
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
    await welcome(p2, 'look');
    await idle(p2);
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
    const { page, errors } = await openApp({
      init: () => {
        const gc = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (t, o) {
          return window.__lim && this.width * this.height > window.__lim ? null : gc.call(this, t, o);
        };
      },
    });
    await sampleGuide(page);
    await idle(page);
    let n = 0;
    page.on('download', () => n++);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    await page.evaluate(() => {
      window.__lim = __mstest.W * __mstest.H;
    });
    await page.click('#sfExport');
    await page.waitForFunction(() => !document.getElementById('sfExport').disabled, null, { timeout: 5000 });
    assert.match(await page.textContent('#sfExport'), /Save image/);
    assert.equal(n, 0);
    await page.evaluate(() => {
      window.__lim = 0;
    });
    await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#sfExport')]);
    assert.deepEqual(errors, []);
  });
  test('Test strip PDF: pages drawn one at a time, on the paper it was started on even if Paper is changed meanwhile', async () => {
    // (each page's compressing slowed, so Paper is tapped while the PDF is being written)
    const { page, errors } = await openApp({
      init: () => {
        const ab = Response.prototype.arrayBuffer;
        Response.prototype.arrayBuffer = function () {
          return new Promise((r) => setTimeout(r, Number(window.__slow || 0))).then(() => ab.call(this));
        };
      },
    });
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await sharePrint(page);
    await page.click('[data-paper="a5"]');
    await idle(page);
    await page.click('[data-pwhat="strip"]');
    await idle(page);
    const lazy = await page.evaluate(() => {
      const p = __mstest.buildPDFPages(false, true);
      return p.map((x) => typeof x);
    });
    assert.ok(lazy.length >= 2 && lazy.every((t) => t === 'function'), 'functions, one per page: ' + lazy);
    await page.evaluate(() => {
      window.__slow = 400;
    });
    const dlP = page.waitForEvent('download', { timeout: 30000 });
    await page.click('#sfPDF');
    await page.waitForTimeout(200); // (while the first page is being compressed)
    await page.click('[data-paper="letter"]');
    const dl = await dlP;
    const txt = Buffer.from(await (await import('node:fs/promises')).readFile(await dl.path())).toString(
      'latin1',
    );
    const boxes = [...txt.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => m[1] + 'x' + m[2]),
      imgs = [...txt.matchAll(/\/Width (\d+) \/Height (\d+)/g)].map((m) => m[1] + 'x' + m[2]);
    assert.ok(
      boxes.length >= 2 && new Set(boxes).size === 1 && boxes[0] === '419.53x595.28',
      'A5 pages: ' + boxes,
    );
    assert.ok(new Set(imgs).size === 1, 'every page drawn at one size: ' + imgs);
    assert.deepEqual(errors, []);
  });
  test('PDF where the browser can’t compress (Safari before 16.4): the pages stored as they are', async () => {
    const { page, errors } = await openApp({
      init: () => {
        delete window.CompressionStream;
      },
    });
    await sampleGuide(page);
    await idle(page);
    await sharePrint(page);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#sfPDF')]);
    const buf = await (await import('node:fs/promises')).readFile(await dl.path()),
      txt = buf.toString('latin1');
    assert.match(txt.slice(0, 8), /^%PDF-1\.4/);
    assert.ok(!/FlateDecode/.test(txt));
    const m =
      /\/Width (\d+) \/Height (\d+) \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Length (\d+)/.exec(txt);
    assert.ok(m && +m[3] === m[1] * m[2] * 3, 'a page’s pixels as they are');
    assert.match(txt.slice(-6), /%%EOF$/);
    assert.deepEqual(errors, []);
  });
  test('Print sheet closed and opened again while its PDF is written: the button says which page it is on until it is done, and one PDF comes', async () => {
    // (v307.1: the pages are packed in the worker since v307, so slowing the page's own compression no longer held the
    // PDF up, and on WebKit it was done before the sheet was open again: the worker's page jobs are held here instead.
    // The button of the sheet opened again says the page, "Page 2 of 4…", as the sheet it was started from does; it
    // said "Preparing…" before v307)
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    let n = 0;
    page.on('download', () => n++);
    await sharePrint(page);
    const label = await page.textContent('#sfPDF');
    await page.evaluate(() => {
      const J = __mstest.jobs,
        run = J.run;
      window.__held = 0;
      window.__go = new Promise((r) => {
        window.__release = r;
      });
      J.run = function (k, d, t) {
        if (k !== 'pdf') return run.call(J, k, d, t);
        window.__held++;
        return window.__go.then(() => run.call(J, k, d, t));
      };
    });
    await page.click('#sfPDF');
    await page.waitForFunction(() => window.__held >= 1);
    await page.click('#sfSheet [data-pr="cancel"]');
    await page.waitForSelector('#sfSheet', { state: 'detached' });
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    assert.match(await page.textContent('#sfPDF'), /^Page [12] of [2-9]…$/);
    assert.equal(await page.isDisabled('#sfPDF'), true);
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => !document.getElementById('sfPDF').disabled, null, { timeout: 30000 });
    assert.equal(await page.textContent('#sfPDF'), label, 'back as it was');
    await page.waitForTimeout(300);
    assert.equal(n, 1);
    assert.deepEqual(errors, []);
  });
  test('the colour card stays under 16 million pixels with every marker on it', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    const r = await page.evaluate(async () => {
      const url = await makeCard(
          COLORS.map((_, i) => i),
          'random',
        ),
        im = new Image();
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
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.reject(new DOMException('already sharing', 'InvalidStateError')),
      });
    });
    const r = await page.evaluate(() =>
      handOver(new Blob(['x'], { type: 'text/plain' }), 'x.txt', { title: 'X' }),
    );
    assert.equal(r, 'cancel');
    await page.waitForTimeout(300);
    assert.equal(n, 0);
    const waits = await page.evaluate(() => {
      const st = window.setTimeout,
        d = [];
      window.setTimeout = function (f, ms) {
        d.push(ms);
        return st.apply(this, arguments);
      };
      try {
        downloadBlob(new Blob(['x']), 'y.txt');
      } finally {
        window.setTimeout = st;
      }
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
    await welcome(page, 'look');
    await idle(page);
    // line art drawn here: a 12 × 12 grid with a ring in each cell, 2400 px square
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas'),
        N = 2400,
        s = N / 12;
      c.width = c.height = N;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, N, N);
      g.strokeStyle = '#000';
      g.lineWidth = 7;
      for (let i = 0; i <= 12; i++) {
        g.beginPath();
        g.moveTo(i * s, 0);
        g.lineTo(i * s, N);
        g.moveTo(0, i * s);
        g.lineTo(N, i * s);
        g.stroke();
      }
      for (let y = 0; y < 12; y++)
        for (let x = 0; x < 12; x++) {
          g.beginPath();
          g.arc(x * s + s / 2, y * s + s / 2, s * 0.3, 0, 6.283);
          g.stroke();
        }
      return c.toDataURL('image/png');
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({
      name: 'grid-2400.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png.split(',')[1], 'base64'),
    });
    const first = await Promise.race([
      page.waitForSelector('#sfBuild', { state: 'visible', timeout: 120000 }).then(() => 'build'),
      page.waitForSelector('#sfPgGo', { state: 'visible', timeout: 120000 }).then(() => 'corners'),
    ]);
    if (first === 'corners') {
      await page.click('#sfPgGo');
      await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 120000 });
    }
    await idle(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 120000,
    });
    await idle(page);
    assert.ok(Math.max(...(await page.evaluate(() => [__mstest.W, __mstest.H]))) >= 2300, 'a big picture');
    // shading, and two zones (top and bottom thirds) shaded differently from Main
    const selectVal = (id, v) =>
      page.evaluate(
        ([id, v]) => {
          const el = document.getElementById(id);
          el.value = v;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        },
        [id, v],
      );
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await selectVal('sfShStyle', 'grey');
    await idle(page);
    for (const [name, lo, hi] of [
      ['Top', 0, 0.34],
      ['Bottom', 0.66, 1],
    ]) {
      await page.click('.sftabbtn[data-t="pattern"]');
      await idle(page);
      // (＋ Zone on its own line until there is one; then a chip after the zones')
      if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
      else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
      await idle(page);
      await page.fill('#sfZoneName', name);
      await page.press('#sfZoneName', 'Enter');
      await page.evaluate(
        ([lo, hi]) => {
          const t = __mstest,
            cl = Object.keys(t.assignData.assign)
              .map(Number)
              .filter((l) => t.comps[l].cy >= t.H * lo && t.comps[l].cy < t.H * hi);
          t.zoneMove(cl, t.zoneCur);
          t.reassign([0, t.zoneCur]);
        },
        [lo, hi],
      );
      await page.click('#sfZoneDone');
      await idle(page);
      await page.click('.sftabbtn[data-t="shading"]');
      await idle(page);
      await selectVal('sfShStyle', 'cool');
      await idle(page);
    }
    const r = await page.evaluate(() => {
      const T = __mstest,
        W = T.W,
        H = T.H,
        n = W * H,
        P = CanvasRenderingContext2D.prototype,
        put = P.putImageData,
        push = Array.prototype.push;
      let pushes = 0;
      const cands = [];
      // (the outlines' own layer: picture-sized, see-through but for the outlines)
      P.putImageData = function (im) {
        if (im.width === W && im.height === H) {
          let see = false;
          for (let q = 0; q < n && !see; q += 997) see = im.data[q * 4 + 3] === 0;
          if (see) cands.push(new Uint8ClampedArray(im.data));
        }
        return put.apply(this, arguments);
      };
      Array.prototype.push = function () {
        pushes += arguments.length;
        return push.apply(this, arguments);
      };
      const t0 = performance.now();
      try {
        T.buildPDFPages(false).forEach((c) => {
          c.width = 0;
        });
      } finally {
        P.putImageData = put;
        Array.prototype.push = push;
      }
      const ms = performance.now() - t0;
      // (the layer in the zones' colours: the first two of the PDF's, #d4145a and #1f6fd1; other see-through layers are
      // the shading's marks)
      const ZC = ['212,20,90', '31,111,209'],
        ov = cands.find((d) => {
          let k = 0;
          for (let q = 0; q < n; q++)
            if (d[q * 4 + 3]) {
              if (!ZC.includes(d[q * 4] + ',' + d[q * 4 + 1] + ',' + d[q * 4 + 2])) return false;
              k++;
            }
          return k > 0;
        });
      if (!ov) return { ms, pushes, ov: false, layers: cands.length };
      // the reference: each zone closed over its lines, filled from the edge (a plain flood, queue), its rim t px thick
      const dil = (M, r) => {
        const T2 = new Uint8Array(n),
          O = new Uint8Array(n);
        for (let y = 0; y < H; y++) {
          let c = 0;
          const ro = y * W;
          for (let x = -r; x < W; x++) {
            if (x + r < W) c += M[ro + x + r];
            if (x - r - 1 >= 0) c -= M[ro + x - r - 1];
            if (x >= 0) T2[ro + x] = c > 0 ? 1 : 0;
          }
        }
        for (let x = 0; x < W; x++) {
          let c = 0;
          for (let y = -r; y < H; y++) {
            if (y + r < H) c += T2[(y + r) * W + x];
            if (y - r - 1 >= 0) c -= T2[(y - r - 1) * W + x];
            if (y >= 0) O[y * W + x] = c > 0 ? 1 : 0;
          }
        }
        return O;
      };
      const r1 = Math.max(2, Math.round(Math.max(W, H) / 160)),
        ids = [...new Set(Object.keys(T.assignData.assign).map((l) => T.zoneOf(+l)))].filter((id) => +id);
      const outside = [];
      ids.forEach((id) => {
        const M = new Uint8Array(n);
        for (let q = 0; q < n; q++) {
          const l = T.labels[q];
          if (l > 0 && T.zoneOf(l) === id) M[q] = 1;
        }
        const D = dil(M, r1),
          inv = new Uint8Array(n);
        for (let q = 0; q < n; q++) inv[q] = D[q] ? 0 : 1;
        const E = dil(inv, r1),
          out = new Uint8Array(n),
          qu = new Int32Array(n);
        for (let q = 0; q < n; q++) E[q] = E[q] ? 0 : 1;
        let a = 0,
          b = 0;
        const go = (q) => {
          if (!out[q] && !E[q]) {
            out[q] = 1;
            qu[b++] = q;
          }
        };
        for (let x = 0; x < W; x++) {
          go(x);
          go((H - 1) * W + x);
        }
        for (let y = 0; y < H; y++) {
          go(y * W);
          go(y * W + W - 1);
        }
        while (a < b) {
          const q = qu[a++],
            x = q % W;
          if (x > 0) go(q - 1);
          if (x < W - 1) go(q + 1);
          if (q >= W) go(q - W);
          if (q < n - W) go(q + W);
        }
        outside.push(out);
      });
      // the rim's thickness depends on the page's scale: the one that gives the drawn outline
      let best = null;
      const tried = [];
      for (let t = 1; t <= 12 && !best; t++) {
        let diff = 0,
          drawn = 0;
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
      for (let q = 0; q < n; q++)
        if (ov[q * 4 + 3]) cols.add(ov[q * 4] + ',' + ov[q * 4 + 1] + ',' + ov[q * 4 + 2]);
      return { ms, pushes, ov: true, zones: ids.length, best, tried, cols: cols.size, W, H };
    });
    assert.ok(r.ov, 'the zone outlines were drawn');
    assert.equal(r.zones, 2);
    assert.ok(
      r.best,
      'the outline is exactly the reference flood’s, for one rim thickness: ' + JSON.stringify(r),
    );
    assert.ok(r.best.drawn > 2000, 'outline pixels: ' + (r.best && r.best.drawn));
    assert.equal(r.cols, 2, 'a colour per zone');
    assert.ok(
      r.pushes < 1e6,
      'no list of millions while it is built (v303: one entry for every neighbour): ' + r.pushes,
    );
    assert.ok(r.ms < 60000, 'built in ' + Math.round(r.ms) + ' ms');
    assert.deepEqual(errors, []);
  });
}

// ---- from v307-speed.test.mjs ----
// v307 speed work, in the browser: the PDF is drawn a page at a time and packed in the worker, Save image and a new
// guide's section map are encoded there, label points are worked out there and kept for the session, Continue paints
// once, and Home decodes its pictures before drawing them. Each gives exactly what the page gives doing it all itself.
{
  const sharePrint = async (page) => {
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await idle(page);
  };
  // the PDF as the page writes it with everything drawn first and packed here (no worker): what v306 did
  const pdfHere = (page) =>
    page.evaluate(async () => {
      const t = __mstest,
        P = { letter: [612, 792], a4: [595.28, 841.89] }[localStorage.getItem('ms-paper') || 'letter'] || [
          612, 792,
        ];
      // (v318.35: the pages carrying the picture in colour tried as JPEG, as exportPDF does)
      const cvs = t.buildPDFPages(false, false),
        kinds = t.pdfKinds.slice();
      const u8 = await t.canvasesToPDF(cvs, P[0], P[1], false, null, (i) => !!(kinds[i] && kinds[i].col));
      return Array.from(u8);
    });
  const stats = (page) => page.evaluate(() => JSON.parse(JSON.stringify(__mstest.jobs.stats)));
  // a downloaded PNG's pixels, as a hash
  const pngHash = (page, buf) =>
    page.evaluate(async (b64) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
        bm = await createImageBitmap(new Blob([bin], { type: 'image/png' }));
      const c = document.createElement('canvas');
      c.width = bm.width;
      c.height = bm.height;
      const g = c.getContext('2d');
      g.drawImage(bm, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let a = 2166136261 | 0;
      for (let i = 0; i < d.length; i++) a = Math.imul(a ^ d[i], 16777619);
      return c.width + 'x' + c.height + ':' + a;
    }, buf.toString('base64'));
  test('the PDF is drawn a page at a time ("Page 2 of 3…"), packed in the worker, and is the same file byte for byte', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await welcome(page, 'look');
    await letterGuide(page);
    // with shading too: tone lines and H/S marks on page 1, the coloured picture on the key
    for (const shade of [false, true]) {
      if (shade) {
        await page.click('.sftabbtn[data-t="shading"]');
        await page.evaluate(() => __mstest.shadeTo('full'));
        await idle(page);
      }
      await sharePrint(page);
      await page.evaluate(() => {
        // the button's words as the PDF is written, and how many whole pages are drawn at once
        const f = (window.__pg = { txt: [], live: 0, most: 0 }),
          b = () => document.getElementById('sfPDF');
        new MutationObserver(() => {
          const t = b() && b().textContent;
          if (t && f.txt[f.txt.length - 1] !== t) f.txt.push(t);
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
        const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
        Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
          configurable: true,
          get() {
            return d.get.call(this);
          },
          set(v) {
            const was = d.get.call(this) === 1700;
            d.set.call(this, v);
            const is = v === 1700;
            if (is && !was) {
              f.live++;
              f.most = Math.max(f.most, f.live);
            } else if (was && !is) f.live--;
          },
        });
        window.__pgUndo = () => Object.defineProperty(HTMLCanvasElement.prototype, 'width', d);
      });
      const s0 = await stats(page);
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        page.click('#sfPDF'),
      ]);
      const got = await readFile(await dl.path());
      await idle(page);
      const pg = await page.evaluate(() => {
        __pgUndo();
        return window.__pg;
      });
      const n = await page.evaluate(() => __mstest.buildPDFPages(true));
      assert.ok(n >= 2, 'more than one page');
      for (let i = 2; i <= n; i++)
        assert.ok(
          pg.txt.includes(`Page ${i} of ${n}…`),
          `"Page ${i} of ${n}…" shown (${pg.txt.join(' | ')})`,
        );
      assert.ok(
        pg.most <= 2 && pg.most < n,
        `a page’s canvas at a time (and the one before, until its pixels are packed): ${pg.most} of ${n}`,
      );
      assert.equal(await page.textContent('#sfPDF'), 'Download PDF', 'the button back as it was');
      const s1 = await stats(page);
      assert.equal((s1.done.pdf || 0) - (s0.done.pdf || 0), n, 'each page packed in the worker');
      await page.click('#sfSheet [data-pr="cancel"]');
      await idle(page);
      // the same bytes as drawn all at once and packed here, without a worker
      await page.evaluate(() => __mstest.jobs.off());
      const ref = Buffer.from(await pdfHere(page));
      await page.evaluate(() => __mstest.jobs.off(false));
      assert.equal(got.length, ref.length, (shade ? 'shaded: ' : '') + 'same size');
      assert.ok(got.equals(ref), (shade ? 'shaded: ' : '') + 'same bytes');
    }
    assert.deepEqual(errors, []);
  });
  test('Save image is encoded in the worker, with the same pixels; a new guide’s section map is encoded there before its first save, the same file', async () => {
    // (v307.1: the first save waits for the worker only while the Build bloom shows, so this test has the bloom; with
    // none it's saved at once, encoded on the page: v307-hotfix)
    const { page, errors } = await openApp({
      width: 1180,
      height: 820,
      init: () => {
        window.__MS_BLOOM = true;
      },
    });
    await welcome(page, 'look');
    await letterGuide(page);
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    // the first save after Build: its section map from the worker, the file the page makes itself
    assert.ok((await stats(page)).done.lmap >= 1, 'section map encoded in the worker');
    assert.equal(
      await page.evaluate(() => __mstest.lmapKept === __mstest.lmapHere()),
      true,
      'the same file as encoded here',
    );
    const saved = await page.evaluate(() =>
      sfLoadDesign(__mstest.curId).then((d) => d.lmap === __mstest.lmapHere()),
    );
    assert.equal(saved, true, 'and the one saved');
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    let [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.click('#sfExport'),
    ]);
    const a = await pngHash(page, await readFile(await dl.path()));
    await idle(page);
    assert.ok((await stats(page)).done.png >= 1, 'encoded in the worker');
    // the same picture encoded here, with no worker
    await page.evaluate(() => __mstest.jobs.off());
    [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfExport')]);
    const b = await pngHash(page, await readFile(await dl.path()));
    await idle(page);
    assert.equal(a, b, 'the same pixels');
    assert.deepEqual(errors, []);
  });
  test('opening a guide: label points from the worker, kept for the session, the same as worked out here; the guide opens as saved', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await saveGuide(page);
    const sampleId = await page.evaluate(() => __mstest.curId);
    await letterGuide(page);
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    const id = await page.evaluate(() => __mstest.curId);
    const look = () =>
      page.evaluate(() => {
        const t = __mstest,
          d = t.currentDesignObj();
        return {
          pts: JSON.stringify(t.labelPts),
          assign: JSON.stringify(d.payload.assign),
          lmap: d.payload.lmap,
          n: t.assignData.order.length,
          mk: [...new Set(Object.values(t.assignData.assign).map((m) => m.mkey))].sort().join(),
        };
      });
    const before = await look();
    // after a reload (nothing kept), opened from the Library: worked out in the worker
    await page.reload();
    await idle(page);
    let s0 = await stats(page);
    await page.evaluate((id) => SF.openDesign(id), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    let s1 = await stats(page);
    assert.equal((s1.done.lpts || 0) - (s0.done.lpts || 0), 1, 'worked out in the worker');
    const opened = await look();
    assert.deepEqual(opened, before, 'the same label points, markers and section map as when it was saved');
    // worked out here instead: the same
    assert.equal(
      await page.evaluate(() => {
        const t = __mstest,
          k = JSON.stringify(t.labelPts);
        return JSON.stringify(t.labelPtsCore(t.labels, t.W, t.H, t.comps.length).lp) === k;
      }),
      true,
    );
    // another guide, then this one again: kept, not worked out again
    await page.evaluate((id) => SF.openDesign(id), sampleId);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, sampleId);
    await idle(page);
    s0 = await stats(page);
    await page.evaluate((id) => SF.openDesign(id), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    s1 = await stats(page);
    assert.equal(s1.done.lpts || 0, s0.done.lpts || 0, 'kept for the session');
    assert.deepEqual(await look(), before);
    assert.deepEqual(errors, []);
  });
  test('Home’s Continue paints the picture once; Home decodes the pictures before drawing them', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    await letterGuide(page);
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    await page.click('#mSections');
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order;
      o.slice(0, 7).forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.updateProgress();
      t.renderGuide();
    });
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    await page.click('#sfDoneBtn');
    await idle(page);
    // a fresh start, so Home draws its pictures and Continue opens the guide from the Library
    await page.addInitScript(() => {
      const o = HTMLImageElement.prototype.decode;
      window.__dec = 0;
      HTMLImageElement.prototype.decode = function () {
        window.__dec++;
        return o.apply(this, arguments);
      };
    });
    await page.reload();
    await idle(page);
    await page.click('#mHome');
    await page.waitForSelector('#homeCont img');
    await idle(page);
    assert.ok((await page.evaluate(() => window.__dec)) >= 1, 'decoded before drawing');
    await page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        o = P.putImageData;
      window.__full = 0;
      P.putImageData = function (im) {
        if (
          this.canvas.id === 'sfCanvas' &&
          im.width === this.canvas.width &&
          im.height === this.canvas.height
        )
          __full++;
        return o.apply(this, arguments);
      };
    });
    await page.click('#homeCont .hccard');
    await page.waitForFunction(() => __mstest.sfmode === 'color');
    await idle(page);
    assert.equal(await page.evaluate(() => window.__full), 1, 'one full paint');
    assert.deepEqual(errors, []);
  });
}

// ---- from v308-output.test.mjs ----
// v308 (output): the PDF key's reference sized to the room left, its table going on to a "continued" page, and Key +
// reference on one page; one number column in colouring order when Numbers are printed; the shading's sun clear of the
// labels; small sections left with only a dot given a number after all; Save image's least code size, with dots below
// it. Colouring: Focus mode's + and − about the section it's on, its keyboard ring, the Page finished panel in view
// after finishing there, Escape leaving Colour along as Back does, Reveal from Colour along going back there, the
// screen-on note in the tool row. Dialogs: Tab stays in Help and Scan. The Print sheet's choices not taken look
// pressable.
{
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
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
  };
  const over = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
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
    // (a Letter page: v307 put 16 markers' key on two pages, as on Ben's page; v318.1: with no labels, as with labels
    // page 1 is the labelled picture)
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await letterGuide(page);
    await opt(page, { pwhat: 'ref', plabels: 'none', paper: 'letter', blend: false });
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
    assert.ok(
      !onKey.some((e) => e.t === 'ORDER' || /^\d+(st|nd|rd|th)$/.test(e.t)),
      'no second, ORDER column',
    );
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
      // (v308 run: the app places the panel again once the pinned picture has settled, 260 ms on)
      await page.waitForTimeout(450);
      await idle(page);
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
    await page.click('#sfDoneRev');
    await page.waitForSelector('#sfRoot.sfrev');
    await page.click('#sfRevX');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
    assert.ok(await page.isVisible('#sfDone'), 'the Page finished panel');
    // and with Escape
    await page.click('#sfDoneRev');
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
    // (once the sheet's buttons have finished their colour change: read mid-way, a colour came back 0.99 opaque, v308.1 run)
    await page.waitForFunction(() =>
      [...document.querySelectorAll('#sfSheet [data-plabels]')].every(
        (e) => !e.getAnimations().some((a) => a.playState === 'running'),
      ),
    );
    // (v316: and until the choice not taken has its ink, up to 2 s: WebKit doesn't always list its 0.2 s colour change
    // as running, and read mid-way it came back 0.52–0.77 opaque on GitHub; one that stays faded times out here)
    await page
      .waitForFunction(
        () => {
          const on = document.querySelector('#sfSheet [data-plabels].on'),
            off = document.querySelector('#sfSheet [data-plabels]:not(.on):not(:disabled)');
          return getComputedStyle(off).color === getComputedStyle(on).color;
        },
        null,
        { timeout: 2000 },
      )
      .catch(() => {});
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
}
