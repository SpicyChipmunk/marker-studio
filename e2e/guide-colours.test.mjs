// A guide’s colours: Mood, Colours from, filters, Change colour, pins, Paint, brand letters.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  ENGINE,
  ROOT,
  WK,
  addFromMarkers,
  answerAsks,
  buildGo,
  clearCollection,
  fitPicture,
  idle,
  letterGuide,
  notOnWebKit,
  openApp,
  openAtScale,
  sampleGuide,
  saveGuide,
  scanFromMarkers,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from brand-letters.test.mjs ----
// Brand letters: on screen they follow your collection and the view (one brand owned: letters only where a view mixes
// brands; both brands owned, or none yet: letters everywhere), while exports go by what they hold (one brand is named
// once, mixed brands keep the letters and the key).
{
  // ---- From v265 ----
  // V265_SHOTS=<dir> also saves the screenshots looked at by hand (Markers Owned / All, Match, the PDF's first page)
  const SHOTS = process.env.V265_SHOTS || '';
  const snap = async (page, name) => {
    if (SHOTS) {
      await mkdir(SHOTS, { recursive: true });
      await page.screenshot({ path: SHOTS + '/' + name + '.png' });
    }
  };
  const letters = (page, sel) =>
    page.$$eval(sel, (els) => els.filter((e) => e.offsetParent).map((e) => e.textContent));
  // every text drawn on the PDF's pages (page number and text)
  const pdfTexts = (page) =>
    page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        log = [];
      P.fillText = function (t) {
        log.push({ cv: this.canvas, t: String(t) });
        return of.apply(this, arguments);
      };
      let cvs;
      try {
        cvs = __mstest.buildPDFPages();
      } finally {
        P.fillText = of;
      }
      window.__pdf0 = cvs[0].toDataURL('image/png');
      return log.filter((e) => cvs.indexOf(e.cv) >= 0).map((e) => ({ p: cvs.indexOf(e.cv), t: e.t }));
    });
  const canvasTexts = (page, fn) =>
    page.evaluate((fn) => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        log = [];
      P.fillText = function (t) {
        log.push(String(t));
        return of.apply(this, arguments);
      };
      try {
        __mstest[fn]();
      } finally {
        P.fillText = of;
      }
      return log;
    }, fn);
  // ---- From v267 ----
  // V267_SHOTS=<dir> also saves the screenshots looked at by hand
  const SHOTS_V267 = process.env.V267_SHOTS || '';
  const snapV267 = async (page, name) => {
    if (SHOTS_V267) {
      await mkdir(SHOTS_V267, { recursive: true });
      await page.screenshot({ path: SHOTS_V267 + '/' + name + '.png' });
    }
  };
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v266',
    ...extra,
  });
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: [],
      saved: [],
      ...extra,
    });
  const guideBrands = (page) =>
    page.evaluate(() => [...new Set(Object.values(__mstest.assignData.assign).map((m) => m.brand))]);
  // some Copic markers into an Ohuhu collection (the guide already made keeps its Ohuhu markers)
  const ownCopic = (page, n = 12) =>
    page.evaluate((n) => {
      let k = 0;
      COLORS.forEach((c, i) => {
        if (c.brand === 'Copic' && k < n) {
          state.owned.add(mkey(i));
          k++;
        }
      });
      save();
      if (window.SF) SF.setCollection(sfCollection());
    }, n);
  // every text drawn on the guide's picture in a full redraw (a code label's brand letter is drawn on its own)
  const pictureTexts = (page) =>
    page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        cv = document.getElementById('sfCanvas'),
        log = [];
      P.fillText = function (t) {
        if (this.canvas === cv) log.push(String(t));
        return of.apply(this, arguments);
      };
      try {
        __mstest.forceFullRender();
        __mstest.renderGuide();
      } finally {
        P.fillText = of;
      }
      return log;
    });
  const pdfTextsOnly = (page) =>
    page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        log = [];
      P.fillText = function (t) {
        log.push({ cv: this.canvas, t: String(t) });
        return of.apply(this, arguments);
      };
      let cvs;
      try {
        cvs = __mstest.buildPDFPages();
      } finally {
        P.fillText = of;
      }
      return log.filter((e) => cvs.indexOf(e.cv) >= 0).map((e) => ({ p: cvs.indexOf(e.cv), t: e.t }));
    });
  // Match a colour: the rows, how many carry a letter, and whether they mix brands
  async function matchRows(page, hex) {
    await page.fill('#matchHex', hex);
    await idle(page);
    // (v304: another brand's row under "Closer in Copic" names its brand in full, with no letter: left out here)
    return page.evaluate(() => {
      const rows = [...document.querySelectorAll('#matchResult .mrow')].filter(
        (x) => !/^(Ohuhu|Copic) /.test(x.querySelector('.mnm b').textContent),
      );
      return {
        n: rows.length,
        tags: document.querySelectorAll('#matchResult .mtag').length,
        mixed: new Set(rows.map((x) => x.getAttribute('data-copy').split(' ')[0])).size > 1,
      };
    });
  }
  const HEXES = ['#0bd6c8', '#e03c31', '#f2c14e', '#6b4f9e', '#9a9a9a', '#2e7d32'];
  async function markersView(page, v) {
    await page.click('#mCollection');
    await idle(page);
    await page.click(`#ownView [data-v="${v}"]`);
    await idle(page);
  }
  async function drawPalette(page) {
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page);
  }
  // ---- Brand tags on the picture (decision #7) ----
  // every tag drawn: its box's fill colour and the letter in it, in order (a tag's box is the path drawn with arcTo
  // just before its letter). what: 'screen' (the guide's picture), 'pdf' or 'image' (the saved image)
  const tagsOf = (page, what) =>
    page.evaluate((what) => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fill,
        oa = P.arcTo,
        ot = P.fillText,
        log = [],
        cv = document.getElementById('sfCanvas');
      P.arcTo = function () {
        this.__tag = 1;
        return oa.apply(this, arguments);
      };
      P.fill = function () {
        if (this.__tag) {
          this.__tag = 0;
          this.__box = this.fillStyle;
        }
        return of.apply(this, arguments);
      };
      // (v316: the saved image's key swatches are rounded boxes too, each followed by its code and name; a tag's text is one letter)
      P.fillText = function (t) {
        if (this.__box && /^[A-Z]$/.test(String(t)))
          log.push({ box: this.__box, t: String(t), cv: this.canvas });
        this.__box = null;
        return ot.apply(this, arguments);
      };
      let cvs;
      try {
        if (what === 'screen') {
          cvs = [cv];
          __mstest.forceFullRender();
          __mstest.renderGuide();
        } else if (what === 'pdf') cvs = __mstest.buildPDFPages();
        else cvs = [__mstest.buildExportCanvas()];
      } finally {
        P.fill = of;
        P.arcTo = oa;
        P.fillText = ot;
      }
      return log
        .filter((e) => cvs.indexOf(e.cv) >= 0)
        .map((e) => (what === 'pdf' ? { box: e.box, t: e.t, p: cvs.indexOf(e.cv) } : { box: e.box, t: e.t }));
    }, what);
  const ownAllCopic = (page) =>
    page.evaluate(() => {
      COLORS.forEach((c, i) => {
        if (c.brand === 'Copic') state.owned.add(mkey(i));
      });
      save();
      SF.setCollection(sfCollection());
      __mstest.reassign();
    });
  test('brand letters: hidden in an Ohuhu-only Owned view, shown in All and Unowned, and in Match results that mix brands (another brand clearly closer is named in full)', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.click('#mCollection');
    await idle(page);
    await page.click('#ownView [data-v="owned"]');
    await idle(page);
    assert.ok((await page.locator('#results .cell').count()) > 50);
    assert.deepEqual(await letters(page, '#results .cell .bt'), [], 'one brand: no letters');
    assert.match(
      await page.getAttribute('#results .cell', 'aria-label'),
      /^Ohuhu /,
      'the label still names the brand',
    );
    await snap(page, 'c-markers-owned');
    await page.click('#ownView [data-v="all"]');
    await idle(page);
    const all = await letters(page, '#results .cell .bt');
    assert.ok(all.includes('O') && all.includes('C'), 'All mixes brands: letters');
    await snap(page, 'c-markers-all');
    await page.click('#ownView [data-v="unowned"]');
    await idle(page);
    assert.ok((await letters(page, '#results .cell .bt')).length > 0);
    // filtered to one brand, All has no letters either
    await page.click('#ownView [data-v="all"]');
    await idle(page);
    await page.evaluate(() => {
      fgTap('brand', 'Ohuhu');
      save();
      fullRender();
    });
    await idle(page);
    assert.deepEqual(await letters(page, '#results .cell .bt'), []);
    await page.evaluate(() => {
      fgClear('brand');
      save();
      fullRender();
    });
    await idle(page);
    // Match: letters on every row when the rows mix brands, on none when they don't
    await page.click('#mkMatchBtn');
    await page.click('.msrc [data-src="hex"]');
    let mixedSeen = false,
      singleSeen = false,
      otherSeen = false;
    for (const hex of [
      '#0bd6c8',
      '#e03c31',
      '#f2c14e',
      '#6b4f9e',
      '#9a9a9a',
      '#2e7d32',
      '#ff8fb1',
      '#3a7bd5',
    ]) {
      await page.fill('#matchHex', hex);
      await idle(page);
      // (v304: another brand's row under "Closer in Copic" names its brand in full and carries no letter; the letters
      // follow the other rows)
      const r = await page.evaluate(() => {
        const full = (x) => /^(Ohuhu|Copic) /.test(x.querySelector('.mnm b').textContent);
        if (
          [...document.querySelectorAll('#matchResult .mrow')].some(
            (x) => full(x) && x.querySelector('.mtag'),
          )
        )
          return { bad: 1 };
        const rows = [...document.querySelectorAll('#matchResult .mrow')].filter((x) => !full(x)),
          best = document.querySelector('#matchResult .mbbrand');
        const bs = new Set(rows.map((x) => x.getAttribute('data-copy').split(' ')[0]));
        if (best && /marker$/.test(best.textContent)) bs.add(best.textContent.split(' ')[0]);
        return {
          n: rows.length,
          tags: document.querySelectorAll('#matchResult .mtag').length,
          mixed: bs.size > 1,
          other: document.querySelectorAll('#matchResult .mrow').length - rows.length,
        };
      });
      assert.ok(!r.bad, hex + ': no letter on a row that names its brand');
      if (r.other) otherSeen = true;
      if (r.mixed) {
        mixedSeen = true;
        assert.equal(r.tags, r.n, hex + ': mixed → a letter on every row');
        if (SHOTS && !singleSeen) await snap(page, 'c-match');
      } else {
        singleSeen = true;
        assert.equal(r.tags, 0, hex + ': one brand → no letters');
      }
    }
    // (v304: an Ohuhu collection's rows are Ohuhu, yours and to buy; a Copic one clearly closer is named in full)
    assert.ok(otherSeen || mixedSeen, 'some result names another brand');
    await page.click('#matchClose');
    // Palette and Random with only Ohuhu markers: no letters
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page);
    assert.deepEqual((await letters(page, '#bands .band .bt')).filter(Boolean), []);
    assert.match(await page.getAttribute('#bands .band .bhit', 'aria-label'), /^Ohuhu /);
    assert.deepEqual(errors, []);
  });
  test('exports: one brand is named once in the headers (no letters); mixed brands keep the letters and the key', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    assert.deepEqual(
      await page.evaluate(() => [...new Set(Object.values(__mstest.assignData.assign).map((m) => m.brand))]),
      ['Ohuhu'],
    );
    let t = await pdfTexts(page);
    assert.ok(
      t.some((e) => e.p === 0 && /\d+ Ohuhu markers/.test(e.t)),
      'page 1 says the brand: ' +
        t
          .filter((e) => e.p === 0)
          .map((e) => e.t)
          .slice(0, 4),
    );
    // (the key's page: after any close-ups of small sections, v284)
    const kp = (t) => t.find((e) => e.t === 'Colour key')?.p ?? 1;
    assert.ok(
      t.some((e) => e.p === kp(t) && /· \d+ Ohuhu markers ·/.test(e.t)),
      'and the key page',
    );
    assert.ok(!t.some((e) => /= Copic|= Ohuhu/.test(e.t)), 'no letter key');
    assert.ok(!t.some((e) => e.p >= kp(t) && /^[OC]$/.test(e.t)), 'no letter column');
    if (SHOTS) {
      await mkdir(SHOTS, { recursive: true });
      const png = await page.evaluate(() => window.__pdf0);
      await writeFile(SHOTS + '/c-pdf-page1.png', Buffer.from(png.split(',')[1], 'base64'));
    }
    // the saved image and the share card
    let img = await canvasTexts(page, 'buildExportCanvas');
    assert.ok(
      img.includes('Ohuhu markers') &&
        !img.some((s) => /= Copic/.test(s)) &&
        !img.some((s) => /^O {2}/.test(s)),
    );
    let card = await canvasTexts(page, 'buildShareCard');
    // (v305: the card's line says "… 16 Ohuhu markers …", as Reveal's end does)
    assert.ok(card.some((s) => /\bOhuhu markers\b/.test(s)) && !card.includes('O'));
    // the same picture with Copic markers too
    await page.evaluate(() => {
      COLORS.forEach((c, i) => {
        if (c.brand === 'Copic') state.owned.add(mkey(i));
      });
      save();
      SF.setCollection(sfCollection());
      __mstest.reassign();
    });
    await idle(page);
    assert.equal(
      await page.evaluate(() => new Set(Object.values(__mstest.assignData.assign).map((m) => m.brand)).size),
      2,
      'the guide mixes brands now',
    );
    t = await pdfTexts(page);
    assert.ok(
      t.some((e) => e.p === kp(t) && /C = Copic {2}O = Ohuhu/.test(e.t)),
      'the key page has the letter key',
    );
    assert.ok(
      t.some((e) => e.p >= kp(t) && e.t === 'C') && t.some((e) => e.p >= kp(t) && e.t === 'O'),
      'and a letter on each row',
    );
    assert.ok(!t.some((e) => /Ohuhu markers|Copic markers/.test(e.t)));
    img = await canvasTexts(page, 'buildExportCanvas');
    assert.ok(img.some((s) => /C = Copic/.test(s)) && img.some((s) => /^[OC] {2}/.test(s)));
    card = await canvasTexts(page, 'buildShareCard');
    assert.ok(card.some((s) => /C = Copic/.test(s)) && card.includes('O') && card.includes('C'));
    assert.deepEqual(errors, []);
  });
  test('the palette card says the brand once when there is one', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    const t = await page.evaluate(async () => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        log = [];
      P.fillText = function (s) {
        log.push(String(s));
        return of.apply(this, arguments);
      };
      try {
        const oh = [],
          mixed = [];
        COLORS.forEach((c, i) => {
          if (c.brand === 'Ohuhu' && oh.length < 12) oh.push(i);
        });
        const cp = COLORS.map((c, i) => i)
          .filter((i) => COLORS[i].brand === 'Copic')
          .slice(0, 6);
        mixed.push(...oh.slice(0, 6), ...cp);
        await makeCard(oh, 'drawn');
        log.push('---');
        await makeCard(mixed, 'drawn');
      } finally {
        P.fillText = of;
      }
      return log;
    });
    const [one, mix] = [t.slice(0, t.indexOf('---')), t.slice(t.indexOf('---') + 1)];
    assert.ok(one.includes('12 colours · Ohuhu markers'));
    assert.ok(!one.some((s) => /^O /.test(s)), 'no letters');
    assert.ok(
      mix.some((s) => /^12 colours · C = Copic/.test(s)) &&
        mix.some((s) => /^C /.test(s)) &&
        mix.some((s) => /^O /.test(s)),
    );
    assert.deepEqual(errors, []);
  });
  test('letters, one brand owned: none on lists of that brand (Owned, Palette, the guide), still where a view mixes (All, Match)', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await markersView(page, 'owned');
    assert.ok((await page.locator('#results .cell').count()) > 50);
    assert.deepEqual(await letters(page, '#results .cell .bt'), [], 'Owned: no letters');
    await markersView(page, 'all');
    const all = await letters(page, '#results .cell .bt');
    assert.ok(all.includes('O') && all.includes('C'), 'All mixes brands: letters');
    await page.click('#mkMatchBtn');
    await page.click('.msrc [data-src="hex"]');
    let single = 0;
    for (const hex of HEXES) {
      const r = await matchRows(page, hex);
      if (!r.mixed) {
        single++;
        assert.equal(r.tags, 0, hex + ': one brand → no letters');
      } else assert.equal(r.tags, r.n, hex);
    }
    assert.ok(single > 0, 'some result is one brand');
    await page.click('#matchClose');
    await drawPalette(page);
    assert.deepEqual((await letters(page, '#bands .band .bt')).filter(Boolean), []);
    assert.equal(await page.$$eval('#readout .rbt', (x) => x.length), 0, 'no letters in the code line');
    // the sample guide, all Ohuhu: no letters on the picture or in Colour along
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await idle(page);
    assert.deepEqual(await guideBrands(page), ['Ohuhu']);
    const pic = await pictureTexts(page);
    assert.ok(pic.length > 20 && !pic.includes('O'), 'no letters on the picture');
    await page.click('#sfColor');
    await idle(page);
    assert.equal(await page.locator('#sfAlist .btag').count(), 0);
    assert.deepEqual(errors, []);
  });
  test('letters, both brands owned: on every list (Owned, Palette, Match, the guide picture and rows), with full names for screen readers; exports of a one-brand guide unchanged', async () => {
    // (v328: the Labelled page, whose page 1 has the labels; Page to colour's has none)
    const { page, errors } = await openApp({ storage: { 'ms-pdf-what': 'page' } });
    await sampleGuide(page);
    await ownCopic(page);
    assert.deepEqual(await guideBrands(page), ['Ohuhu'], 'the guide itself is still all Ohuhu');
    // the guide: letters on the picture's labels, in Colour along's rows and the shading tones
    const pic = await pictureTexts(page);
    assert.ok(pic.filter((t) => t === 'O').length > 5, 'the picture labels carry their letter');
    assert.ok(!pic.includes('C'));
    await scrollTop(page);
    await snapV267(page, 'a-guide-letters');
    await page.click('#sfColor');
    await idle(page);
    const rows = await letters(page, '#sfAlist .btag');
    assert.ok(rows.length > 3 && rows.every((t) => t === 'O'), 'a letter on every row');
    assert.match(
      await page.textContent('#sfAlist .sfarow .sfah .nm'),
      /^O Ohuhu \S+/,
      'the letter is hidden from screen readers, which hear "Ohuhu"',
    );
    assert.equal(await page.getAttribute('#sfAlist .btag', 'aria-hidden'), 'true');
    await page.click('#sfDoneBtn');
    await idle(page);
    // exports go by the guide's own markers: one brand, named once, no letters
    const t = await pdfTextsOnly(page);
    assert.ok(
      t.some((e) => e.p === 0 && /\d+ Ohuhu markers/.test(e.t)),
      'page 1 says the brand',
    );
    assert.ok(!t.some((e) => /= Copic|= Ohuhu/.test(e.t)), 'no letter key');
    // (the close-ups' letters aside: C and O are the 3rd and 15th, on page 1 and over their close-up)
    const nCl = await page.evaluate(() => __mstest.pdfCloseL),
      close = (x) => x.charCodeAt(0) - 64 <= nCl;
    for (const x of ['O', 'C'])
      assert.ok(
        t.filter((e) => e.t === x).length <= (close(x) ? 2 : 0),
        'no letters, on the picture or the key: ' + x,
      );
    const img = await canvasTexts(page, 'buildExportCanvas');
    assert.ok(img.includes('Ohuhu markers') && !img.includes('O') && !img.some((s) => /^O {2}/.test(s)));
    const card = await canvasTexts(page, 'buildShareCard');
    // (v305: the card's line says "… 16 Ohuhu markers …", as Reveal's end does)
    assert.ok(card.some((s) => /\bOhuhu markers\b/.test(s)) && !card.includes('O'));
    // the shell's lists
    await markersView(page, 'owned');
    const own = await letters(page, '#results .cell .bt');
    assert.ok(
      own.length > 50 && own.filter((x) => x === 'O').length > 50 && own.includes('C'),
      'Owned: a letter on every cell',
    );
    assert.equal(own.length, await page.locator('#results .cell').count());
    assert.match(
      await page.getAttribute('#results .cell', 'aria-label'),
      /^(Ohuhu|Copic) /,
      'labels name the brand',
    );
    await page.evaluate(() => scrollTo(0, 0));
    await snapV267(page, 'a-markers-owned');
    // filtered to Ohuhu only, still letters: the collection mixes
    await page.evaluate(() => {
      fgTap('brand', 'Ohuhu');
      save();
      fullRender();
    });
    await idle(page);
    const oh = await letters(page, '#results .cell .bt');
    assert.ok(oh.length > 50 && oh.every((x) => x === 'O'));
    await drawPalette(page);
    assert.ok((await letters(page, '#bands .band .bt')).filter(Boolean).length > 0, 'Palette bands');
    assert.ok((await page.$$eval('#readout .rbt', (x) => x.length)) > 0, 'and the code line');
    assert.match(
      await page.textContent('#readout .hex'),
      /Ohuhu /,
      'which a screen reader hears as the brand',
    );
    await page.evaluate(() => {
      fgClear('brand');
      save();
      fullRender();
    });
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mkMatchBtn');
    await page.click('.msrc [data-src="hex"]');
    for (const hex of HEXES) {
      const r = await matchRows(page, hex);
      assert.equal(r.tags, r.n, hex + ': a letter on every row');
    }
    assert.deepEqual(errors, []);
  });
  test('letters with an empty collection: the whole range counts, so letters everywhere', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    await markersView(page, 'all');
    assert.ok((await letters(page, '#results .cell .bt')).length > 50);
    await page.evaluate(() => {
      fgTap('brand', 'Copic');
      save();
      fullRender();
    });
    await idle(page);
    const cp = await letters(page, '#results .cell .bt');
    assert.ok(cp.length > 20 && cp.every((x) => x === 'C'), 'a one-brand view still has them');
    await drawPalette(page);
    assert.ok((await letters(page, '#bands .band .bt')).filter(Boolean).every((x) => x === 'C'));
    assert.ok((await letters(page, '#bands .band .bt')).filter(Boolean).length > 0);
    await page.evaluate(() => {
      fgClear('brand');
      save();
      fullRender();
    });
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mkMatchBtn');
    await page.click('.msrc [data-src="hex"]');
    for (const hex of HEXES.slice(0, 3)) {
      const r = await matchRows(page, hex);
      assert.equal(r.tags, r.n, hex);
    }
    await page.click('#matchClose');
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await idle(page);
    const pic = await pictureTexts(page);
    assert.ok(
      pic.some((t) => t === 'O' || t === 'C'),
      'the picture labels carry letters',
    );
    assert.deepEqual(errors, []);
  });
  test('brand tags: a small box after every code when the collection mixes brands (Ohuhu filled, Copic pale and outlined), on screen, the PDF and the saved image; none for one brand', async () => {
    // (v328: the Labelled page, whose page 1 has the labels; Page to colour's has none)
    const { page, errors } = await openApp({ storage: { 'ms-pdf-what': 'page' } });
    await sampleGuide(page);
    // one brand owned, one brand in the guide: no tags anywhere
    assert.deepEqual(await tagsOf(page, 'screen'), []);
    assert.deepEqual(await tagsOf(page, 'pdf'), []);
    assert.deepEqual(await tagsOf(page, 'image'), []);
    // both brands owned and used
    await ownAllCopic(page);
    await idle(page);
    const n = await page.evaluate(() => Object.keys(__mstest.assignData.assign).length);
    const scr = await tagsOf(page, 'screen');
    assert.ok(scr.length > 20 && scr.length <= n, 'a tag on the labels: ' + scr.length + ' of ' + n);
    assert.ok(scr.some((e) => e.t === 'O') && scr.some((e) => e.t === 'C'), 'both brands');
    for (const e of scr)
      assert.equal(
        e.box,
        e.t === 'C' ? '#c4c1c9' : '#26252b',
        'Copic pale, Ohuhu dark: ' + JSON.stringify(e),
      );
    // the print's light labels draw them as light as the codes; the saved image as on screen
    // (v305: the close-ups' codes are near-black; v306: their tags in print colours too, near-black and white)
    const pdf = await tagsOf(page, 'pdf'),
      p1 = pdf.filter((e) => e.p === 0),
      cu = pdf.filter((e) => e.p > 0);
    // (v318.1: a code under 6 pt, and its tag, a darker grey, #8a8a8a)
    assert.ok(
      p1.length > 20 &&
        p1.every((e) => (e.t === 'C' ? e.box === '#ffffff' : e.box === '#a0a0a0' || e.box === '#8a8a8a')),
      JSON.stringify(p1.slice(0, 3)),
    );
    assert.ok(
      cu.every((e) => e.box === (e.t === 'C' ? '#ffffff' : '#1a1a1a')),
      JSON.stringify(cu.slice(0, 3)),
    );
    const img = await tagsOf(page, 'image');
    assert.ok(
      img.length > 20 && img.every((e) => e.box === (e.t === 'C' ? '#c4c1c9' : '#26252b')),
      JSON.stringify(img.slice(0, 3)),
    );
    // pixels: a big label's tag, drawn on a canvas of its own (inside its padding: the fill; on its left edge: the outline)
    const px = await page.evaluate(() => {
      const t = __mstest,
        l = +Object.keys(t.assignData.assign).sort((a, b) => t.comps[b].area - t.comps[a].area)[0],
        out = {};
      for (const brand of ['Ohuhu', 'Copic']) {
        const m = COLORS.find((c) => c.brand === brand),
          c = document.createElement('canvas');
        c.width = t.W;
        c.height = t.H;
        const g = c.getContext('2d');
        g.fillStyle = '#7fbf7f';
        g.fillRect(0, 0, c.width, c.height);
        const o = { bt: true, base: 40, min: 40, max: 40, w: 600, swk: 0.27, stroke: '#fff', fill: '#000' },
          L = t.codeLayout(g, l, m, o);
        t.drawCode(g, l, m, o);
        const tx = L.x0 + L.cw + L.fs * 0.2,
          at = (x) => [...g.getImageData(Math.round(x), Math.round(L.y), 1, 1).data.slice(0, 3)];
        out[brand] = { fill: at(tx + L.fs * 0.1), edge: at(tx + 0.5), gw: L.gw, fs: L.fs };
      }
      return out;
    });
    const near = (a, hex) =>
      a.every((v, k) => Math.abs(v - parseInt(hex.slice(1 + 2 * k, 3 + 2 * k), 16)) < 12);
    assert.ok(near(px.Ohuhu.fill, '#26252b'), 'Ohuhu tag filled dark: ' + px.Ohuhu.fill);
    assert.ok(near(px.Copic.fill, '#c4c1c9'), 'Copic tag pale inside: ' + px.Copic.fill);
    assert.ok(near(px.Copic.edge, '#26252b'), 'with a dark outline: ' + px.Copic.edge);
    assert.ok(
      px.Ohuhu.gw > px.Ohuhu.fs * 0.5 && px.Ohuhu.gw < px.Ohuhu.fs * 0.9,
      'about a letter plus padding wide: ' + JSON.stringify(px.Ohuhu),
    );
    assert.deepEqual(errors, []);
  });
  test('brand tags: the tag counts in a label’s width, so labels still fit their sections (and the tap box covers it)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await ownAllCopic(page);
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        g = document.createElement('canvas').getContext('2d'),
        a = t.assignData.assign,
        o = { base: 9, min: 5, w: 600, swk: 0.27, stroke: '#fff', fill: '#000' };
      return Object.keys(a).map((k) => {
        const l = +k,
          p = t.labelPos(l),
          L = t.codeLayout(g, l, a[k], o),
          N = t.codeLayout(g, l, a[k], { ...o, bt: false });
        return {
          l,
          fs: L.fs,
          fsN: N.fs,
          w: L.box[2] - L.box[0] - 2 * L.lw - 4,
          want: L.cw + L.fs * 0.2 + L.gw,
          aw: p.aw,
          tg: L.tg,
          gw: L.gw,
        };
      });
    });
    assert.ok(
      r.every((x) => x.tg && x.gw > 0),
      'every label has its tag',
    );
    assert.ok(
      r.every((x) => Math.abs(x.w - x.want) < 0.01),
      'the box spans code, gap and tag',
    );
    // above the smallest size a label fits its section's width, tag included; the tag only ever makes a label smaller
    assert.deepEqual(
      r.filter((x) => x.fs > 5 && x.w > x.aw * 0.94 + 0.5),
      [],
      'labels fit',
    );
    assert.ok(r.every((x) => x.fs <= x.fsN));
    assert.ok(
      r.some((x) => x.fs < x.fsN),
      'some labels made room for the tag',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from held.test.mjs ----
// v284: sections with ink on the paper (ticked, or some of their tones coloured) keep their markers through any change
// to the plan, and Undo leaves them too; a toast says so when it matters, with Recolour them too (one Undo step, which
// puts the ticks back). Their Shadows and Highlights keep as well, saved with the guide. Also: the Photo pattern chosen
// before a photo is picked keeps the pattern before it (laid and saved), and choosing a saved palette asks nothing.
{
  const asg = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData,
        o = {};
      a.order.forEach((l) => {
        o[l] = a.assign[l].mkey;
      });
      return o;
    });
  // tick n of the biggest sections done, and colour one step of the next few (as Colour along does)
  async function colourSome(page, n, part) {
    await page.click('#sfColor');
    await idle(page);
    const secs = await page.evaluate(
      ([n, part]) => {
        const t = __mstest,
          a = t.assignData,
          big = a.order.slice().sort((x, y) => t.comps[y].area - t.comps[x].area);
        const done = big.slice(0, n),
          half = big.slice(n, n + part);
        done.forEach((l) => {
          t.colored[l] = 1;
        });
        half.forEach((l) => {
          t.stepSet(l, 1, true);
        });
        t.renderGuide();
        return { done, half };
      },
      [n, part],
    );
    await page.click('#sfDoneBtn');
    await idle(page);
    return secs;
  }
  // (the line under the Plan's tabs that says so: not a toast, which sits over Shuffle and Pin colours)
  const noteText = (page) =>
    page.evaluate(() => {
      const n = document.querySelectorAll('#sfHeldNote');
      return n.length
        ? n.length +
            ':' +
            n[0].querySelector('span').textContent +
            ' · ' +
            document.getElementById('sfHeldGo').textContent
        : '';
    });
  test('ticked and part-done sections keep their markers through a change to the plan; a line under the tabs says so once, and they are never saved as pins', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    await page.click('#sfBal [data-v="mixed"]');
    await idle(page);
    const { done, half } = await colourSome(page, 6, 2);
    const kept = done.concat(half),
      a0 = await asg(page);
    await page.click('#sfShuffle');
    await idle(page);
    const a1 = await asg(page);
    kept.forEach((l) => assert.equal(a1[l], a0[l], 'section ' + l + ' kept its marker'));
    assert.ok(
      Object.keys(a0).some((l) => !kept.includes(+l) && a1[l] !== a0[l]),
      'the rest laid again',
    );
    assert.equal(await noteText(page), '1:Kept 8 coloured sections as they are · Recolour them too');
    assert.ok(
      !(await page.evaluate(
        () =>
          document.getElementById('msToast')?.classList.contains('on') &&
          /Kept/.test(document.getElementById('msToast').textContent),
      )),
      'no toast for it',
    );
    assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Colours shuffled');
    // (Undo takes the line away with the change it spoke of; the change again brings it back, as it's more than told)
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await noteText(page), '', 'gone with Undo');
    await page.evaluate(() => {
      __mstest.heldTold = 0;
    });
    await page.click('#sfShuffle');
    await idle(page);
    // not pins: nothing in locks, nothing saved as one
    assert.deepEqual(await page.evaluate(() => Object.keys(__mstest.locks)), []);
    assert.deepEqual(await page.evaluate(() => __mstest.currentDesignObj().payload.locks), {});
    // a change while it shows: it stays, for this change's sections
    await page.click('#sfShuffle');
    await idle(page);
    assert.equal(await noteText(page), '1:Kept 8 coloured sections as they are · Recolour them too');
    // closed, then a second change on this visit: kept again, not said again
    await page.click('#sfHeldX');
    await idle(page);
    assert.equal(await noteText(page), '');
    await page.click('#sfShuffle');
    await idle(page);
    const a2 = await asg(page);
    kept.forEach((l) => assert.equal(a2[l], a0[l]));
    assert.equal(await noteText(page), '');
    assert.deepEqual(errors, []);
  });
  test('Undo leaves coloured sections as they are; Recolour them too lays them again unticked, one Undo step that puts the ticks back', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    await page.click('#sfBal [data-v="mixed"]');
    await idle(page);
    const a0 = await asg(page);
    await page.click('#sfShuffle');
    await idle(page);
    // coloured after the Shuffle, with its markers
    const { done } = await colourSome(page, 5, 0),
      a1 = await asg(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    const a2 = await asg(page);
    done.forEach((l) => assert.equal(a2[l], a1[l], 'Undo left section ' + l + ' as coloured'));
    assert.ok(
      Object.keys(a0).some((l) => !done.includes(+l) && a2[l] === a0[l] && a1[l] !== a0[l]),
      'the rest went back',
    );
    // a change, then Recolour them too
    await page.click('#sfShuffle');
    await idle(page);
    const a3 = await asg(page);
    await page.click('#sfHeldGo');
    await idle(page);
    assert.equal(await noteText(page), '', 'the line goes once used');
    assert.match(
      await page.getAttribute('#sfPlanUndo', 'aria-label'),
      /^Undo: Recoloured 5 coloured sections$/,
    );
    const st = await page.evaluate((d) => d.map((l) => __mstest.colored[l]), done);
    assert.deepEqual(st, [0, 0, 0, 0, 0], 'unticked');
    const a4 = await asg(page);
    assert.ok(
      done.some((l) => a4[l] !== a3[l]),
      'laid again',
    );
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(
      await page.evaluate((d) => d.map((l) => __mstest.colored[l]), done),
      [1, 1, 1, 1, 1],
      'the ticks back',
    );
    const a5 = await asg(page);
    done.forEach((l) => assert.equal(a5[l], a3[l], 'and their markers'));
    assert.deepEqual(errors, []);
  });
  test('every way the plan is laid again keeps them: Blend’s Spread too (v284 review)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    const { done } = await colourSome(page, 6, 0),
      a0 = await asg(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.evaluate(() => {
      const s = document.getElementById('sfSpread');
      s.value = s.value === '4' ? '0.6' : '4';
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await idle(page);
    const a1 = await asg(page);
    done.forEach((l) => assert.equal(a1[l], a0[l], 'section ' + l + ' kept its marker'));
    assert.ok(
      Object.keys(a0).some((l) => !done.includes(+l) && a1[l] !== a0[l]),
      'the rest blended again',
    );
    assert.deepEqual(
      await page.evaluate((d) => d.map((l) => __mstest.colored[l]), done),
      done.map(() => 1),
      'still ticked',
    );
    assert.deepEqual(errors, []);
  });
  test('a coloured section keeps its Shadows and Highlights when they change; saved with the guide, it opens the same', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    const { done } = await colourSome(page, 4, 0);
    const tones = () =>
      page.evaluate(() => {
        const o = {};
        __mstest.assignData.order.forEach((l) => {
          const t = __mstest.shadeSec(l);
          if (t) o[l] = (t.dark ? t.dark.mkey : '-') + '/' + (t.light ? t.light.mkey : '-');
        });
        return o;
      });
    const t0 = await tones();
    const shaded = done.filter((l) => t0[l]);
    assert.ok(shaded.length >= 2, 'some coloured sections are shaded');
    await page.click('.sftabbtn[data-t="shading"]');
    await idle(page);
    await page.selectOption('#sfShStyle', 'grey');
    await idle(page);
    const t1 = await tones();
    shaded.forEach((l) => assert.equal(t1[l], t0[l], 'section ' + l + ' kept its tones'));
    assert.ok(
      Object.keys(t0).some((l) => !done.includes(+l) && t1[l] !== t0[l]),
      'the rest follow Grey',
    );
    const d = await page.evaluate(() => __mstest.currentDesignObj());
    shaded.forEach((l) => assert.deepEqual(d.payload.held[l], ['same', 'same', 0]));
    await page.evaluate((d) => {
      const p = d.payload;
      __mstest.openDesignObj(Object.assign({}, p, { name: 'Held', W: d.W, H: d.H }), null);
    }, d);
    await page.waitForFunction(() => __mstest.curName === 'Held');
    await idle(page);
    const t2 = await tones();
    shaded.forEach((l) => assert.equal(t2[l], t0[l], 'reopened, section ' + l + ' still has its tones'));
    assert.deepEqual(errors, []);
  });
  test('v285: a section part-way coloured keeps its Highlights, its Shadows follow until its shadow is coloured; saved that way, and a v284 save keeps both', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    // shaded sections with both a lighter and a darker tone: one with its base coloured, one with its shadow coloured too
    const [a, b] = await page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order.filter((l) => {
          const s = t.shadeSec(l);
          return s && s.light && s.dark;
        });
      t.stepSet(o[0], 2, true);
      t.stepSet(o[1], 2, true);
      t.stepSet(o[1], 4, true);
      t.renderGuide();
      return [o[0], o[1]];
    });
    await page.click('#sfDoneBtn');
    await idle(page);
    const tones = (l) =>
      page.evaluate((l) => {
        const s = __mstest.shadeSec(l);
        return { dark: s && s.dark ? s.dark.mkey : '-', light: s && s.light ? s.light.mkey : '-' };
      }, l);
    const a0 = await tones(a),
      b0 = await tones(b);
    await page.click('.sftabbtn[data-t="shading"]');
    await idle(page);
    await page.selectOption('#sfShStyle', 'grey');
    await idle(page);
    await page.selectOption('#sfHiStyle', 'paper');
    await idle(page);
    const a1 = await tones(a),
      b1 = await tones(b);
    assert.equal(a1.light, a0.light, 'highlight kept once anything is coloured');
    assert.notEqual(a1.dark, a0.dark, 'shadow not on the paper yet: it follows Grey');
    assert.deepEqual(b1, b0, 'shadow coloured: both kept');
    const d = await page.evaluate(() => __mstest.currentDesignObj());
    assert.equal(d.payload.held[a][2], 1, 'saved with its shadow free');
    assert.equal(d.payload.held[b][2], 0);
    // reopened: the same
    await page.evaluate((d) => {
      __mstest.openDesignObj(Object.assign({}, d.payload, { name: 'Held 2', W: d.W, H: d.H }), null);
    }, d);
    await page.waitForFunction(() => __mstest.curName === 'Held 2');
    await idle(page);
    assert.deepEqual(await tones(a), a1);
    assert.deepEqual(await tones(b), b0);
    // a v284 save ([shadow, hilite]) keeps both, even for a section part-way coloured
    const d2 = JSON.parse(JSON.stringify(d));
    d2.payload.held[a] = [d.payload.style.shShadow || 'same', d.payload.held[a][1]];
    const legacy = await page.evaluate(
      ([d, a]) => {
        const p = Object.assign({}, d.payload, { name: 'Held 3', W: d.W, H: d.H });
        p.held = Object.assign({}, p.held);
        p.held[a] = ['same', p.held[a][1]];
        __mstest.openDesignObj(p, null);
        return p.held[a];
      },
      [d2, a],
    );
    await page.waitForFunction(() => __mstest.curName === 'Held 3');
    await idle(page);
    const a3 = await tones(a);
    await page.click('.sftabbtn[data-t="shading"]');
    await idle(page);
    await page.selectOption('#sfShStyle', 'cool');
    await idle(page);
    assert.deepEqual(await tones(a), a3, 'v284 hold: both kept: ' + legacy);
    assert.deepEqual(errors, []);
  });
  test('Photo chosen with no photo picked: the pattern before it stays laid and saved; choosing a saved palette asks nothing', async () => {
    const { page, errors } = await openApp();
    const dialogs = [];
    page.on('dialog', (dl) => {
      dialogs.push(dl.message());
      dl.dismiss();
    });
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    const a0 = await asg(page);
    // (the file picker is left closed, as when it's cancelled)
    await page.evaluate(() => {
      HTMLInputElement.prototype.click = function () {};
    });
    await page.click('#sfFam [data-v="photo"]');
    await idle(page);
    assert.equal(await page.getAttribute('#sfFam [data-v="photo"]', 'aria-pressed'), 'true');
    assert.equal(
      await page.evaluate(() => __mstest.currentDesignObj().payload.style.family),
      'random',
      'saved as the pattern still laid',
    );
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    await page.evaluate(() => {
      const s = document.getElementById('sfMkCount');
      s.value = String(+s.value - 2);
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await idle(page);
    const a1 = await asg(page);
    assert.notDeepEqual(a1, a0, 'laid again');
    assert.equal(
      await page.evaluate(() => __mstest.currentDesignObj().payload.style.family),
      'random',
      'as Random, not a Gradient under Photo',
    );
    // a saved palette: no "are you sure"
    await page.evaluate(() => {
      state.saved.unshift({
        id: 885001,
        type: 'palette',
        name: 'Mine',
        keys: [...state.owned].slice(0, 6),
        ts: 885001,
      });
      save();
    });
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    // (v318.34: A palette, then Choose a saved palette)
    await page.click('#sfSrc [data-v="palette"]');
    await idle(page);
    await page.selectOption('#sfPalPick', '885001');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.paletteSource), 'saved');
    assert.deepEqual(dialogs, []);
    assert.deepEqual(errors, []);
  });
}

// ---- from paint.test.mjs ----
// Planning realistic colours by hand: "Everywhere" in the Change colour picker swaps a marker in every section that
// uses it (pinned, one Undo step), and Paint in the Manual pattern fills the sections a tap or a drag passes over
// (one stroke = one Undo step) while two fingers still move and zoom the picture.
{
  // touch is driven through Chromium's own protocol (CDP): Safari's engine skips those tests
  const CDP_ONLY = { skip: ENGINE !== 'chromium' && 'touch is driven through Chromium\u2019s protocol' };
  // big sections whose label points are well inside the picture (not under the zoom row), biggest first
  const bigSections = (page, n = 6) =>
    page.evaluate((n) => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        z = document.getElementById('sfZoomCtl').getBoundingClientRect();
      return t.assignData.order
        .filter((l) => {
          const q = t.labelPos(l),
            y = r.top + (q.y / c.height) * r.height,
            x = r.left + (q.x / c.width) * r.width;
          return (
            y > r.top + 12 &&
            y < (z.top > r.top + 20 ? Math.min(r.bottom, z.top) : r.bottom) - 12 &&
            x > r.left + 12 &&
            x < r.right - 12
          );
        })
        .sort((a, b) => t.comps[b].area - t.comps[a].area)
        .slice(0, n);
    }, n);
  const plan = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const k in a) o[k] = a[k].mkey;
      return { a: o, locks: { ...__mstest.locks }, n: __mstest.planCount, label: __mstest.planLabel };
    });
  async function tap(page, l) {
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  async function manual(page) {
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
  }
  // compare the canvas with a from-scratch redraw of the same state
  const vsFull = (page) =>
    page.evaluate(() => {
      const c = document.getElementById('sfCanvas'),
        g = c.getContext('2d');
      __mstest.renderGuide();
      const a = g.getImageData(0, 0, c.width, c.height).data.slice();
      __mstest.forceFullRender();
      __mstest.renderGuide();
      const b = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
      return n;
    });
  // a marker in the collection that the guide doesn't use yet
  const unusedKey = (page) =>
    page.evaluate(() => {
      const used = new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey));
      return sfCollection().find((m) => !used.has(m.mkey)).mkey;
    });
  // a big section whose marker is shared with at least `n` other sections
  const sharedSection = (page, ls, n = 2) =>
    page.evaluate(
      ([ls, n]) => {
        const a = __mstest.assignData.assign;
        return ls.find((l) => Object.keys(a).filter((x) => a[x].mkey === a[l].mkey).length > n);
      },
      [ls, n],
    );
  async function touch(cdp) {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  }
  const T = (cdp, type, pts) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i + 1 })),
    });
  test('Change colour → Everywhere replaces the marker in every section that uses it (and only those), pinned, as one Undo step', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const l = await sharedSection(page, await bigSections(page, 12), 3),
      p0 = await plan(page),
      old = p0.a[l];
    const same = Object.keys(p0.a)
        .filter((x) => p0.a[x] === old)
        .map(Number),
      k1 = await unusedKey(page);
    const code = (k) => page.evaluate((k) => sfCollection().find((m) => m.mkey === k).code, k),
      oc = await code(old),
      nc = await code(k1);
    const mkN = () => page.evaluate(() => +document.querySelector('#sfStat .sfsp2 b').textContent);
    const m0 = await mkN();
    await tap(page, l);
    // the tip keeps its buttons (v318.26: and Leave white): the choice lives in the picker
    assert.deepEqual(await page.$$eval('.sftip [data-a]', (b) => b.map((x) => x.textContent)), [
      'Change colour',
      'Pin',
      'Leave white',
    ]);
    await page.click('.sftip [data-a="change"]');
    assert.deepEqual(
      await page.$$eval('.sfpopscope [data-sc]', (b) =>
        b.map((x) => [x.textContent, x.getAttribute('aria-pressed')]),
      ),
      [
        ['Only this section', 'true'],
        [`Everywhere (${same.length} sections)`, 'false'],
      ],
    );
    // a pick previews on this section only; Everywhere spreads it; Only this section takes it back
    await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k1}"]`);
    await idle(page);
    let p = await plan(page);
    assert.equal(p.a[l], k1);
    assert.equal(same.filter((x) => p.a[x] === k1).length, 1);
    await page.click('.sfpopscope [data-sc="all"]');
    await idle(page);
    p = await plan(page);
    assert.ok(
      same.every((x) => p.a[x] === k1),
      'every section with the old marker previews the new one',
    );
    await page.click('.sfpopscope [data-sc="one"]');
    await idle(page);
    p = await plan(page);
    assert.deepEqual(
      same.filter((x) => p.a[x] === k1),
      [l],
      'back to this section only',
    );
    await page.click('.sfpopscope [data-sc="all"]');
    await page.click('#sfPopConfirm');
    await idle(page);
    p = await plan(page);
    for (const x in p0.a) assert.equal(p.a[x], same.includes(+x) ? k1 : p0.a[x], 'section ' + x);
    assert.ok(
      same.every((x) => p.locks[x] === k1),
      'all pinned',
    );
    assert.deepEqual(
      Object.keys(p.locks)
        .map(Number)
        .sort((a, b) => a - b),
      same.slice().sort((a, b) => a - b),
      'nothing else pinned',
    );
    assert.equal(p.n, p0.n + 1, 'one Undo step');
    assert.equal(p.label, `Replaced ${oc} with ${nc} in ${same.length} sections`);
    // no toast: ↶ Undo says it, and a screen reader hears it
    assert.equal(
      await page.evaluate(() => {
        const t = document.getElementById('msToast');
        return !!(t && t.classList.contains('on'));
      }),
      false,
    );
    assert.equal(
      await page.getAttribute('#sfPlanUndo', 'aria-label'),
      `Undo: Replaced ${oc} with ${nc} in ${same.length} sections`,
    );
    assert.match(
      await page.textContent('#sfLive'),
      new RegExp(
        `^${oc} → ${nc} .*, ${same.length} sections\\.?( (Pinned: changes|Changes) to the plan leave them as they are\\.)?$`,
      ),
      'the picker says what it did (then, the first time, that they are pinned)',
    );
    assert.equal(await mkN(), m0, 'markers used: one out, one in');
    assert.equal(await vsFull(page), 0, 'redraw matches a full redraw');
    // Recently used remembers the new marker
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-recent-mk'))[0]), k1);
    // Undo (the button under the picture) takes it all back in one go
    await page.click('#sfPlanUndo');
    await idle(page);
    p = await plan(page);
    assert.deepEqual(p.a, p0.a);
    assert.deepEqual(p.locks, {});
    assert.equal(p.n, p0.n);
    assert.deepEqual(errors, []);
  });
  test('Everywhere leaves sections already coloured with the old marker as they are; Cancel restores everything', async () => {
    const { page, errors } = await openApp({ width: 360, height: 780 });
    await sampleGuide(page);
    const l = await sharedSection(page, await bigSections(page, 12), 3),
      p0 = await plan(page),
      old = p0.a[l];
    const same = Object.keys(p0.a)
        .filter((x) => p0.a[x] === old)
        .map(Number),
      done = same.find((x) => x !== l),
      k1 = await unusedKey(page);
    await page.evaluate((d) => {
      __mstest.colored[d] = 1;
    }, done);
    await tap(page, l);
    // at 360 px the tip and the choice both fit
    const fit = await page.evaluate(() => {
      const t = document.querySelector('.sftip').getBoundingClientRect();
      return t.left >= 0 && t.right <= 360;
    });
    assert.ok(fit, 'tip fits at 360 px');
    await page.click('.sftip [data-a="change"]');
    const sc = await page.evaluate(() => {
      const pop = document.getElementById('sfSheet').getBoundingClientRect();
      return [...document.querySelectorAll('.sfpopscope [data-sc]')].map((b) => {
        const r = b.getBoundingClientRect();
        return { cut: b.scrollWidth > b.clientWidth, in: r.left >= pop.left && r.right <= pop.right };
      });
    });
    assert.deepEqual(
      sc,
      [
        { cut: false, in: true },
        { cut: false, in: true },
      ],
      'both choices readable in the picker',
    );
    assert.equal(
      await page.textContent('.sfpopscope [data-sc="all"]'),
      `Everywhere (${same.length - 1} sections)`,
    );
    assert.ok(!(await page.isVisible('.sfpopnote')));
    await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k1}"]`);
    await page.click('.sfpopscope [data-sc="all"]');
    await idle(page);
    assert.match(await page.textContent('.sfpopnote'), /^1 coloured section keeps /);
    let p = await plan(page);
    assert.equal(p.a[done], old, 'the coloured section keeps its marker');
    assert.equal(same.filter((x) => p.a[x] === k1).length, same.length - 1);
    await page.click('#sfPopCancel');
    await idle(page);
    p = await plan(page);
    assert.deepEqual(p.a, p0.a);
    assert.deepEqual(p.locks, {});
    assert.equal(p.n, p0.n, 'Cancel is no step');
    // and when confirmed, the tick stays
    await tap(page, l);
    await page.click('.sftip [data-a="change"]');
    await page.click(`#sfPopSw .sfsw[data-k="${k1}"] >> nth=0`);
    await page.click('.sfpopscope [data-sc="all"]');
    await page.click('#sfPopConfirm');
    await idle(page);
    p = await plan(page);
    assert.equal(p.a[done], old);
    assert.equal(await page.evaluate((d) => __mstest.colored[d], done), 1, 'tick kept');
    assert.match(p.label, /\(1 coloured kept /);
    assert.deepEqual(errors, []);
  });
  test('Paint: a tap fills one section with the brush (default: the most recently used marker) and pins it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const k1 = await unusedKey(page);
    await page.evaluate((k) => localStorage.setItem('ms-recent-mk', JSON.stringify([k])), k1);
    await manual(page);
    assert.equal(await page.textContent('#sfPaint'), 'Paint');
    assert.equal(await page.locator('#sfBrush').count(), 0, 'no brush until Paint is on');
    await page.click('#sfPaint');
    await idle(page);
    assert.equal(await page.textContent('#sfPaint'), 'Done painting');
    assert.equal(await page.getAttribute('#sfPaint', 'aria-pressed'), 'true');
    const code = await page.evaluate((k) => sfCollection().find((m) => m.mkey === k).code, k1);
    assert.match(await page.textContent('#sfBrush'), new RegExp('^' + code));
    assert.equal(await page.evaluate(() => document.getElementById('sfCanvas').style.cursor), 'crosshair');
    const [l] = await bigSections(page, 1),
      p0 = await plan(page);
    await tap(page, l);
    const p = await plan(page);
    assert.ok(!(await page.isVisible('#sfSheet')), 'no picker while painting');
    assert.equal(await page.locator('.sftip').count(), 0, 'no tip');
    assert.equal(p.a[l], k1);
    assert.equal(p.locks[l], k1);
    assert.deepEqual(
      Object.keys(p0.a)
        .filter((x) => p.a[x] !== p0.a[x])
        .map(Number),
      [l],
      'only that section',
    );
    assert.equal(p.n, p0.n + 1);
    assert.equal(p.label, 'Painted 1 section with ' + code);
    assert.equal(await vsFull(page), 0, 'redraw matches a full redraw');
    // change the brush from the chip: the picker, then the next tap uses it
    await page.click('#sfBrush');
    assert.equal(await page.textContent('#sfSheetT'), 'Paint with');
    const k2 = await page.evaluate(
      (k) =>
        [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')].find((b) => b.dataset.k !== k)
          .dataset.k,
      k1,
    );
    await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k2}"]`);
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.paintKey), k2);
    const [, l2] = await bigSections(page, 2);
    await tap(page, l2);
    assert.equal((await plan(page)).a[l2], k2);
    assert.deepEqual(errors, []);
  });
  test('Paint: a drag fills every section it passes over, as one Undo step', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const k = await unusedKey(page);
    await page.evaluate((k) => localStorage.setItem('ms-recent-mk', JSON.stringify([k])), k);
    await manual(page);
    await page.click('#sfPaint');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.paintKey), k);
    await scrollTop(page);
    // down through the middle of the picture, across many sections
    const c = await page.evaluate(() => document.getElementById('sfCanvas').getBoundingClientRect().toJSON());
    const a = { x: c.x + c.width * 0.45, y: c.y + c.height * 0.1 },
      b = { x: c.x + c.width * 0.6, y: c.y + c.height * 0.9 };
    const p0 = await plan(page);
    // where the pointer went, in picture pixels
    await page.evaluate(() => {
      window.__path = [];
      const c = document.getElementById('sfCanvas');
      ['pointerdown', 'pointermove'].forEach((t) =>
        c.addEventListener(t, (e) => {
          if (!e.buttons) return;
          const r = c.getBoundingClientRect();
          __path.push({
            x: Math.floor(((e.clientX - r.left) / r.width) * __mstest.W),
            y: Math.floor(((e.clientY - r.top) / r.height) * __mstest.H),
          });
        }),
      );
    });
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    await idle(page);
    const p = await plan(page),
      got = Object.keys(p.a)
        .filter((x) => p.locks[x] === k)
        .map(Number)
        .sort((x, y) => x - y);
    // every section under the pointer's path, joining its points with straight lines (a fast drag skips nothing)
    const want = await page.evaluate(() => {
      const t = __mstest,
        P = __path,
        s = new Set();
      const at = (x, y) => {
        if (x < 0 || y < 0 || x >= t.W || y >= t.H) return;
        const l = t.labels[y * t.W + x];
        if (l > 0 && t.assignData.assign[l]) s.add(l);
      };
      at(P[0].x, P[0].y);
      for (let i = 1; i < P.length; i++) {
        const A = P[i - 1],
          B = P[i],
          dx = B.x - A.x,
          dy = B.y - A.y,
          n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
        for (let j = 1; j <= n; j++) at(Math.round(A.x + (dx * j) / n), Math.round(A.y + (dy * j) / n));
      }
      return [...s].sort((x, y) => x - y);
    });
    assert.ok(want.length >= 8, 'the drag crosses many sections: ' + want.length);
    assert.ok((await page.evaluate(() => __path.length)) >= 5, 'several pointer moves');
    assert.deepEqual(got, want, 'exactly the passed-over sections are painted and pinned');
    for (const x in p0.a) if (!got.includes(+x)) assert.equal(p.a[x], p0.a[x], 'section ' + x + ' untouched');
    assert.equal(p.n, p0.n + 1, 'one stroke, one Undo step');
    assert.equal(
      p.label,
      `Painted ${got.length} sections with ` +
        (await page.evaluate((k) => sfCollection().find((m) => m.mkey === k).code, k)),
    );
    assert.doesNotMatch(
      await page.evaluate(() => {
        const t = document.getElementById('msToast');
        return t ? t.textContent : '';
      }),
      /Painted/,
      'no toast after each stroke: ↶ Undo is in the zoom row',
    );
    assert.equal(await vsFull(page), 0, 'incremental redraw matches a full redraw');
    await page.click('#sfPlanUndo');
    await idle(page);
    const u = await plan(page);
    assert.deepEqual(u.a, p0.a);
    assert.deepEqual(u.locks, p0.locks);
    assert.equal(u.n, p0.n);
    assert.deepEqual(errors, []);
  });
  test(
    'Paint with touch: one finger paints, two fingers zoom and pan without painting, a late second finger stops the stroke',
    CDP_ONLY,
    async () => {
      const { page, errors } = await openApp();
      await sampleGuide(page);
      const k1 = await unusedKey(page);
      await page.evaluate((k) => localStorage.setItem('ms-recent-mk', JSON.stringify([k])), k1);
      await manual(page);
      await page.click('#sfPaint');
      await idle(page);
      const cdp = await page.context().newCDPSession(page);
      await touch(cdp);
      await scrollTop(page);
      const k = await page.evaluate(() => __mstest.paintKey),
        ls = await bigSections(page, 3);
      const pts = [];
      for (const l of ls) pts.push(await sectionPoint(page, l));
      const c = await page.evaluate(() =>
          document.getElementById('sfCanvas').getBoundingClientRect().toJSON(),
        ),
        cx = c.x + c.width / 2,
        cy = c.y + c.height / 2;
      let p0 = await plan(page);
      // two fingers together: pinch out and move — zooms and pans, paints nothing
      await T(cdp, 'touchStart', [
        { x: cx - 20, y: cy },
        { x: cx + 20, y: cy },
      ]);
      for (let i = 1; i <= 6; i++)
        await T(cdp, 'touchMove', [
          { x: cx - 20 - i * 12, y: cy + i * 4 },
          { x: cx + 20 + i * 12, y: cy + i * 4 },
        ]);
      await T(cdp, 'touchEnd', []);
      await idle(page);
      let s = await page.evaluate(() => ({ z: __mstest.zoom, x: __mstest.panX, y: __mstest.panY }));
      assert.ok(s.z > 1.5, 'zoomed in: ' + s.z);
      let p = await plan(page);
      assert.deepEqual(p.a, p0.a, 'nothing painted');
      assert.equal(p.n, p0.n, 'no Undo step');
      // two fingers moving together pan the zoomed picture
      await T(cdp, 'touchStart', [
        { x: cx - 30, y: cy },
        { x: cx + 30, y: cy },
      ]);
      for (let i = 1; i <= 5; i++)
        await T(cdp, 'touchMove', [
          { x: cx - 30 + i * 8, y: cy + i * 5 },
          { x: cx + 30 + i * 8, y: cy + i * 5 },
        ]);
      await T(cdp, 'touchEnd', []);
      await idle(page);
      const s2 = await page.evaluate(() => ({ z: __mstest.zoom, x: __mstest.panX, y: __mstest.panY }));
      assert.ok(s2.x !== s.x || s2.y !== s.y, 'panned');
      assert.deepEqual((await plan(page)).a, p0.a, 'still nothing painted');
      // back to the whole picture for the rest
      await page.click('#sfZrst');
      await idle(page);
      assert.equal(await page.evaluate(() => __mstest.zoom), 1);
      const q = [];
      for (const l of ls) q.push(await sectionPoint(page, l));
      // a second finger landing just after the first (before it paints): nothing painted
      const f2 = { x: c.x + c.width * 0.75, y: q[0].y + 30 };
      await T(cdp, 'touchStart', [{ x: q[0].x, y: q[0].y, id: 1 }]); // (the second lands at once: well inside the 110 ms before a touch paints)
      await T(cdp, 'touchStart', [
        { x: q[0].x, y: q[0].y, id: 1 },
        { x: f2.x, y: f2.y, id: 2 },
      ]);
      for (let i = 1; i <= 4; i++)
        await T(cdp, 'touchMove', [
          { x: q[0].x - i * 4, y: q[0].y - i * 4, id: 1 },
          { x: f2.x + i * 4, y: f2.y + i * 4, id: 2 },
        ]);
      await T(cdp, 'touchEnd', []);
      await idle(page);
      p = await plan(page);
      assert.deepEqual(p.a, p0.a, 'a pinch that starts one finger at a time paints nothing');
      assert.equal(p.n, p0.n);
      await fitPicture(page);
      // one finger: tap paints its section
      await T(cdp, 'touchStart', [{ x: q[0].x, y: q[0].y }]);
      await T(cdp, 'touchEnd', []);
      await idle(page);
      p = await plan(page);
      assert.equal(p.a[ls[0]], k);
      assert.equal(p.n, p0.n + 1, 'a touch tap is one step');
      // one finger held (so it paints), then a second finger: the painted section stays, the stroke ends, the rest is a pinch
      p0 = p;
      await T(cdp, 'touchStart', [{ x: q[1].x, y: q[1].y, id: 1 }]);
      await until(
        page,
        ([l, k]) => __mstest.assignData.assign[l].mkey === k,
        [ls[1], k],
        'the held finger painting its section',
      );
      await T(cdp, 'touchStart', [
        { x: q[1].x, y: q[1].y, id: 1 },
        { x: q[2].x, y: q[2].y, id: 2 },
      ]);
      for (let i = 1; i <= 4; i++)
        await T(cdp, 'touchMove', [
          { x: q[1].x - i * 10, y: q[1].y, id: 1 },
          { x: q[2].x + i * 10, y: q[2].y, id: 2 },
        ]);
      await T(cdp, 'touchEnd', []);
      await idle(page);
      p = await plan(page);
      assert.equal(p.a[ls[1]], k, 'painted before the second finger: kept');
      assert.deepEqual(
        Object.keys(p.a)
          .filter((x) => p.a[x] !== p0.a[x])
          .map(Number),
        [ls[1]],
        'the second finger paints nothing',
      );
      assert.equal(p.n, p0.n + 1, 'one step');
      assert.deepEqual(errors, []);
    },
  );
  test(
    'Paint off: a tap opens the picker as before; leaving the Pattern tab or Manual turns Paint off; the page still scrolls outside the picture',
    CDP_ONLY,
    async () => {
      const { page, errors } = await openApp();
      await sampleGuide(page);
      await manual(page);
      await page.click('#sfPaint');
      await idle(page);
      await page.click('#sfPaint');
      await idle(page);
      assert.equal(await page.evaluate(() => __mstest.paintOn), false);
      assert.equal(await page.evaluate(() => document.getElementById('sfCanvas').style.cursor), '');
      const [l] = await bigSections(page, 1),
        p0 = await plan(page);
      await tap(page, l);
      assert.ok(await page.isVisible('#sfSheet'), 'picker straight away');
      assert.equal(await page.textContent('#sfSheetT'), 'Change colour');
      await page.click('#sfPopCancel');
      await idle(page);
      assert.deepEqual((await plan(page)).a, p0.a);
      // leaving the Pattern tab
      await page.click('#sfPaint');
      await page.click('.sftabbtn[data-t="colours"]');
      await idle(page);
      assert.equal(await page.evaluate(() => __mstest.paintOn), false, 'off after leaving Pattern');
      await page.click('.sftabbtn[data-t="pattern"]');
      assert.equal(await page.textContent('#sfPaint'), 'Paint');
      // leaving Manual
      await page.click('#sfPaint');
      await page.click('#sfFam [data-v="random"]');
      await idle(page);
      assert.equal(await page.evaluate(() => __mstest.paintOn), false, 'off after leaving Manual');
      assert.equal(await page.locator('#sfPaint').count(), 0);
      await page.click('#sfFam [data-v="manual"]');
      await idle(page);
      assert.equal(await page.textContent('#sfPaint'), 'Paint', 'still off back in Manual');
      // a finger swipe on the controls (outside the picture) scrolls the page while painting
      await page.click('#sfPaint');
      await idle(page);
      const cdp = await page.context().newCDPSession(page);
      await touch(cdp);
      await scrollTop(page);
      const y0 = await page.evaluate(() => scrollY),
        box = await page.evaluate(() => document.querySelector('.sfbar').getBoundingClientRect().toJSON());
      const sx = 195,
        sy = Math.min(800, box.y - 20);
      await T(cdp, 'touchStart', [{ x: sx, y: sy }]);
      for (let i = 1; i <= 8; i++) await T(cdp, 'touchMove', [{ x: sx, y: sy - i * 30 }]);
      await T(cdp, 'touchEnd', []);
      await idle(page);
      assert.ok((await page.evaluate(() => scrollY)) > y0, 'page scrolled');
      assert.deepEqual(errors, []);
    },
  );
}

// ---- from pins-and-change-colour.test.mjs ----
// Changing one section's colour, and pins, from a tap (from UX release 2, part B). A tap in the guide editor shows the
// section's marker with "Change colour" and "Pin"; the marker picker is grouped by colour family with codes on
// the tiles and a "Recently used" row; Pin colours mode toggles pins directly; Blend keeps taps for anchors and
// uses press and hold; Manual keeps opening the picker; Fill unpinned sections.
{
  // big sections whose label points are well inside the picture (not under the zoom row), biggest first
  const bigSections = (page, n = 6) =>
    page.evaluate((n) => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        z = document.getElementById('sfZoomCtl').getBoundingClientRect();
      return t.assignData.order
        .filter((l) => {
          const q = t.labelPos(l),
            y = r.top + (q.y / c.height) * r.height,
            x = r.left + (q.x / c.width) * r.width;
          return (
            y > r.top + 12 &&
            y < (z.top > r.top + 20 ? Math.min(r.bottom, z.top) : r.bottom) - 12 &&
            x > r.left + 12 &&
            x < r.right - 12
          );
        })
        .sort((a, b) => t.comps[b].area - t.comps[a].area)
        .slice(0, n);
    }, n);
  const mk = (page, l) => page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
  const lock = (page, l) => page.evaluate((l) => __mstest.locks[l] ?? null, l);
  async function tap(page, l) {
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  async function styleTab(page) {
    await page.click('.sftabbtn[data-t="pattern"]');
  }
  async function pattern(page, v) {
    await styleTab(page);
    await page.click(`#sfFam [data-v="${v}"]`);
    await idle(page);
  }
  // a marker in the collection that is not `not`, from a different family, and its tile
  const otherKey = (page, not) =>
    page.evaluate((not) => {
      const b = [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')];
      const cur = b.find((x) => x.dataset.k === not);
      const g = cur && cur.closest('.sfswg');
      const o = b.find((x) => x.dataset.k !== not && x.closest('.sfswg') !== g);
      return o.dataset.k;
    }, not);
  const pickTile = (page, k) => page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
  // compare the canvas with a from-scratch redraw of the same state
  const vsFull = (page) =>
    page.evaluate(() => {
      const c = document.getElementById('sfCanvas'),
        g = c.getContext('2d');
      __mstest.renderGuide();
      const a = g.getImageData(0, 0, c.width, c.height).data.slice();
      __mstest.forceFullRender();
      __mstest.renderGuide();
      const b = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
      return n;
    });
  // ---- From the fourth review (v263 guide screen) ----
  const biggestSections = (page, n = 6) =>
    page.evaluate((n) => {
      const t = __mstest;
      return t.assignData.order
        .slice()
        .sort((a, b) => t.comps[b].area - t.comps[a].area)
        .slice(0, n);
    }, n);
  async function tapSection(page, l) {
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  test('Gradient: a tap shows the marker with Change colour and Pin; Pin survives Shuffle; Unpin goes back to the pattern', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const [l] = await bigSections(page, 1),
      code = await page.evaluate((l) => __mstest.assignData.assign[l].code, l);
    await tap(page, l);
    assert.ok(await page.isVisible('.sftip'), 'tip shown');
    assert.match(await page.textContent('.sftip'), new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(await page.textContent('.sftip [data-a="change"]'), 'Change colour');
    assert.equal(await page.textContent('.sftip [data-a="pin"]'), 'Pin');
    assert.ok(!(await page.isVisible('.sftippin')), 'no Pinned chip yet');
    assert.match(await page.textContent('#sfLive'), new RegExp(code));
    // it stays (no timer) and sits inside the picture's frame
    await idle(page, 2600);
    assert.ok(await page.isVisible('.sftip'), 'a tip with buttons does not go by itself');
    const inside = await page.evaluate(() => {
      const t = document.querySelector('.sftip').getBoundingClientRect(),
        v = document.getElementById('sfView').getBoundingClientRect();
      return t.left >= v.left && t.right <= v.right && t.top >= v.top && t.bottom <= v.bottom;
    });
    assert.ok(inside, 'tip inside the picture frame');
    const orig = await mk(page, l);
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    assert.equal(await lock(page, l), orig, 'pinned to its marker');
    assert.equal(await page.textContent('.sftip [data-a="pin"]'), 'Unpin');
    assert.ok(await page.isVisible('.sftippin'), 'Pinned chip');
    await styleTab(page);
    assert.match(await page.textContent('#sfLock'), /· 1/);
    // Shuffle: the pinned section keeps its marker, the others change
    const before = await page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const k in a) o[k] = a[k].mkey;
      return o;
    });
    await styleTab(page);
    await page.click('#sfVary');
    await idle(page);
    const after1 = await page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const k in a) o[k] = a[k].mkey;
      return o;
    });
    assert.equal(after1[l], orig, 'pinned section kept');
    assert.ok(Object.keys(before).filter((k) => before[k] !== after1[k]).length > 3, 'others changed');
    // Unpin: back to the pattern's colour
    await tap(page, l);
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    assert.equal(await lock(page, l), null);
    const back = await page.evaluate((l) => __mstest.assignData.base[l].mkey, l);
    assert.equal(await mk(page, l), back, "Unpin gives the section the pattern's colour");
    assert.equal(await page.textContent('.sftip [data-a="pin"]'), 'Pin');
    assert.deepEqual(errors, []);
  });
  test('Change colour: pick, Done pins it through Shuffle and every pattern; Cancel and Escape undo; picker layout', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const [l] = await bigSections(page, 1),
      orig = await mk(page, l);
    await tap(page, l);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet', { state: 'visible' });
    assert.ok(!(await page.isVisible('.sftip')), 'the tip gives way to the picker');
    assert.equal(await page.textContent('#sfSheetT'), 'Change colour');
    const lay = await page.evaluate(() => {
      const pop = document.getElementById('sfSheet'),
        tiles = [...pop.querySelectorAll('.sfsw')];
      return {
        role: pop.getAttribute('role'),
        lab: document.getElementById(pop.getAttribute('aria-labelledby'))?.textContent,
        sub: pop.querySelector('.sfpops')?.textContent || '',
        codes: tiles.every(
          (b) =>
            b.querySelector('.sfswt').textContent.toUpperCase() === b.dataset.code &&
            b.hasAttribute('aria-pressed'),
        ),
        groups: [...pop.querySelectorAll('.sfswg:not(.sfswrec)')].map(
          (g) => g.querySelector('.sfswh').textContent,
        ),
        roles: [...pop.querySelectorAll('.sfswg')].every(
          (g) => g.getAttribute('role') === 'group' && g.getAttribute('aria-labelledby'),
        ),
        order: FAM_ORDER,
        recent: [...pop.querySelectorAll('.sfswrec .sfswh')].some((h) => h.textContent === 'Recently used'),
        short: [...pop.querySelectorAll('.sfswrec .sfswh')].map((h) => h.textContent),
        n: new Set(tiles.map((b) => b.dataset.k)).size,
        coll: sfCollection().length,
        confirmBg: getComputedStyle(document.getElementById('sfPopConfirm')).backgroundColor,
        cancelBg: getComputedStyle(document.getElementById('sfPopCancel')).backgroundColor,
        light: [...pop.querySelectorAll('.sfswg:not(.sfswrec)')].every((g) => {
          const L = [...g.querySelectorAll('.sfsw')].map(
            (b) => __mstest.assignData && sfCollection().find((m) => m.mkey === b.dataset.k).lab[0],
          );
          return L.every((v, i) => i === 0 || v <= L[i - 1] + 1e-9);
        }),
        w: pop.getBoundingClientRect().width,
        inline: pop.querySelector('#sfPopSw').style.maxHeight,
      };
    });
    assert.equal(lay.role, 'dialog');
    assert.equal(lay.lab, 'Change colour');
    assert.match(lay.sub, /Now/);
    assert.ok(lay.codes, 'every tile shows its code, matching data-code');
    assert.ok(lay.roles, 'groups are labelled groups');
    const idx = lay.groups.map((g) => lay.order.indexOf(g));
    assert.ok(
      idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1])),
      'groups follow the family order: ' + lay.groups.join(', '),
    );
    assert.ok(lay.light, 'each group runs light to dark');
    assert.equal(lay.recent, false, 'nothing recently used yet');
    // (v318.26: and Skin tones, as Honolulu 120 has 3 or more of them)
    assert.deepEqual(lay.short, ['Closest', 'In this guide', 'Skin tones'], 'v288: the shortcuts first');
    assert.equal(lay.n, lay.coll, 'every marker in the collection');
    assert.equal(lay.confirmBg, 'rgb(111, 78, 245)', 'Done is the primary button');
    assert.equal(await page.textContent('#sfPopConfirm'), 'Done');
    assert.notEqual(lay.cancelBg, lay.confirmBg);
    assert.equal(lay.w, 390, 'the picker is a sheet across the screen: ' + lay.w);
    assert.equal(lay.inline, '', 'no fixed 150px list height');
    // Cancel undoes the preview
    const k1 = await otherKey(page, orig);
    await pickTile(page, k1);
    await idle(page);
    assert.equal(await mk(page, l), k1, 'previews live');
    assert.equal(
      await page.evaluate(
        (k) =>
          [...document.querySelectorAll(`#sfPopSw .sfsw[data-k="${k}"]`)].every(
            (b) => b.classList.contains('on') && b.getAttribute('aria-pressed') === 'true',
          ),
        k1,
      ),
      true,
    );
    await page.click('#sfPopCancel');
    await idle(page);
    assert.equal(await mk(page, l), orig);
    assert.equal(await lock(page, l), null);
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-recent-mk')),
      null,
      'Cancel does not count as used',
    );
    // Escape undoes too
    await tap(page, l);
    await page.click('.sftip [data-a="change"]');
    await pickTile(page, k1);
    await idle(page);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(!(await page.isVisible('#sfSheet')));
    assert.equal(await mk(page, l), orig);
    assert.equal(await lock(page, l), null);
    // Done keeps it as a pin
    await tap(page, l);
    await page.click('.sftip [data-a="change"]');
    await pickTile(page, k1);
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.equal(await mk(page, l), k1);
    assert.equal(await lock(page, l), k1);
    await styleTab(page);
    await page.click('#sfVary');
    await idle(page);
    assert.equal(await mk(page, l), k1, 'kept through Shuffle');
    for (const v of ['random', 'blend', 'manual', 'gradient']) {
      await pattern(page, v);
      assert.equal(await mk(page, l), k1, 'kept in ' + v);
    }
    await page.click('#sfSurprise');
    await idle(page);
    assert.equal(await mk(page, l), k1, 'kept through Surprise');
    // the next picker starts with the shortcut rows; k1 is remembered as recently used (which survives a reload), and as
    // it's this section's marker now it shows in In this guide, so Recently used doesn't repeat it (v288)
    await tap(page, l);
    await page.click('.sftip [data-a="change"]');
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('#sfPopSw .sfswrec')].map((g) => [
        g.querySelector('.sfswh').textContent,
        [...g.querySelectorAll('.sfsw')].map((b) => b.dataset.k),
      ]),
    );
    assert.ok(
      rows.some(([h, ks]) => h === 'In this guide' && ks.includes(k1)),
      JSON.stringify(rows),
    );
    assert.ok(!rows.some(([h]) => h === 'Recently used'), 'nothing recent that isn’t shown above');
    assert.equal(
      await page.evaluate(() => document.querySelector('#sfPopSw .sfswg').classList.contains('sfswrec')),
      true,
      'shortcut rows first',
    );
    // filtering hides the recent row and empty groups
    const code = await page.evaluate(
      () => document.querySelector('#sfPopSw .sfswg:not(.sfswrec) .sfsw').dataset.code,
    );
    await page.fill('#sfPopFilter', code.slice(0, 2).toLowerCase());
    await idle(page);
    const f = await page.evaluate((q) => {
      const sw = document.getElementById('sfPopSw'),
        vis = (e) => !!e.offsetParent;
      return {
        rec: vis(sw.querySelector('.sfswrec')),
        groups: [...sw.querySelectorAll('.sfswg:not(.sfswrec)')]
          .filter(vis)
          .map((g) => [...g.querySelectorAll('.sfsw')].filter(vis).length),
        bad: [...sw.querySelectorAll('.sfsw')].filter(vis).some((b) => !b.dataset.code.startsWith(q)),
      };
    }, code.slice(0, 2).toUpperCase());
    assert.equal(f.rec, false, 'recent row hidden while filtering');
    assert.ok(
      f.groups.length >= 1 && f.groups.every((n) => n > 0),
      'only groups with matches: ' + JSON.stringify(f.groups),
    );
    assert.equal(f.bad, false);
    await page.click('#sfPopCancel');
    await page.reload();
    await page.waitForFunction(() => window.__mstest);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-recent-mk'))), [k1]);
    assert.deepEqual(errors, []);
  });
  test('colour along never shows the buttons, and an open tip closes when colouring starts', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const [l, l2] = await bigSections(page, 2);
    await tap(page, l);
    assert.ok(await page.isVisible('.sftip [data-a="pin"]'));
    await page.click('#sfColor');
    await idle(page);
    assert.equal(await page.locator('.sftip').count(), 0, 'tip closed on entering colour along');
    await tap(page, l2);
    assert.equal(await page.locator('.sftip [data-a]').count(), 0, 'no buttons while colouring');
    assert.deepEqual(errors, []);
  });
  test('Pin colours mode: a tap toggles the pin, with no picker', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const [l] = await bigSections(page, 1),
      orig = await mk(page, l);
    await styleTab(page);
    await page.click('#sfLock');
    await idle(page);
    assert.match(
      await page.textContent('.sftab[data-tab="pattern"]'),
      /Tap sections to pin or unpin their colour\./,
    );
    await tap(page, l);
    assert.ok(!(await page.isVisible('#sfSheet')), 'no picker');
    assert.equal(await page.locator('.sftip').count(), 0, 'no tip');
    assert.equal(await lock(page, l), orig);
    assert.match(await page.textContent('#sfLock'), /· 1/);
    await tap(page, l);
    assert.equal(await lock(page, l), null, 'second tap unpins');
    assert.equal(await vsFull(page), 0, 'redraw matches a full redraw');
    assert.deepEqual(errors, []);
  });
  test('shading on: a new colour brings its own tones, drawn exactly as a full redraw', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await page.click('.sftabbtn[data-t="colours"]');
    const [l] = await bigSections(page, 1),
      orig = await mk(page, l);
    await page.evaluate((l) => {
      __mstest.tonePart[l] = 1;
    }, l);
    await tap(page, l);
    await page.click('.sftip [data-a="change"]');
    const k1 = await otherKey(page, orig);
    await pickTile(page, k1);
    await page.click('#sfPopConfirm');
    await idle(page);
    const code = await page.evaluate((l) => __mstest.assignData.assign[l].code, l);
    assert.equal(
      await page.evaluate((l) => __mstest.tonePart[l], l),
      0,
      'part-done tones reset for the new marker',
    );
    await tap(page, l);
    assert.match(
      await page.textContent('.sftip .sftipsh'),
      new RegExp('B ' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'tip lists the new base',
    );
    assert.equal(await vsFull(page), 0, 'redraw matches a full redraw');
    assert.deepEqual(errors, []);
  });
  test('a changed colour and a pin come back when the guide is saved and opened again', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const [l, l2] = await bigSections(page, 2),
      orig = await mk(page, l);
    await tap(page, l);
    await page.click('.sftip [data-a="change"]');
    const k1 = await otherKey(page, orig);
    await pickTile(page, k1);
    await page.click('#sfPopConfirm');
    await idle(page);
    await tap(page, l2);
    await page.click('.sftip [data-a="pin"]');
    const k2 = await mk(page, l2);
    const cx = await page.evaluate(
      (ls) => ls.map((l) => [__mstest.comps[l].cx, __mstest.comps[l].cy]),
      [l, l2],
    );
    await saveGuide(page);
    await idle(page);
    await page.reload();
    await page.click('#mHome');
    await page.click('#sfRecent [data-gid]');
    await page.waitForFunction(() => __mstest.assignData);
    await idle(page);
    // section numbers can change on reopening: find them by position
    const r = await page.evaluate((cx) => {
      const t = __mstest;
      return cx.map(([x, y]) => {
        const l = t.labels[Math.round(y) * t.W + Math.round(x)];
        return {
          m: t.assignData.assign[l].mkey,
          k: t.locks[l] ?? null,
          base: !!(t.assignData.base && t.assignData.base[l]),
        };
      });
    }, cx);
    assert.deepEqual(
      r.map((x) => [x.m, x.k]),
      [
        [k1, k1],
        [k2, k2],
      ],
    );
    assert.ok(
      r.every((x) => x.base),
      'Unpin has something to go back to',
    );
    assert.deepEqual(errors, []);
  });
  test('keyboard: Tab reaches the tip buttons, Escape closes the tip', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const [l] = await bigSections(page, 1);
    await tap(page, l);
    let got = null;
    for (let i = 0; i < 12 && !got; i++) {
      await page.keyboard.press('Tab');
      got = await page.evaluate(() =>
        document.activeElement?.closest('.sftip') ? document.activeElement.dataset.a : null,
      );
    }
    assert.equal(got, 'change', 'Tab lands on Change colour');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.a), 'pin');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.ok(await lock(page, l), 'Enter pins');
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.a),
      'pin',
      'focus stays on the button',
    );
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.locator('.sftip').count(), 0);
    assert.deepEqual(errors, []);
  });
  test('Blend: a tap still adds an anchor; press and hold shows the tip without adding one', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await pattern(page, 'blend');
    const n0 = await page.evaluate(() => __mstest.anchors.length);
    const ls = await bigSections(page, 6);
    const far = await page.evaluate(
      (ls) =>
        ls.find((l) => {
          const t = __mstest,
            c = t.comps[l],
            tol = Math.max(t.W, t.H) * 0.06;
          return t.anchors.every((a) => Math.hypot(a.x - c.cx, a.y - c.cy) > tol);
        }),
      ls,
    );
    await scrollTop(page);
    const p = await sectionPoint(page, far);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await idle(page);
    await page.mouse.up();
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.anchors.length), n0, 'press and hold adds no anchor');
    assert.ok(await page.isVisible('.sftip [data-a="pin"]'), 'tip with buttons');
    assert.match(
      await page.textContent('.sftab[data-tab="pattern"]'),
      /Press and hold a section to change or pin its colour/,
    );
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    assert.ok(await lock(page, far), 'pinned in Blend');
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.anchors.length), n0 + 1, 'a plain tap adds an anchor');
    assert.equal(await page.locator('.sftip').count(), 0, 'and closes the tip');
    assert.deepEqual(errors, []);
  });
  test('Manual: a tap still opens the picker, with Unpin (allow fill) on a pinned section', async () => {
    const { page, errors } = await openApp({ width: 1100, height: 900 });
    await sampleGuide(page);
    await pattern(page, 'manual');
    assert.match(await page.textContent('.sftab[data-tab="pattern"]'), /Tap a section to set its colour/);
    const [l] = await bigSections(page, 1),
      orig = await mk(page, l);
    await tap(page, l);
    assert.ok(await page.isVisible('#sfSheet'), 'picker straight away');
    assert.equal(await page.locator('.sftip').count(), 0);
    assert.equal(await page.locator('#sfPopExtra').count(), 0, 'not pinned: no Unpin');
    const k1 = await otherKey(page, orig);
    await pickTile(page, k1);
    // a tap on another section (one the picker doesn't cover) keeps this one and opens the picker for that one
    const l2 = await page.evaluate((l) => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        pr = document.getElementById('sfSheet').getBoundingClientRect();
      return t.assignData.order
        .filter((k) => k !== l && t.comps[k].area > 400)
        .find((k) => {
          const q = t.labelPos(k),
            x = r.left + (q.x / c.width) * r.width,
            y = r.top + (q.y / c.height) * r.height;
          return (
            y > r.top + 8 &&
            y < r.bottom - 8 &&
            x > r.left + 8 &&
            x < r.right - 8 &&
            (x < pr.left - 8 || x > pr.right + 8 || y < pr.top - 8 || y > pr.bottom + 8) &&
            document.elementFromPoint(x, y) === c
          );
        });
    }, l);
    assert.ok(l2, 'a section outside the picker');
    await tap(page, l2);
    assert.equal(await mk(page, l), k1);
    assert.equal(await lock(page, l), k1);
    assert.ok(await page.isVisible('#sfSheet'), 'picker open for the next section');
    await page.click('#sfPopCancel');
    await idle(page);
    await tap(page, l);
    assert.equal(await page.textContent('#sfPopExtra'), 'Unpin (allow fill)');
    await page.click('#sfPopExtra');
    await idle(page);
    assert.equal(await lock(page, l), null);
    assert.equal(await mk(page, l), k1, 'Manual keeps the colour when unpinned');
    assert.deepEqual(errors, []);
  });
  test('Photo: a pinned section is not left white, and its tip has the buttons', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const [l, l2] = await bigSections(page, 2),
      orig = await mk(page, l);
    await tap(page, l);
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    // a white photo: every section it covers would be left white
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 800;
      const g = c.getContext('2d');
      g.fillStyle = '#fcfcfa';
      g.fillRect(0, 0, 600, 800);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    await styleTab(page);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'white.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking);
    await idle(page);
    if (await page.evaluate(() => __mstest.photoAlign)) {
      await page.click('#sfPhAlign');
      await idle(page);
    }
    const r = await page.evaluate(
      ([l, l2]) => {
        const a = __mstest.assignData;
        return {
          m: a.assign[l] && a.assign[l].mkey,
          paper: !!(a.paper && a.paper[l]),
          paper2: !!(a.paper && a.paper[l2]),
        };
      },
      [l, l2],
    );
    assert.equal(r.paper2, true, 'an unpinned section is left white');
    assert.equal(r.paper, false);
    assert.equal(r.m, orig, 'the pinned one keeps its marker');
    await tap(page, l);
    assert.ok(await page.isVisible('.sftip [data-a="pin"]'));
    assert.match(await page.textContent('.sftip'), /\(pinned\)/);
    assert.equal(await page.textContent('.sftip [data-a="pin"]'), 'Unpin');
    // a white section: no buttons
    await tap(page, l2);
    assert.equal(await page.locator('.sftip [data-a]').count(), 0);
    assert.deepEqual(errors, []);
  });
  test('while a marker picker is open: no Undo in the tool row, no auto-save of the preview; Done is announced', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await saveGuide(page);
    await idle(page);
    const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id),
      savedAssign = () =>
        page.evaluate((id) => IDB.get('guide-' + id).then((p) => JSON.stringify(p.assign)), id);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfVary');
    await idle(page, 2500);
    assert.equal(await page.isVisible('#sfPlanUndo'), true);
    const before = await savedAssign();
    const [l] = await biggestSections(page, 1),
      code = await page.evaluate((l) => __mstest.assignData.assign[l].code, l);
    await scrollTop(page);
    await tapSection(page, l);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet.sfpicksh');
    assert.equal(await page.isVisible('#sfPlanUndo'), false, 'Undo hidden: the sheet has Cancel');
    const k = await page.evaluate(
      (cur) =>
        [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')].find((b) => b.dataset.k !== cur)
          .dataset.k,
      await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l),
    );
    await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
    await idle(page, 2500);
    assert.equal(await savedAssign(), before, 'the preview is not saved');
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.match(
      await page.textContent('#sfLive'),
      new RegExp('^' + code + ' → \\S+ .*1 section'),
      'announced: ' + (await page.textContent('#sfLive')),
    );
    await idle(page, 2500);
    assert.notEqual(await savedAssign(), before, 'saved once confirmed');
    assert.equal(await page.isVisible('#sfPlanUndo'), true);
    assert.deepEqual(errors, []);
  });
  // ---- From the fifth review (data safety) ----
  test('Fill unpinned sections leaves sections ticked done with their marker', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    const l = await page.evaluate(() => __mstest.assignData.order[3]);
    await page.evaluate((l) => {
      __mstest.colored[l] = 1;
      __mstest.renderGuide();
    }, l);
    const m0 = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
    const k = await page.evaluate((m0) => sfCollection().find((m) => m.mkey !== m0).mkey, m0);
    await page.evaluate(() => __mstest.openFillPop());
    await page.waitForSelector('#sfPopSw');
    await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.equal(
      await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l),
      m0,
      'the done section keeps its marker',
    );
    assert.equal(
      await page.evaluate((l) => __mstest.assignData.assign[__mstest.assignData.order[5]].mkey, l),
      k,
      'the others are filled',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from rough-count.test.mjs ----
// v318 review: Smooth them brings markers the guide doesn't use, so the page could end up with more markers than
// "Markers in this guide" says, without a word. Its line now says how many more before the tap ("Smooth them (+1 marker)",
// read out "Smooth them, with 1 more marker on the page"), and the page has that many more after it.
{
  const pageCount = (page) =>
    page.evaluate(() => {
      const A = __mstest.assignData.assign;
      return new Set(__mstest.assignData.order.filter((l) => A[l]).map((l) => A[l].mkey)).size;
    });
  const said = async (page) => {
    const t = await page.textContent('#sfRoughGo');
    const m = /^Smooth them(?: \(\+(\d+) markers?\))?$/.exec(t.trim());
    assert.ok(m, 'the button says: ' + t);
    return m[1] ? +m[1] : 0;
  };
  test('a small Gradient zone at the top of the sample: the line says how many more markers, and the page has them', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    const top = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order
        .map((l) => [l, t.comps[l].cy])
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .map((x) => x[0]);
    });
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfZoneAdd');
    await idle(page);
    for (const l of top) {
      await scrollTop(page);
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
    }
    await page.click('#sfZoneDone');
    await idle(page);
    await page.click('#sfPanel-pattern .sfzchip[data-z="0"]');
    await idle(page);
    assert.ok(await page.isVisible('#sfRoughGo'), 'rough spots to smooth');
    const n = await said(page),
      before = await pageCount(page);
    assert.ok(n > 0, 'it brings at least one');
    await page.click('#sfRoughGo');
    await idle(page);
    assert.equal(await pageCount(page), before + n, `${before} + ${n} markers on the page`);
    assert.match(
      (await page.textContent('#sfStat')).replace(/\s+/g, ' '),
      new RegExp(`${before + n} markers`),
      'the tool row says so',
    );
    assert.deepEqual(errors, []);
  });
  test('all of a big collection in play: the count it says is the count it adds', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.styleVars.gradIncl = null;
      state.owned = new Set(defaultOwned());
      save();
      t.coll = sfCollection();
      t.styleVars.limitN = 999;
      t.reassign();
    });
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.evaluate(() => __mstest.renderControls());
    await idle(page);
    // (every marker in play: the line can take a while on GitHub's WebKit, which once missed the usual 30 s, v318.18)
    await page.waitForSelector('#sfRoughGo', { timeout: 90000 });
    const n = await said(page),
      before = await pageCount(page);
    await page.click('#sfRoughGo');
    await idle(page);
    assert.equal(await pageCount(page), before + n, `${before} + ${n}`);
    assert.deepEqual(errors, []);
  });
}

// ---- from v287-review.test.mjs ----
// v287's fresh-eyes review: changes kept as the page goes leave the Library row alone until they're in the guide, and
// never a colour only tried in the picker; a new guide saves straight after Build; zooming doesn't paint the plan over
// Edit sections, nor does a visit elsewhere after Reveal; a Temperature with no markers stays as it was; Focus mode
// stamps the start date and hands back its marker's row; very wide pictures keep their shape; the tool row stays
// above the bar on a tiny screen with large text; clearer no-markers words; guide files with no markers refused;
// Blend plan groups and the ink choice for the keyboard and screen readers.
{
  test('Temperature: a choice none of your markers have stays as it was, and says so', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    // only warm markers owned
    await page.evaluate(() => {
      const ks = [];
      COLORS.forEach((c, i) => {
        if (/^R\d|^YR|^RV/.test(c.code) && c.brand === 'Ohuhu') ks.push(i);
      });
      state.owned = new Set(ks.slice(0, 12));
      save();
      SF.setCollection(sfCollection());
    });
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    const was = await page.getAttribute('#sfPal .sfedit.on', 'data-v');
    assert.notEqual(was, 'cool');
    await page.click('#sfPal [data-v="cool"]');
    await idle(page);
    assert.equal(await page.getAttribute('#sfPal .sfedit.on', 'data-v'), was, 'Temperature stays');
    assert.match(await page.textContent('#sfMeta'), /None of your markers are cool/);
    assert.equal(await page.getAttribute(`#sfPal [data-v="${was}"]`, 'aria-pressed'), 'true');
    assert.deepEqual(errors, []);
  });
  test('Blend plan colour groups are buttons that say whether they are open; the ink choice is pressed buttons', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    await page.click('#sfPlan');
    await idle(page);
    const g = await page.$('.plangrp');
    if (g) {
      assert.equal(await g.evaluate((e) => e.tagName), 'BUTTON');
      assert.equal(await g.getAttribute('aria-expanded'), 'false');
      await g.focus();
      await page.keyboard.press('Enter');
      await idle(page);
      assert.equal(
        await page.evaluate(
          () =>
            document.activeElement.classList.contains('plangrp') &&
            document.activeElement.getAttribute('aria-expanded'),
        ),
        'true',
        'opened by keyboard, focus kept',
      );
    }
    assert.deepEqual(errors, []);
  });
}

// ---- from v289.test.mjs ----
// v289: fixes from the fresh-eyes review of v288 — ← Plan › Discard of edits brought back by Resume, a palette held for
// the next guide and a photo that won't open, section edits beyond Undo, Use in a guide › Recolour from Colour along,
// Change colour after an iPad turns, a backup restored over a guide deleted while open, Generate keeping the keyboard,
// Edit sections' tools on a phone's first screen, the guide saved at once on leaving it, focus after Change colour.
{
  const bigSec = (page, i = 2) =>
    page.evaluate((i) => {
      const t = __mstest;
      return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[i];
    }, i);
  test('Change colour open as an iPad turns from landscape to portrait (or a phone size): the sheet keeps its room, Done on screen', async () => {
    for (const to of [
      [834, 1194],
      [390, 844],
      [320, 568],
    ]) {
      const { page, errors, ctx } = await openApp({ width: 1194, height: 834 });
      await sampleGuide(page);
      const l = await bigSec(page);
      await scrollTop(page);
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
      await page.click('.sftip [data-a="change"]');
      await page.waitForSelector('#sfSheet', { state: 'visible' });
      await idle(page);
      await page.setViewportSize({ width: to[0], height: to[1] });
      await idle(page);
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => ({
        h: document.getElementById('sfSheet').getBoundingClientRect().height,
        done: document.getElementById('sfPopConfirm').getBoundingClientRect().bottom,
        vh: innerHeight,
      }));
      assert.ok(m.h >= to[1] * 0.45, `${to}: the sheet's room (${m.h})`);
      assert.ok(m.done <= m.vh, `${to}: Done on screen`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Change colour › Done by keyboard: focus stays on screen (the section’s tip, or Unpin), not ⋯ at the top', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const l = await bigSec(page);
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet', { state: 'visible' });
    await idle(page);
    await page.click('#sfPopSw .sfswrec .sfsw:not(.on)');
    await idle(page);
    await page.focus('#sfPopConfirm');
    await page.keyboard.press('Enter');
    await idle(page);
    // (back on the section's tip, its Change colour, when the keyboard brought it there; else Unpin or the tab)
    const a = await page.evaluate(() => {
      const e = document.activeElement,
        r = e.getBoundingClientRect();
      return { id: e.id, tip: !!e.closest('.sftip'), on: r.top >= 0 && r.bottom <= innerHeight };
    });
    assert.ok(a.tip || a.id === 'sfPinUn' || /^sfTab-/.test(a.id), JSON.stringify(a));
    assert.ok(a.on, 'on screen');
    assert.deepEqual(errors, []);
  });
  test('sheets: the markers list counts its shading markers in the title; a sideways row fades at its edge; Print says less on a small phone', async () => {
    {
      const { page, errors, ctx } = await openApp();
      await sampleGuide(page);
      await page.click('.sftabbtn[data-t="shading"]');
      await page.evaluate(() => __mstest.shadeTo('full'));
      await idle(page);
      await page.click('.sftabbtn[data-t="colours"]');
      await idle(page);
      await page.click('#sfMkList');
      await page.waitForSelector('#sfSheet', { state: 'visible' });
      await idle(page);
      const n = await page.$$eval('#sfSheet button.sfmlrow', (b) => b.length),
        t = await page.$$eval('#sfSheet .sfmlgrp ~ .sfmlrow', (b) => b.length);
      assert.ok(t > 0, 'some markers for shading');
      assert.equal(await page.textContent('#sfSheetT'), `${n} markers on this page, ${t} more for shading`);
      await page.click('#sfSheet [data-ml="done"]');
      await idle(page);
      // Change colour's rows: the faded edge goes once a row is scrolled to its end
      const p = await page.evaluate(() => {
        const t = __mstest,
          l = t.assignData.order[10],
          q = t.labelPos(l),
          c = document.getElementById('sfCanvas').getBoundingClientRect();
        return { x: c.left + (q.x / t.W) * c.width, y: c.top + (q.y / t.H) * c.height };
      });
      await page.mouse.click(p.x, p.y);
      await page.waitForSelector('.sftip');
      await page.click('.sftip >> text=Change colour');
      await page.waitForSelector('#sfSheet.sfpicksh');
      await idle(page);
      const row = '#sfPopSw .sfswrow .sfswl';
      assert.equal(
        await page.$eval(row, (r) => r.classList.contains('sffade') === r.scrollWidth > r.clientWidth + 2),
        true,
        'faded when there is more',
      );
      await page.$eval(row, (r) => {
        r.scrollLeft = r.scrollWidth;
        r.dispatchEvent(new Event('scroll'));
      });
      assert.equal(await page.$eval(row, (r) => r.classList.contains('sffade')), false, 'not at its end');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    {
      const { page, errors, ctx } = await openApp({ width: 320, height: 568 });
      await sampleGuide(page);
      await page.click('.sftabbtn[data-t="share"]');
      await page.click('#sfPrint');
      await page.waitForSelector('#sfSheet.sfprsh');
      await idle(page);
      // (v318.27: the close-ups note under Pages, in full, and the summary one line)
      assert.match(await page.textContent('#sfPrSum'), /^\d+ pages · Letter · Codes$/);
      assert.match(
        await page.textContent('#sfPrWhat'),
        /colour key\.\d+ small sections are on \d+ close-up pages?\./,
      );
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Change colour by keyboard: one Tab stop per row or group, the arrow keys within it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    // (v313: the page settled first, and the tap tried again if no tip came: GitHub's runner once tapped as the guide's
    // first frames were still moving the picture, and the tip never showed)
    await idle(page);
    for (let i = 0; i < 3 && !(await page.isVisible('.sftip')); i++) {
      const p = await page.evaluate(() => {
        const t = __mstest,
          l = t.assignData.order[10],
          q = t.labelPos(l),
          c = document.getElementById('sfCanvas').getBoundingClientRect();
        return { x: c.left + (q.x / t.W) * c.width, y: c.top + (q.y / t.H) * c.height };
      });
      await page.mouse.click(p.x, p.y);
      await page.waitForSelector('.sftip', { timeout: 5000 }).catch(() => {});
    }
    await page.waitForSelector('.sftip');
    await page.click('.sftip >> text=Change colour');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await idle(page);
    const stops = () =>
      page.evaluate(() => {
        const ls = [...document.querySelectorAll('#sfPopSw .sfswl')].filter((l) =>
          l.closest('.sfswg:not([hidden])'),
        );
        return {
          lists: ls.length,
          stops: ls.map(
            (l) => [...l.querySelectorAll('.sfsw')].filter((b) => b.tabIndex === 0 && !b.hidden).length,
          ),
        };
      });
    const s = await stops();
    assert.ok(s.lists > 5);
    assert.deepEqual(
      s.stops,
      s.stops.map(() => 1),
      'one Tab stop in each',
    );
    assert.ok(
      (await page.evaluate(() => document.querySelectorAll('#sfPopSw .sfsw').length)) > 100,
      'of a hundred and more markers',
    );
    // a family group of several lines: → along, ↓ to the line under, End and Home
    const g = await page.evaluate(() => {
      const l = [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfswl')].find(
        (x) => x.children.length > 12,
      );
      const b = l.querySelector('.sfsw');
      b.tabIndex = 0;
      b.focus();
      return [...l.querySelectorAll('.sfsw')].indexOf(b);
    });
    assert.equal(g, 0);
    const at = () =>
      page.evaluate(() => {
        const a = document.activeElement,
          l = a.closest('.sfswl');
        return { i: [...l.querySelectorAll('.sfsw')].indexOf(a), top: a.offsetTop, tab: a.tabIndex };
      });
    await page.keyboard.press('ArrowRight');
    assert.deepEqual(await at().then((x) => [x.i, x.tab]), [1, 0]);
    const t0 = (await at()).top;
    await page.keyboard.press('ArrowDown');
    assert.ok((await at()).top > t0, 'the line under');
    await page.keyboard.press('End');
    const n = await page.evaluate(
      () => document.activeElement.closest('.sfswl').querySelectorAll('.sfsw').length,
    );
    assert.equal((await at()).i, n - 1);
    await page.keyboard.press('Home');
    assert.equal((await at()).i, 0);
    // Enter picks it
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('on')), true);
    // filtered: still one stop in each group shown
    await page.fill('#sfPopFilter', 'B');
    await idle(page);
    const f = await stops();
    assert.deepEqual(
      f.stops,
      f.stops.map(() => 1),
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v298.test.mjs ----
// v298: fixes from the second fresh-eyes review of v297 — ticks follow merged and split sections; Focus mode says
// where it is up to; zones keep touching sections apart across their borders; a guide file with odd keys opens; the
// sets list follows Clear collection; and Scan's box: the same text again is still cleared, Enter then the same cap
// again is read, letters composed by an Android keyboard wait for Enter, and a card isn't repeated while held.
{
  const ticked = (page, ls) => page.evaluate((ls) => ls.map((l) => __mstest.colored[l]), ls);
  test('Undo after Change colour on a coloured section puts its marker back', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const l = await page.evaluate(() => {
      const t = __mstest;
      let best = 0,
        ba = 0;
      for (const l of t.assignData.order)
        if (t.comps[l].area > ba) {
          ba = t.comps[l].area;
          best = l;
        }
      t.colored[best] = 1;
      t.guideDirty = true;
      t.renderGuide();
      return best;
    });
    const mk = () => page.evaluate((l) => [__mstest.assignData.assign[l].mkey, __mstest.locks[l] ?? null], l);
    const [orig] = await mk();
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet', { state: 'visible' });
    const k1 = await page.evaluate(
      (not) =>
        [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')].find((b) => b.dataset.k !== not)
          .dataset.k,
      orig,
    );
    await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k1}"]`);
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.deepEqual(await mk(), [k1, k1]);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await mk(), [orig, null], 'its marker back, unpinned');
    assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1, 'still ticked');
    assert.deepEqual(errors, []);
  });
}
